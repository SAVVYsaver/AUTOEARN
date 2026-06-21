const USER_SHEET_NAME = "Users";
const EARNING_SHEET_NAME = "Auto Earnings";
const DEPOSIT_SHEET_NAME = "Bank Deposits";
const CHAT_SHEET_NAME = "Chat Messages";

const USER_HEADERS = [
  "Role",
  "Name",
  "Username",
  "PAN Number",
  "DOB",
  "Password Hash",
  "Status",
  "Created At",
  "Photo Data",
  "Phone",
  "Address",
  "Admin Notes",
  "Approved At"
];

const EARNING_HEADERS = [
  "Driver Name",
  "Username",
  "Entry Date",
  "Cash Earning",
  "Online Earning",
  "Total Earning",
  "Expense Amount",
  "Expense Reason",
  "Balance",
  "Created At"
];

const DEPOSIT_HEADERS = [
  "Driver Name",
  "Username",
  "Deposit Date",
  "Cash Deposit",
  "Online Deposit",
  "Total Deposit",
  "Created At"
];

const CHAT_HEADERS = [
  "Thread Id",
  "Sender Username",
  "Sender Name",
  "Sender Role",
  "Recipient Username",
  "Recipient Name",
  "Message",
  "Created At"
];

function doGet(event) {
  try {
    ensureAdminUser();
    const params = event.parameter || {};
    const action = params.action || "read";

    if (action === "read") {
      return readDashboard(params);
    }

    if (action === "messages") {
      return getMessages(params);
    }

    return jsonResponse({ ok: false, message: "Unknown action." });
  } catch (error) {
    return jsonResponse({ ok: false, message: error.message });
  }
}

function doPost(event) {
  try {
    ensureAdminUser();
    const payload = JSON.parse((event.postData && event.postData.contents) || "{}");
    const action = ((event.parameter || {}).action) || payload.action || "create";

    if (action === "register") return registerUser(payload, false);
    if (action === "login") return loginUser(payload);
    if (action === "resetPassword") return resetPassword(payload);
    if (action === "listUsers") return listUsers(payload);
    if (action === "approveUser") return approveUser(payload);
    if (action === "rejectUser") return rejectUser(payload);
    if (action === "adminCreateUser") return registerUser(payload, true);
    if (action === "deleteUser") return deleteUser(payload);
    if (action === "deposit") return saveDeposit(payload);
    if (action === "create") return saveEntry(payload);
    if (action === "updateProfile") return updateProfile(payload);
    if (action === "sendMessage") return sendMessage(payload);

    return jsonResponse({ ok: false, message: "Unknown action." });
  } catch (error) {
    return jsonResponse({ ok: false, message: error.message });
  }
}

function readDashboard(params) {
  const user = getUserByKey(params.userKey);
  if (!user || user.status === "deleted" || user.status === "rejected") {
    return jsonResponse({ ok: false, message: "Login required." });
  }

  const scopeKey = user.role === "admin" ? "" : user.userKey;
  const records = getRecords(scopeKey);
  const deposits = getDeposits(scopeKey);
  const users = getUsers();
  const activeUsers = users.filter((item) => item.status === "active");
  const counterpartUsers = user.role === "admin"
    ? activeUsers.filter((item) => item.role === "user")
    : activeUsers.filter((item) => item.role === "admin");

  return jsonResponse({
    ok: true,
    data: {
      records: records,
      deposits: deposits,
      wallet: getWallet(scopeKey),
      profile: sanitizeProfile(user),
      users: user.role === "admin" ? users.map(sanitizeProfile) : [],
      pendingUsers: user.role === "admin" ? users.filter((item) => item.status === "pending").map(sanitizeProfile) : [],
      missedDates: user.role === "user" ? getMissedDates(user.userKey, user.createdAt) : [],
      contacts: counterpartUsers.map(sanitizeProfile),
      adminProfile: sanitizeProfile(getUserByKey("RAHUL")),
      threadMessages: getMessagesForUser(user)
    }
  });
}

function registerUser(payload, byAdmin) {
  if (byAdmin) requireAdmin(payload.adminKey);

  const role = payload.role === "admin" ? "admin" : "user";
  const name = cleanText(payload.name);
  const userKey = cleanKey(payload.username || payload.userKey);
  const pan = cleanKey(payload.pan);
  const dob = payload.dob || "";
  const password = String(payload.password || "");
  const phone = cleanText(payload.phone);
  const address = cleanText(payload.address);
  const photoData = cleanPhoto(payload.photoData);

  if (!name || !userKey || !password || (role === "user" && (!dob || !pan))) {
    return jsonResponse({ ok: false, message: "Name, username, PAN, DOB and password required." });
  }

  if (getUserByKey(userKey)) {
    return jsonResponse({ ok: false, message: "This PAN / username is already registered." });
  }

  const status = byAdmin || role === "admin" ? "active" : "pending";
  const approvedAt = status === "active" ? new Date() : "";

  getUserSheet().appendRow([
    role,
    name,
    userKey,
    pan,
    dob,
    hashPassword(password),
    status,
    new Date(),
    photoData,
    phone,
    address,
    "",
    approvedAt
  ]);

  return jsonResponse({
    ok: true,
    message: status === "pending"
      ? "Account request sent to admin for approval."
      : "User registered."
  });
}

function loginUser(payload) {
  const userKey = cleanKey(payload.username || payload.userKey);
  const password = String(payload.password || "");
  const requestedRole = payload.role || "user";
  const user = getUserByKey(userKey);

  if (!user || user.role !== requestedRole) {
    return jsonResponse({ ok: false, message: "Invalid login details." });
  }

  if (user.status === "pending") {
    return jsonResponse({ ok: false, message: "Your account is pending admin approval." });
  }

  if (user.status !== "active") {
    return jsonResponse({ ok: false, message: "This account is not active." });
  }

  if (user.passwordHash !== hashPassword(password)) {
    return jsonResponse({ ok: false, message: "Invalid password." });
  }

  return jsonResponse({
    ok: true,
    data: {
      user: {
        role: user.role,
        name: user.name,
        userKey: user.userKey
      }
    }
  });
}

function resetPassword(payload) {
  const userKey = cleanKey(payload.username || payload.userKey);
  const pan = cleanKey(payload.pan);
  const dob = payload.dob || "";
  const newPassword = String(payload.newPassword || "");
  const user = getUserByKey(userKey);

  if (!user || user.role !== "user" || user.pan !== pan || user.dob !== dob) {
    return jsonResponse({ ok: false, message: "Username, PAN and DOB verification failed." });
  }

  if (!newPassword) {
    return jsonResponse({ ok: false, message: "New password required." });
  }

  getUserSheet().getRange(user.rowIndex, 6).setValue(hashPassword(newPassword));
  return jsonResponse({ ok: true, message: "Password reset." });
}

function listUsers(payload) {
  requireAdmin(payload.adminKey);
  return jsonResponse({
    ok: true,
    data: {
      users: getUsers().map(sanitizeProfile)
    }
  });
}

function approveUser(payload) {
  requireAdmin(payload.adminKey);
  const user = getUserByKey(payload.userKey);
  if (!user) return jsonResponse({ ok: false, message: "User not found." });
  if (user.role === "admin") return jsonResponse({ ok: false, message: "Admin user cannot be approved here." });

  getUserSheet().getRange(user.rowIndex, 7).setValue("active");
  getUserSheet().getRange(user.rowIndex, 13).setValue(new Date());
  return jsonResponse({ ok: true, message: "User approved." });
}

function rejectUser(payload) {
  requireAdmin(payload.adminKey);
  const user = getUserByKey(payload.userKey);
  if (!user) return jsonResponse({ ok: false, message: "User not found." });
  if (user.role === "admin") return jsonResponse({ ok: false, message: "Admin user cannot be rejected." });

  getUserSheet().getRange(user.rowIndex, 7).setValue("rejected");
  return jsonResponse({ ok: true, message: "User rejected." });
}

function deleteUser(payload) {
  requireAdmin(payload.adminKey);
  const userKey = cleanKey(payload.userKey);
  const user = getUserByKey(userKey);

  if (!user) return jsonResponse({ ok: false, message: "User not found." });
  if (user.role === "admin") return jsonResponse({ ok: false, message: "Admin cannot be deleted." });

  getUserSheet().getRange(user.rowIndex, 7).setValue("deleted");
  return jsonResponse({ ok: true, message: "User deleted." });
}

function updateProfile(payload) {
  const admin = getUserByKey(payload.adminKey);
  const actor = getUserByKey(payload.userKey);
  const targetKey = cleanKey(payload.targetUserKey || payload.userKey);
  const target = getUserByKey(targetKey);

  if (!target) {
    return jsonResponse({ ok: false, message: "Profile not found." });
  }

  const isAdmin = admin && admin.role === "admin" && admin.status === "active";
  const isSelf = actor && actor.userKey === target.userKey && actor.status === "active";

  if (!isAdmin && !isSelf) {
    return jsonResponse({ ok: false, message: "Profile update not allowed." });
  }

  const sheet = getUserSheet();
  const name = cleanText(payload.name);
  const phone = cleanText(payload.phone);
  const address = cleanText(payload.address);
  const photoData = cleanPhoto(payload.photoData);
  const adminNotes = cleanText(payload.adminNotes);

  if (name) sheet.getRange(target.rowIndex, 2).setValue(name);
  sheet.getRange(target.rowIndex, 9).setValue(photoData);
  sheet.getRange(target.rowIndex, 10).setValue(phone);
  sheet.getRange(target.rowIndex, 11).setValue(address);
  if (isAdmin) {
    sheet.getRange(target.rowIndex, 12).setValue(adminNotes);
  }

  return jsonResponse({
    ok: true,
    message: "Profile updated.",
    data: { profile: sanitizeProfile(getUserByKey(target.userKey)) }
  });
}

function saveEntry(payload) {
  const user = getUserByKey(payload.userKey);
  if (!user || user.status !== "active" || user.role !== "user") {
    return jsonResponse({ ok: false, message: "Valid user login required." });
  }

  const today = formatDate(new Date());
  const entryDate = payload.entryDate || today;
  if (entryDate > today) {
    return jsonResponse({ ok: false, message: "Future dates are not allowed." });
  }

  if (hasEntryForDate(user.userKey, entryDate)) {
    return jsonResponse({ ok: false, message: "Data already entered for this date." });
  }

  const cashEarning = toNumber(payload.cashEarning);
  const onlineEarning = toNumber(payload.onlineEarning);
  const expenseAmount = toNumber(payload.expenseAmount);
  const totalEarning = cashEarning + onlineEarning;
  const balance = totalEarning - expenseAmount;

  getEarningSheet().appendRow([
    user.name,
    user.userKey,
    entryDate,
    cashEarning,
    onlineEarning,
    totalEarning,
    expenseAmount,
    cleanText(payload.expenseReason),
    balance,
    new Date()
  ]);

  return jsonResponse({ ok: true, message: "Entry saved." });
}

function saveDeposit(payload) {
  const admin = getUserByKey(payload.adminKey);
  const actingUser = getUserByKey(payload.userKey);
  let user = null;

  if (admin && admin.role === "admin" && admin.status === "active") {
    user = getUserByKey(payload.targetUserKey);
  } else if (actingUser && actingUser.role === "user" && actingUser.status === "active") {
    user = actingUser;
  } else {
    return jsonResponse({ ok: false, message: "Valid login required." });
  }

  if (!user || user.status !== "active" || user.role !== "user") {
    return jsonResponse({ ok: false, message: "Valid user required for deposit." });
  }

  const wallet = getWallet(user.userKey);
  const cashDeposit = toNumber(payload.cashDeposit);
  const onlineDeposit = toNumber(payload.onlineDeposit);
  const totalDeposit = cashDeposit + onlineDeposit;

  if (totalDeposit <= 0) return jsonResponse({ ok: false, message: "No available amount to deposit." });
  if (cashDeposit > wallet.availableCash || onlineDeposit > wallet.availableOnline) {
    return jsonResponse({ ok: false, message: "Deposit amount is higher than available amount." });
  }

  getDepositSheet().appendRow([
    user.name,
    user.userKey,
    formatDate(new Date()),
    cashDeposit,
    onlineDeposit,
    totalDeposit,
    new Date()
  ]);
  return jsonResponse({ ok: true, message: "Deposit saved." });
}

function sendMessage(payload) {
  const sender = getUserByKey(payload.userKey);
  if (!sender || sender.status !== "active") {
    return jsonResponse({ ok: false, message: "Valid login required." });
  }

  const recipient = getUserByKey(payload.recipientUserKey);
  if (!recipient || recipient.status !== "active") {
    return jsonResponse({ ok: false, message: "Recipient not found." });
  }

  const message = cleanText(payload.message);
  if (!message) {
    return jsonResponse({ ok: false, message: "Message required." });
  }

  const threadId = buildThreadId(sender.userKey, recipient.userKey);
  getChatSheet().appendRow([
    threadId,
    sender.userKey,
    sender.name,
    sender.role,
    recipient.userKey,
    recipient.name,
    message,
    new Date()
  ]);

  return jsonResponse({
    ok: true,
    message: "Message sent.",
    data: { messages: getMessagesForPair(sender.userKey, recipient.userKey) }
  });
}

function getMessages(params) {
  const user = getUserByKey(params.userKey);
  if (!user || user.status !== "active") {
    return jsonResponse({ ok: false, message: "Valid login required." });
  }

  const otherUserKey = cleanKey(params.otherUserKey);
  if (otherUserKey) {
    return jsonResponse({
      ok: true,
      data: {
        messages: getMessagesForPair(user.userKey, otherUserKey)
      }
    });
  }

  return jsonResponse({
    ok: true,
    data: {
      messages: getMessagesForUser(user)
    }
  });
}

function hasEntryForDate(userKey, entryDate) {
  return getRecords(userKey).some((record) => record.entryDate === entryDate);
}

function getRecords(userKey) {
  const values = getEarningSheet().getDataRange().getValues();
  return values.slice(1)
    .filter((row) => !userKey || cleanKey(row[1]) === userKey)
    .reverse()
    .map((row) => ({
      driverName: row[0],
      userKey: cleanKey(row[1]),
      entryDate: normalizeDate(row[2]),
      cashEarning: toNumber(row[3]),
      onlineEarning: toNumber(row[4]),
      totalEarning: toNumber(row[5]),
      expenseAmount: toNumber(row[6]),
      expenseReason: row[7],
      balance: toNumber(row[8]),
      createdAt: normalizeDateTime(row[9])
    }));
}

function getDeposits(userKey) {
  const values = getDepositSheet().getDataRange().getValues();
  return values.slice(1)
    .filter((row) => !userKey || cleanKey(row[1]) === userKey)
    .reverse()
    .map((row) => ({
      driverName: row[0],
      userKey: cleanKey(row[1]),
      depositDate: normalizeDate(row[2]),
      cashDeposit: toNumber(row[3]),
      onlineDeposit: toNumber(row[4]),
      totalDeposit: toNumber(row[5]),
      createdAt: normalizeDateTime(row[6])
    }));
}

function getWallet(userKey) {
  const records = getRecords(userKey);
  const deposits = getDeposits(userKey);
  const earnedCash = records.reduce((total, record) => total + toNumber(record.cashEarning), 0);
  const earnedOnline = records.reduce((total, record) => total + toNumber(record.onlineEarning), 0);
  const totalExpense = records.reduce((total, record) => total + toNumber(record.expenseAmount), 0);
  const depositedCash = deposits.reduce((total, deposit) => total + toNumber(deposit.cashDeposit), 0);
  const depositedOnline = deposits.reduce((total, deposit) => total + toNumber(deposit.onlineDeposit), 0);
  const expenseFromCash = Math.min(earnedCash, totalExpense);
  const expenseFromOnline = Math.max(totalExpense - expenseFromCash, 0);
  const availableCash = Math.max(earnedCash - expenseFromCash - depositedCash, 0);
  const availableOnline = Math.max(earnedOnline - expenseFromOnline - depositedOnline, 0);

  return {
    availableCash: availableCash,
    availableOnline: availableOnline,
    availableTotal: availableCash + availableOnline,
    depositedCash: depositedCash,
    depositedOnline: depositedOnline,
    depositedTotal: depositedCash + depositedOnline,
    totalExpense: totalExpense
  };
}

function getMessagesForUser(user) {
  const values = getChatSheet().getDataRange().getValues();
  return values.slice(1)
    .filter((row) => cleanKey(row[1]) === user.userKey || cleanKey(row[4]) === user.userKey)
    .reverse()
    .map(mapChatRow);
}

function getMessagesForPair(firstUserKey, secondUserKey) {
  const threadId = buildThreadId(firstUserKey, secondUserKey);
  const values = getChatSheet().getDataRange().getValues();
  return values.slice(1)
    .filter((row) => String(row[0]) === threadId)
    .map(mapChatRow);
}

function mapChatRow(row) {
  return {
    threadId: row[0],
    senderUserKey: cleanKey(row[1]),
    senderName: row[2],
    senderRole: row[3],
    recipientUserKey: cleanKey(row[4]),
    recipientName: row[5],
    message: row[6],
    createdAt: normalizeDateTime(row[7])
  };
}

function getMissedDates(userKey, createdAt) {
  const createdDate = createdAt && Object.prototype.toString.call(createdAt) === "[object Date]"
    ? createdAt
    : new Date(createdAt || new Date());
  const start = new Date(createdDate);
  start.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const earliestAllowed = new Date(today);
  earliestAllowed.setDate(today.getDate() - 60);

  const firstDate = start > earliestAllowed ? start : earliestAllowed;
  const existing = {};
  getRecords(userKey).forEach((record) => {
    existing[record.entryDate] = true;
  });

  const result = [];
  const cursor = new Date(firstDate);
  while (cursor <= today) {
    const key = formatDate(cursor);
    if (!existing[key]) {
      result.push(key);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return result.reverse();
}

function sanitizeProfile(user) {
  if (!user) return {};
  return {
    role: user.role,
    name: user.name,
    username: user.userKey,
    pan: user.pan,
    dob: user.dob,
    status: user.status,
    createdAt: normalizeDateTime(user.createdAt),
    photoData: user.photoData || "",
    phone: user.phone || "",
    address: user.address || "",
    adminNotes: user.adminNotes || "",
    approvedAt: normalizeDateTime(user.approvedAt)
  };
}

function ensureAdminUser() {
  const admin = getUserByKey("RAHUL");
  if (!admin) {
    getUserSheet().appendRow([
      "admin",
      "Rahul",
      "RAHUL",
      "",
      "",
      hashPassword("1912"),
      "active",
      new Date(),
      "",
      "",
      "",
      "DealsKart administrator",
      new Date()
    ]);
  }
}

function requireAdmin(adminKey) {
  const admin = getUserByKey(adminKey);
  if (!admin || admin.role !== "admin" || admin.status !== "active") {
    throw new Error("Admin access required.");
  }
}

function buildThreadId(first, second) {
  return [cleanKey(first), cleanKey(second)].sort().join("__");
}

function getUserByKey(userKey) {
  return getUsers().find((user) => user.userKey === cleanKey(userKey));
}

function getUsers() {
  const values = getUserSheet().getDataRange().getValues();
  return values.slice(1).map((row, index) => {
    const role = row[0] || "user";
    const isVeryOldRow = row.length < 8 || row[5] === "active" || row[5] === "deleted";
    if (isVeryOldRow) {
      return {
        rowIndex: index + 2,
        role: role,
        name: row[1],
        userKey: cleanKey(row[2]),
        pan: "",
        dob: normalizeDate(row[3]),
        passwordHash: row[4] || "",
        status: row[5] || "active",
        createdAt: row[6] || "",
        photoData: "",
        phone: "",
        address: "",
        adminNotes: "",
        approvedAt: ""
      };
    }

    return {
      rowIndex: index + 2,
      role: role,
      name: row[1],
      userKey: cleanKey(row[2]),
      pan: cleanKey(row[3]),
      dob: normalizeDate(row[4]),
      passwordHash: row[5] || "",
      status: row[6] || "pending",
      createdAt: row[7] || "",
      photoData: row[8] || "",
      phone: row[9] || "",
      address: row[10] || "",
      adminNotes: row[11] || "",
      approvedAt: row[12] || ""
    };
  });
}

function getUserSheet() {
  return getSheetWithHeaders(USER_SHEET_NAME, USER_HEADERS);
}

function getEarningSheet() {
  return getSheetWithHeaders(EARNING_SHEET_NAME, EARNING_HEADERS);
}

function getDepositSheet() {
  return getSheetWithHeaders(DEPOSIT_SHEET_NAME, DEPOSIT_HEADERS);
}

function getChatSheet() {
  return getSheetWithHeaders(CHAT_SHEET_NAME, CHAT_HEADERS);
}

function getSheetWithHeaders(sheetName, headers) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(sheetName);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  const currentHeaders = headerRange.getValues()[0];
  const isMissingHeaders = headers.some((header, index) => currentHeaders[index] !== header);
  if (isMissingHeaders) {
    headerRange.setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function hashPassword(password) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(password),
    Utilities.Charset.UTF_8
  );
  return digest.map((byte) => {
    const value = byte < 0 ? byte + 256 : byte;
    return ("0" + value.toString(16)).slice(-2);
  }).join("");
}

function cleanPhoto(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length > 500000 ? text.slice(0, 500000) : text;
}

function cleanKey(value) {
  return String(value || "").trim().toUpperCase();
}

function cleanText(value) {
  return String(value || "").trim();
}

function toNumber(value) {
  const number = Number(value || 0);
  return Number.isNaN(number) ? 0 : number;
}

function normalizeDate(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") return formatDate(value);
  return String(value);
}

function normalizeDateTime(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  }
  return String(value);
}

function formatDate(value) {
  return Utilities.formatDate(new Date(value), Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
