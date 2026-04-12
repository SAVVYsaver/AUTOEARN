const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyBaa0bgLsl5C6BXoSG6u1-kBsd7Cj14hJ8DQBmtqroSVWuY8rr3ds5QfMOaZ-2dbFaJQ/exec";
const LOGIN_PASSWORD = "1912";
const SESSION_KEY = "dealskartAutoDiaryLoggedIn";

const loginScreen = document.querySelector("#loginScreen");
const loginForm = document.querySelector("#loginForm");
const loginStatus = document.querySelector("#loginStatus");
const appShell = document.querySelector("#appShell");
const logoutButton = document.querySelector("#logoutButton");
const form = document.querySelector("#entryForm");
const formStatus = document.querySelector("#formStatus");
const recordsBody = document.querySelector("#recordsBody");
const depositsBody = document.querySelector("#depositsBody");
const refreshButton = document.querySelector("#refreshButton");
const depositButton = document.querySelector("#depositButton");
const depositStatus = document.querySelector("#depositStatus");
const entryDate = document.querySelector("#entryDate");
const cashEarning = document.querySelector("#cashEarning");
const onlineEarning = document.querySelector("#onlineEarning");
const expenseAmount = document.querySelector("#expenseAmount");
const totalPreview = document.querySelector("#totalPreview");
const balancePreview = document.querySelector("#balancePreview");
const submitEntryButton = document.querySelector("#submitEntryButton");
const tabButtons = document.querySelectorAll(".tab-button");
const tabPanels = document.querySelectorAll(".tab-panel");

const summaryElements = {
  sevenDayEarning: document.querySelector("#sevenDayEarning"),
  monthEarning: document.querySelector("#monthEarning"),
  totalEarning: document.querySelector("#totalEarning"),
  totalExpense: document.querySelector("#totalExpense"),
  netSaving: document.querySelector("#netSaving"),
};

const walletElements = {
  availableTotal: document.querySelector("#availableTotal"),
  availableCash: document.querySelector("#availableCash"),
  availableOnline: document.querySelector("#availableOnline"),
  depositedTotal: document.querySelector("#depositedTotal"),
};

let currentWallet = {
  availableCash: 0,
  availableOnline: 0,
  availableTotal: 0,
  depositedTotal: 0,
};

function setTodayDate() {
  const today = new Date();
  const timezoneOffset = today.getTimezoneOffset() * 60000;
  entryDate.value = new Date(today.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function setStatus(message, type = "") {
  formStatus.textContent = message;
  formStatus.className = `status ${type}`.trim();
}

function setLoginStatus(message, type = "") {
  loginStatus.textContent = message;
  loginStatus.className = `status ${type}`.trim();
}

function setDepositStatus(message, type = "") {
  depositStatus.textContent = message;
  depositStatus.className = `status ${type}`.trim();
}

function getNumber(value) {
  return Number(value || 0);
}

function formatCurrency(value) {
  return `Rs ${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(getNumber(value))}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getEndpointUrl(action) {
  if (!SCRIPT_URL || SCRIPT_URL.includes("PASTE_YOUR")) {
    throw new Error("Google Apps Script URL script.js me paste karein.");
  }

  const url = new URL(SCRIPT_URL);
  url.searchParams.set("action", action);
  return url;
}

function updatePreview() {
  const total = getNumber(cashEarning.value) + getNumber(onlineEarning.value);
  const balance = total - getNumber(expenseAmount.value);
  totalPreview.textContent = formatCurrency(total);
  balancePreview.textContent = formatCurrency(balance);
}

function parseSheetDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function calculateSummary(records) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(todayStart.getDate() - 6);

  return records.reduce((summary, record) => {
    const recordDate = parseSheetDate(record.entryDate);
    const total = getNumber(record.totalEarning);
    const expense = getNumber(record.expenseAmount);

    summary.totalEarning += total;
    summary.totalExpense += expense;

    if (recordDate && recordDate >= sevenDaysAgo && recordDate <= todayStart) {
      summary.sevenDayEarning += total;
    }

    if (recordDate && recordDate.getFullYear() === now.getFullYear() && recordDate.getMonth() === now.getMonth()) {
      summary.monthEarning += total;
    }

    return summary;
  }, {
    sevenDayEarning: 0,
    monthEarning: 0,
    totalEarning: 0,
    totalExpense: 0,
  });
}

function renderSummary(records) {
  const summary = calculateSummary(records);
  const netSaving = summary.totalEarning - summary.totalExpense;
  summaryElements.sevenDayEarning.textContent = formatCurrency(summary.sevenDayEarning);
  summaryElements.monthEarning.textContent = formatCurrency(summary.monthEarning);
  summaryElements.totalEarning.textContent = formatCurrency(summary.totalEarning);
  summaryElements.totalExpense.textContent = formatCurrency(summary.totalExpense);
  summaryElements.netSaving.textContent = formatCurrency(netSaving);
}

function renderWallet(wallet = {}) {
  currentWallet = {
    availableCash: getNumber(wallet.availableCash),
    availableOnline: getNumber(wallet.availableOnline),
    availableTotal: getNumber(wallet.availableTotal),
    depositedTotal: getNumber(wallet.depositedTotal),
  };

  walletElements.availableTotal.textContent = formatCurrency(currentWallet.availableTotal);
  walletElements.availableCash.textContent = formatCurrency(currentWallet.availableCash);
  walletElements.availableOnline.textContent = formatCurrency(currentWallet.availableOnline);
  walletElements.depositedTotal.textContent = formatCurrency(currentWallet.depositedTotal);
  depositButton.disabled = currentWallet.availableTotal <= 0;
}

function renderDeposits(deposits = []) {
  if (!deposits.length) {
    depositsBody.innerHTML = '<tr><td colspan="4">Abhi koi bank deposit record nahi hai.</td></tr>';
    return;
  }

  depositsBody.innerHTML = deposits.map((row) => `
    <tr>
      <td>${escapeHtml(row.depositDate)}</td>
      <td>${escapeHtml(formatCurrency(row.cashDeposit))}</td>
      <td>${escapeHtml(formatCurrency(row.onlineDeposit))}</td>
      <td>${escapeHtml(formatCurrency(row.totalDeposit))}</td>
    </tr>
  `).join("");
}

function setEntryLocked(isLocked) {
  form.classList.toggle("disabled", isLocked);
  submitEntryButton.disabled = isLocked;
  [cashEarning, onlineEarning, expenseAmount, form.elements.expenseReason].forEach((input) => {
    input.disabled = isLocked;
  });
}

function updateTodayEntryState(records) {
  const alreadyEntered = records.some((record) => record.entryDate === entryDate.value);
  setEntryLocked(alreadyEntered);

  if (alreadyEntered) {
    setStatus("Data already entered for today. Ek din me only one entry allowed hai.", "error");
  } else if (!formStatus.textContent.includes("save")) {
    setStatus("Aaj ki entry ready hai.", "success");
  }
}

async function loadRecords() {
  recordsBody.innerHTML = '<tr><td colspan="7">Loading records...</td></tr>';
  depositsBody.innerHTML = '<tr><td colspan="4">Loading deposits...</td></tr>';

  try {
    const response = await fetch(getEndpointUrl("read"));
    const result = await response.json();

    if (!result.ok) {
      throw new Error(result.message || "Records load nahi ho paye.");
    }

    const records = Array.isArray(result.data) ? result.data : (result.data.records || []);
    const deposits = Array.isArray(result.data) ? [] : (result.data.deposits || []);
    const wallet = Array.isArray(result.data) ? {} : (result.data.wallet || {});

    renderSummary(records);
    renderWallet(wallet);
    renderDeposits(deposits);
    updateTodayEntryState(records);

    if (!records.length) {
      recordsBody.innerHTML = '<tr><td colspan="7">Abhi koi record nahi hai.</td></tr>';
      return;
    }

    recordsBody.innerHTML = records.map((row) => `
      <tr>
        <td>${escapeHtml(row.entryDate)}</td>
        <td>${escapeHtml(formatCurrency(row.cashEarning))}</td>
        <td>${escapeHtml(formatCurrency(row.onlineEarning))}</td>
        <td>${escapeHtml(formatCurrency(row.totalEarning))}</td>
        <td>${escapeHtml(formatCurrency(row.expenseAmount))}</td>
        <td>${escapeHtml(row.expenseReason || "-")}</td>
        <td>${escapeHtml(formatCurrency(row.balance))}</td>
      </tr>
    `).join("");
  } catch (error) {
    recordsBody.innerHTML = `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`;
    depositsBody.innerHTML = `<tr><td colspan="4">${escapeHtml(error.message)}</td></tr>`;
    setStatus(error.message, "error");
  }
}

async function showApp() {
  loginScreen.classList.add("hidden");
  appShell.classList.remove("hidden");
  setTodayDate();
  updatePreview();
  await loadRecords();
}

function showLogin() {
  appShell.classList.add("hidden");
  loginScreen.classList.remove("hidden");
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = document.querySelector("#password").value;

  if (password !== LOGIN_PASSWORD) {
    setLoginStatus("Wrong password. Password 1912 hai.", "error");
    return;
  }

  sessionStorage.setItem(SESSION_KEY, "true");
  setLoginStatus("");
  await showApp();
});

logoutButton.addEventListener("click", () => {
  sessionStorage.removeItem(SESSION_KEY);
  showLogin();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = Object.fromEntries(new FormData(form).entries());
  const cash = getNumber(formData.cashEarning);
  const online = getNumber(formData.onlineEarning);
  const expense = getNumber(formData.expenseAmount);

  formData.cashEarning = cash;
  formData.onlineEarning = online;
  formData.totalEarning = cash + online;
  formData.expenseAmount = expense;
  formData.balance = formData.totalEarning - expense;

  submitEntryButton.disabled = true;
  setStatus("Entry save ho rahi hai...");

  try {
    const response = await fetch(getEndpointUrl("create"), {
      method: "POST",
      body: JSON.stringify(formData),
    });
    const result = await response.json();

    if (!result.ok) {
      throw new Error(result.message || "Entry save nahi ho payi.");
    }

    form.reset();
    setTodayDate();
    updatePreview();
    setStatus("Entry Google Sheet me save ho gayi.", "success");
    await loadRecords();
  } catch (error) {
    setStatus(error.message, "error");
    submitEntryButton.disabled = false;
  }
});

depositButton.addEventListener("click", async () => {
  if (currentWallet.availableTotal <= 0) {
    setDepositStatus("Deposit ke liye abhi koi available amount nahi hai.", "error");
    return;
  }

  depositButton.disabled = true;
  setDepositStatus("Bank deposit record save ho raha hai...");

  try {
    const response = await fetch(getEndpointUrl("deposit"), {
      method: "POST",
      body: JSON.stringify({
        cashDeposit: currentWallet.availableCash,
        onlineDeposit: currentWallet.availableOnline,
      }),
    });
    const result = await response.json();

    if (!result.ok) {
      throw new Error(result.message || "Deposit save nahi ho paya.");
    }

    setDepositStatus("Deposit Google Sheet me save ho gaya. Available amount zero ho gaya.", "success");
    await loadRecords();
  } catch (error) {
    setDepositStatus(error.message, "error");
    depositButton.disabled = false;
  }
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    tabButtons.forEach((tabButton) => tabButton.classList.remove("active"));
    tabPanels.forEach((panel) => panel.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`#${button.dataset.tab}`).classList.add("active");

    if (button.dataset.tab === "earningsPanel") {
      loadRecords();
    }
  });
});

[cashEarning, onlineEarning, expenseAmount].forEach((input) => {
  input.addEventListener("input", updatePreview);
});

refreshButton.addEventListener("click", loadRecords);
setTodayDate();
updatePreview();

if (sessionStorage.getItem(SESSION_KEY) === "true") {
  showApp();
}
