/**
 * Dealskart – Auto Earning Tracker
 * Google Apps Script Backend (Code.gs)
 *
 * Non-destructive, backwards-compatible JSON API for the existing
 * "Auto Earning Diary" Google Spreadsheet.
 *
 * Existing sheet names & columns (preserved verbatim):
 * 1. "Auto Earnings":
 *    Driver Name | Username | Entry Date | Cash Earning | Online Earning |
 *    Total Earning | Expense Amount | Expense Reason | Balance | Created At
 * 2. "Bank Deposits":
 *    Driver Name | Username | Deposit Date | Cash Deposit | Online Deposit |
 *    Total Deposit | Created At
 * 3. "Users":
 *    Role | Name | Username | PAN Number | DOB | Password Hash | Status |
 *    Created At | Photo Data | Phone | Address | Admin Notes | Approved At
 */

const SHEET_NAMES = {
  EARNINGS: 'Auto Earnings',
  DEPOSITS: 'Bank Deposits',
  USERS: 'Users'
};

const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function sha256Hex(text) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(text),
    Utilities.Charset.UTF_8
  );
  return bytes
    .map(function (b) {
      const hex = (b < 0 ? b + 256 : b).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    })
    .join('');
}

function formatCreatedAtIST(dateObj) {
  return Utilities.formatDate(dateObj || new Date(), 'Asia/Kolkata', 'dd/MM/yyyy HH:mm:ss');
}

function normalizeDateCell(val) {
  if (!val) return '';
  if (Object.prototype.toString.call(val) === '[object Date]' && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, 'Asia/Kolkata', 'yyyy-MM-dd');
  }
  return String(val).trim();
}

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function readSheetObjects(sheetName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(function (h) { return String(h).trim(); });
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const isEmpty = row.every(function (c) { return c === '' || c === null; });
    if (isEmpty) continue;
    const obj = { rowNumber: i + 1 };
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      let val = row[c];
      if (key === 'Entry Date' || key === 'Deposit Date' || key === 'DOB') {
        val = normalizeDateCell(val);
      }
      obj[key] = val;
    }
    rows.push(obj);
  }
  return rows;
}

function getSession(token) {
  if (!token) return null;
  const cache = CacheService.getScriptCache();
  const raw = cache.get('sess_' + token);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function requireAuth(token) {
  const session = getSession(token);
  if (!session) {
    return { error: jsonResponse({ ok: false, message: 'Login required.' }) };
  }
  return { session: session };
}

function handleLogin(username, password) {
  const cleanUser = String(username || '').trim().toUpperCase();
  const passHash = sha256Hex(String(password || ''));
  const users = readSheetObjects(SHEET_NAMES.USERS);

  const matched = users.find(function (u) {
    return (
      String(u['Username'] || '').trim().toUpperCase() === cleanUser &&
      String(u['Status'] || '').trim().toLowerCase() === 'active' &&
      String(u['Password Hash'] || '').trim().toLowerCase() === passHash.toLowerCase()
    );
  });

  if (!matched) {
    return jsonResponse({ ok: false, message: 'Invalid username or password.' });
  }

  const token = Utilities.getUuid();
  const userInfo = {
    username: String(matched['Username']).trim(),
    name: String(matched['Name'] || matched['Username']).trim(),
    role: String(matched['Role'] || 'user').trim().toLowerCase()
  };

  CacheService.getScriptCache().put(
    'sess_' + token,
    JSON.stringify(userInfo),
    SESSION_TTL_SECONDS
  );

  return jsonResponse({
    ok: true,
    token: token,
    user: userInfo
  });
}

function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const action = String(params.action || '').trim();
    const token = String(params.token || '').trim();

    const auth = requireAuth(token);
    if (auth.error) return auth.error;
    const session = auth.session;

    if (action === 'health') {
      return jsonResponse({
        ok: true,
        status: 'connected',
        user: session,
        sheets: Object.values(SHEET_NAMES),
        serverTime: formatCreatedAtIST(new Date())
      });
    }

    if (action === 'getEarnings' || action === '') {
      let earnings = readSheetObjects(SHEET_NAMES.EARNINGS);
      let deposits = readSheetObjects(SHEET_NAMES.DEPOSITS);

      // Non-admin drivers only see their own records
      if (session.role !== 'admin') {
        const u = session.username.toUpperCase();
        earnings = earnings.filter(function (r) {
          return String(r['Username'] || '').trim().toUpperCase() === u;
        });
        deposits = deposits.filter(function (r) {
          return String(r['Username'] || '').trim().toUpperCase() === u;
        });
      }

      return jsonResponse({
        ok: true,
        user: session,
        earnings: earnings,
        deposits: deposits,
        syncedAt: new Date().toISOString()
      });
    }

    return jsonResponse({ ok: false, message: 'Unsupported GET action: ' + action });
  } catch (err) {
    return jsonResponse({ ok: false, message: 'Server error: ' + err.message });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const rawBody = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const body = JSON.parse(rawBody);
    const action = String(body.action || '').trim();

    if (action === 'login') {
      return handleLogin(body.username, body.password);
    }

    if (action === 'logout') {
      if (body.token) {
        CacheService.getScriptCache().remove('sess_' + body.token);
      }
      return jsonResponse({ ok: true, message: 'Logged out.' });
    }

    const auth = requireAuth(String(body.token || '').trim());
    if (auth.error) return auth.error;
    const session = auth.session;

    lock.waitLock(15000);
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.EARNINGS);
    if (!sheet) {
      return jsonResponse({ ok: false, message: 'Sheet "Auto Earnings" not found.' });
    }

    if (action === 'addEarning') {
      const entry = body.entry || {};
      const entryDate = normalizeDateCell(entry.entryDate);
      if (!entryDate) {
        return jsonResponse({ ok: false, message: 'Entry Date is required.' });
      }
      const driverName = String(entry.driverName || session.name).trim();
      const username = String(
        session.role === 'admin' ? (entry.username || session.username) : session.username
      ).trim();

      // Duplicate date guard per username
      const existing = readSheetObjects(SHEET_NAMES.EARNINGS).find(function (r) {
        return (
          r['Entry Date'] === entryDate &&
          String(r['Username'] || '').trim().toUpperCase() === username.toUpperCase()
        );
      });
      if (existing) {
        return jsonResponse({
          ok: false,
          code: 'DUPLICATE_DATE',
          rowNumber: existing.rowNumber,
          message: 'An entry already exists for ' + entryDate + '. Use edit instead.'
        });
      }

      const cash = Number(entry.cashEarning) || 0;
      const online = Number(entry.onlineEarning) || 0;
      const total = cash + online;
      const expense = Number(entry.expenseAmount) || 0;
      const reason = String(entry.expenseReason || '').trim();
      const balance = Number(entry.balance !== undefined ? entry.balance : (total - expense)) || 0;
      const createdAt = formatCreatedAtIST(new Date());

      sheet.appendRow([
        driverName,
        username,
        entryDate,
        cash,
        online,
        total,
        expense,
        reason,
        balance,
        createdAt
      ]);

      return jsonResponse({
        ok: true,
        message: 'Daily earning added.',
        rowNumber: sheet.getLastRow()
      });
    }

    if (action === 'updateEarning') {
      const rowNumber = Number(body.rowNumber);
      const entry = body.entry || {};
      if (!rowNumber || rowNumber < 2 || rowNumber > sheet.getLastRow()) {
        return jsonResponse({ ok: false, message: 'Invalid row number.' });
      }

      const currentRow = sheet.getRange(rowNumber, 1, 1, 10).getValues()[0];
      const rowUsername = String(currentRow[1] || '').trim().toUpperCase();
      if (session.role !== 'admin' && rowUsername !== session.username.toUpperCase()) {
        return jsonResponse({ ok: false, message: 'Permission denied for this record.' });
      }

      const driverName = String(entry.driverName || currentRow[0]).trim();
      const username = String(
        session.role === 'admin' ? (entry.username || currentRow[1]) : currentRow[1]
      ).trim();
      const entryDate = normalizeDateCell(entry.entryDate || currentRow[2]);
      const cash = Number(entry.cashEarning) || 0;
      const online = Number(entry.onlineEarning) || 0;
      const total = cash + online;
      const expense = Number(entry.expenseAmount) || 0;
      const reason = String(entry.expenseReason || '').trim();
      const balance = Number(entry.balance !== undefined ? entry.balance : (total - expense)) || 0;
      const createdAt = currentRow[9] || formatCreatedAtIST(new Date());

      sheet.getRange(rowNumber, 1, 1, 10).setValues([[
        driverName,
        username,
        entryDate,
        cash,
        online,
        total,
        expense,
        reason,
        balance,
        createdAt
      ]]);

      return jsonResponse({ ok: true, message: 'Daily earning updated.', rowNumber: rowNumber });
    }

    if (action === 'deleteEarning') {
      const rowNumber = Number(body.rowNumber);
      if (!rowNumber || rowNumber < 2 || rowNumber > sheet.getLastRow()) {
        return jsonResponse({ ok: false, message: 'Invalid row number.' });
      }
      const currentRow = sheet.getRange(rowNumber, 1, 1, 10).getValues()[0];
      const rowUsername = String(currentRow[1] || '').trim().toUpperCase();
      if (session.role !== 'admin' && rowUsername !== session.username.toUpperCase()) {
        return jsonResponse({ ok: false, message: 'Permission denied for this record.' });
      }
      if (body.entryDate && normalizeDateCell(currentRow[2]) !== normalizeDateCell(body.entryDate)) {
        return jsonResponse({ ok: false, message: 'Row date mismatch. Refresh and try again.' });
      }

      sheet.deleteRow(rowNumber);
      return jsonResponse({ ok: true, message: 'Record deleted.' });
    }

    return jsonResponse({ ok: false, message: 'Unsupported POST action: ' + action });
  } catch (err) {
    return jsonResponse({ ok: false, message: 'Server error: ' + err.message });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}
