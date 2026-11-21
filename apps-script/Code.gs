/**
 * Dealskart – Auto Earning Tracker
 * Google Apps Script Backend (Code.gs)
 *
 * Non-destructive JSON API for your existing "Auto Earning Diary" Spreadsheet.
 *
 * Features:
 * - Role-based auth (Admin vs Driver) with SHA-256 password verification
 * - Strict driver data isolation (each driver sees/edits ONLY their own records)
 * - New driver registration (pending) + Admin-only Approve / Reject
 * - Forgot Password verification (Username + Mobile + PAN + DOB)
 * - Admin-only Deposit to Bank (add/delete/view)
 * - Secure Gemini AI Chatbot proxy using Script Property `GEMINI_API_KEY`
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
  const s = String(val).trim();
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    return dmy[3] + '-' + ('0' + dmy[2]).slice(-2) + '-' + ('0' + dmy[1]).slice(-2);
  }
  return s;
}

function normalizePhoneDigits(val) {
  const digits = String(val || '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
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

function sanitizeUsersForAdmin(users) {
  return users.map(function (u) {
    return {
      rowNumber: u.rowNumber,
      role: String(u['Role'] || 'user').trim().toLowerCase(),
      name: String(u['Name'] || '').trim(),
      username: String(u['Username'] || '').trim(),
      panNumber: String(u['PAN Number'] || '').trim(),
      dob: normalizeDateCell(u['DOB']),
      status: String(u['Status'] || 'pending').trim().toLowerCase(),
      createdAt: String(u['Created At'] || '').trim(),
      phone: String(u['Phone'] || '').trim(),
      address: String(u['Address'] || '').trim(),
      adminNotes: String(u['Admin Notes'] || '').trim(),
      approvedAt: String(u['Approved At'] || '').trim()
    };
  });
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
      String(u['Password Hash'] || '').trim().toLowerCase() === passHash.toLowerCase()
    );
  });

  if (!matched) {
    return jsonResponse({ ok: false, message: 'Invalid username or password.' });
  }

  const status = String(matched['Status'] || '').trim().toLowerCase();
  if (status === 'pending') {
    return jsonResponse({ ok: false, message: 'Your driver account is pending Admin approval.' });
  }
  if (status === 'rejected') {
    return jsonResponse({ ok: false, message: 'Your registration was rejected by Admin.' });
  }
  if (status !== 'active') {
    return jsonResponse({ ok: false, message: 'Account is not active (' + status + ').' });
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

function handleRegisterDriver(driver) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.USERS);
  if (!sheet) {
    return jsonResponse({ ok: false, message: 'Sheet "Users" not found.' });
  }

  const name = String(driver.name || '').trim();
  const username = String(driver.username || '').trim().toUpperCase();
  const password = String(driver.password || '');
  const panNumber = String(driver.panNumber || '').trim().toUpperCase();
  const dob = normalizeDateCell(driver.dob || '');
  const phone = normalizePhoneDigits(driver.phone || '');
  const address = String(driver.address || '').trim();

  if (!name || !username || password.length < 4) {
    return jsonResponse({
      ok: false,
      message: 'Name, Username, and Password (min 4 characters) are required.'
    });
  }
  if (!phone || !panNumber || !dob) {
    return jsonResponse({
      ok: false,
      message: 'Mobile Number, PAN Number, and Date of Birth are required for account verification.'
    });
  }

  const users = readSheetObjects(SHEET_NAMES.USERS);
  const exists = users.some(function (u) {
    return String(u['Username'] || '').trim().toUpperCase() === username;
  });
  if (exists) {
    return jsonResponse({ ok: false, message: 'Username "' + username + '" already exists.' });
  }

  const createdAt = formatCreatedAtIST(new Date());
  const passHash = sha256Hex(password);

  sheet.appendRow([
    'user',
    name,
    username,
    panNumber,
    dob,
    passHash,
    'pending',
    createdAt,
    '',
    phone,
    address,
    '',
    ''
  ]);

  return jsonResponse({
    ok: true,
    message: 'Registration submitted! Please wait for Admin approval before logging in.'
  });
}

function handleResetPassword(payload) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.USERS);
  if (!sheet) {
    return jsonResponse({ ok: false, message: 'Sheet "Users" not found.' });
  }

  const username = String(payload.username || '').trim().toUpperCase();
  const phone = normalizePhoneDigits(payload.phone || '');
  const panNumber = String(payload.panNumber || '').trim().toUpperCase();
  const dob = normalizeDateCell(payload.dob || '');
  const newPassword = String(payload.newPassword || '');

  if (!username || !phone || !panNumber || !dob) {
    return jsonResponse({
      ok: false,
      message: 'Username, Mobile Number, PAN Number, and Date of Birth are all required.'
    });
  }
  if (newPassword.length < 4) {
    return jsonResponse({ ok: false, message: 'New password must be at least 4 characters.' });
  }

  const users = readSheetObjects(SHEET_NAMES.USERS);
  const matched = users.find(function (u) {
    const uUser = String(u['Username'] || '').trim().toUpperCase();
    const uPhone = normalizePhoneDigits(u['Phone']);
    const uPan = String(u['PAN Number'] || '').trim().toUpperCase();
    const uDob = normalizeDateCell(u['DOB']);
    return (
      uUser === username &&
      uPhone !== '' && uPhone === phone &&
      uPan !== '' && uPan === panNumber &&
      uDob !== '' && uDob === dob
    );
  });

  if (!matched) {
    return jsonResponse({
      ok: false,
      message: 'Verification failed. Username, Mobile Number, PAN Number, and DOB must all match your registered profile in the Users sheet.'
    });
  }

  // Column 6 = Password Hash
  sheet.getRange(matched.rowNumber, 6).setValue(sha256Hex(newPassword));
  return jsonResponse({
    ok: true,
    message: 'Password updated successfully! You can now sign in with your new password.'
  });
}

function handleGeminiChat(session, userMessage) {
  const prompt = String(userMessage || '').trim();
  if (!prompt) {
    return jsonResponse({ ok: false, message: 'Please type a message.' });
  }

  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    return jsonResponse({
      ok: false,
      message: 'Gemini API key is not configured yet. In Apps Script, go to Project Settings → Script Properties and add GEMINI_API_KEY.'
    });
  }

  // Gather ONLY authorized summary data for the logged-in user
  let earnings = readSheetObjects(SHEET_NAMES.EARNINGS);
  let deposits = session.role === 'admin' ? readSheetObjects(SHEET_NAMES.DEPOSITS) : [];
  if (session.role !== 'admin') {
    const u = session.username.toUpperCase();
    earnings = earnings.filter(function (r) {
      return String(r['Username'] || '').trim().toUpperCase() === u;
    });
  }

  let totalEarn = 0, totalCash = 0, totalOnline = 0, totalExp = 0;
  earnings.forEach(function (r) {
    totalEarn += Number(r['Total Earning']) || 0;
    totalCash += Number(r['Cash Earning']) || 0;
    totalOnline += Number(r['Online Earning']) || 0;
    totalExp += Number(r['Expense Amount']) || 0;
  });

  let totalDep = 0, cashDep = 0, onlineDep = 0;
  deposits.forEach(function (d) {
    totalDep += Number(d['Total Deposit']) || 0;
    cashDep += Number(d['Cash Deposit']) || 0;
    onlineDep += Number(d['Online Deposit']) || 0;
  });

  const recent = earnings.slice(-10).map(function (r) {
    return r['Entry Date'] + ': Earn ₹' + (r['Total Earning'] || 0) + ', Exp ₹' + (r['Expense Amount'] || 0) + (r['Expense Reason'] ? ' (' + r['Expense Reason'] + ')' : '');
  }).join('; ');

  const contextLines = [
    'You are Ask Dealskart, the Dealskart Auto Earning Tracker AI Assistant. Reply concisely in the same language the user writes (Hindi, Hinglish, or English) using INR (₹).',
    'Logged-in user: ' + session.name + ' (' + session.username + '), role: ' + session.role,
    'Authorized summary: ' + earnings.length + ' records | Total Earnings: ₹' + totalEarn + ' (Cash ₹' + totalCash + ', Online ₹' + totalOnline + ') | Total Expenses: ₹' + totalExp + ' | Net Profit: ₹' + (totalEarn - totalExp)
  ];
  if (session.role === 'admin') {
    contextLines.push(
      'Admin Bank Deposits: Total Deposited ₹' + totalDep + ' (Cash ₹' + cashDep + ', Online ₹' + onlineDep + ') | Remaining to Collect: Total ₹' + ((totalEarn - totalExp) - totalDep) + ', Cash ₹' + (totalCash - totalExp - cashDep) + ', Online ₹' + (totalOnline - onlineDep)
    );
  }
  if (recent) {
    contextLines.push('Recent entries: ' + recent);
  }

  const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=' + encodeURIComponent(apiKey);
  const reqPayload = JSON.stringify({
    system_instruction: { parts: [{ text: contextLines.join('\n') }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }]
  });

  let code = 0;
  let body = {};
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = UrlFetchApp.fetch(endpoint, {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: reqPayload
    });
    code = res.getResponseCode();
    try {
      body = JSON.parse(res.getContentText() || '{}');
    } catch (e) {
      body = {};
    }
    if (code >= 200 && code < 300) break;
    if ((code === 503 || code === 429) && attempt < maxAttempts) {
      Utilities.sleep(1500 * attempt);
      continue;
    }
    break;
  }

  if (code < 200 || code >= 300) {
    const errMsg = (body.error && body.error.message) ? body.error.message : ('Gemini API error HTTP ' + code);
    return jsonResponse({ ok: false, message: errMsg });
  }

  const reply = (
    body.candidates &&
    body.candidates[0] &&
    body.candidates[0].content &&
    body.candidates[0].content.parts &&
    body.candidates[0].content.parts[0] &&
    body.candidates[0].content.parts[0].text
  ) || 'No response generated.';

  return jsonResponse({ ok: true, reply: reply });
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
      let users = [];

      if (session.role === 'admin') {
        users = sanitizeUsersForAdmin(readSheetObjects(SHEET_NAMES.USERS));
      } else {
        const u = session.username.toUpperCase();
        earnings = earnings.filter(function (r) {
          return String(r['Username'] || '').trim().toUpperCase() === u;
        });
        deposits = [];
      }

      return jsonResponse({
        ok: true,
        user: session,
        earnings: earnings,
        deposits: deposits,
        users: users,
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

    if (action === 'registerDriver') {
      lock.waitLock(15000);
      return handleRegisterDriver(body.driver || body);
    }

    if (action === 'resetPassword') {
      lock.waitLock(15000);
      return handleResetPassword(body);
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

    if (action === 'askDealskart' || action === 'geminiChat') {
      return handleGeminiChat(session, body.message);
    }

    lock.waitLock(15000);
    const ss = getSpreadsheet();

    // --- ADMIN DRIVER APPROVAL / REJECTION ---
    if (action === 'updateDriverStatus') {
      if (session.role !== 'admin') {
        return jsonResponse({ ok: false, message: 'Only Admin can approve or reject drivers.' });
      }
      const usersSheet = ss.getSheetByName(SHEET_NAMES.USERS);
      if (!usersSheet) {
        return jsonResponse({ ok: false, message: 'Sheet "Users" not found.' });
      }
      const rowNumber = Number(body.rowNumber);
      const nextStatus = String(body.status || '').trim().toLowerCase();
      const adminNotes = String(body.adminNotes || '').trim();

      if (!rowNumber || rowNumber < 2 || rowNumber > usersSheet.getLastRow()) {
        return jsonResponse({ ok: false, message: 'Invalid user row number.' });
      }
      if (nextStatus !== 'active' && nextStatus !== 'rejected' && nextStatus !== 'pending') {
        return jsonResponse({ ok: false, message: 'Invalid status value.' });
      }

      const rowVals = usersSheet.getRange(rowNumber, 1, 1, 13).getValues()[0];
      if (body.username && String(rowVals[2] || '').trim().toUpperCase() !== String(body.username).trim().toUpperCase()) {
        return jsonResponse({ ok: false, message: 'Driver row mismatch. Refresh and retry.' });
      }
      if (String(rowVals[0] || '').trim().toLowerCase() === 'admin') {
        return jsonResponse({ ok: false, message: 'Cannot change status of an admin account.' });
      }

      usersSheet.getRange(rowNumber, 7).setValue(nextStatus);
      usersSheet.getRange(rowNumber, 12).setValue(adminNotes);
      usersSheet.getRange(rowNumber, 13).setValue(nextStatus === 'active' ? formatCreatedAtIST(new Date()) : '');

      return jsonResponse({
        ok: true,
        message: nextStatus === 'active' ? 'Driver approved successfully.' : 'Driver status updated to ' + nextStatus + '.'
      });
    }

    // --- BANK DEPOSITS (ADMIN ONLY) ---
    if (action === 'addDeposit') {
      if (session.role !== 'admin') {
        return jsonResponse({ ok: false, message: 'Only Admin can record Deposit to Bank entries.' });
      }
      const depSheet = ss.getSheetByName(SHEET_NAMES.DEPOSITS);
      if (!depSheet) {
        return jsonResponse({ ok: false, message: 'Sheet "Bank Deposits" not found.' });
      }
      const dep = body.deposit || {};
      const depositDate = normalizeDateCell(dep.depositDate);
      if (!depositDate) {
        return jsonResponse({ ok: false, message: 'Deposit Date is required.' });
      }
      const username = String(dep.username || session.username).trim();
      const driverName = String(dep.driverName || session.name || username).trim();
      const cashDeposit = Number(dep.cashDeposit) || 0;
      const onlineDeposit = Number(dep.onlineDeposit) || 0;
      const totalDeposit = cashDeposit + onlineDeposit;
      if (cashDeposit < 0 || onlineDeposit < 0 || totalDeposit <= 0) {
        return jsonResponse({ ok: false, message: 'Enter a valid positive Cash or Online deposit amount.' });
      }

      const createdAt = formatCreatedAtIST(new Date());
      depSheet.appendRow([
        driverName,
        username,
        depositDate,
        cashDeposit,
        onlineDeposit,
        totalDeposit,
        createdAt
      ]);

      return jsonResponse({
        ok: true,
        message: 'Bank deposit recorded successfully.',
        rowNumber: depSheet.getLastRow()
      });
    }

    if (action === 'deleteDeposit') {
      if (session.role !== 'admin') {
        return jsonResponse({ ok: false, message: 'Only Admin can delete bank deposit records.' });
      }
      const depSheet = ss.getSheetByName(SHEET_NAMES.DEPOSITS);
      if (!depSheet) {
        return jsonResponse({ ok: false, message: 'Sheet "Bank Deposits" not found.' });
      }
      const rowNumber = Number(body.rowNumber);
      if (!rowNumber || rowNumber < 2 || rowNumber > depSheet.getLastRow()) {
        return jsonResponse({ ok: false, message: 'Invalid deposit row number.' });
      }
      const rowVals = depSheet.getRange(rowNumber, 1, 1, 7).getValues()[0];
      if (body.depositDate && normalizeDateCell(rowVals[2]) !== normalizeDateCell(body.depositDate)) {
        return jsonResponse({ ok: false, message: 'Deposit row mismatch. Refresh and retry.' });
      }
      depSheet.deleteRow(rowNumber);
      return jsonResponse({ ok: true, message: 'Deposit record deleted.' });
    }

    // --- AUTO EARNINGS ---
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
      const driverName = String(
        session.role === 'admin' ? (entry.driverName || session.name) : session.name
      ).trim();
      const username = String(
        session.role === 'admin' ? (entry.username || session.username) : session.username
      ).trim();

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

      const driverName = String(
        session.role === 'admin' ? (entry.driverName || currentRow[0]) : currentRow[0]
      ).trim();
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
