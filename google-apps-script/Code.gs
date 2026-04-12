const SHEET_NAME = "Auto Earnings";
const DEPOSIT_SHEET_NAME = "Bank Deposits";
const HEADERS = [
  "Entry Date",
  "Cash Earning",
  "Online Earning",
  "Total Earning",
  "Expense Amount",
  "Expense Reason",
  "Balance",
  "Created At",
];
const DEPOSIT_HEADERS = [
  "Deposit Date",
  "Cash Deposit",
  "Online Deposit",
  "Total Deposit",
  "Created At",
];

function doGet(event) {
  const action = (event.parameter && event.parameter.action) || "read";

  if (action === "read") {
    return jsonResponse({
      ok: true,
      data: {
        records: getRecords(),
        deposits: getDeposits(),
        wallet: getWallet(),
      },
    });
  }

  return jsonResponse({
    ok: false,
    message: "Unknown action.",
  });
}

function doPost(event) {
  try {
    const payload = JSON.parse(event.postData.contents || "{}");
    const action = (event.parameter && event.parameter.action) || payload.action || "create";

    if (action === "deposit") {
      return saveDeposit(payload);
    }

    const entryDate = payload.entryDate || formatDate(new Date());

    if (hasEntryForDate(entryDate)) {
      return jsonResponse({
        ok: false,
        message: "Data already entered for this date.",
      });
    }

    const cashEarning = toNumber(payload.cashEarning);
    const onlineEarning = toNumber(payload.onlineEarning);
    const expenseAmount = toNumber(payload.expenseAmount);
    const totalEarning = cashEarning + onlineEarning;
    const balance = totalEarning - expenseAmount;
    const sheet = getSheet();

    sheet.appendRow([
      entryDate,
      cashEarning,
      onlineEarning,
      totalEarning,
      expenseAmount,
      payload.expenseReason || "",
      balance,
      new Date(),
    ]);

    return jsonResponse({
      ok: true,
      message: "Entry saved.",
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      message: error.message,
    });
  }
}

function saveDeposit(payload) {
  const wallet = getWallet();
  const cashDeposit = toNumber(payload.cashDeposit);
  const onlineDeposit = toNumber(payload.onlineDeposit);
  const totalDeposit = cashDeposit + onlineDeposit;

  if (totalDeposit <= 0) {
    return jsonResponse({
      ok: false,
      message: "No available amount to deposit.",
    });
  }

  if (cashDeposit > wallet.availableCash || onlineDeposit > wallet.availableOnline) {
    return jsonResponse({
      ok: false,
      message: "Deposit amount is higher than available amount.",
    });
  }

  const sheet = getDepositSheet();
  sheet.appendRow([
    formatDate(new Date()),
    cashDeposit,
    onlineDeposit,
    totalDeposit,
    new Date(),
  ]);

  return jsonResponse({
    ok: true,
    message: "Deposit saved.",
    data: {
      wallet: getWallet(),
      deposits: getDeposits(),
    },
  });
}

function hasEntryForDate(entryDate) {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return false;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  return values.some((row) => normalizeDate(row[0]) === entryDate);
}

function getRecords() {
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  const rows = values.slice(1).reverse();

  return rows.map((row) => ({
    entryDate: normalizeDate(row[0]),
    cashEarning: toNumber(row[1]),
    onlineEarning: toNumber(row[2]),
    totalEarning: toNumber(row[3]),
    expenseAmount: toNumber(row[4]),
    expenseReason: row[5],
    balance: toNumber(row[6]),
    createdAt: normalizeDateTime(row[7]),
  }));
}

function getDeposits() {
  const sheet = getDepositSheet();
  const values = sheet.getDataRange().getValues();
  const rows = values.slice(1).reverse();

  return rows.map((row) => ({
    depositDate: normalizeDate(row[0]),
    cashDeposit: toNumber(row[1]),
    onlineDeposit: toNumber(row[2]),
    totalDeposit: toNumber(row[3]),
    createdAt: normalizeDateTime(row[4]),
  }));
}

function getWallet() {
  const records = getRecords();
  const deposits = getDeposits();

  const earnedCash = records.reduce((total, record) => total + toNumber(record.cashEarning), 0);
  const earnedOnline = records.reduce((total, record) => total + toNumber(record.onlineEarning), 0);
  const depositedCash = deposits.reduce((total, deposit) => total + toNumber(deposit.cashDeposit), 0);
  const depositedOnline = deposits.reduce((total, deposit) => total + toNumber(deposit.onlineDeposit), 0);
  const availableCash = Math.max(earnedCash - depositedCash, 0);
  const availableOnline = Math.max(earnedOnline - depositedOnline, 0);

  return {
    availableCash,
    availableOnline,
    availableTotal: availableCash + availableOnline,
    depositedCash,
    depositedOnline,
    depositedTotal: depositedCash + depositedOnline,
  };
}

function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  const currentHeaders = headerRange.getValues()[0];
  const isMissingHeaders = HEADERS.some((header, index) => currentHeaders[index] !== header);

  if (isMissingHeaders) {
    headerRange.setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function getDepositSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(DEPOSIT_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(DEPOSIT_SHEET_NAME);
  }

  const headerRange = sheet.getRange(1, 1, 1, DEPOSIT_HEADERS.length);
  const currentHeaders = headerRange.getValues()[0];
  const isMissingHeaders = DEPOSIT_HEADERS.some((header, index) => currentHeaders[index] !== header);

  if (isMissingHeaders) {
    headerRange.setValues([DEPOSIT_HEADERS]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function toNumber(value) {
  const number = Number(value || 0);
  return Number.isNaN(number) ? 0 : number;
}

function normalizeDate(value) {
  if (!value) {
    return "";
  }

  if (Object.prototype.toString.call(value) === "[object Date]") {
    return formatDate(value);
  }

  return String(value);
}

function normalizeDateTime(value) {
  if (!value) {
    return "";
  }

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
