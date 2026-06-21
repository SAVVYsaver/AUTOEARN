const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyBaa0bgLsl5C6BXoSG6u1-kBsd7Cj14hJ8DQBmtqroSVWuY8rr3ds5QfMOaZ-2dbFaJQ/exec";
const SESSION_KEY = "dealskartAutoDiarySession";
const SESSION_DEADLINE_KEY = "dealskartAutoDiarySessionDeadline";
const LAST_LOGIN_KEY = "dealskartLastLoginName";
const SESSION_SECONDS = 120;
const CHAT_POLL_MS = 5000;

const $ = (selector) => document.querySelector(selector);

const ui = {
  loadingOverlay: $("#loadingOverlay"),
  loginScreen: $("#loginScreen"),
  appShell: $("#appShell"),
  authForms: document.querySelectorAll(".auth-form"),
  authLinks: document.querySelectorAll(".link-button"),
  loginForm: $("#loginForm"),
  registerForm: $("#registerForm"),
  forgotForm: $("#forgotForm"),
  loginKeyLabel: $("#loginKeyLabel span"),
  loginKey: $("#loginKey"),
  loginPassword: $("#loginPassword"),
  loginStatus: $("#loginStatus"),
  reloginButton: $("#reloginButton"),
  logoutButton: $("#logoutButton"),
  driverBadge: $("#driverBadge"),
  countdown: $("#sessionCountdown"),
  walletPanel: $("#walletPanel"),
  availableTotal: $("#availableTotal"),
  availableCash: $("#availableCash"),
  availableOnline: $("#availableOnline"),
  depositedTotal: $("#depositedTotal"),
  depositStatus: $("#depositStatus"),
  tabButtons: document.querySelectorAll(".tab-button"),
  tabPanels: document.querySelectorAll(".tab-panel"),
  entryTabButton: $("#entryTabButton"),
  adminTabButton: $("#adminTabButton"),
  entryForm: $("#entryForm"),
  entryDate: $("#entryDate"),
  cashEarning: $("#cashEarning"),
  onlineEarning: $("#onlineEarning"),
  expenseAmount: $("#expenseAmount"),
  expenseReason: $("#expenseReason"),
  totalPreview: $("#totalPreview"),
  balancePreview: $("#balancePreview"),
  submitEntryButton: $("#submitEntryButton"),
  formStatus: $("#formStatus"),
  missedDatesList: $("#missedDatesList"),
  refreshButton: $("#refreshButton"),
  recordsBody: $("#recordsBody"),
  depositsBody: $("#depositsBody"),
  sevenDayEarning: $("#sevenDayEarning"),
  monthEarning: $("#monthEarning"),
  totalEarning: $("#totalEarning"),
  totalExpense: $("#totalExpense"),
  netSaving: $("#netSaving"),
  earningSplitChart: $("#earningSplitChart"),
  earningSplitLegend: $("#earningSplitLegend"),
  savingsSplitChart: $("#savingsSplitChart"),
  savingsSplitLegend: $("#savingsSplitLegend"),
  walletSplitChart: $("#walletSplitChart"),
  walletSplitLegend: $("#walletSplitLegend"),
  profileForm: $("#profileForm"),
  profilePhotoPreview: $("#profilePhotoPreview"),
  profilePhotoInput: $("#profilePhotoInput"),
  choosePhotoButton: $("#choosePhotoButton"),
  profileName: $("#profileName"),
  profileUsername: $("#profileUsername"),
  profilePan: $("#profilePan"),
  profileDob: $("#profileDob"),
  profilePhone: $("#profilePhone"),
  profileAddress: $("#profileAddress"),
  profileAdminNotes: $("#profileAdminNotes"),
  profileStatus: $("#profileStatus"),
  contactName: $("#contactName"),
  contactRole: $("#contactRole"),
  contactPhone: $("#contactPhone"),
  contactAddress: $("#contactAddress"),
  chatRecipient: $("#chatRecipient"),
  chatContactName: $("#chatContactName"),
  chatContactRole: $("#chatContactRole"),
  chatContactPhone: $("#chatContactPhone"),
  chatContactAddress: $("#chatContactAddress"),
  chatMessages: $("#chatMessages"),
  chatForm: $("#chatForm"),
  chatMessageInput: $("#chatMessageInput"),
  chatStatus: $("#chatStatus"),
  adminRefreshButton: $("#adminRefreshButton"),
  activeUsers: $("#activeUsers"),
  pendingUsersCount: $("#pendingUsersCount"),
  averageDailyEarning: $("#averageDailyEarning"),
  averageExpense: $("#averageExpense"),
  pendingDeposit: $("#pendingDeposit"),
  approvalBody: $("#approvalBody"),
  adminDepositUser: $("#adminDepositUser"),
  adminDepositCash: $("#adminDepositCash"),
  adminDepositOnline: $("#adminDepositOnline"),
  adminDepositTotal: $("#adminDepositTotal"),
  adminDepositButton: $("#adminDepositButton"),
  adminDepositStatus: $("#adminDepositStatus"),
  usersBody: $("#usersBody"),
  adminStatus: $("#adminStatus")
};

let currentSession = null;
let logoutDeadline = 0;
let countdownTimer = null;
let loadingDepth = 0;
let chatPollTimer = null;
let lastLoginName = localStorage.getItem(LAST_LOGIN_KEY) || "";
let profilePhotoData = "";
let dashboardState = {
  records: [],
  deposits: [],
  wallet: {},
  profile: null,
  users: [],
  pendingUsers: [],
  missedDates: [],
  contacts: [],
  adminProfile: null,
  threadMessages: []
};

function formatCurrency(value) {
  return `Rs ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(value || 0))}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setMessage(element, message, type = "") {
  element.textContent = message;
  element.className = `status ${type}`.trim();
}

function setLoadingState(active) {
  loadingDepth = active ? loadingDepth + 1 : Math.max(loadingDepth - 1, 0);
  ui.loadingOverlay.classList.toggle("hidden", loadingDepth === 0);
}

function getEndpointUrl(action, extra = {}) {
  const url = new URL(SCRIPT_URL);
  url.searchParams.set("action", action);
  if (currentSession?.userKey) {
    url.searchParams.set("userKey", currentSession.userKey);
  }
  Object.entries(extra).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });
  return url;
}

async function postAction(action, payload) {
  setLoadingState(true);
  try {
    const response = await fetch(getEndpointUrl(action), {
      method: "POST",
      body: JSON.stringify(payload || {})
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.message || "Request failed.");
    return result;
  } finally {
    setLoadingState(false);
  }
}

async function getAction(action, extra = {}) {
  setLoadingState(true);
  try {
    const response = await fetch(getEndpointUrl(action, extra));
    const result = await response.json();
    if (!result.ok) throw new Error(result.message || "Request failed.");
    return result;
  } finally {
    setLoadingState(false);
  }
}

function showAuthForm(formId) {
  ui.authForms.forEach((form) => form.classList.toggle("active", form.id === formId));
  ui.authLinks.forEach((button) => button.classList.toggle("active", button.dataset.form === formId));
  setMessage(ui.loginStatus, "");
}

function updateLoginLabel() {
  const role = document.querySelector('input[name="loginRole"]:checked')?.value || "user";
  ui.loginKeyLabel.textContent = role === "admin" ? "Admin Username" : "Username";
  ui.loginKey.placeholder = role === "admin" ? "RAHUL" : "Username";
}

function setTodayDate() {
  const now = new Date();
  const shifted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  const today = shifted.toISOString().slice(0, 10);
  ui.entryDate.value = today;
  ui.entryDate.max = today;
}

function updatePreview() {
  const total = Number(ui.cashEarning.value || 0) + Number(ui.onlineEarning.value || 0);
  const balance = total - Number(ui.expenseAmount.value || 0);
  ui.totalPreview.textContent = formatCurrency(total);
  ui.balancePreview.textContent = formatCurrency(balance);
}

function syncSessionDeadline(deadline) {
  logoutDeadline = deadline;
  sessionStorage.setItem(SESSION_DEADLINE_KEY, String(deadline));
  updateCountdownLabel();
}

function updateCountdownLabel() {
  if (!logoutDeadline) {
    ui.countdown.textContent = "Auto logout in 00:00";
    return;
  }
  const remaining = Math.max(0, Math.ceil((logoutDeadline - Date.now()) / 1000));
  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");
  ui.countdown.textContent = `Auto logout in ${minutes}:${seconds}`;
}

function startSessionTimer() {
  clearInterval(countdownTimer);
  syncSessionDeadline(Date.now() + (SESSION_SECONDS * 1000));
  countdownTimer = window.setInterval(() => {
    if (Date.now() >= logoutDeadline) {
      clearSession(true);
      return;
    }
    updateCountdownLabel();
  }, 1000);
}

function resumeSessionTimer() {
  const savedDeadline = Number(sessionStorage.getItem(SESSION_DEADLINE_KEY) || 0);
  if (!savedDeadline || savedDeadline <= Date.now()) {
    clearSession(true);
    return false;
  }
  clearInterval(countdownTimer);
  syncSessionDeadline(savedDeadline);
  countdownTimer = window.setInterval(() => {
    if (Date.now() >= logoutDeadline) {
      clearSession(true);
      return;
    }
    updateCountdownLabel();
  }, 1000);
  return true;
}

function bumpSession() {
  if (!currentSession) return;
  syncSessionDeadline(Date.now() + (SESSION_SECONDS * 1000));
}

function saveSession(user) {
  currentSession = user;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  lastLoginName = user.userKey;
  localStorage.setItem(LAST_LOGIN_KEY, user.userKey);
  startSessionTimer();
}

function clearSession(expired = false) {
  currentSession = null;
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_DEADLINE_KEY);
  clearInterval(countdownTimer);
  clearInterval(chatPollTimer);
  countdownTimer = null;
  chatPollTimer = null;
  logoutDeadline = 0;
  ui.loginPassword.value = "";
  if (lastLoginName) ui.loginKey.value = lastLoginName;
  ui.reloginButton.classList.toggle("hidden", !expired);
  ui.logoutButton.classList.toggle("hidden", expired);
  showLogin();
  if (expired) {
    showAuthForm("loginForm");
    setMessage(ui.loginStatus, "Session expired. Username retained. Enter password to login again.", "error");
  }
}

function showLogin() {
  ui.appShell.classList.add("hidden");
  ui.loginScreen.classList.remove("hidden");
}

function showApp() {
  ui.loginScreen.classList.add("hidden");
  ui.appShell.classList.remove("hidden");
  ui.driverBadge.textContent = `${currentSession.role.toUpperCase()} - ${currentSession.name}`;
  ui.entryTabButton.classList.toggle("hidden", currentSession.role === "admin");
  ui.adminTabButton.classList.toggle("hidden", currentSession.role !== "admin");
  ui.reloginButton.classList.add("hidden");
  ui.logoutButton.classList.remove("hidden");
  activateTab(currentSession.role === "admin" ? "adminPanel" : "entryPanel");
}

function activateTab(tabId) {
  ui.tabButtons.forEach((button) => button.classList.toggle("active", button.dataset.tab === tabId));
  ui.tabPanels.forEach((panel) => panel.classList.toggle("active", panel.id === tabId));
  if (tabId === "chatPanel") {
    startChatPolling();
  }
}

function calculateSummary(records) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);
  const dailyTotals = new Map();

  return records.reduce((acc, record) => {
    const recordDate = new Date(`${record.entryDate}T00:00:00`);
    const earning = Number(record.totalEarning || 0);
    const expense = Number(record.expenseAmount || 0);
    acc.totalEarning += earning;
    acc.totalExpense += expense;
    if (recordDate >= sevenDaysAgo && recordDate <= today) acc.sevenDayEarning += earning;
    if (recordDate.getFullYear() === now.getFullYear() && recordDate.getMonth() === now.getMonth()) acc.monthEarning += earning;
    if (!dailyTotals.has(record.entryDate)) dailyTotals.set(record.entryDate, { earning: 0, expense: 0 });
    const bucket = dailyTotals.get(record.entryDate);
    bucket.earning += earning;
    bucket.expense += expense;
    acc.dailyTotals = dailyTotals;
    return acc;
  }, { totalEarning: 0, totalExpense: 0, sevenDayEarning: 0, monthEarning: 0, dailyTotals });
}

function renderSummary(records) {
  const summary = calculateSummary(records);
  ui.sevenDayEarning.textContent = formatCurrency(summary.sevenDayEarning);
  ui.monthEarning.textContent = formatCurrency(summary.monthEarning);
  ui.totalEarning.textContent = formatCurrency(summary.totalEarning);
  ui.totalExpense.textContent = formatCurrency(summary.totalExpense);
  ui.netSaving.textContent = formatCurrency(summary.totalEarning - summary.totalExpense);
  return summary;
}

function renderWallet(wallet) {
  ui.availableTotal.textContent = formatCurrency(wallet.availableTotal || 0);
  ui.availableCash.textContent = formatCurrency(wallet.availableCash || 0);
  ui.availableOnline.textContent = formatCurrency(wallet.availableOnline || 0);
  ui.depositedTotal.textContent = formatCurrency(wallet.depositedTotal || 0);
}

function renderRecords(records) {
  if (!records.length) {
    ui.recordsBody.innerHTML = "<tr><td colspan=\"8\">No records available.</td></tr>";
    return;
  }
  ui.recordsBody.innerHTML = records.map((row) => `
    <tr>
      <td>${escapeHtml(row.driverName)}</td>
      <td>${escapeHtml(row.entryDate)}</td>
      <td>${escapeHtml(formatCurrency(row.cashEarning))}</td>
      <td>${escapeHtml(formatCurrency(row.onlineEarning))}</td>
      <td>${escapeHtml(formatCurrency(row.totalEarning))}</td>
      <td>${escapeHtml(formatCurrency(row.expenseAmount))}</td>
      <td>${escapeHtml(row.expenseReason || "-")}</td>
      <td>${escapeHtml(formatCurrency(row.balance))}</td>
    </tr>
  `).join("");
}

function renderDeposits(deposits) {
  if (!deposits.length) {
    ui.depositsBody.innerHTML = "<tr><td colspan=\"5\">No bank deposit records available.</td></tr>";
    return;
  }
  ui.depositsBody.innerHTML = deposits.map((row) => `
    <tr>
      <td>${escapeHtml(row.driverName)}</td>
      <td>${escapeHtml(row.depositDate)}</td>
      <td>${escapeHtml(formatCurrency(row.cashDeposit))}</td>
      <td>${escapeHtml(formatCurrency(row.onlineDeposit))}</td>
      <td>${escapeHtml(formatCurrency(row.totalDeposit))}</td>
    </tr>
  `).join("");
}

function lockEntryForm(locked, message = "", type = "") {
  ui.entryForm.classList.toggle("disabled", locked);
  ui.submitEntryButton.disabled = locked;
  [ui.entryDate, ui.cashEarning, ui.onlineEarning, ui.expenseAmount, ui.expenseReason].forEach((input) => {
    input.disabled = locked;
  });
  if (message) setMessage(ui.formStatus, message, type);
}

function updateEntryState(records, missedDates) {
  if (currentSession.role === "admin") {
    lockEntryForm(true, "Daily entry is disabled for admin login.", "error");
    return;
  }
  const hasEntry = records.some((record) => record.entryDate === ui.entryDate.value);
  if (hasEntry) {
    lockEntryForm(true, "Data already entered for this date. Only one entry is allowed per date.", "error");
  } else {
    lockEntryForm(false, missedDates.length ? "You can also complete missed dates below." : "Entry is ready.", "success");
  }
}

function renderMissedDates(dates) {
  if (!dates.length) {
    ui.missedDatesList.innerHTML = "<span class=\"empty-inline\">No missed dates right now.</span>";
    return;
  }
  ui.missedDatesList.innerHTML = dates.map((date) => `
    <button class="date-chip" type="button" data-date="${escapeHtml(date)}">${escapeHtml(date)}</button>
  `).join("");
}

function readProfilePhoto(profile) {
  return profile?.photoData || "assets/company-logo.svg";
}

function renderProfile(profile) {
  if (!profile) return;
  profilePhotoData = profile.photoData || "";
  ui.profilePhotoPreview.src = readProfilePhoto(profile);
  ui.profileName.value = profile.name || "";
  ui.profileUsername.value = profile.username || "";
  ui.profilePan.value = profile.pan || "";
  ui.profileDob.value = profile.dob || "";
  ui.profilePhone.value = profile.phone || "";
  ui.profileAddress.value = profile.address || "";
  ui.profileAdminNotes.value = profile.adminNotes || "";
}

function renderContactCard(contact) {
  const fallbackRole = contact?.role === "admin" ? "Administrator" : "Driver";
  ui.contactName.textContent = contact?.name || "Admin";
  ui.contactRole.textContent = fallbackRole;
  ui.contactPhone.textContent = contact?.phone || "Phone not added.";
  ui.contactAddress.textContent = contact?.address || "Address not added.";
}

function renderChatRecipientOptions(contacts) {
  if (!contacts.length) {
    ui.chatRecipient.innerHTML = "<option value=\"\">No contacts available</option>";
    renderChatContactCard(null);
    return;
  }
  const selected = ui.chatRecipient.value || contacts[0].username;
  ui.chatRecipient.innerHTML = contacts.map((contact) => `
    <option value="${escapeHtml(contact.username)}">${escapeHtml(contact.name)} (${escapeHtml(contact.role)})</option>
  `).join("");
  ui.chatRecipient.value = contacts.some((item) => item.username === selected) ? selected : contacts[0].username;
  renderChatContactCard(getSelectedChatContact());
}

function getSelectedChatContact() {
  return dashboardState.contacts.find((item) => item.username === ui.chatRecipient.value) || null;
}

function renderChatContactCard(contact) {
  ui.chatContactName.textContent = contact?.name || "No contact selected";
  ui.chatContactRole.textContent = contact?.role || "-";
  ui.chatContactPhone.textContent = contact?.phone || "Phone not available.";
  ui.chatContactAddress.textContent = contact?.address || "Address not available.";
}

function renderChatMessages(messages) {
  const selected = ui.chatRecipient.value;
  const scoped = messages.filter((message) => {
    return message.senderUserKey === selected || message.recipientUserKey === selected;
  });

  if (!scoped.length) {
    ui.chatMessages.innerHTML = "<div class=\"empty-chat\">Start a conversation.</div>";
    return;
  }

  ui.chatMessages.innerHTML = scoped.map((message) => {
    const mine = message.senderUserKey === currentSession.userKey;
    return `
      <article class="chat-bubble ${mine ? "mine" : "theirs"}">
        <strong>${escapeHtml(message.senderName)}</strong>
        <p>${escapeHtml(message.message)}</p>
        <span>${escapeHtml(message.createdAt)}</span>
      </article>
    `;
  }).join("");
  ui.chatMessages.scrollTop = ui.chatMessages.scrollHeight;
}

function renderAdminMetrics(records, users, pendingUsers) {
  const summary = calculateSummary(records);
  const dailyCount = Math.max(summary.dailyTotals.size, 1);
  const activeUsers = users.filter((user) => user.role === "user" && user.status === "active");
  const totalPendingDeposit = activeUsers.reduce((total, user) => {
    const userRecords = records.filter((record) => record.userKey === user.username);
    const userDeposits = dashboardState.deposits.filter((deposit) => deposit.userKey === user.username);
    return total + computeWalletForUser(userRecords, userDeposits).availableTotal;
  }, 0);

  ui.activeUsers.textContent = String(activeUsers.length);
  ui.pendingUsersCount.textContent = String(pendingUsers.length);
  ui.averageDailyEarning.textContent = formatCurrency(summary.totalEarning / dailyCount);
  ui.averageExpense.textContent = formatCurrency(summary.totalExpense / dailyCount);
  ui.pendingDeposit.textContent = formatCurrency(totalPendingDeposit);
}

function computeWalletForUser(records, deposits) {
  const earnedCash = records.reduce((total, row) => total + Number(row.cashEarning || 0), 0);
  const earnedOnline = records.reduce((total, row) => total + Number(row.onlineEarning || 0), 0);
  const totalExpense = records.reduce((total, row) => total + Number(row.expenseAmount || 0), 0);
  const depositedCash = deposits.reduce((total, row) => total + Number(row.cashDeposit || 0), 0);
  const depositedOnline = deposits.reduce((total, row) => total + Number(row.onlineDeposit || 0), 0);
  const expenseFromCash = Math.min(earnedCash, totalExpense);
  const expenseFromOnline = Math.max(totalExpense - expenseFromCash, 0);
  const availableCash = Math.max(earnedCash - expenseFromCash - depositedCash, 0);
  const availableOnline = Math.max(earnedOnline - expenseFromOnline - depositedOnline, 0);
  return { availableCash, availableOnline, availableTotal: availableCash + availableOnline };
}

function renderApprovalRequests(pendingUsers) {
  if (!pendingUsers.length) {
    ui.approvalBody.innerHTML = "<tr><td colspan=\"5\">No pending requests.</td></tr>";
    return;
  }
  ui.approvalBody.innerHTML = pendingUsers.map((user) => `
    <tr>
      <td>${escapeHtml(user.name)}</td>
      <td>${escapeHtml(user.username)}</td>
      <td>${escapeHtml(user.phone || "-")}</td>
      <td>${escapeHtml(user.createdAt || "-")}</td>
      <td>
        <div class="action-row">
          <button class="secondary-button approve-user-button" type="button" data-user-key="${escapeHtml(user.username)}">Approve</button>
          <button class="secondary-button reject-user-button" type="button" data-user-key="${escapeHtml(user.username)}">Reject</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function renderUsers(users) {
  if (!users.length) {
    ui.usersBody.innerHTML = "<tr><td colspan=\"7\">No users available.</td></tr>";
    return;
  }
  ui.usersBody.innerHTML = users.map((user) => `
    <tr>
      <td>${escapeHtml(user.name)}</td>
      <td>${escapeHtml(user.username)}</td>
      <td>${escapeHtml(user.phone || "-")}</td>
      <td>${escapeHtml(user.status)}</td>
      <td>${escapeHtml(user.role)}</td>
      <td>${escapeHtml(user.createdAt || "-")}</td>
      <td>${user.role === "admin" ? "-" : `<button class="secondary-button delete-user-button" type="button" data-user-key="${escapeHtml(user.username)}">Delete</button>`}</td>
    </tr>
  `).join("");
}

function renderAdminDepositOptions(users, records, deposits) {
  const activeUsers = users.filter((user) => user.role === "user" && user.status === "active");
  if (!activeUsers.length) {
    ui.adminDepositUser.innerHTML = "<option value=\"\">No users available</option>";
    ui.adminDepositButton.disabled = true;
    return;
  }
  const selected = ui.adminDepositUser.value || activeUsers[0].username;
  ui.adminDepositUser.innerHTML = activeUsers.map((user) => `
    <option value="${escapeHtml(user.username)}">${escapeHtml(user.name)} (${escapeHtml(user.username)})</option>
  `).join("");
  ui.adminDepositUser.value = activeUsers.some((user) => user.username === selected) ? selected : activeUsers[0].username;
  updateAdminDepositSummary(records, deposits);
}

function updateAdminDepositSummary(records, deposits) {
  const selected = ui.adminDepositUser.value;
  if (!selected) {
    ui.adminDepositCash.textContent = formatCurrency(0);
    ui.adminDepositOnline.textContent = formatCurrency(0);
    ui.adminDepositTotal.textContent = formatCurrency(0);
    ui.adminDepositButton.disabled = true;
    return;
  }
  const userRecords = records.filter((record) => record.userKey === selected);
  const userDeposits = deposits.filter((deposit) => deposit.userKey === selected);
  const wallet = computeWalletForUser(userRecords, userDeposits);
  ui.adminDepositCash.textContent = formatCurrency(wallet.availableCash);
  ui.adminDepositOnline.textContent = formatCurrency(wallet.availableOnline);
  ui.adminDepositTotal.textContent = formatCurrency(wallet.availableTotal);
  ui.adminDepositButton.disabled = wallet.availableTotal <= 0;
  ui.adminDepositButton.dataset.cash = String(wallet.availableCash);
  ui.adminDepositButton.dataset.online = String(wallet.availableOnline);
}

function renderPieChart(element, legendElement, segments) {
  const validSegments = segments.filter((segment) => Number(segment.value) > 0);
  if (!validSegments.length) {
    element.innerHTML = "<div class=\"empty-chart\">No data available</div>";
    legendElement.innerHTML = "";
    return;
  }
  const total = validSegments.reduce((sum, segment) => sum + Number(segment.value), 0);
  let start = 0;
  const stops = validSegments.map((segment) => {
    const size = (Number(segment.value) / total) * 100;
    const stop = `${segment.color} ${start}% ${start + size}%`;
    start += size;
    return stop;
  }).join(", ");

  element.innerHTML = `<div class="pie-circle" style="background: conic-gradient(${stops});"></div>`;
  legendElement.innerHTML = validSegments.map((segment) => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${segment.color};"></span>
      <span>${escapeHtml(segment.label)}</span>
      <strong>${escapeHtml(formatCurrency(segment.value))}</strong>
    </div>
  `).join("");
}

function renderCharts(records, wallet) {
  const totalCash = records.reduce((sum, row) => sum + Number(row.cashEarning || 0), 0);
  const totalOnline = records.reduce((sum, row) => sum + Number(row.onlineEarning || 0), 0);
  const totalExpense = records.reduce((sum, row) => sum + Number(row.expenseAmount || 0), 0);
  const totalSaving = Math.max((records.reduce((sum, row) => sum + Number(row.totalEarning || 0), 0) - totalExpense), 0);

  renderPieChart(ui.earningSplitChart, ui.earningSplitLegend, [
    { label: "Cash", value: totalCash, color: "#58a6ff" },
    { label: "Online", value: totalOnline, color: "#3fb950" }
  ]);

  renderPieChart(ui.savingsSplitChart, ui.savingsSplitLegend, [
    { label: "Expense", value: totalExpense, color: "#f85149" },
    { label: "Saving", value: totalSaving, color: "#d29922" }
  ]);

  renderPieChart(ui.walletSplitChart, ui.walletSplitLegend, [
    { label: "Available", value: wallet.availableTotal || 0, color: "#58a6ff" },
    { label: "Deposited", value: wallet.depositedTotal || 0, color: "#3fb950" }
  ]);
}

async function loadDashboard() {
  bumpSession();
  const result = await getAction("read");
  dashboardState = result.data;
  setTodayDate();
  renderWallet(dashboardState.wallet || {});
  renderRecords(dashboardState.records || []);
  renderDeposits(dashboardState.deposits || []);
  renderSummary(dashboardState.records || []);
  renderCharts(dashboardState.records || [], dashboardState.wallet || {});
  renderMissedDates(dashboardState.missedDates || []);
  renderProfile(dashboardState.profile);
  renderContactCard(currentSession.role === "admin" ? getSelectedChatContact() : dashboardState.adminProfile);
  renderChatRecipientOptions(dashboardState.contacts || []);
  renderChatMessages(dashboardState.threadMessages || []);
  updateEntryState(dashboardState.records || [], dashboardState.missedDates || []);

  if (currentSession.role === "admin") {
    renderAdminMetrics(dashboardState.records || [], dashboardState.users || [], dashboardState.pendingUsers || []);
    renderApprovalRequests(dashboardState.pendingUsers || []);
    renderUsers(dashboardState.users || []);
    renderAdminDepositOptions(dashboardState.users || [], dashboardState.records || [], dashboardState.deposits || []);
    setMessage(ui.adminStatus, dashboardState.pendingUsers?.length ? "New account requests are waiting for your approval." : "Admin dashboard is ready.", "success");
  }
}

async function pollChat() {
  const selected = ui.chatRecipient.value;
  if (!currentSession || !selected) return;
  try {
    const result = await getAction("messages", { otherUserKey: selected });
    dashboardState.threadMessages = result.data.messages || [];
    renderChatMessages(dashboardState.threadMessages);
  } catch (error) {
    setMessage(ui.chatStatus, error.message, "error");
  }
}

function startChatPolling() {
  clearInterval(chatPollTimer);
  if (!currentSession) return;
  pollChat();
  chatPollTimer = window.setInterval(pollChat, CHAT_POLL_MS);
}

function stopChatPolling() {
  clearInterval(chatPollTimer);
  chatPollTimer = null;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

ui.authLinks.forEach((button) => {
  button.addEventListener("click", () => showAuthForm(button.dataset.form));
});

document.querySelectorAll('input[name="loginRole"]').forEach((radio) => {
  radio.addEventListener("change", updateLoginLabel);
});

ui.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(ui.loginStatus, "Signing in...");
  try {
    const result = await postAction("login", {
      role: document.querySelector('input[name="loginRole"]:checked').value,
      username: ui.loginKey.value.trim().toUpperCase(),
      password: ui.loginPassword.value
    });
    saveSession(result.data.user);
    ui.loginPassword.value = "";
    showApp();
    await loadDashboard();
    startChatPolling();
  } catch (error) {
    setMessage(ui.loginStatus, error.message, "error");
  }
});

ui.registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(ui.loginStatus, "Creating account request...");
  try {
    await postAction("register", {
      name: $("#registerName").value.trim(),
      username: $("#registerUsername").value.trim().toUpperCase(),
      pan: $("#registerPan").value.trim().toUpperCase(),
      dob: $("#registerDob").value,
      phone: $("#registerPhone").value.trim(),
      address: $("#registerAddress").value.trim(),
      password: $("#registerPassword").value,
      role: "user"
    });
    ui.registerForm.reset();
    showAuthForm("loginForm");
    setMessage(ui.loginStatus, "Account request sent to admin for approval.", "success");
  } catch (error) {
    setMessage(ui.loginStatus, error.message, "error");
  }
});

ui.forgotForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(ui.loginStatus, "Resetting password...");
  try {
    await postAction("resetPassword", {
      username: $("#forgotUsername").value.trim().toUpperCase(),
      pan: $("#forgotPan").value.trim().toUpperCase(),
      dob: $("#forgotDob").value,
      newPassword: $("#forgotNewPassword").value
    });
    ui.forgotForm.reset();
    showAuthForm("loginForm");
    setMessage(ui.loginStatus, "Password reset successfully.", "success");
  } catch (error) {
    setMessage(ui.loginStatus, error.message, "error");
  }
});

ui.logoutButton.addEventListener("click", () => clearSession(false));
ui.reloginButton.addEventListener("click", () => {
  showAuthForm("loginForm");
  ui.reloginButton.classList.add("hidden");
  ui.logoutButton.classList.remove("hidden");
  ui.loginPassword.focus();
});

ui.entryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  bumpSession();
  setMessage(ui.formStatus, "Saving entry...");
  try {
    await postAction("create", {
      userKey: currentSession.userKey,
      entryDate: ui.entryDate.value,
      cashEarning: Number(ui.cashEarning.value || 0),
      onlineEarning: Number(ui.onlineEarning.value || 0),
      expenseAmount: Number(ui.expenseAmount.value || 0),
      expenseReason: ui.expenseReason.value.trim()
    });
    ui.cashEarning.value = "";
    ui.onlineEarning.value = "";
    ui.expenseAmount.value = "";
    ui.expenseReason.value = "";
    updatePreview();
    setMessage(ui.formStatus, "Entry saved successfully.", "success");
    await loadDashboard();
  } catch (error) {
    setMessage(ui.formStatus, error.message, "error");
  }
});

ui.missedDatesList.addEventListener("click", (event) => {
  if (!event.target.classList.contains("date-chip")) return;
  ui.entryDate.value = event.target.dataset.date;
  updateEntryState(dashboardState.records || [], dashboardState.missedDates || []);
});

ui.entryDate.addEventListener("change", () => {
  updateEntryState(dashboardState.records || [], dashboardState.missedDates || []);
});

[ui.cashEarning, ui.onlineEarning, ui.expenseAmount].forEach((input) => {
  input.addEventListener("input", updatePreview);
});

ui.refreshButton.addEventListener("click", () => loadDashboard().catch((error) => setMessage(ui.formStatus, error.message, "error")));
ui.adminRefreshButton.addEventListener("click", () => loadDashboard().catch((error) => setMessage(ui.adminStatus, error.message, "error")));

ui.choosePhotoButton.addEventListener("click", () => ui.profilePhotoInput.click());
ui.profilePhotoInput.addEventListener("change", async () => {
  const file = ui.profilePhotoInput.files?.[0];
  if (!file) return;
  profilePhotoData = await readFileAsDataUrl(file);
  ui.profilePhotoPreview.src = profilePhotoData;
});

ui.profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(ui.profileStatus, "Saving profile...");
  try {
    const payload = {
      userKey: currentSession.userKey,
      name: ui.profileName.value.trim(),
      phone: ui.profilePhone.value.trim(),
      address: ui.profileAddress.value.trim(),
      photoData: profilePhotoData
    };
    if (currentSession.role === "admin") payload.adminKey = currentSession.userKey;
    const result = await postAction("updateProfile", payload);
    dashboardState.profile = result.data.profile;
    renderProfile(dashboardState.profile);
    setMessage(ui.profileStatus, "Profile updated successfully.", "success");
  } catch (error) {
    setMessage(ui.profileStatus, error.message, "error");
  }
});

ui.chatRecipient.addEventListener("change", () => {
  renderChatContactCard(getSelectedChatContact());
  renderContactCard(currentSession.role === "admin" ? getSelectedChatContact() : dashboardState.adminProfile);
  pollChat();
});

ui.chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const recipientUserKey = ui.chatRecipient.value;
  if (!recipientUserKey) return;
  setMessage(ui.chatStatus, "Sending message...");
  try {
    const result = await postAction("sendMessage", {
      userKey: currentSession.userKey,
      recipientUserKey: recipientUserKey,
      message: ui.chatMessageInput.value.trim()
    });
    dashboardState.threadMessages = result.data.messages || [];
    renderChatMessages(dashboardState.threadMessages);
    ui.chatMessageInput.value = "";
    setMessage(ui.chatStatus, "Message sent.", "success");
  } catch (error) {
    setMessage(ui.chatStatus, error.message, "error");
  }
});

ui.approvalBody.addEventListener("click", async (event) => {
  const approveButton = event.target.closest(".approve-user-button");
  const rejectButton = event.target.closest(".reject-user-button");
  if (!approveButton && !rejectButton) return;
  try {
    if (approveButton) {
      await postAction("approveUser", { adminKey: currentSession.userKey, userKey: approveButton.dataset.userKey });
      setMessage(ui.adminStatus, "User approved.", "success");
    }
    if (rejectButton) {
      await postAction("rejectUser", { adminKey: currentSession.userKey, userKey: rejectButton.dataset.userKey });
      setMessage(ui.adminStatus, "User rejected.", "success");
    }
    await loadDashboard();
  } catch (error) {
    setMessage(ui.adminStatus, error.message, "error");
  }
});

ui.usersBody.addEventListener("click", async (event) => {
  const button = event.target.closest(".delete-user-button");
  if (!button) return;
  try {
    await postAction("deleteUser", {
      adminKey: currentSession.userKey,
      userKey: button.dataset.userKey
    });
    setMessage(ui.adminStatus, "User deleted.", "success");
    await loadDashboard();
  } catch (error) {
    setMessage(ui.adminStatus, error.message, "error");
  }
});

ui.adminDepositUser.addEventListener("change", () => {
  updateAdminDepositSummary(dashboardState.records || [], dashboardState.deposits || []);
});

ui.adminDepositButton.addEventListener("click", async () => {
  const cashDeposit = Number(ui.adminDepositButton.dataset.cash || 0);
  const onlineDeposit = Number(ui.adminDepositButton.dataset.online || 0);
  if (cashDeposit + onlineDeposit <= 0) {
    setMessage(ui.adminDepositStatus, "No available amount to deposit.", "error");
    return;
  }
  setMessage(ui.adminDepositStatus, "Saving deposit...");
  try {
    await postAction("deposit", {
      adminKey: currentSession.userKey,
      targetUserKey: ui.adminDepositUser.value,
      cashDeposit: cashDeposit,
      onlineDeposit: onlineDeposit
    });
    setMessage(ui.adminDepositStatus, "Deposit saved successfully.", "success");
    await loadDashboard();
  } catch (error) {
    setMessage(ui.adminDepositStatus, error.message, "error");
  }
});

ui.tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activateTab(button.dataset.tab);
    if (button.dataset.tab === "earningsPanel" || button.dataset.tab === "profilePanel" || button.dataset.tab === "chatPanel" || button.dataset.tab === "adminPanel") {
      loadDashboard().catch((error) => setMessage(ui.formStatus, error.message, "error"));
    }
  });
});

["click", "keydown", "input", "pointerdown", "touchstart"].forEach((eventName) => {
  window.addEventListener(eventName, bumpSession, { passive: true });
});

document.addEventListener("visibilitychange", () => {
  if (!currentSession) return;
  const savedDeadline = Number(sessionStorage.getItem(SESSION_DEADLINE_KEY) || 0);
  if (document.visibilityState === "visible" && savedDeadline && savedDeadline <= Date.now()) {
    clearSession(true);
  } else {
    updateCountdownLabel();
  }
});

window.addEventListener("focus", () => {
  if (!currentSession) return;
  const savedDeadline = Number(sessionStorage.getItem(SESSION_DEADLINE_KEY) || 0);
  if (savedDeadline && savedDeadline <= Date.now()) {
    clearSession(true);
  }
});

setTodayDate();
updatePreview();
updateLoginLabel();
if (lastLoginName) ui.loginKey.value = lastLoginName;

try {
  currentSession = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
} catch (error) {
  currentSession = null;
}

if (currentSession?.userKey && resumeSessionTimer()) {
  showApp();
  loadDashboard().then(startChatPolling).catch((error) => setMessage(ui.loginStatus, error.message, "error"));
}
