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
  parseAutoEarningsCSV,
  computeSettlementMetrics
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
  users: [],
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

function isAdmin() {
  return String(api.session?.role || '').trim().toLowerCase() === 'admin';
}

function getScopedDeposits() {
  if (state.selectedDriver === 'ALL') return state.deposits;
  return state.deposits.filter(
    (d) => (d.username || d.driverName) === state.selectedDriver
  );
}

function getScopedEarnings() {
  if (!isAdmin()) {
    const myUser = String(api.session?.username || '').trim().toUpperCase();
    return state.earnings.filter(
      (r) => String(r.username || '').trim().toUpperCase() === myUser
    );
  }
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
    if (!isAdmin()) {
      showToast('Deposit to Bank is accessible to Admin only.', 'warning');
      switchTab('dashboard');
      return;
    }
    renderDeposits();
  } else if (tabId === 'approvals') {
    if (!isAdmin()) {
      showToast('Driver Approvals are accessible to Admin only.', 'warning');
      switchTab('dashboard');
      return;
    }
    renderApprovals();
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

  const adminMode = loggedIn && isAdmin();
  const fab = document.getElementById('gemini-fab');
  if (fab) fab.classList.toggle('hidden', !loggedIn);
  if (!loggedIn) document.getElementById('gemini-drawer')?.classList.add('hidden');

  [
    'driver-scope-select',
    'nav-admin-deposits',
    'mobile-nav-deposits',
    'dash-admin-deposit-btn',
    'nav-admin-approvals',
    'mobile-nav-approvals'
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('admin-only-hidden', !adminMode);
    el.classList.remove('hidden');
  });

  const pendingCount = (state.users || []).filter((u) => u.status === 'pending').length;
  const badge = document.getElementById('pending-approvals-badge');
  if (badge) {
    badge.textContent = String(pendingCount);
    badge.classList.toggle('hidden', !adminMode || pendingCount === 0);
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
  if (isAdmin()) {
    renderDeposits();
    renderApprovals();
  }
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

function updateDepositFormTotal() {
  const cash = safeNumber(document.getElementById('dep-cash')?.value);
  const online = safeNumber(document.getElementById('dep-online')?.value);
  const el = document.getElementById('dep-total-preview');
  if (el) el.textContent = formatINR(cash + online);
}

function resetDepositForm() {
  const dateEl = document.getElementById('dep-date');
  const drvEl = document.getElementById('dep-driver');
  const usrEl = document.getElementById('dep-username');
  const cashEl = document.getElementById('dep-cash');
  const onlEl = document.getElementById('dep-online');
  if (dateEl && !dateEl.value) dateEl.value = getTodayISO();
  if (drvEl && !drvEl.value && api.session?.name) drvEl.value = api.session.name;
  if (usrEl && !usrEl.value && api.session?.username) usrEl.value = api.session.username;
  if (cashEl) cashEl.value = '';
  if (onlEl) onlEl.value = '';
  updateDepositFormTotal();
}

function renderDeposits() {
  const scopedEarnings = getScopedEarnings();
  const scopedDeposits = getScopedDeposits();
  const settlement = computeSettlementMetrics(scopedEarnings, scopedDeposits);
  const t = settlement.totals;

  const kpiGrid = document.getElementById('settlement-kpi-grid');
  if (kpiGrid) {
    const cards = [
      {
        label: 'Total Remaining to Collect',
        val: formatINR(t.totalRemaining),
        sub: `Net Earned ${formatINR(t.netEarned)} − Deposited ${formatINR(t.totalDeposited)}`,
        color: t.totalRemaining > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
      },
      {
        label: 'Cash Remaining to Collect',
        val: formatINR(t.cashRemaining),
        sub: `Cash ${formatINR(t.cashEarned)} − Exp ${formatINR(t.expenses)} − Dep ${formatINR(t.cashDeposited)}`,
        color: t.cashRemaining > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
      },
      {
        label: 'Online Remaining to Collect',
        val: formatINR(t.onlineRemaining),
        sub: `Online ${formatINR(t.onlineEarned)} − Online Dep ${formatINR(t.onlineDeposited)}`,
        color: t.onlineRemaining > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-emerald-600 dark:text-emerald-400'
      },
      {
        label: 'Total Deposited to Bank',
        val: formatINR(t.totalDeposited),
        sub: `Cash ${formatINR(t.cashDeposited)} · Online ${formatINR(t.onlineDeposited)}`,
        color: 'text-emerald-600 dark:text-emerald-400'
      }
    ];
    kpiGrid.innerHTML = cards
      .map(
        (c) => `
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">${c.label}</span>
        <div class="mt-2 text-2xl font-extrabold ${c.color}">${c.val}</div>
        <div class="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate" title="${escapeHTML(c.sub)}">${escapeHTML(c.sub)}</div>
      </div>`
      )
      .join('');
  }

  const drvBody = document.getElementById('settlement-driver-body');
  if (drvBody) {
    if (!settlement.drivers.length) {
      drvBody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-sm text-slate-400">No driver settlement data available yet.</td></tr>`;
    } else {
      drvBody.innerHTML = settlement.drivers
        .map(
          (d) => `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
          <td class="py-3 px-4 font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">
            ${escapeHTML(d.driverName)} <span class="text-xs text-slate-400 font-normal">(${escapeHTML(d.username || '—')})</span>
          </td>
          <td class="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">${formatINR(d.netEarned)}</td>
          <td class="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap">${formatINR(d.totalDeposited)}</td>
          <td class="py-3 px-4 font-bold ${d.cashRemaining > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'} whitespace-nowrap">${formatINR(d.cashRemaining)}</td>
          <td class="py-3 px-4 font-bold ${d.onlineRemaining > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-emerald-600'} whitespace-nowrap">${formatINR(d.onlineRemaining)}</td>
          <td class="py-3 px-4 font-extrabold ${d.totalRemaining > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600'} whitespace-nowrap">${formatINR(d.totalRemaining)}</td>
          <td class="py-3 px-4 text-right whitespace-nowrap">
            <button type="button" data-prefill-driver="${escapeHTML(d.username || d.driverName)}"
              class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition">
              Deposit Now
            </button>
          </td>
        </tr>`
        )
        .join('');

      drvBody.querySelectorAll('[data-prefill-driver]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const target = settlement.drivers.find(
            (x) => (x.username || x.driverName) === btn.dataset.prefillDriver
          );
          if (!target) return;
          document.getElementById('dep-date').value = getTodayISO();
          document.getElementById('dep-driver').value = target.driverName;
          document.getElementById('dep-username').value = target.username;
          document.getElementById('dep-cash').value = Math.max(0, Math.round(target.cashRemaining));
          document.getElementById('dep-online').value = Math.max(0, Math.round(target.onlineRemaining));
          updateDepositFormTotal();
          document.getElementById('deposit-entry-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      });
    }
  }

  const tbody = document.getElementById('deposits-table-body');
  const sumEl = document.getElementById('deposits-total-badge');
  if (!tbody) return;
  const rows = [...scopedDeposits].sort((a, b) => b.depositDate.localeCompare(a.depositDate));
  const totalDep = rows.reduce((s, d) => s + d.totalDeposit, 0);
  if (sumEl) sumEl.textContent = `Total Deposited: ${formatINR(totalDep)}`;

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-10 text-center text-sm text-slate-400">
          No bank deposit records loaded yet.
        </td>
      </tr>`;
    return;
  }
  tbody.innerHTML = rows
    .map(
      (d) => `
    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
      <td class="py-3 px-4 font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">${formatDisplayDate(d.depositDate)}</td>
      <td class="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">${escapeHTML(d.driverName || '—')}</td>
      <td class="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">${formatINR(d.cashDeposit)}</td>
      <td class="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">${formatINR(d.onlineDeposit)}</td>
      <td class="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">${formatINR(d.totalDeposit)}</td>
      <td class="py-3 px-4 text-xs text-slate-400 whitespace-nowrap">${escapeHTML(d.createdAt || '—')}</td>
      <td class="py-3 px-4 text-right whitespace-nowrap">
        ${
          isAdmin()
            ? `<button type="button" data-del-dep="${d.id}" class="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline">Delete</button>`
            : '<span class="text-xs text-slate-400">—</span>'
        }
      </td>
    </tr>`
    )
    .join('');

  tbody.querySelectorAll('[data-del-dep]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dep = state.deposits.find((x) => x.id === btn.dataset.delDep);
      if (!dep) return;
      showConfirmModal({
        title: 'Delete Bank Deposit?',
        message: `Delete the ${formatDisplayDate(dep.depositDate)} deposit (${formatINR(dep.totalDeposit)}) for ${dep.driverName}?`,
        confirmLabel: 'Delete Deposit',
        onConfirm: async () => {
          setLoading(true, 'Deleting bank deposit…');
          try {
            await api.deleteDeposit(dep.rowNumber, dep.depositDate);
            showToast('Bank deposit deleted.', 'success');
            await syncFromBackend(true);
          } catch (err) {
            showToast(err.message || 'Failed to delete deposit.', 'error');
          } finally {
            setLoading(false);
          }
        }
      });
    });
  });
}

function renderApprovals() {
  const pendingList = document.getElementById('pending-drivers-list');
  const pendingCountLabel = document.getElementById('pending-count-label');
  const allBody = document.getElementById('all-users-table-body');
  if (!pendingList || !allBody) return;

  const users = state.users || [];
  const pending = users.filter((u) => u.status === 'pending');
  if (pendingCountLabel) pendingCountLabel.textContent = `${pending.length} pending`;

  if (!pending.length) {
    pendingList.innerHTML = `<div class="p-6 text-center text-sm text-slate-400">No pending driver registration requests right now.</div>`;
  } else {
    pendingList.innerHTML = pending
      .map(
        (u) => `
      <div class="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div class="space-y-1 text-sm">
          <div class="font-bold text-slate-900 dark:text-white">
            ${escapeHTML(u.name)} <span class="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">${escapeHTML(u.username)}</span>
          </div>
          <div class="text-xs text-slate-500 dark:text-slate-400">
            Phone: ${escapeHTML(u.phone || '—')} · PAN: ${escapeHTML(u.panNumber || '—')} · DOB: ${escapeHTML(u.dob || '—')} · Registered: ${escapeHTML(u.createdAt || '—')}
          </div>
          ${u.address ? `<div class="text-xs text-slate-500 dark:text-slate-400">Address: ${escapeHTML(u.address)}</div>` : ''}
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <input type="text" data-admin-note="${u.rowNumber}" placeholder="Admin note (optional)" class="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs w-44" />
          <button type="button" data-approve-row="${u.rowNumber}" data-approve-user="${escapeHTML(u.username)}" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">✓ Approve</button>
          <button type="button" data-reject-row="${u.rowNumber}" data-reject-user="${escapeHTML(u.username)}" class="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold">✕ Reject</button>
        </div>
      </div>`
      )
      .join('');
  }

  const badgeStyles = {
    active: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    pending: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    rejected: 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
  };

  if (!users.length) {
    allBody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-sm text-slate-400">No accounts loaded.</td></tr>`;
  } else {
    allBody.innerHTML = users
      .map(
        (u) => `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40">
        <td class="py-3 px-4 font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">${escapeHTML(u.name)}</td>
        <td class="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-300">${escapeHTML(u.username)}</td>
        <td class="py-3 px-4 text-xs uppercase font-semibold text-slate-500">${escapeHTML(u.role)}</td>
        <td class="py-3 px-4 text-xs text-slate-500 dark:text-slate-400">${escapeHTML(u.phone || '—')} / ${escapeHTML(u.panNumber || '—')}</td>
        <td class="py-3 px-4"><span class="px-2.5 py-1 rounded-full text-xs font-bold ${badgeStyles[u.status] || 'bg-slate-200 text-slate-600'}">${escapeHTML(u.status)}</span></td>
        <td class="py-3 px-4 text-xs text-slate-400 whitespace-nowrap">${escapeHTML(u.approvedAt || '—')}</td>
        <td class="py-3 px-4 text-right whitespace-nowrap">
          ${
            u.role === 'admin'
              ? '<span class="text-xs text-slate-400">Admin</span>'
              : u.status === 'active'
                ? `<button type="button" data-reject-row="${u.rowNumber}" data-reject-user="${escapeHTML(u.username)}" class="text-xs font-semibold text-rose-600 hover:underline">Revoke / Reject</button>`
                : `<button type="button" data-approve-row="${u.rowNumber}" data-approve-user="${escapeHTML(u.username)}" class="text-xs font-semibold text-emerald-600 hover:underline">Approve</button>`
          }
        </td>
      </tr>`
      )
      .join('');
  }

  const bindStatusAction = (selector, nextStatus) => {
    document.querySelectorAll(selector).forEach((btn) => {
      btn.addEventListener('click', async () => {
        const rowNumber = Number(btn.dataset.approveRow || btn.dataset.rejectRow);
        const username = btn.dataset.approveUser || btn.dataset.rejectUser;
        const noteInput = document.querySelector(`[data-admin-note="${rowNumber}"]`);
        const note = noteInput ? noteInput.value.trim() : '';
        btn.disabled = true;
        setLoading(true, nextStatus === 'active' ? 'Approving driver…' : 'Rejecting driver…');
        try {
          await api.updateDriverStatus(rowNumber, username, nextStatus, note);
          showToast(
            nextStatus === 'active' ? `Driver ${username} approved!` : `Driver ${username} rejected.`,
            nextStatus === 'active' ? 'success' : 'warning'
          );
          await syncFromBackend(true);
        } catch (err) {
          showToast(err.message || 'Failed to update driver status.', 'error');
        } finally {
          btn.disabled = false;
          setLoading(false);
        }
      });
    });
  };
  bindStatusAction('[data-approve-row]', 'active');
  bindStatusAction('[data-reject-row]', 'rejected');
}

async function handleDepositSubmit(e) {
  e.preventDefault();
  if (state.dataSourceMode === 'local_csv') {
    showToast('Local CSV mode is read-only. Sign in to record a live Bank Deposit.', 'warning');
    return;
  }
  const depositDate = document.getElementById('dep-date').value;
  const driverName = document.getElementById('dep-driver').value.trim();
  const username = document.getElementById('dep-username').value.trim();
  const cashDeposit = safeNumber(document.getElementById('dep-cash').value);
  const onlineDeposit = safeNumber(document.getElementById('dep-online').value);

  if (!depositDate || !driverName || !username) {
    showToast('Deposit Date, Driver Name, and Username are required.', 'error');
    return;
  }
  if (cashDeposit < 0 || onlineDeposit < 0 || cashDeposit + onlineDeposit <= 0) {
    showToast('Enter a positive Cash or Online deposit amount.', 'warning');
    return;
  }

  const btn = document.getElementById('dep-submit-btn');
  btn.disabled = true;
  setLoading(true, 'Recording Bank Deposit in Google Sheets…');
  try {
    await api.addDeposit({
      driverName,
      username,
      depositDate,
      cashDeposit,
      onlineDeposit,
      totalDeposit: cashDeposit + onlineDeposit
    });
    showToast(`Recorded ${formatINR(cashDeposit + onlineDeposit)} deposit to bank!`, 'success');
    document.getElementById('dep-cash').value = '';
    document.getElementById('dep-online').value = '';
    updateDepositFormTotal();
    await syncFromBackend(true);
  } catch (err) {
    showToast(err.message || 'Failed to record bank deposit.', 'error');
  } finally {
    btn.disabled = false;
    setLoading(false);
  }
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
  const drvInp = document.getElementById('entry-driver');
  const usrInp = document.getElementById('entry-username');
  drvInp.value = api.session?.name || '';
  usrInp.value = api.session?.username || '';
  const lockDriverFields = !isAdmin();
  drvInp.readOnly = lockDriverFields;
  usrInp.readOnly = lockDriverFields;
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
    state.users = Array.isArray(res.users) ? res.users : [];
    if (res.user && api.session) {
      api.setSession({
        ...api.session,
        username: res.user.username || api.session.username,
        name: res.user.name || api.session.name,
        role: String(res.user.role || api.session.role || 'user').trim().toLowerCase()
      });
    }
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
  resetDepositForm();
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
    state.users = [];
    showToast('Signed out.', 'info');
    renderAll();
  });

  // Auth tab toggle: Sign In vs Register Driver
  const tabLogin = document.getElementById('auth-tab-login');
  const tabReg = document.getElementById('auth-tab-register');
  const panelLogin = document.getElementById('auth-panel-login');
  const panelReg = document.getElementById('auth-panel-register');
  const panelForgot = document.getElementById('auth-panel-forgot');
  const switchAuthMode = (mode) => {
    panelLogin?.classList.toggle('hidden', mode !== 'login');
    panelReg?.classList.toggle('hidden', mode !== 'register');
    panelForgot?.classList.toggle('hidden', mode !== 'forgot');
    if (tabLogin && tabReg) {
      tabLogin.className = mode === 'login'
        ? 'py-2 rounded-lg bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
        : 'py-2 rounded-lg text-slate-600 dark:text-slate-300';
      tabReg.className = mode === 'register'
        ? 'py-2 rounded-lg bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
        : 'py-2 rounded-lg text-slate-600 dark:text-slate-300';
    }
  };
  tabLogin?.addEventListener('click', () => switchAuthMode('login'));
  tabReg?.addEventListener('click', () => switchAuthMode('register'));
  document.getElementById('open-forgot-btn')?.addEventListener('click', () => switchAuthMode('forgot'));
  document.getElementById('back-to-login-btn')?.addEventListener('click', () => switchAuthMode('login'));

  // Forgot Password submission
  document.getElementById('forgot-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fb = document.getElementById('forgot-feedback');
    const btn = document.getElementById('forgot-submit-btn');
    const newPassword = document.getElementById('fp-new-pass').value;
    const confirmPassword = document.getElementById('fp-confirm-pass').value;
    fb.classList.add('hidden');
    if (newPassword !== confirmPassword) {
      fb.className = 'text-xs p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800';
      fb.textContent = 'New Password and Confirm Password do not match.';
      fb.classList.remove('hidden');
      return;
    }
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = 'Verifying…';
    try {
      const res = await api.resetPassword({
        username: document.getElementById('fp-username').value.trim().toUpperCase(),
        phone: document.getElementById('fp-phone').value.trim(),
        panNumber: document.getElementById('fp-pan').value.trim().toUpperCase(),
        dob: document.getElementById('fp-dob').value,
        newPassword
      });
      fb.className = 'text-xs p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
      fb.textContent = res.message || 'Password reset successful! Sign in now.';
      fb.classList.remove('hidden');
      document.getElementById('forgot-form').reset();
      showToast('Password updated! Please sign in.', 'success');
    } catch (err) {
      fb.className = 'text-xs p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800';
      fb.textContent = err.message || 'Password reset failed.';
      fb.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  });

  // Gemini AI Chatbot widget
  const geminiFab = document.getElementById('gemini-fab');
  const geminiDrawer = document.getElementById('gemini-drawer');
  const geminiMsgs = document.getElementById('gemini-messages');
  geminiFab?.addEventListener('click', () => {
    geminiDrawer?.classList.toggle('hidden');
    document.getElementById('gemini-input')?.focus();
  });
  document.getElementById('gemini-close-btn')?.addEventListener('click', () => {
    geminiDrawer?.classList.add('hidden');
  });
  document.getElementById('gemini-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inp = document.getElementById('gemini-input');
    const sendBtn = document.getElementById('gemini-send-btn');
    const text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    const userBubble = document.createElement('div');
    userBubble.className = 'p-2.5 rounded-xl bg-indigo-600 text-white ml-8';
    userBubble.textContent = text;
    geminiMsgs.appendChild(userBubble);

    const botBubble = document.createElement('div');
    botBubble.className = 'p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 mr-6 whitespace-pre-wrap';
    botBubble.textContent = 'Thinking…';
    geminiMsgs.appendChild(botBubble);
    geminiMsgs.scrollTop = geminiMsgs.scrollHeight;

    sendBtn.disabled = true;
    try {
      const res = await api.askDealskart(text);
      botBubble.textContent = res.reply || 'No reply received.';
    } catch (err) {
      botBubble.className = 'p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 mr-6';
      let msg = err.message || 'Ask Dealskart is temporarily unavailable.';
      if (/Unsupported POST action/i.test(msg)) {
        msg = 'Apps Script deployment is still on an older version. Paste the latest apps-script/Code.gs, Save, then click Deploy → Manage deployments → Edit → Version: New version → Deploy.';
      }
      botBubble.textContent = msg;
    } finally {
      sendBtn.disabled = false;
      geminiMsgs.scrollTop = geminiMsgs.scrollHeight;
    }
  });

  // Register Driver submission
  document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fb = document.getElementById('register-feedback');
    const btn = document.getElementById('register-submit-btn');
    const driver = {
      name: document.getElementById('reg-name').value.trim(),
      username: document.getElementById('reg-username').value.trim().toUpperCase(),
      password: document.getElementById('reg-password').value,
      phone: document.getElementById('reg-phone').value.trim(),
      panNumber: document.getElementById('reg-pan').value.trim().toUpperCase(),
      dob: document.getElementById('reg-dob').value,
      address: document.getElementById('reg-address').value.trim()
    };
    fb.classList.add('hidden');
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = 'Submitting…';
    try {
      const res = await api.registerDriver(driver);
      fb.className = 'text-xs p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
      fb.textContent = res.message || 'Registration submitted! Waiting for Admin approval.';
      fb.classList.remove('hidden');
      document.getElementById('register-form').reset();
      showToast('Driver registration submitted for Admin approval!', 'success');
    } catch (err) {
      fb.className = 'text-xs p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800';
      fb.textContent = err.message || 'Registration failed.';
      fb.classList.remove('hidden');
      showToast(err.message || 'Registration failed.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  });

  // Deposit to Bank form bindings
  ['dep-cash', 'dep-online'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', updateDepositFormTotal);
  });
  document.getElementById('deposit-entry-form')?.addEventListener('submit', handleDepositSubmit);
  document.getElementById('dep-fill-cash-btn')?.addEventListener('click', () => {
    const s = computeSettlementMetrics(getScopedEarnings(), getScopedDeposits());
    document.getElementById('dep-cash').value = Math.max(0, Math.round(s.totals.cashRemaining));
    updateDepositFormTotal();
  });
  document.getElementById('dep-fill-online-btn')?.addEventListener('click', () => {
    const s = computeSettlementMetrics(getScopedEarnings(), getScopedDeposits());
    document.getElementById('dep-online').value = Math.max(0, Math.round(s.totals.onlineRemaining));
    updateDepositFormTotal();
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
