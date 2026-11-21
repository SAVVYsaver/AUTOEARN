/**
 * Dealskart – Auto Earning Tracker
 * Settings & Theme / Connection Status Panel
 */
import { APP_CONFIG } from './config.js';

export function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  try {
    localStorage.setItem(APP_CONFIG.STORAGE_KEYS.THEME, isDark ? 'dark' : 'light');
  } catch {}
  const toggleBtn = document.getElementById('theme-toggle-label');
  if (toggleBtn) toggleBtn.textContent = isDark ? 'Dark Mode' : 'Light Mode';
}

export function initTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.THEME);
  } catch {}
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
}

export function renderConnectionBadge(api, dataSourceMode) {
  const badges = document.querySelectorAll('[data-conn-badge]');
  const statusTextEl = document.getElementById('settings-conn-status');
  const lastSyncEl = document.getElementById('settings-last-sync');
  const errorBox = document.getElementById('settings-last-error');

  let label = 'Checking…';
  let cls = 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300';

  if (dataSourceMode === 'local_csv') {
    label = 'Local CSV Preview';
    cls = 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
  } else if (api.status === 'connected') {
    label = 'Connected (Live Sheet)';
    cls = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
  } else if (api.status === 'auth_required') {
    label = 'Login Required';
    cls = 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
  } else if (api.status === 'error') {
    label = 'Offline / Error';
    cls = 'bg-rose-500/15 text-rose-600 dark:text-rose-400';
  }

  badges.forEach((b) => {
    const responsive = b.dataset.mobileOnly === 'true' ? 'lg:hidden ' : '';
    b.className = `${responsive}inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`;
    b.textContent = label;
  });

  if (statusTextEl) statusTextEl.textContent = label;
  if (lastSyncEl) {
    lastSyncEl.textContent = api.lastSyncAt
      ? new Date(api.lastSyncAt).toLocaleString('en-IN')
      : 'Never synced';
  }
  if (errorBox) {
    if (api.lastError && dataSourceMode !== 'local_csv') {
      errorBox.classList.remove('hidden');
      errorBox.textContent = api.lastError;
    } else {
      errorBox.classList.add('hidden');
      errorBox.textContent = '';
    }
  }
}
