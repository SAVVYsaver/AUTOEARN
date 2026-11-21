/**
 * Dealskart – Auto Earning Tracker
 * Data Processing, Normalization, Date/IST Safety & KPI Calculations
 */
import { APP_CONFIG } from './config.js';

const inrWholeFormatter = new Intl.NumberFormat(APP_CONFIG.LOCALE, {
  style: 'currency',
  currency: APP_CONFIG.CURRENCY_CODE,
  maximumFractionDigits: 0
});

const inrDecimalFormatter = new Intl.NumberFormat(APP_CONFIG.LOCALE, {
  style: 'currency',
  currency: APP_CONFIG.CURRENCY_CODE,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const indianNumberFormatter = new Intl.NumberFormat(APP_CONFIG.LOCALE, {
  maximumFractionDigits: 2
});

export function formatINR(amount, forceDecimals = false) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return '₹0';
  if (!forceDecimals && Math.abs(num - Math.round(num)) < 0.005) {
    return inrWholeFormatter.format(Math.round(num));
  }
  return inrDecimalFormatter.format(num);
}

export function formatIndianNumber(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return '0';
  return indianNumberFormatter.format(num);
}

/**
 * Returns today's date string in YYYY-MM-DD using IST (Asia/Kolkata) or browser local date.
 */
export function getTodayISO() {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_CONFIG.TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // Fallback to local date
  }
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Normalizes YYYY-MM-DD, DD/MM/YYYY, or ISO timestamps to YYYY-MM-DD without UTC shift bugs.
 */
export function normalizeDateISO(raw) {
  if (!raw) return '';
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const isoPrefix = str.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoPrefix) return isoPrefix[1];
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    return normalizeDateISO(parsed);
  }
  return '';
}

export function parseLocalDate(isoDate) {
  const clean = normalizeDateISO(isoDate);
  if (!clean) return null;
  const [y, m, d] = clean.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDisplayDate(isoDate) {
  const dt = parseLocalDate(isoDate);
  if (!dt) return isoDate || '—';
  return dt.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export function safeNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  const cleaned = typeof val === 'string' ? val.replace(/[₹,\s]/g, '') : val;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Normalizes a raw row from the "Auto Earnings" sheet into a canonical record.
 */
export function normalizeEarningRecord(raw, idx = 0) {
  const driverName = String(
    raw['Driver Name'] ?? raw.driverName ?? ''
  ).trim();
  const username = String(
    raw['Username'] ?? raw.username ?? ''
  ).trim();
  const entryDate = normalizeDateISO(
    raw['Entry Date'] ?? raw.entryDate ?? raw.date ?? ''
  );
  const cashEarning = safeNumber(raw['Cash Earning'] ?? raw.cashEarning);
  const onlineEarning = safeNumber(raw['Online Earning'] ?? raw.onlineEarning);
  const rawTotal = raw['Total Earning'] ?? raw.totalEarning;
  const totalEarning =
    rawTotal !== undefined && rawTotal !== '' && rawTotal !== null
      ? safeNumber(rawTotal)
      : cashEarning + onlineEarning;
  const expenseAmount = safeNumber(raw['Expense Amount'] ?? raw.expenseAmount);
  const expenseReason = String(
    raw['Expense Reason'] ?? raw.expenseReason ?? ''
  ).trim();
  const netProfit = totalEarning - expenseAmount;
  const balance = safeNumber(raw['Balance'] ?? raw.balance);
  const createdAt = String(raw['Created At'] ?? raw.createdAt ?? '').trim();
  const rowNumber = Number(raw.rowNumber || raw._row || idx + 2);

  return {
    id: `${rowNumber}_${entryDate}_${username}`,
    rowNumber,
    driverName,
    username,
    entryDate,
    cashEarning,
    onlineEarning,
    totalEarning,
    expenseAmount,
    expenseReason,
    netProfit,
    balance,
    createdAt
  };
}

export function normalizeDepositRecord(raw, idx = 0) {
  const driverName = String(raw['Driver Name'] ?? raw.driverName ?? '').trim();
  const username = String(raw['Username'] ?? raw.username ?? '').trim();
  const depositDate = normalizeDateISO(raw['Deposit Date'] ?? raw.depositDate ?? '');
  const cashDeposit = safeNumber(raw['Cash Deposit'] ?? raw.cashDeposit);
  const onlineDeposit = safeNumber(raw['Online Deposit'] ?? raw.onlineDeposit);
  const rawTotal = raw['Total Deposit'] ?? raw.totalDeposit;
  const totalDeposit =
    rawTotal !== undefined && rawTotal !== '' && rawTotal !== null
      ? safeNumber(rawTotal)
      : cashDeposit + onlineDeposit;
  const createdAt = String(raw['Created At'] ?? raw.createdAt ?? '').trim();
  return {
    id: `dep_${idx + 2}_${depositDate}`,
    rowNumber: Number(raw.rowNumber || idx + 2),
    driverName,
    username,
    depositDate,
    cashDeposit,
    onlineDeposit,
    totalDeposit,
    createdAt
  };
}

/**
 * Computes all 10 required dashboard KPIs accurately from real records.
 * Avoids dividing by zero and double-counting.
 */
export function computeDashboardMetrics(records, todayISO = getTodayISO()) {
  const valid = (records || []).filter((r) => r.entryDate);
  const todayMonth = todayISO.slice(0, 7); // YYYY-MM

  const todayDate = parseLocalDate(todayISO);
  const sevenDaysAgo = new Date(todayDate);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // inclusive 7-day window

  let todayEarnings = 0;
  let todayExpenses = 0;
  let monthlyEarnings = 0;
  let monthlyExpenses = 0;
  let last7DaysEarnings = 0;
  let last7DaysExpenses = 0;
  let lifetimeEarnings = 0;
  let lifetimeExpenses = 0;
  let lifetimeCash = 0;
  let lifetimeOnline = 0;
  const uniqueWorkingDates = new Set();

  for (const r of valid) {
    lifetimeEarnings += r.totalEarning;
    lifetimeExpenses += r.expenseAmount;
    lifetimeCash += r.cashEarning;
    lifetimeOnline += r.onlineEarning;
    uniqueWorkingDates.add(r.entryDate);

    if (r.entryDate === todayISO) {
      todayEarnings += r.totalEarning;
      todayExpenses += r.expenseAmount;
    }
    if (r.entryDate.slice(0, 7) === todayMonth) {
      monthlyEarnings += r.totalEarning;
      monthlyExpenses += r.expenseAmount;
    }
    const dt = parseLocalDate(r.entryDate);
    if (dt && dt >= sevenDaysAgo && dt <= todayDate) {
      last7DaysEarnings += r.totalEarning;
      last7DaysExpenses += r.expenseAmount;
    }
  }

  const workingDays = uniqueWorkingDates.size;
  const averageDailyEarnings = workingDays > 0 ? lifetimeEarnings / workingDays : 0;

  return {
    todayEarnings,
    todayExpenses,
    todayNetProfit: todayEarnings - todayExpenses,
    monthlyEarnings,
    monthlyExpenses,
    monthlyNetProfit: monthlyEarnings - monthlyExpenses,
    last7DaysEarnings,
    last7DaysExpenses,
    last7DaysNetProfit: last7DaysEarnings - last7DaysExpenses,
    lifetimeEarnings,
    lifetimeExpenses,
    lifetimeNetProfit: lifetimeEarnings - lifetimeExpenses,
    lifetimeCash,
    lifetimeOnline,
    workingDays,
    averageDailyEarnings
  };
}

/**
 * Filters records by analytics timeframe.
 */
export function filterByTimeframe(records, range, todayISO = getTodayISO()) {
  const valid = (records || []).filter((r) => r.entryDate);
  if (range === 'all') return valid;

  const today = parseLocalDate(todayISO);
  const curY = today.getFullYear();
  const curM = today.getMonth();

  return valid.filter((r) => {
    const dt = parseLocalDate(r.entryDate);
    if (!dt) return false;
    if (range === '7d') {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return dt >= start && dt <= today;
    }
    if (range === '30d') {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      return dt >= start && dt <= today;
    }
    if (range === 'this_month') {
      return dt.getFullYear() === curY && dt.getMonth() === curM;
    }
    if (range === 'prev_month') {
      const prev = new Date(curY, curM - 1, 1);
      return dt.getFullYear() === prev.getFullYear() && dt.getMonth() === prev.getMonth();
    }
    if (range === 'this_year') {
      return dt.getFullYear() === curY;
    }
    return true;
  });
}

/**
 * Computes analytics highlights (Best Day, Lowest Day, Average Daily, Monthly Growth %).
 */
export function computeAnalyticsHighlights(allRecords, filteredRecords, todayISO = getTodayISO()) {
  // Aggregate by date so multiple entries on same day don't skew daily highs/lows
  const dailyMap = new Map();
  for (const r of filteredRecords) {
    const prev = dailyMap.get(r.entryDate) || { date: r.entryDate, earnings: 0, expenses: 0 };
    prev.earnings += r.totalEarning;
    prev.expenses += r.expenseAmount;
    dailyMap.set(r.entryDate, prev);
  }
  const days = Array.from(dailyMap.values());
  let bestDay = null;
  let lowestDay = null;
  let totalEarnings = 0;

  for (const d of days) {
    totalEarnings += d.earnings;
    if (!bestDay || d.earnings > bestDay.earnings) bestDay = d;
    if (!lowestDay || d.earnings < lowestDay.earnings) lowestDay = d;
  }

  const avgDaily = days.length > 0 ? totalEarnings / days.length : 0;

  // Monthly growth % (current month vs previous month across all records)
  const today = parseLocalDate(todayISO);
  const thisMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

  let thisMonthSum = 0;
  let prevMonthSum = 0;
  for (const r of allRecords) {
    const ym = r.entryDate.slice(0, 7);
    if (ym === thisMonthKey) thisMonthSum += r.totalEarning;
    else if (ym === prevMonthKey) prevMonthSum += r.totalEarning;
  }

  let monthlyGrowthPct = null;
  if (prevMonthSum > 0) {
    monthlyGrowthPct = ((thisMonthSum - prevMonthSum) / prevMonthSum) * 100;
  }

  return {
    bestDay,
    lowestDay,
    avgDaily,
    monthlyGrowthPct,
    thisMonthSum,
    prevMonthSum,
    activeDays: days.length
  };
}

/**
 * Parses a CSV string exported from the "Auto Earnings" sheet.
 */
export function parseAutoEarningsCSV(csvText) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && next === '\n') i++;
      row.push(field);
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  }

  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const obj = { rowNumber: i + 1 };
    headers.forEach((h, idx) => {
      obj[h] = rows[i][idx] !== undefined ? rows[i][idx].trim() : '';
    });
    const norm = normalizeEarningRecord(obj, i - 1);
    if (norm.entryDate) records.push(norm);
  }
  return records;
}


/**
 * Computes how much Cash, Online, and Total amount is remaining to collect
 * from drivers (Deposit to Bank settlement), both overall and per driver.
 * Formula:
 *   Cash Remaining   = Cash Earned - Expenses - Cash Deposited
 *   Online Remaining = Online Earned - Online Deposited
 *   Total Remaining  = (Total Earned - Expenses) - Total Deposited
 */
export function computeSettlementMetrics(earnings, deposits) {
  const byDriver = new Map();

  const ensure = (username, driverName) => {
    const key = (username || driverName || 'UNKNOWN').trim().toUpperCase();
    if (!byDriver.has(key)) {
      byDriver.set(key, {
        key,
        username: (username || '').trim(),
        driverName: (driverName || username || 'Driver').trim(),
        cashEarned: 0,
        onlineEarned: 0,
        totalEarned: 0,
        expenses: 0,
        cashDeposited: 0,
        onlineDeposited: 0,
        totalDeposited: 0
      });
    } else if (driverName && byDriver.get(key).driverName.length < driverName.trim().length) {
      byDriver.get(key).driverName = driverName.trim();
    }
    return byDriver.get(key);
  };

  for (const e of earnings || []) {
    const d = ensure(e.username, e.driverName);
    d.cashEarned += safeNumber(e.cashEarning);
    d.onlineEarned += safeNumber(e.onlineEarning);
    d.totalEarned += safeNumber(e.totalEarning);
    d.expenses += safeNumber(e.expenseAmount);
  }

  for (const dep of deposits || []) {
    const d = ensure(dep.username, dep.driverName);
    d.cashDeposited += safeNumber(dep.cashDeposit);
    d.onlineDeposited += safeNumber(dep.onlineDeposit);
    d.totalDeposited += safeNumber(dep.totalDeposit);
  }

  const drivers = Array.from(byDriver.values()).map((d) => {
    const netEarned = d.totalEarned - d.expenses;
    const cashRemaining = d.cashEarned - d.expenses - d.cashDeposited;
    const onlineRemaining = d.onlineEarned - d.onlineDeposited;
    const totalRemaining = netEarned - d.totalDeposited;
    return {
      ...d,
      netEarned,
      cashRemaining,
      onlineRemaining,
      totalRemaining
    };
  }).sort((a, b) => b.totalRemaining - a.totalRemaining);

  const totals = drivers.reduce(
    (acc, d) => {
      acc.cashEarned += d.cashEarned;
      acc.onlineEarned += d.onlineEarned;
      acc.totalEarned += d.totalEarned;
      acc.expenses += d.expenses;
      acc.netEarned += d.netEarned;
      acc.cashDeposited += d.cashDeposited;
      acc.onlineDeposited += d.onlineDeposited;
      acc.totalDeposited += d.totalDeposited;
      acc.cashRemaining += d.cashRemaining;
      acc.onlineRemaining += d.onlineRemaining;
      acc.totalRemaining += d.totalRemaining;
      return acc;
    },
    {
      cashEarned: 0,
      onlineEarned: 0,
      totalEarned: 0,
      expenses: 0,
      netEarned: 0,
      cashDeposited: 0,
      onlineDeposited: 0,
      totalDeposited: 0,
      cashRemaining: 0,
      onlineRemaining: 0,
      totalRemaining: 0
    }
  );

  return { totals, drivers };
}
