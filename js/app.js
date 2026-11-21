/**
 * Dealskart – Auto Earning Tracker
 * Main Application Controller
 */
import { APP_CONFIG } from './config.js';
import { ApiService } from './api.js';
import {
  normalizeEarningRecord,
  normalizeDepositRecord,
  formatINR,
  formatDisplayDate,
  getTodayISO,
  safeNumber,
  filterByTimeframe,
  computeAnalyticsHighlights,
  parseAutoEarningsCSV
} from './data.js';
import { renderDashboard } from './dashboard.js';
import { ChartsManager } from './charts.js';
import { CalendarView } from './calendar.js';
import { showToast, showConfirmModal, escapeHTML } from './components.js';
import { initTheme, applyTheme, renderConnectionBadge } from './settings.js';

const api = new ApiService();
const charts = new ChartsManager();

const state = {
  activeTab: 'dashboard',
  earnings: [],
  deposits: [],
  dataSourceMode: 'live', // 'live' | 'local_csv'
  selectedDriver: 'ALL',
  analyticsRange: '30d',
  editingRowNumber: null,
  historyPage: 1,
  historyFilters: {
    search: '',
    month: '',
    year: '',
    minAmount: '',
    maxAmount: ''
  }
};

const calendar = new CalendarView({
  onEditRecord: (rec) => openRecordForEdit(rec),
  onAddForDate: (dateStr) => {
    resetEntryForm(dateStr);
    switchTab('entry');
  }
});

function getScopedEarnings() {
  if (state.selectedDriver === 'ALL') return state.earnings;
  return state.earnings.filter(
    (r) => (r.username || r.driverName) === state.selectedDriver
  );
}

function setLoading(isLoading, message = 'Syncing with Google Sheets…') {
  const bar = document.getElementById('global-loader');
  const txt = document.getElementById('global-loader-text');
  if (txt) txt.textContent = message;
  if (bar) bar.classList.toggle('hidden', !isLoading);
}

function switchTab(tabId) {
  if (!isAuthenticated()) {
    enforceAuthGate();
    showToast('Please sign in first to continue.', 'warning');
    return;
  }
  state.activeTab = tabId;
  document.querySelectorAll('[data-view]').forEach((sec) => {
    sec.classList.toggle('hidden', sec.dataset.view !== tabId);
  });
  document.querySelectorAll('[data-nav]').forEach((btn) => {
    const active = btn.dataset.nav === tabId;
    btn.classList.toggle('nav-active', active);
  });
  if (tabId === 'analytics') {
    renderAnalytics();
  } else if (tabId === 'calendar') {
    calendar.render(getScopedEarnings());
  } else if (tabId === 'history') {
    renderHistory();
  } else if (tabId === 'deposits') {
    renderDeposits();
  }
}

function populateDriverAndYearFilters() {
  const driverSelect = document.getElementById('driver-scope-select');
  if (driverSelect) {
    const drivers = Array.from(
      new Set(state.earnings.map((r) => r.username || r.driverName).filter(Boolean))
    ).sort();
    const cur = state.selectedDriver;
    driverSelect.innerHTML =
      `<option value="ALL">All Drivers (${drivers.length})</option>` +
      drivers.map((d) => `<option value="${escapeHTML(d)}">${escapeHTML(d)}</option>`).join('');
    driverSelect.value = drivers.includes(cur) ? cur : 'ALL';
    state.selectedDriver = driverSelect.value;
  }

  const yearSelect = document.getElementById('hist-year');
  if (yearSelect) {
    const years = Array.from(
      new Set(state.earnings.map((r) => r.entryDate?.slice(0, 4)).filter(Boolean))
    ).sort((a, b) => b.localeCompare(a));
    const curY = state.historyFilters.year;
    yearSelect.innerHTML =
      `<option value="">All Years</option>` +
      years.map((y) => `<option value="${y}">${y}</option>`).join('');
    yearSelect.value = years.includes(curY) ? curY : '';
  }
}

function isAuthenticated() {
  return Boolean(api.session && api.session.username && api.session.token);
}

function enforceAuthGate() {
  const loggedIn = isAuthenticated();
  const appShell = document.getElementById('app-shell');
  const mobileNav = document.getElementById('mobile-bottom-nav');
  const loginModal = document.getElementById('login-modal');
  const closeBtn = document.getElementById('login-modal-close');

  if (appShell) appShell.classList.toggle('hidden', !loggedIn);
  if (mobileNav) mobileNav.classList.toggle('hidden', !loggedIn);
  if (loginModal) loginModal.classList.toggle('hidden', loggedIn);
  if (closeBtn) closeBtn.classList.toggle('hidden', !loggedIn);
  return loggedIn;
}

function renderSessionUI() {
  const loggedIn = enforceAuthGate();
  const userPill = document.getElementById('session-user-pill');
  const loginTrigger = document.getElementById('open-login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const authBanner = document.getElementById('auth-required-banner');

  if (loggedIn) {
    if (userPill) {
      userPill.classList.remove('hidden');
      userPill.textContent = `${api.session.name || api.session.username} (${api.session.role})`;
    }
    if (loginTrigger) loginTrigger.classList.add('hidden');
    if (logoutBtn) logoutBtn.classList.remove('hidden');
  } else {
    if (userPill) userPill.classList.add('hidden');
    if (loginTrigger) loginTrigger.classList.remove('hidden');
    if (logoutBtn) logoutBtn.classList.add('hidden');
  }

  if (authBanner) {
    const showAuthBanner =
      loggedIn && state.dataSourceMode === 'live' && api.status === 'auth_required';
    authBanner.classList.toggle('hidden', !showAuthBanner);
  }
}

function renderAll() {
  populateDriverAndYearFilters();
  renderSessionUI();
  renderConnectionBadge(api, state.dataSourceMode);
  const scoped = getScopedEarnings();
  renderDashboard(scoped, { onQuickEdit: openRecordForEdit });
  renderHistory();
  if (state.activeTab === 'analytics') renderAnalytics();
  if (state.activeTab === 'calendar') calendar.render(scoped);
  renderDeposits();
  checkDuplicateDateWarning();
}

function renderAnalytics() {
  const scoped = getScopedEarnings();
  const filtered = filterByTimeframe(scoped, state.analyticsRange);
  const hi = computeAnalyticsHighlights(scoped, filtered);

  const bestEl = document.getElementById('stat-best-day');
  const bestDateEl = document.getElementById('stat-best-day-date');
  const lowEl = document.getElementById('stat-low-day');
  const lowDateEl = document.getElementById('stat-low-day-date');
  const avgEl = document.getElementById('stat-avg-daily');
  const growthEl = document.getElementById('stat-monthly-growth');
  const growthSubEl = document.getElementById('stat-monthly-growth-sub');

  if (bestEl) bestEl.textContent = hi.bestDay ? formatINR(hi.bestDay.earnings) : '—';
  if (bestDateEl) bestDateEl.textContent = hi.bestDay ? formatDisplayDate(hi.bestDay.date) : 'No data in range';
  if (lowEl) lowEl.textContent = hi.lowestDay ? formatINR(hi.lowestDay.earnings) : '—';
  if (lowDateEl) lowDateEl.textContent = hi.lowestDay ? formatDisplayDate(hi.lowestDay.date) : 'No data in range';
  if (avgEl) avgEl.textContent = formatINR(hi.avgDaily);

  if (growthEl) {
    if (hi.monthlyGrowthPct === null) {
      growthEl.textContent = '—';
      growthEl.className = 'text-2xl font-extrabold text-slate-700 dark:text-slate-200 mt-1';
    } else {
      const sign = hi.monthlyGrowthPct >= 0 ? '+' : '';
      growthEl.textContent = `${sign}${hi.monthlyGrowthPct.toFixed(1)}%`;
      growthEl.className = `text-2xl font-extrabold mt-1 ${
        hi.monthlyGrowthPct >= 0
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-rose-600 dark:text-rose-400'
      }`;
    }
  }
  if (growthSubEl) {
    growthSubEl.textContent = `This month ${formatINR(hi.thisMonthSum)} vs prev ${formatINR(hi.prevMonthSum)}`;
  }

  document.querySelectorAll('[data-range-btn]').forEach((b) => {
    const active = b.dataset.rangeBtn === state.analyticsRange;
    b.classList.toggle('bg-indigo-600', active);
    b.classList.toggle('text-white', active);
    b.classList.toggle('bg-white', !active);
    b.classList.toggle('dark:bg-slate-800', !active);
  });

  charts.renderAll(filtered, scoped);
}

function getFilteredHistory() {
  const { search, month, year, minAmount, maxAmount } = state.historyFilters;
  const q = search.trim().toLowerCase();
  const minVal = minAmount !== '' ? Number(minAmount) : null;
  const maxVal = maxAmount !== '' ? Number(maxAmount) : null;

  return getScopedEarnings()
    .filter((r) => {
      if (q) {
        const hay = `${r.entryDate} ${r.driverName} ${r.username} ${r.expenseReason}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (month && r.entryDate.slice(5, 7) !== month) return false;
      if (year && r.entryDate.slice(0, 4) !== year) return false;
      if (minVal !== null && Number.isFinite(minVal) && r.totalEarning < minVal) return false;
      if (maxVal !== null && Number.isFinite(maxVal) && r.totalEarning > maxVal) return false;
      return true;
    })
    .sort((a, b) => b.entryDate.localeCompare(a.entryDate));
}

function renderHistory() {
  const filtered = getFilteredHistory();
  const totalEarn = filtered.reduce((s, r) => s + r.totalEarning, 0);
  const totalExp = filtered.reduce((s, r) => s + r.expenseAmount, 0);

  const summaryEl = document.getElementById('hist-period-summary');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <span class="font-semibold text-slate-700 dark:text-slate-200">${filtered.length} records</span>
      <span class="text-slate-300 dark:text-slate-600">·</span>
      <span class="font-bold text-emerald-600 dark:text-emerald-400">Earnings: ${formatINR(totalEarn)}</span>
      <span class="text-slate-300 dark:text-slate-600">·</span>
      <span class="font-semibold text-rose-500">Expenses: ${formatINR(totalExp)}</span>
      <span class="text-slate-300 dark:text-slate-600">·</span>
      <span class="font-bold text-indigo-600 dark:text-indigo-400">Net: ${formatINR(totalEarn - totalExp)}</span>
    `;
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / APP_CONFIG.PAGE_SIZE));
  if (state.historyPage > totalPages) state.historyPage = totalPages;
  const start = (state.historyPage - 1) * APP_CONFIG.PAGE_SIZE;
  const pageRows = filtered.slice(start, start + APP_CONFIG.PAGE_SIZE);

  const tbody = document.getElementById('history-table-body');
  if (tbody) {
    if (!pageRows.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="py-10 text-center text-sm text-slate-400">
            No matching earning records found.
          </td>
        </tr>`;
    } else {
      tbody.innerHTML = pageRows
        .map(
          (r) => `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
          <td class="py-3 px-4 font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">${formatDisplayDate(r.entryDate)}</td>
          <td class="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">${escapeHTML(r.driverName || '—')}</td>
          <td class="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">${formatINR(r.cashEarning)}</td>
          <td class="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">${formatINR(r.onlineEarning)}</td>
          <td class="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">${formatINR(r.totalEarning)}</td>
          <td class="py-3 px-4 text-rose-500 whitespace-nowrap">${formatINR(r.expenseAmount)}</td>
          <td class="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">${formatINR(r.netProfit)}</td>
          <td class="py-3 px-4 text-xs text-slate-500 dark:text-slate-400 max-w-[180px] truncate" title="${escapeHTML(r.expenseReason)}">${escapeHTML(r.expenseReason || '—')}</td>
          <td class="py-3 px-4 text-right whitespace-nowrap">
            <button type="button" data-hist-edit="${r.id}" class="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline mr-3">Edit</button>
            <button type="button" data-hist-del="${r.id}" class="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline">Delete</button>
          </td>
        </tr>`
        )
        .join('');

      tbody.querySelectorAll('[data-hist-edit]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const rec = state.earnings.find((x) => x.id === btn.dataset.histEdit);
          if (rec) openRecordForEdit(rec);
        });
      });

      tbody.querySelectorAll('[data-hist-del]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const rec = state.earnings.find((x) => x.id === btn.dataset.histDel);
          if (!rec) return;
          showConfirmModal({
            title: 'Delete Earning Record?',
            message: `This will permanently delete the ${formatDisplayDate(rec.entryDate)} record (${formatINR(rec.totalEarning)}) from your Google Sheet.`,
            confirmLabel: 'Delete Record',
            onConfirm: () => handleDeleteRecord(rec)
          });
        });
      });
    }
  }

  const pageInfo = document.getElementById('hist-page-info');
  const prevBtn = document.getElementById('hist-prev-btn');
  const nextBtn = document.getElementById('hist-next-btn');
  if (pageInfo) pageInfo.textContent = `Page ${state.historyPage} of ${totalPages}`;
  if (prevBtn) prevBtn.disabled = state.historyPage <= 1;
  if (nextBtn) nextBtn.disabled = state.historyPage >= totalPages;
}

function renderDeposits() {
  const tbody = document.getElementById('deposits-table-body');
  const sumEl = document.getElementById('deposits-total-badge');
  if (!tbody) return;
  const rows = [...state.deposits].sort((a, b) => b.depositDate.localeCompare(a.depositDate));
  const totalDep = rows.reduce((s, d) => s + d.totalDeposit, 0);
  if (sumEl) sumEl.textContent = `Total Deposited: ${formatINR(totalDep)}`;

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-10 text-center text-sm text-slate-400">
          No bank deposit records loaded yet.
        </td>
      </tr>`;
    return;
  }
  tbody.innerHTML = rows
    .map(
      (d) => `
    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
      <td class="py-3 px-4 font-semibold text-slate-800 dark:text-slate-100">${formatDisplayDate(d.depositDate)}</td>
      <td class="py-3 px-4 text-slate-600 dark:text-slate-300">${escapeHTML(d.driverName || '—')}</td>
      <td class="py-3 px-4 text-slate-600 dark:text-slate-300">${formatINR(d.cashDeposit)}</td>
      <td class="py-3 px-4 text-slate-600 dark:text-slate-300">${formatINR(d.onlineDeposit)}</td>
      <td class="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">${formatINR(d.totalDeposit)}</td>
      <td class="py-3 px-4 text-xs text-slate-400">${escapeHTML(d.createdAt || '—')}</td>
    </tr>`
    )
    .join('');
}

function updateEntryFormTotals() {
  const cash = safeNumber(document.getElementById('entry-cash')?.value);
  const online = safeNumber(document.getElementById('entry-online')?.value);
  const exp = safeNumber(document.getElementById('entry-expense')?.value);
  const total = cash + online;
  const net = total - exp;

  const totalEl = document.getElementById('entry-total-preview');
  const netEl = document.getElementById('entry-net-preview');
  if (totalEl) totalEl.textContent = formatINR(total);
  if (netEl) {
    netEl.textContent = formatINR(net);
    netEl.className = `text-xl font-extrabold ${
      net >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'
    }`;
  }
}

function checkDuplicateDateWarning() {
  const dateVal = document.getElementById('entry-date')?.value;
  const userVal = (document.getElementById('entry-username')?.value || '').trim().toUpperCase();
  const warnBox = document.getElementById('duplicate-date-warning');
  if (!warnBox || !dateVal) return;

  if (state.editingRowNumber !== null) {
    warnBox.classList.add('hidden');
    return;
  }

  const dup = state.earnings.find(
    (r) =>
      r.entryDate === dateVal &&
      (!userVal || r.username.toUpperCase() === userVal)
  );
  if (dup) {
    warnBox.classList.remove('hidden');
    warnBox.dataset.dupId = dup.id;
  } else {
    warnBox.classList.add('hidden');
    delete warnBox.dataset.dupId;
  }
}

function resetEntryForm(prefillDate = getTodayISO()) {
  state.editingRowNumber = null;
  document.getElementById('entry-form-title').textContent = 'Add Daily Earning';
  document.getElementById('entry-submit-btn').textContent = 'Save to Google Sheet';
  document.getElementById('entry-cancel-edit').classList.add('hidden');

  document.getElementById('entry-date').value = prefillDate;
  document.getElementById('entry-driver').value = api.session?.name || '';
  document.getElementById('entry-username').value = api.session?.username || '';
  document.getElementById('entry-cash').value = '';
  document.getElementById('entry-online').value = '';
  document.getElementById('entry-expense').value = '';
  document.getElementById('entry-reason').value = '';

  updateEntryFormTotals();
  checkDuplicateDateWarning();
}

function openRecordForEdit(rec) {
  state.editingRowNumber = rec.rowNumber;
  document.getElementById('entry-form-title').textContent = `Edit Entry (${formatDisplayDate(rec.entryDate)})`;
  document.getElementById('entry-submit-btn').textContent = 'Update Google Sheet';
  document.getElementById('entry-cancel-edit').classList.remove('hidden');

  document.getElementById('entry-date').value = rec.entryDate;
  document.getElementById('entry-driver').value = rec.driverName;
  document.getElementById('entry-username').value = rec.username;
  document.getElementById('entry-cash').value = rec.cashEarning;
  document.getElementById('entry-online').value = rec.onlineEarning;
  document.getElementById('entry-expense').value = rec.expenseAmount;
  document.getElementById('entry-reason').value = rec.expenseReason;

  updateEntryFormTotals();
  checkDuplicateDateWarning();
  switchTab('entry');
}

async function syncFromBackend(silent = false) {
  state.dataSourceMode = 'live';
  setLoading(true, 'Syncing with Google Sheets…');
  try {
    const res = await api.fetchAllData();
    const rawEarnings = Array.isArray(res.earnings)
      ? res.earnings
      : Array.isArray(res.data)
        ? res.data
        : [];
    const rawDeposits = Array.isArray(res.deposits) ? res.deposits : [];
    state.earnings = rawEarnings
      .map((r, i) => normalizeEarningRecord(r, i))
      .filter((r) => r.entryDate);
    state.deposits = rawDeposits
      .map((d, i) => normalizeDepositRecord(d, i))
      .filter((d) => d.depositDate);
    if (!silent) {
      showToast(`Synced ${state.earnings.length} earning records from Google Sheets.`, 'success');
    }
  } catch (err) {
    if (err.code === 'AUTH_REQUIRED') {
      api.clearSession();
      state.earnings = [];
      state.deposits = [];
      if (!silent) showToast('Session expired. Please sign in again.', 'warning');
    } else {
      showToast(err.message || 'Unable to reach Google Sheets backend.', 'error');
    }
  } finally {
    setLoading(false);
    renderAll();
  }
}

async function handleEntrySubmit(e) {
  e.preventDefault();
  if (state.dataSourceMode === 'local_csv') {
    showToast('Local CSV mode is read-only. Connect to your live Google Sheet to save changes.', 'warning');
    return;
  }

  const entryDate = document.getElementById('entry-date').value;
  const driverName = document.getElementById('entry-driver').value.trim();
  const username = document.getElementById('entry-username').value.trim();
  const cashEarning = safeNumber(document.getElementById('entry-cash').value);
  const onlineEarning = safeNumber(document.getElementById('entry-online').value);
  const expenseAmount = safeNumber(document.getElementById('entry-expense').value);
  const expenseReason = document.getElementById('entry-reason').value.trim();

  if (!entryDate) {
    showToast('Please select a valid Entry Date.', 'error');
    return;
  }
  if (cashEarning < 0 || onlineEarning < 0 || expenseAmount < 0) {
    showToast('Amounts cannot be negative.', 'error');
    return;
  }
  if (cashEarning + onlineEarning === 0 && expenseAmount === 0) {
    showToast('Enter at least one earning or expense amount.', 'warning');
    return;
  }

  const payload = {
    driverName: driverName || api.session?.name || '',
    username: username || api.session?.username || '',
    entryDate,
    cashEarning,
    onlineEarning,
    totalEarning: cashEarning + onlineEarning,
    expenseAmount,
    expenseReason,
    balance: cashEarning + onlineEarning - expenseAmount
  };

  const submitBtn = document.getElementById('entry-submit-btn');
  submitBtn.disabled = true;
  setLoading(true, state.editingRowNumber ? 'Updating record in Google Sheets…' : 'Saving record to Google Sheets…');

  try {
    if (state.editingRowNumber !== null) {
      await api.updateEarning(state.editingRowNumber, payload);
      showToast('Record updated in Google Sheets.', 'success');
    } else {
      await api.addEarning(payload);
      showToast('Daily earning saved to Google Sheets.', 'success');
    }
    resetEntryForm();
    await syncFromBackend(true);
    switchTab('dashboard');
  } catch (err) {
    showToast(err.message || 'Failed to save record.', 'error');
  } finally {
    submitBtn.disabled = false;
    setLoading(false);
    renderConnectionBadge(api, state.dataSourceMode);
  }
}

async function handleDeleteRecord(rec) {
  if (state.dataSourceMode === 'local_csv') {
    showToast('Local CSV mode is read-only. Sign in to delete from Google Sheets.', 'warning');
    return;
  }
  setLoading(true, 'Deleting record from Google Sheets…');
  try {
    await api.deleteEarning(rec.rowNumber, rec.entryDate);
    showToast('Record deleted from Google Sheets.', 'success');
    await syncFromBackend(true);
  } catch (err) {
    showToast(err.message || 'Failed to delete record.', 'error');
  } finally {
    setLoading(false);
  }
}

function exportFilteredHistoryCSV() {
  const rows = getFilteredHistory();
  if (!rows.length) {
    showToast('No records to export.', 'warning');
    return;
  }
  const headers = APP_CONFIG.SHEET_SCHEMA.AUTO_EARNINGS;
  const csvLines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        r.driverName,
        r.username,
        r.entryDate,
        r.cashEarning,
        r.onlineEarning,
        r.totalEarning,
        r.expenseAmount,
        r.expenseReason,
        r.balance,
        r.createdAt
      ]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',')
    )
  ];
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dealskart-auto-earnings-${getTodayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function bindEvents() {
  // Navigation
  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.nav));
  });

  // Theme toggle
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
      applyTheme(next);
      if (state.activeTab === 'analytics') renderAnalytics();
    });
  });

  // Refresh
  document.querySelectorAll('[data-refresh-btn]').forEach((btn) => {
    btn.addEventListener('click', () => syncFromBackend(false));
  });

  // Driver scope selector
  document.getElementById('driver-scope-select')?.addEventListener('change', (e) => {
    state.selectedDriver = e.target.value;
    state.historyPage = 1;
    renderAll();
  });

  // Entry form
  ['entry-cash', 'entry-online', 'entry-expense'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', updateEntryFormTotals);
  });
  ['entry-date', 'entry-username'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', checkDuplicateDateWarning);
  });
  document.getElementById('load-duplicate-btn')?.addEventListener('click', () => {
    const dupId = document.getElementById('duplicate-date-warning')?.dataset.dupId;
    const rec = state.earnings.find((r) => r.id === dupId);
    if (rec) openRecordForEdit(rec);
  });
  document.getElementById('entry-cancel-edit')?.addEventListener('click', () => resetEntryForm());
  document.getElementById('earning-entry-form')?.addEventListener('submit', handleEntrySubmit);

  // History filters
  document.getElementById('hist-search')?.addEventListener('input', (e) => {
    state.historyFilters.search = e.target.value;
    state.historyPage = 1;
    renderHistory();
  });
  document.getElementById('hist-month')?.addEventListener('change', (e) => {
    state.historyFilters.month = e.target.value;
    state.historyPage = 1;
    renderHistory();
  });
  document.getElementById('hist-year')?.addEventListener('change', (e) => {
    state.historyFilters.year = e.target.value;
    state.historyPage = 1;
    renderHistory();
  });
  document.getElementById('hist-min')?.addEventListener('input', (e) => {
    state.historyFilters.minAmount = e.target.value;
    state.historyPage = 1;
    renderHistory();
  });
  document.getElementById('hist-max')?.addEventListener('input', (e) => {
    state.historyFilters.maxAmount = e.target.value;
    state.historyPage = 1;
    renderHistory();
  });
  document.getElementById('hist-reset-btn')?.addEventListener('click', () => {
    state.historyFilters = { search: '', month: '', year: '', minAmount: '', maxAmount: '' };
    state.historyPage = 1;
    ['hist-search', 'hist-month', 'hist-year', 'hist-min', 'hist-max'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    renderHistory();
  });
  document.getElementById('hist-prev-btn')?.addEventListener('click', () => {
    if (state.historyPage > 1) {
      state.historyPage--;
      renderHistory();
    }
  });
  document.getElementById('hist-next-btn')?.addEventListener('click', () => {
    state.historyPage++;
    renderHistory();
  });
  document.getElementById('hist-export-btn')?.addEventListener('click', exportFilteredHistoryCSV);

  // Analytics range buttons
  document.querySelectorAll('[data-range-btn]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.analyticsRange = btn.dataset.rangeBtn;
      renderAnalytics();
    });
  });

  // Calendar controls
  document.getElementById('cal-prev-btn')?.addEventListener('click', () => {
    calendar.prevMonth();
    calendar.render(getScopedEarnings());
  });
  document.getElementById('cal-next-btn')?.addEventListener('click', () => {
    calendar.nextMonth();
    calendar.render(getScopedEarnings());
  });
  document.getElementById('cal-today-btn')?.addEventListener('click', () => {
    calendar.goToday();
    calendar.render(getScopedEarnings());
  });

  // Login modal
  const loginModal = document.getElementById('login-modal');
  document.querySelectorAll('[data-open-login]').forEach((btn) => {
    btn.addEventListener('click', () => loginModal?.classList.remove('hidden'));
  });
  document.getElementById('login-modal-close')?.addEventListener('click', () => {
    if (isAuthenticated()) {
      loginModal?.classList.add('hidden');
    } else {
      showToast('Please sign in first to access Dealskart.', 'warning');
    }
  });
  loginModal?.addEventListener('click', (e) => {
    if (e.target === loginModal && !isAuthenticated()) {
      showToast('Please sign in first to access Dealskart.', 'warning');
      document.getElementById('login-username')?.focus();
    }
  });
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    const btn = document.getElementById('login-submit-btn');
    errEl.classList.add('hidden');
    btn.disabled = true;
    const origLabel = btn.textContent;
    btn.textContent = 'Signing in…';
    try {
      await api.login(u, p);
      document.getElementById('login-password').value = '';
      enforceAuthGate();
      renderSessionUI();
      switchTab('dashboard');
      showToast(`Welcome back, ${api.session.name || api.session.username}.`, 'success');
      await syncFromBackend(false);
    } catch (err) {
      let msg = err.message || 'Login failed.';
      if (/login required/i.test(msg)) {
        msg = 'Backend returned "Login required." on login. Please update apps-script/Code.gs in your Google Sheet Apps Script and deploy a New Version under Manage Deployments.';
      } else if (/failed to fetch|networkerror/i.test(msg)) {
        msg = 'Could not reach the Google Apps Script Web App. Check your internet connection and verify Web App access is set to "Anyone" in Deploy → Manage Deployments.';
      }
      errEl.textContent = msg;
      errEl.classList.remove('hidden');
      showToast(msg, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = origLabel;
      renderSessionUI();
      renderConnectionBadge(api, state.dataSourceMode);
    }
  });

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await api.logout();
    state.earnings = [];
    state.deposits = [];
    showToast('Signed out.', 'info');
    renderAll();
  });

  // Settings: Web App URL & Test Connection
  const urlInput = document.getElementById('settings-webapp-url');
  if (urlInput) urlInput.value = api.getBaseUrl();

  document.getElementById('settings-save-url-btn')?.addEventListener('click', () => {
    try {
      api.setBaseUrl(urlInput.value);
      showToast('Backend Web App URL saved.', 'success');
      syncFromBackend(false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('settings-test-conn-btn')?.addEventListener('click', async () => {
    setLoading(true, 'Testing Google Apps Script connection…');
    const result = await api.testConnection();
    setLoading(false);
    renderConnectionBadge(api, state.dataSourceMode);
    if (result.ok) {
      showToast('Backend connection verified!', 'success');
    } else if (result.status === 'auth_required') {
      showToast('Endpoint reachable — sign in required to read data.', 'warning');
    } else {
      showToast(result.message || 'Connection test failed.', 'error');
    }
  });

  // Settings: Local CSV sheet import (read-only offline inspection of real exported sheet)
  document.getElementById('csv-import-input')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseAutoEarningsCSV(String(reader.result || ''));
      if (!parsed.length) {
        showToast('Could not find valid rows matching "Auto Earnings" columns in that CSV.', 'error');
        return;
      }
      state.earnings = parsed;
      state.dataSourceMode = 'local_csv';
      showToast(`Loaded ${parsed.length} records from ${file.name} (read-only preview).`, 'success');
      renderAll();
      switchTab('dashboard');
    };
    reader.readAsText(file);
  });
}

function bootstrap() {
  initTheme();
  bindEvents();
  resetEntryForm();
  renderSessionUI();
  if (isAuthenticated()) {
    switchTab('dashboard');
    syncFromBackend(true);
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
