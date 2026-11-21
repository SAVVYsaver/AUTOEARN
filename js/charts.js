/**
 * Dealskart – Auto Earning Tracker
 * Analytics & Chart.js Visualizations
 */
import { formatINR, parseLocalDate } from './data.js';

export class ChartsManager {
  constructor() {
    this.instances = {};
  }

  destroyAll() {
    Object.values(this.instances).forEach((ch) => {
      try { ch.destroy(); } catch {}
    });
    this.instances = {};
  }

  _palette() {
    const isDark = document.documentElement.classList.contains('dark');
    return {
      text: isDark ? '#94a3b8' : '#64748b',
      grid: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.07)',
      emerald: '#10b981',
      emeraldFill: isDark ? 'rgba(16,185,129,0.20)' : 'rgba(16,185,129,0.14)',
      indigo: '#6366f1',
      indigoFill: isDark ? 'rgba(99,102,241,0.22)' : 'rgba(99,102,241,0.14)',
      rose: '#f43f5e',
      amber: '#f59e0b',
      teal: '#14b8a6'
    };
  }

  _baseOptions(palette, showLegend = false) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: showLegend,
          labels: { color: palette.text, usePointStyle: true, boxWidth: 8 }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatINR(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: palette.text, maxRotation: 45, autoSkip: true, maxTicksLimit: 10 }
        },
        y: {
          beginAtZero: true,
          grid: { color: palette.grid },
          ticks: {
            color: palette.text,
            callback: (v) => formatINR(v)
          }
        }
      }
    };
  }

  _renderChart(canvasId, config) {
    if (typeof window.Chart === 'undefined') return;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (this.instances[canvasId]) {
      try { this.instances[canvasId].destroy(); } catch {}
    }
    this.instances[canvasId] = new window.Chart(canvas.getContext('2d'), config);
  }

  renderAll(filteredRecords, allRecords) {
    const palette = this._palette();

    // 1. Daily Earnings & Expenses (from filteredRecords)
    const dailyMap = new Map();
    for (const r of filteredRecords) {
      const cur = dailyMap.get(r.entryDate) || { earnings: 0, expenses: 0 };
      cur.earnings += r.totalEarning;
      cur.expenses += r.expenseAmount;
      dailyMap.set(r.entryDate, cur);
    }
    const sortedDays = Array.from(dailyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const dayLabels = sortedDays.map(([d]) => d.slice(5)); // MM-DD
    const dayEarnings = sortedDays.map(([, v]) => v.earnings);
    const dayExpenses = sortedDays.map(([, v]) => v.expenses);

    this._renderChart('chart-daily', {
      type: 'line',
      data: {
        labels: dayLabels.length ? dayLabels : ['No Data'],
        datasets: [
          {
            label: 'Daily Earnings',
            data: dayEarnings.length ? dayEarnings : [0],
            borderColor: palette.emerald,
            backgroundColor: palette.emeraldFill,
            fill: true,
            tension: 0.32,
            borderWidth: 2.2,
            pointRadius: sortedDays.length > 45 ? 0 : 3
          }
        ]
      },
      options: this._baseOptions(palette, false)
    });

    // 2. Earnings vs Expenses
    this._renderChart('chart-earn-vs-exp', {
      type: 'bar',
      data: {
        labels: dayLabels.length ? dayLabels : ['No Data'],
        datasets: [
          {
            label: 'Earnings',
            data: dayEarnings.length ? dayEarnings : [0],
            backgroundColor: palette.emerald,
            borderRadius: 6
          },
          {
            label: 'Expenses',
            data: dayExpenses.length ? dayExpenses : [0],
            backgroundColor: palette.rose,
            borderRadius: 6
          }
        ]
      },
      options: this._baseOptions(palette, true)
    });

    // 3. Weekly Earnings (ISO week starting Monday)
    const weekMap = new Map();
    for (const [dateStr, val] of sortedDays) {
      const dt = parseLocalDate(dateStr);
      if (!dt) continue;
      const day = dt.getDay();
      const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(dt.getFullYear(), dt.getMonth(), diff);
      const wkKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      weekMap.set(wkKey, (weekMap.get(wkKey) || 0) + val.earnings);
    }
    const sortedWeeks = Array.from(weekMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    this._renderChart('chart-weekly', {
      type: 'bar',
      data: {
        labels: sortedWeeks.length ? sortedWeeks.map(([w]) => `Wk ${w.slice(5)}`) : ['No Data'],
        datasets: [
          {
            label: 'Weekly Earnings',
            data: sortedWeeks.length ? sortedWeeks.map(([, v]) => v) : [0],
            backgroundColor: palette.indigo,
            borderRadius: 6
          }
        ]
      },
      options: this._baseOptions(palette, false)
    });

    // 4. Monthly Earnings (uses allRecords for full monthly trend, or filtered if subset)
    const monthSource = filteredRecords.length ? filteredRecords : allRecords;
    const monthMap = new Map();
    for (const r of monthSource) {
      if (!r.entryDate) continue;
      const ym = r.entryDate.slice(0, 7);
      monthMap.set(ym, (monthMap.get(ym) || 0) + r.totalEarning);
    }
    const sortedMonths = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    this._renderChart('chart-monthly', {
      type: 'bar',
      data: {
        labels: sortedMonths.length ? sortedMonths.map(([m]) => m) : ['No Data'],
        datasets: [
          {
            label: 'Monthly Earnings',
            data: sortedMonths.length ? sortedMonths.map(([, v]) => v) : [0],
            backgroundColor: palette.teal,
            borderRadius: 6
          }
        ]
      },
      options: this._baseOptions(palette, false)
    });

    // 5. Yearly Earnings (from allRecords so yearly comparison is always meaningful)
    const yearMap = new Map();
    for (const r of allRecords) {
      if (!r.entryDate) continue;
      const y = r.entryDate.slice(0, 4);
      yearMap.set(y, (yearMap.get(y) || 0) + r.totalEarning);
    }
    const sortedYears = Array.from(yearMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    this._renderChart('chart-yearly', {
      type: 'bar',
      data: {
        labels: sortedYears.length ? sortedYears.map(([y]) => y) : ['No Data'],
        datasets: [
          {
            label: 'Yearly Earnings',
            data: sortedYears.length ? sortedYears.map(([, v]) => v) : [0],
            backgroundColor: palette.amber,
            borderRadius: 8
          }
        ]
      },
      options: this._baseOptions(palette, false)
    });
  }
}
