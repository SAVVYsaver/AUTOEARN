/**
 * Dealskart – Auto Earning Tracker
 * Dashboard KPI Renderer (All 10 Mandatory Metrics)
 */
import { computeDashboardMetrics, formatINR, formatIndianNumber, formatDisplayDate } from './data.js';
import { escapeHTML } from './components.js';

export function renderDashboard(records, { onQuickEdit }) {
  const m = computeDashboardMetrics(records);

  const kpis = [
    { label: "Today's Total Earnings", value: formatINR(m.todayEarnings), accent: 'emerald', sub: 'Cash + Online today' },
    { label: "Today's Total Expenses", value: formatINR(m.todayExpenses), accent: 'rose', sub: 'Logged expenses today' },
    { label: "Today's Net Profit", value: formatINR(m.todayNetProfit), accent: m.todayNetProfit >= 0 ? 'indigo' : 'rose', sub: 'Earnings − Expenses' },
    { label: 'Total Monthly Earnings', value: formatINR(m.monthlyEarnings), accent: 'emerald', sub: 'Current calendar month' },
    { label: 'Total Monthly Expenses', value: formatINR(m.monthlyExpenses), accent: 'rose', sub: 'Current calendar month' },
    { label: 'Monthly Net Profit', value: formatINR(m.monthlyNetProfit), accent: m.monthlyNetProfit >= 0 ? 'indigo' : 'rose', sub: 'Monthly net margin' },
    { label: "Last 7 Days' Earnings", value: formatINR(m.last7DaysEarnings), accent: 'teal', sub: `Net: ${formatINR(m.last7DaysNetProfit)}` },
    { label: 'Total Lifetime Earnings', value: formatINR(m.lifetimeEarnings), accent: 'amber', sub: `Cash ${formatINR(m.lifetimeCash)} · Online ${formatINR(m.lifetimeOnline)}` },
    { label: 'Total Working Days', value: formatIndianNumber(m.workingDays), accent: 'slate', sub: 'Unique recorded dates' },
    { label: 'Average Daily Earnings', value: formatINR(m.averageDailyEarnings), accent: 'indigo', sub: 'Lifetime ÷ Working Days' }
  ];

  const accentMap = {
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
    rose: 'text-rose-600 dark:text-rose-400 bg-rose-500/10',
    indigo: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10',
    teal: 'text-teal-600 dark:text-teal-400 bg-teal-500/10',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
    slate: 'text-slate-700 dark:text-slate-300 bg-slate-500/10'
  };

  const grid = document.getElementById('dashboard-kpi-grid');
  if (grid) {
    grid.innerHTML = kpis
      .map(
        (k) => `
      <div class="kpi-card bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">${k.label}</span>
          <span class="w-2.5 h-2.5 rounded-full ${accentMap[k.accent].split(' ')[0].replace('text-', 'bg-')}"></span>
        </div>
        <div class="mt-2 text-2xl sm:text-[1.65rem] font-extrabold tracking-tight text-slate-900 dark:text-white">${k.value}</div>
        <div class="mt-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">${k.sub}</div>
      </div>`
      )
      .join('');
  }

  // Recent 5 records table
  const recentBody = document.getElementById('dashboard-recent-body');
  if (recentBody) {
    const sorted = [...records].sort((a, b) => b.entryDate.localeCompare(a.entryDate)).slice(0, 6);
    if (!sorted.length) {
      recentBody.innerHTML = `
        <tr>
          <td colspan="6" class="py-8 text-center text-sm text-slate-400">
            No live records loaded yet. Sign in to connect to your Google Sheet or import an exported CSV in Settings.
          </td>
        </tr>`;
      return;
    }

    recentBody.innerHTML = sorted
      .map(
        (r) => `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
        <td class="py-3 px-4 font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">${formatDisplayDate(r.entryDate)}</td>
        <td class="py-3 px-4 text-slate-600 dark:text-slate-300">${escapeHTML(r.driverName || '—')}</td>
        <td class="py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">${formatINR(r.totalEarning)}</td>
        <td class="py-3 px-4 text-rose-500 whitespace-nowrap">${formatINR(r.expenseAmount)}</td>
        <td class="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">${formatINR(r.netProfit)}</td>
        <td class="py-3 px-4 text-right">
          <button type="button" data-rec-id="${r.id}" class="dash-edit-btn text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">Edit</button>
        </td>
      </tr>`
      )
      .join('');

    recentBody.querySelectorAll('.dash-edit-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rec = records.find((x) => x.id === btn.dataset.recId);
        if (rec) onQuickEdit(rec);
      });
    });
  }
}
