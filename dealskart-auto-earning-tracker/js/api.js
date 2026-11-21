/**
 * Dealskart – Auto Earning Tracker
 * Dedicated Google Apps Script Web App API Service Layer
 *
 * Handles:
 * - Centralized Web App URL management
 * - Google Apps Script 302 redirects & CORS-safe text/plain JSON POST payloads
 * - Session token propagation for auth-gated deployments
 * - Retries with backoff for transient network failures
 * - Explicit error propagation (never silently swallows errors)
 */
import { APP_CONFIG } from './config.js';

function safeStorageGet(key, fallback = null) {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? val : fallback;
  } catch {
    return fallback;
  }
}

function safeStorageSet(key, value) {
  try {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // Storage may be unavailable in restricted contexts
  }
}

export class ApiService {
  constructor() {
    this.baseUrl = safeStorageGet(
      APP_CONFIG.STORAGE_KEYS.WEB_APP_URL,
      APP_CONFIG.DEFAULT_WEB_APP_URL
    );
    this.session = this._loadSession();
    this.status = 'idle'; // idle | checking | connected | auth_required | error | local_csv
    this.lastSyncAt = null;
    this.lastError = null;
    this.inFlightWrites = new Set();
  }

  _loadSession() {
    try {
      const raw = safeStorageGet(APP_CONFIG.STORAGE_KEYS.SESSION);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  setSession(sessionObj) {
    this.session = sessionObj;
    safeStorageSet(
      APP_CONFIG.STORAGE_KEYS.SESSION,
      sessionObj ? JSON.stringify(sessionObj) : null
    );
  }

  clearSession() {
    this.setSession(null);
  }

  setBaseUrl(url) {
    const clean = (url || '').trim();
    if (!clean.startsWith('https://')) {
      throw new Error('Web App URL must start with https://');
    }
    this.baseUrl = clean;
    safeStorageSet(APP_CONFIG.STORAGE_KEYS.WEB_APP_URL, clean);
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  async _fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), APP_CONFIG.REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        ...options,
        redirect: 'follow',
        signal: controller.signal
      });
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          response.ok
            ? 'Backend returned non-JSON response. Ensure the Apps Script Web App returns JSON.'
            : `HTTP ${response.status}: Backend returned an unreadable response.`
        );
      }
      return { ok: response.ok, status: response.status, data };
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Request timed out while contacting Google Apps Script.');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async request(action, payload = {}, method = 'GET', allowRetry = true) {
    const maxAttempts = allowRetry && method === 'GET' ? APP_CONFIG.MAX_RETRIES + 1 : 1;
    let lastErr = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        let res;
        if (method === 'GET') {
          const params = new URLSearchParams();
          if (action) params.set('action', action);
          if (this.session?.token) params.set('token', this.session.token);
          if (this.session?.username) params.set('username', this.session.username);
          Object.entries(payload || {}).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
          });
          const sep = this.baseUrl.includes('?') ? '&' : '?';
          const url = params.toString() ? `${this.baseUrl}${sep}${params.toString()}` : this.baseUrl;
          res = await this._fetchWithTimeout(url, { method: 'GET' });
        } else {
          // Use text/plain to avoid CORS preflight OPTIONS failure on Google Apps Script
          const body = JSON.stringify({
            action,
            token: this.session?.token || '',
            sessionUsername: this.session?.username || '',
            ...payload
          });
          res = await this._fetchWithTimeout(this.baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body
          });
        }

        const json = res.data;
        if (json && json.ok === false) {
          const msg = json.message || 'Backend rejected the request.';
          if (/login required|unauthorized|session expired/i.test(msg)) {
            this.status = 'auth_required';
            this.lastError = msg;
            const authErr = new Error(msg);
            authErr.code = 'AUTH_REQUIRED';
            throw authErr;
          }
          this.lastError = msg;
          throw new Error(msg);
        }

        this.status = 'connected';
        this.lastError = null;
        this.lastSyncAt = new Date().toISOString();
        return json;
      } catch (err) {
        lastErr = err;
        if (err.code === 'AUTH_REQUIRED' || attempt === maxAttempts) {
          if (err.code !== 'AUTH_REQUIRED') {
            this.status = 'error';
            this.lastError = err.message || 'Network error';
          }
          throw err;
        }
        await new Promise((r) => setTimeout(r, 600 * attempt));
      }
    }
    throw lastErr;
  }

  async testConnection() {
    this.status = 'checking';
    try {
      const res = await this.request('health', {}, 'GET', false);
      return { ok: true, status: 'connected', data: res };
    } catch (err) {
      if (err.code === 'AUTH_REQUIRED') {
        return { ok: false, status: 'auth_required', message: err.message };
      }
      return { ok: false, status: 'error', message: err.message };
    }
  }

  async login(username, password) {
    const cleanUser = (username || '').trim();
    if (!cleanUser || !password) {
      throw new Error('Username and password are required.');
    }
    const res = await this.request(
      'login',
      { username: cleanUser, password },
      'POST',
      false
    );
    const token =
      res.token ||
      res.sessionToken ||
      res.authToken ||
      res.session?.token ||
      (res.ok ? 'authenticated' : '');
    if (!token) {
      throw new Error(res.message || 'Login succeeded without a session token.');
    }
    const session = {
      token,
      username: res.user?.username || res.username || cleanUser,
      name: res.user?.name || res.name || cleanUser,
      role: res.user?.role || res.role || 'user',
      loggedInAt: new Date().toISOString()
    };
    this.setSession(session);
    return session;
  }

  async logout() {
    try {
      if (this.session?.token) {
        await this.request('logout', {}, 'POST', false);
      }
    } catch {
      // Clear local session even if server logout fails
    } finally {
      this.clearSession();
    }
  }

  async fetchAllData() {
    return this.request('getEarnings', {}, 'GET', true);
  }

  async addEarning(entry) {
    const lockKey = `add:${entry.entryDate}:${entry.username || ''}`;
    if (this.inFlightWrites.has(lockKey)) {
      throw new Error('Submission already in progress for this date.');
    }
    this.inFlightWrites.add(lockKey);
    try {
      return await this.request('addEarning', { entry }, 'POST', false);
    } finally {
      this.inFlightWrites.delete(lockKey);
    }
  }

  async updateEarning(rowNumber, entry) {
    const lockKey = `update:${rowNumber}`;
    if (this.inFlightWrites.has(lockKey)) {
      throw new Error('Update already in progress for this record.');
    }
    this.inFlightWrites.add(lockKey);
    try {
      return await this.request('updateEarning', { rowNumber, entry }, 'POST', false);
    } finally {
      this.inFlightWrites.delete(lockKey);
    }
  }

  async deleteEarning(rowNumber, entryDate) {
    const lockKey = `delete:${rowNumber}`;
    if (this.inFlightWrites.has(lockKey)) {
      throw new Error('Delete already in progress.');
    }
    this.inFlightWrites.add(lockKey);
    try {
      return await this.request('deleteEarning', { rowNumber, entryDate }, 'POST', false);
    } finally {
      this.inFlightWrites.delete(lockKey);
    }
  }
}
