/**
 * Dealskart – Auto Earning Tracker
 * Interactive Monthly Calendar View
 */
import { formatINR, formatDisplayDate, getTodayISO } from './data.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export class CalendarView {
  constructor({ onEditRecord, onAddForDate }) {
    const today = getTodayISO().split('-').map(Number);
    this.year = today[0];
    this.month = today[1] - 1; // 0-indexed
    this.selectedDate = getTodayISO();
    this.onEditRecord = onEditRecord;
    this.onAddForDate = onAddForDate;
  }

  prevMonth() {
    this.month--;
    if (this.month < 0) {
      this.month = 11;
      this.year--;
    }
  }

  nextMonth() {
    this.month++;
    if (this.month > 11) {
      this.month = 0;
      this.year++;
    }
  }

  goToday() {
    const today = getTodayISO().split('-').map(Number);
    this.year = today[0];
    this.month = today[1] - 1;
    this.selectedDate = getTodayISO();
  }

  render(records) {
    const labelEl = document.getElementById('cal-month-label');
    const summaryEl = document.getElementById('cal-month-summary');
    const gridEl = document.getElementById('cal-grid');
    const detailEl = document.getElementById('cal-day-detail');
    if (!gridEl || !labelEl) return;

    const ymPrefix = `${this.year}-${String(this.month + 1).padStart(2, '0')}`;
    labelEl.textContent = `${MONTH_NAMES[this.month]} ${this.year}`;

    // Map records by date for this month
    const byDate = new Map();
    let monthEarnings = 0;
    let monthExpenses = 0;
    for (const r of records) {
      if (!r.entryDate) continue;
      const list = byDate.get(r.entryDate) || [];
      list.push(r);
      byDate.set(r.entryDate, list);
      if (r.entryDate.startsWith(ymPrefix)) {
        monthEarnings += r.totalEarning;
        monthExpenses += r.expenseAmount;
      }
    }

    const monthDaysRecorded = Array.from(byDate.keys()).filter((d) => d.startsWith(ymPrefix)).length;
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="flex flex-wrap items-center gap-3 text-sm">
          <span class="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
            Month Total: ${formatINR(monthEarnings)}
          </span>
          <span class="px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium">
            Expenses: ${formatINR(monthExpenses)}
          </span>
          <span class="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium">
            Net: ${formatINR(monthEarnings - monthExpenses)}
          </span>
          <span class="text-slate-500 dark:text-slate-400">${monthDaysRecorded} working days</span>
        </div>
      `;
    }

    const firstDow = new Date(this.year, this.month, 1).getDay();
    const daysInMonth = new Date(this.year, this.month + 1, 0).getDate();
    const todayISO = getTodayISO();

    let cellsHtml = '';
    for (let i = 0; i < firstDow; i++) {
      cellsHtml += `<div class="min-h-[74px] sm:min-h-[88px] rounded-xl bg-slate-50/50 dark:bg-slate-800/20"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${ymPrefix}-${String(day).padStart(2, '0')}`;
      const dayRecs = byDate.get(iso) || [];
      const dayTotal = dayRecs.reduce((s, r) => s + r.totalEarning, 0);
      const dayExp = dayRecs.reduce((s, r) => s + r.expenseAmount, 0);
      const hasData = dayRecs.length > 0;
      const isSelected = iso === this.selectedDate;
      const isToday = iso === todayISO;
      const isPastMissing = !hasData && iso <= todayISO;

      const baseClass = hasData
        ? 'bg-emerald-50/80 dark:bg-emerald-950/35 border-emerald-200/80 dark:border-emerald-800/60 hover:border-emerald-400'
        : isPastMissing
          ? 'bg-amber-50/50 dark:bg-amber-950/20 border-dashed border-amber-300/80 dark:border-amber-800/50 hover:border-amber-400'
          : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-400';

      const ringClass = isSelected ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900' : '';

      cellsHtml += `
        <button type="button" data-cal-date="${iso}"
          class="cal-cell text-left p-2 rounded-xl border transition-all min-h-[74px] sm:min-h-[88px] flex flex-col justify-between ${baseClass} ${ringClass}">
          <div class="flex items-center justify-between w-full">
            <span class="text-xs font-semibold ${isToday ? 'px-1.5 py-0.5 rounded-md bg-indigo-600 text-white' : 'text-slate-700 dark:text-slate-200'}">${day}</span>
            ${hasData ? '<span class="w-2 h-2 rounded-full bg-emerald-500"></span>' : isPastMissing ? '<span class="w-1.5 h-1.5 rounded-full bg-amber-400" title="No record"></span>' : ''}
          </div>
          <div class="mt-1">
            ${
              hasData
                ? `<div class="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-300 truncate">${formatINR(dayTotal)}</div>
                   ${dayExp > 0 ? `<div class="text-[10px] text-rose-500 truncate">-${formatINR(dayExp)}</div>` : ''}`
                : `<div class="text-[10px] text-slate-400 dark:text-slate-500">${isPastMissing ? 'No entry' : '—'}</div>`
            }
          </div>
        </button>
      `;
    }

    gridEl.innerHTML = cellsHtml;
    gridEl.querySelectorAll('.cal-cell').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedDate = btn.dataset.calDate;
        this.render(records);
      });
    });

    this._renderDetail(detailEl, byDate.get(this.selectedDate) || []);
  }

  _renderDetail(container, dayRecords) {
    if (!container) return;
    const dateLabel = formatDisplayDate(this.selectedDate);
    if (!dayRecords.length) {
      container.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p class="text-xs uppercase tracking-wider text-slate-400 font-semibold">Selected Date</p>
            <h4 class="text-lg font-bold text-slate-900 dark:text-white mt-0.5">${dateLabel}</h4>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">No earning record found in Google Sheets for this date.</p>
          </div>
          <button type="button" id="cal-add-btn"
            class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition">
            + Add Earning for ${this.selectedDate}
          </button>
        </div>
      `;
      container.querySelector('#cal-add-btn')?.addEventListener('click', () => {
        this.onAddForDate(this.selectedDate);
      });
      return;
    }

    const totalEarn = dayRecords.reduce((s, r) => s + r.totalEarning, 0);
    const totalExp = dayRecords.reduce((s, r) => s + r.expenseAmount, 0);

    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-xs uppercase tracking-wider text-slate-400 font-semibold">Selected Date</p>
            <h4 class="text-lg font-bold text-slate-900 dark:text-white">${dateLabel}</h4>
          </div>
          <div class="flex items-center gap-3 text-sm">
            <span class="font-bold text-emerald-600 dark:text-emerald-400">${formatINR(totalEarn)}</span>
            <span class="text-slate-300 dark:text-slate-600">|</span>
            <span class="font-semibold text-rose-500">Exp: ${formatINR(totalExp)}</span>
            <span class="text-slate-300 dark:text-slate-600">|</span>
            <span class="font-bold text-indigo-600 dark:text-indigo-400">Net: ${formatINR(totalEarn - totalExp)}</span>
          </div>
        </div>
        <div class="divide-y divide-slate-100 dark:divide-slate-800">
          ${dayRecords
            .map(
              (r) => `
            <div class="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="text-sm">
                <div class="font-semibold text-slate-800 dark:text-slate-100">
                  ${r.driverName || 'Driver'} <span class="text-xs text-slate-400 font-normal">(${r.username || '—'})</span>
                </div>
                <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Cash: ${formatINR(r.cashEarning)} · Online: ${formatINR(r.onlineEarning)} · Expense: ${formatINR(r.expenseAmount)}
                  ${r.expenseReason ? ` · Note: ${r.expenseReason}` : ''}
                </div>
              </div>
              <button type="button" data-edit-id="${r.id}"
                class="cal-edit-btn px-3.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-xs font-semibold transition">
                Edit Record
              </button>
            </div>`
            )
            .join('')}
        </div>
      </div>
    `;

    container.querySelectorAll('.cal-edit-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rec = dayRecords.find((x) => x.id === btn.dataset.editId);
        if (rec) this.onEditRecord(rec);
      });
    });
  }
}
