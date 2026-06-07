const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyBaa0bgLsl5C6BXoSG6u1-kBsd7Cj14hJ8DQBmtqroSVWuY8rr3ds5QfMOaZ-2dbFaJQ/exec";
const SESSION_KEY = "dealskartAutoDiarySession";
const LANGUAGE_KEY = "dealskartAutoDiaryLanguage";
const SESSION_SECONDS = 120;

const $ = (selector) => document.querySelector(selector);

const ui = {
  loginScreen: $("#loginScreen"),
  appShell: $("#appShell"),
  loginForm: $("#loginForm"),
  registerForm: $("#registerForm"),
  forgotForm: $("#forgotForm"),
  authForms: document.querySelectorAll(".auth-form"),
  authLinks: document.querySelectorAll(".link-button"),
  loginStatus: $("#loginStatus"),
  logoutButton: $("#logoutButton"),
  reloginButton: $("#reloginButton"),
  loginKeyLabel: $("#loginKeyLabel span"),
  loginKey: $("#loginKey"),
  loginPassword: $("#loginPassword"),
  loginLanguageSelect: $("#loginLanguageSelect"),
  languageSelect: $("#languageSelect"),
  driverBadge: $("#driverBadge"),
  countdown: $("#sessionCountdown"),
  form: $("#entryForm"),
  formStatus: $("#formStatus"),
  entryDate: $("#entryDate"),
  cashEarning: $("#cashEarning"),
  onlineEarning: $("#onlineEarning"),
  expenseAmount: $("#expenseAmount"),
  totalPreview: $("#totalPreview"),
  balancePreview: $("#balancePreview"),
  submitEntryButton: $("#submitEntryButton"),
  walletPanel: $("#walletPanel"),
  depositStatus: $("#depositStatus"),
  availableTotal: $("#availableTotal"),
  availableCash: $("#availableCash"),
  availableOnline: $("#availableOnline"),
  depositedTotal: $("#depositedTotal"),
  refreshButton: $("#refreshButton"),
  recordsBody: $("#recordsBody"),
  depositsBody: $("#depositsBody"),
  tabButtons: document.querySelectorAll(".tab-button"),
  tabPanels: document.querySelectorAll(".tab-panel"),
  entryTabButton: $("#entryTabButton"),
  adminTabButton: $("#adminTabButton"),
  adminRefreshButton: $("#adminRefreshButton"),
  adminCreateUserForm: $("#adminCreateUserForm"),
  adminStatus: $("#adminStatus"),
  usersBody: $("#usersBody"),
  adminDepositUser: $("#adminDepositUser"),
  adminDepositCash: $("#adminDepositCash"),
  adminDepositOnline: $("#adminDepositOnline"),
  adminDepositTotal: $("#adminDepositTotal"),
  adminDepositButton: $("#adminDepositButton"),
  adminDepositStatus: $("#adminDepositStatus"),
  activeUsers: $("#activeUsers"),
  averageDailyEarning: $("#averageDailyEarning"),
  averageDailySaving: $("#averageDailySaving"),
  averageExpense: $("#averageExpense"),
  pendingDeposit: $("#pendingDeposit"),
  sevenDayEarning: $("#sevenDayEarning"),
  monthEarning: $("#monthEarning"),
  totalEarning: $("#totalEarning"),
  totalExpense: $("#totalExpense"),
  netSaving: $("#netSaving")
};

const translations = {
  en: {
    language: "Language", secureAccess: "Secure Access", loginIntro: "Sign in to manage driver earnings, expenses and deposits.",
    loginAsUser: "Login as User", loginAsAdmin: "Login as Admin", username: "Username", adminUsername: "Admin Username", password: "Password",
    login: "Login", fullName: "Full Name", panNumber: "PAN Number", dob: "Date of Birth", newPassword: "New Password",
    createAccount: "Create Account", createNewAccount: "Create New Account", forgotPassword: "Forgot Password", resetPassword: "Reset Password",
    tagline: "Earn More, Save More", logout: "Logout", relogin: "Relogin", autoDriverDiary: "Auto Driver Diary",
    heroTitle: "Daily earnings, expenses and deposits in one professional dashboard.",
    heroText: "Track each driver, maintain secure accounts, manage entries, and review business performance in real time.",
    dailyEntry: "Daily Entry", earnings: "Earnings", admin: "Admin", moneyWallet: "Money Wallet", availableNow: "Currently Available",
    walletText: "Available amount updates after expense and deposited balance are adjusted.", cashAvailable: "Cash Available",
    onlineAvailable: "Online Available", totalDeposited: "Total Deposited", todaysEntry: "Today's Entry", addDailyRecord: "Add Daily Record",
    date: "Date", cashEarning: "Cash Earning", onlineEarning: "Online Earning", totalEarning: "Total Earning", expense: "Expense",
    expenseReason: "Expense Reason", expenseReasonPlaceholder: "CNG, repair, parking, fine...", todaySaving: "Today's Saving",
    saveToSheet: "Save to Google Sheet", googleSheetReport: "Google Sheet Report", earningsSummary: "Earnings Summary", refresh: "Refresh",
    lastSevenDays: "Last 7 Days Earning", thisMonth: "This Month Earning", totalExpense: "Total Expense", netSaving: "Net Saving",
    driver: "Driver", cash: "Cash", online: "Online", total: "Total", reason: "Reason", balance: "Balance", bankDepositHistory: "Bank Deposit History",
    cashDeposit: "Cash Deposit", onlineDeposit: "Online Deposit", totalDeposit: "Total Deposit", adminDashboard: "Admin Dashboard",
    registeredUsers: "Registered Users", refreshUsers: "Refresh Users", registerDriver: "Register Driver", createUserFromAdmin: "Create User from Admin",
    registerUser: "Register User", name: "Name", role: "Role", status: "Status", created: "Created", action: "Action",
    activeUsers: "Active Users", averageDailyEarning: "Average Daily Earning", averageDailySaving: "Average Daily Saving", averageExpense: "Average Expense",
    pendingDeposit: "Pending Deposit", depositControl: "Deposit Control", depositForDriver: "Deposit for Driver", selectDriver: "Select Driver", depositNow: "Deposit Now",
    noRecords: "No records available.", noDeposits: "No bank deposit records available.", noUsers: "No users available.", loadingRecords: "Loading records...",
    loadingDeposits: "Loading deposits...", loadingUsers: "Loading users...", readyEntry: "Today's entry is ready.", alreadyEntered: "Data already entered for today. Only one entry is allowed per day.",
    adminEntryDisabled: "Daily entry is disabled for admin login.", loginProgress: "Signing in...", registerProgress: "Creating account...", resetProgress: "Resetting password...",
    accountCreated: "Account created successfully.", passwordResetSuccess: "Password reset successfully.", entrySaving: "Saving entry...", entrySaved: "Entry saved successfully.",
    depositUnavailable: "No available amount to deposit.", depositSaving: "Saving deposit...", depositSaved: "Deposit saved successfully.",
    sessionExpired: "Session expired. Please login again.", sessionPrefix: "Auto logout in", delete: "Delete", reloginReady: "Username retained. Enter your password to login again.",
    quickSuggestion: "Tip: Admin can use the new driver deposit control and average daily overview to audit performance faster."
  },
  hi: {
    language: "भाषा", secureAccess: "सुरक्षित प्रवेश", loginIntro: "ड्राइवर कमाई, खर्च और जमा राशि प्रबंधित करने के लिए लॉगिन करें.",
    loginAsUser: "यूज़र लॉगिन", loginAsAdmin: "एडमिन लॉगिन", username: "यूज़रनेम", adminUsername: "एडमिन यूज़रनेम", password: "पासवर्ड",
    login: "लॉगिन", fullName: "पूरा नाम", panNumber: "पैन नंबर", dob: "जन्म तिथि", newPassword: "नया पासवर्ड",
    createAccount: "अकाउंट बनाएं", createNewAccount: "नया अकाउंट बनाएं", forgotPassword: "पासवर्ड भूल गए", resetPassword: "पासवर्ड रीसेट करें",
    tagline: "ज्यादा कमाएं, ज्यादा बचाएं", logout: "लॉगआउट", relogin: "फिर लॉगिन", autoDriverDiary: "ऑटो ड्राइवर डायरी",
    heroTitle: "दैनिक कमाई, खर्च और जमा राशि के लिए प्रोफेशनल डैशबोर्ड.",
    heroText: "हर ड्राइवर को ट्रैक करें, सुरक्षित अकाउंट रखें, एंट्री मैनेज करें और रीयल टाइम में परफॉर्मेंस देखें.",
    dailyEntry: "डेली एंट्री", earnings: "कमाई", admin: "एडमिन", moneyWallet: "मनी वॉलेट", availableNow: "अभी उपलब्ध",
    walletText: "उपलब्ध राशि खर्च और जमा समायोजित होने के बाद अपडेट होती है.", cashAvailable: "उपलब्ध कैश",
    onlineAvailable: "उपलब्ध ऑनलाइन", totalDeposited: "कुल जमा", todaysEntry: "आज की एंट्री", addDailyRecord: "डेली रिकॉर्ड जोड़ें",
    date: "तारीख", cashEarning: "कैश कमाई", onlineEarning: "ऑनलाइन कमाई", totalEarning: "कुल कमाई", expense: "खर्च",
    expenseReason: "खर्च का कारण", expenseReasonPlaceholder: "सीएनजी, मरम्मत, पार्किंग, जुर्माना...", todaySaving: "आज की बचत",
    saveToSheet: "Google Sheet में सेव करें", googleSheetReport: "Google Sheet रिपोर्ट", earningsSummary: "कमाई सारांश", refresh: "रिफ्रेश",
    lastSevenDays: "पिछले 7 दिन की कमाई", thisMonth: "इस महीने की कमाई", totalExpense: "कुल खर्च", netSaving: "नेट बचत",
    driver: "ड्राइवर", cash: "कैश", online: "ऑनलाइन", total: "कुल", reason: "कारण", balance: "बैलेंस", bankDepositHistory: "बैंक डिपॉज़िट हिस्ट्री",
    cashDeposit: "कैश डिपॉज़िट", onlineDeposit: "ऑनलाइन डिपॉज़िट", totalDeposit: "कुल डिपॉज़िट", adminDashboard: "एडमिन डैशबोर्ड",
    registeredUsers: "रजिस्टर्ड यूज़र", refreshUsers: "यूज़र रिफ्रेश करें", registerDriver: "ड्राइवर रजिस्टर करें", createUserFromAdmin: "एडमिन से यूज़र बनाएं",
    registerUser: "यूज़र रजिस्टर करें", name: "नाम", role: "रोल", status: "स्थिति", created: "बनाया गया", action: "एक्शन",
    activeUsers: "सक्रिय यूज़र", averageDailyEarning: "औसत दैनिक कमाई", averageDailySaving: "औसत दैनिक बचत", averageExpense: "औसत खर्च",
    pendingDeposit: "पेंडिंग डिपॉज़िट", depositControl: "डिपॉज़िट कंट्रोल", depositForDriver: "ड्राइवर के लिए डिपॉज़िट", selectDriver: "ड्राइवर चुनें", depositNow: "अभी जमा करें",
    noRecords: "कोई रिकॉर्ड उपलब्ध नहीं है.", noDeposits: "कोई बैंक डिपॉज़िट रिकॉर्ड उपलब्ध नहीं है.", noUsers: "कोई यूज़र उपलब्ध नहीं है.", loadingRecords: "रिकॉर्ड लोड हो रहे हैं...",
    loadingDeposits: "डिपॉज़िट लोड हो रहे हैं...", loadingUsers: "यूज़र लोड हो रहे हैं...", readyEntry: "आज की एंट्री तैयार है.", alreadyEntered: "आज का डेटा पहले से दर्ज है. एक दिन में केवल एक एंट्री.",
    adminEntryDisabled: "एडमिन लॉगिन में डेली एंट्री बंद है.", loginProgress: "लॉगिन हो रहा है...", registerProgress: "अकाउंट बन रहा है...", resetProgress: "पासवर्ड रीसेट हो रहा है...",
    accountCreated: "अकाउंट सफलतापूर्वक बन गया.", passwordResetSuccess: "पासवर्ड सफलतापूर्वक रीसेट हो गया.", entrySaving: "एंट्री सेव हो रही है...", entrySaved: "एंट्री सफलतापूर्वक सेव हो गई.",
    depositUnavailable: "जमा करने के लिए कोई उपलब्ध राशि नहीं है.", depositSaving: "डिपॉज़िट सेव हो रहा है...", depositSaved: "डिपॉज़िट सफलतापूर्वक सेव हो गया.",
    sessionExpired: "सेशन समाप्त हो गया. कृपया फिर से लॉगिन करें.", sessionPrefix: "ऑटो लॉगआउट में", delete: "डिलीट", reloginReady: "यूज़रनेम रखा गया है. दोबारा लॉगिन के लिए केवल पासवर्ड भरें.",
    quickSuggestion: "सुझाव: एडमिन नया ड्राइवर डिपॉज़िट कंट्रोल और औसत दैनिक ओवरव्यू से ऑडिट जल्दी कर सकता है."
  },
  gu: {
    language: "ભાષા", secureAccess: "સુરક્ષિત પ્રવેશ", loginIntro: "ડ્રાઇવર આવક, ખર્ચ અને ડિપોઝિટ મેનેજ કરવા લોગિન કરો.",
    loginAsUser: "યૂઝર લોગિન", loginAsAdmin: "એડમિન લોગિન", username: "યૂઝરનેમ", adminUsername: "એડમિન યૂઝરનેમ", password: "પાસવર્ડ",
    login: "લોગિન", fullName: "પૂર્ણ નામ", panNumber: "PAN નંબર", dob: "જન્મ તારીખ", newPassword: "નવો પાસવર્ડ",
    createAccount: "એકાઉન્ટ બનાવો", createNewAccount: "નવું એકાઉન્ટ બનાવો", forgotPassword: "પાસવર્ડ ભૂલી ગયા", resetPassword: "પાસવર્ડ રીસેટ કરો",
    tagline: "વધુ કમાઓ, વધુ બચાવો", logout: "લોગઆઉટ", relogin: "ફરી લોગિન", autoDriverDiary: "ઓટો ડ્રાઇવર ડાયરી",
    heroTitle: "દૈનિક આવક, ખર્ચ અને ડિપોઝિટ માટે પ્રોફેશનલ ડેશબોર્ડ.",
    heroText: "દરેક ડ્રાઇવરને ટ્રેક કરો, સુરક્ષિત એકાઉન્ટ રાખો, એન્ટ્રીઓ મેનેજ કરો અને વાસ્તવિક સમયમાં પરફોર્મન્સ જુઓ.",
    dailyEntry: "દૈનિક એન્ટ્રી", earnings: "આવક", admin: "એડમિન", moneyWallet: "મની વૉલેટ", availableNow: "હાલ ઉપલબ્ધ",
    walletText: "ઉપલબ્ધ રકમ ખર્ચ અને ડિપોઝિટ સમાયોજન પછી અપડેટ થાય છે.", cashAvailable: "ઉપલબ્ધ કેશ",
    onlineAvailable: "ઉપલબ્ધ ઑનલાઇન", totalDeposited: "કુલ ડિપોઝિટ", todaysEntry: "આજની એન્ટ્રી", addDailyRecord: "દૈનિક રેકોર્ડ ઉમેરો",
    date: "તારીખ", cashEarning: "કેશ આવક", onlineEarning: "ઑનલાઇન આવક", totalEarning: "કુલ આવક", expense: "ખર્ચ",
    expenseReason: "ખર્ચનું કારણ", expenseReasonPlaceholder: "CNG, repair, parking, fine...", todaySaving: "આજની બચત",
    saveToSheet: "Google Sheetમાં સેવ કરો", googleSheetReport: "Google Sheet રિપોર્ટ", earningsSummary: "આવક સારાંશ", refresh: "રીફ્રેશ",
    lastSevenDays: "છેલ્લા 7 દિવસની આવક", thisMonth: "આ મહિનાની આવક", totalExpense: "કુલ ખર્ચ", netSaving: "નેટ બચત",
    driver: "ડ્રાઇવર", cash: "કેશ", online: "ઑનલાઇન", total: "કુલ", reason: "કારણ", balance: "બેલેન્સ", bankDepositHistory: "બેંક ડિપોઝિટ ઇતિહાસ",
    cashDeposit: "કેશ ડિપોઝિટ", onlineDeposit: "ઑનલાઇન ડિપોઝિટ", totalDeposit: "કુલ ડિપોઝિટ", adminDashboard: "એડમિન ડેશબોર્ડ",
    registeredUsers: "રજીસ્ટર્ડ યૂઝર્સ", refreshUsers: "યૂઝર્સ રીફ્રેશ કરો", registerDriver: "ડ્રાઇવર રજીસ્ટર કરો", createUserFromAdmin: "એડમિનમાંથી યૂઝર બનાવો",
    registerUser: "યૂઝર રજીસ્ટર કરો", name: "નામ", role: "રોલ", status: "સ્થિતિ", created: "બનાવ્યું", action: "એક્શન",
    activeUsers: "સક્રિય યૂઝર્સ", averageDailyEarning: "સરેરાશ દૈનિક આવક", averageDailySaving: "સરેરાશ દૈનિક બચત", averageExpense: "સરેરાશ ખર્ચ",
    pendingDeposit: "પેન્ડિંગ ડિપોઝિટ", depositControl: "ડિપોઝિટ કંટ્રોલ", depositForDriver: "ડ્રાઇવર માટે ડિપોઝિટ", selectDriver: "ડ્રાઇવર પસંદ કરો", depositNow: "હવે ડિપોઝિટ કરો",
    noRecords: "કોઈ રેકોર્ડ ઉપલબ્ધ નથી.", noDeposits: "કોઈ બેંક ડિપોઝિટ રેકોર્ડ ઉપલબ્ધ નથી.", noUsers: "કોઈ યૂઝર ઉપલબ્ધ નથી.", loadingRecords: "રેકોર્ડ લોડ થઈ રહ્યા છે...",
    loadingDeposits: "ડિપોઝિટ લોડ થઈ રહ્યા છે...", loadingUsers: "યૂઝર્સ લોડ થઈ રહ્યા છે...", readyEntry: "આજની એન્ટ્રી તૈયાર છે.", alreadyEntered: "આજનો ડેટા પહેલેથી દાખલ છે. એક દિવસમાં માત્ર એક એન્ટ્રી.",
    adminEntryDisabled: "એડમિન લોગિનમાં દૈનિક એન્ટ્રી બંધ છે.", loginProgress: "લોગિન થઈ રહ્યું છે...", registerProgress: "એકાઉન્ટ બની રહ્યું છે...", resetProgress: "પાસવર્ડ રીસેટ થઈ રહ્યો છે...",
    accountCreated: "એકાઉન્ટ સફળતાપૂર્વક બની ગયું.", passwordResetSuccess: "પાસવર્ડ સફળતાપૂર્વક રીસેટ થયો.", entrySaving: "એન્ટ્રી સેવ થઈ રહી છે...", entrySaved: "એન્ટ્રી સફળતાપૂર્વક સેવ થઈ ગઈ.",
    depositUnavailable: "ડિપોઝિટ માટે કોઈ ઉપલબ્ધ રકમ નથી.", depositSaving: "ડિપોઝિટ સેવ થઈ રહ્યું છે...", depositSaved: "ડિપોઝિટ સફળતાપૂર્વક સેવ થયું.",
    sessionExpired: "સેશન સમાપ્ત થયું. કૃપા કરીને ફરી લોગિન કરો.", sessionPrefix: "ઓટો લોગઆઉટમાં", delete: "ડિલીટ", reloginReady: "યૂઝરનેમ રાખવામાં આવ્યું છે. ફરી લોગિન માટે ફક્ત પાસવર્ડ દાખલ કરો.",
    quickSuggestion: "સૂચન: એડમિન નવા ડ્રાઇવર ડિપોઝિટ કંટ્રોલ અને સરેરાશ દૈનિક ઓવરવ્યૂથી ઓડિટ ઝડપથી કરી શકે છે."
  }
};

let currentLanguage = localStorage.getItem(LANGUAGE_KEY) || "en";
let currentSession = null;
let currentWallet = { availableCash: 0, availableOnline: 0, availableTotal: 0, depositedTotal: 0 };
let lastLoginName = localStorage.getItem("dealskartLastLoginName") || "";
let adminUsers = [];
let logoutDeadline = 0;
let countdownTimer = null;

function t(key) {
  return translations[currentLanguage]?.[key] || translations.en[key] || key;
}

function setMessage(element, message, type = "") {
  element.textContent = message;
  element.className = `status ${type}`.trim();
}

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

function getEndpointUrl(action) {
  const url = new URL(SCRIPT_URL);
  url.searchParams.set("action", action);
  if (currentSession?.userKey) {
    url.searchParams.set("userKey", currentSession.userKey);
  }
  return url;
}

async function postAction(action, payload) {
  const response = await fetch(getEndpointUrl(action), {
    method: "POST",
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!result.ok) throw new Error(result.message || "Request failed.");
  return result;
}

function applyLanguage(language) {
  currentLanguage = language;
  localStorage.setItem(LANGUAGE_KEY, language);
  document.documentElement.lang = language;
  ui.languageSelect.value = language;
  ui.loginLanguageSelect.value = language;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  updateLoginLabel();
  updateCountdownLabel();
}

function updateLoginLabel() {
  const role = document.querySelector('input[name="loginRole"]:checked')?.value || "user";
  ui.loginKeyLabel.textContent = role === "admin" ? t("adminUsername") : t("username");
  ui.loginKey.placeholder = role === "admin" ? "RAHUL" : t("username");
}

function showAuthForm(formId) {
  ui.authForms.forEach((form) => form.classList.toggle("active", form.id === formId));
  ui.authLinks.forEach((button) => button.classList.toggle("active", button.dataset.form === formId));
  setMessage(ui.loginStatus, "");
}

function setTodayDate() {
  const now = new Date();
  const shifted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  ui.entryDate.value = shifted.toISOString().slice(0, 10);
}

function updatePreview() {
  const total = Number(ui.cashEarning.value || 0) + Number(ui.onlineEarning.value || 0);
  const balance = total - Number(ui.expenseAmount.value || 0);
  ui.totalPreview.textContent = formatCurrency(total);
  ui.balancePreview.textContent = formatCurrency(balance);
}

function saveSession(user) {
  currentSession = user;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  if (user.role === "user") {
    lastLoginName = user.userKey;
    localStorage.setItem("dealskartLastLoginName", user.userKey);
  }
  startSessionTimer();
}

function clearSession(expired = false) {
  currentSession = null;
  sessionStorage.removeItem(SESSION_KEY);
  clearInterval(countdownTimer);
  countdownTimer = null;
  logoutDeadline = 0;
  ui.loginPassword.value = "";
  if (lastLoginName) ui.loginKey.value = lastLoginName;
  ui.reloginButton.classList.toggle("hidden", !expired);
  ui.logoutButton.classList.toggle("hidden", expired);
  showLogin();
  if (expired) {
    showAuthForm("loginForm");
    setMessage(ui.loginStatus, `${t("sessionExpired")} ${t("reloginReady")}`, "error");
  }
}

function updateCountdownLabel() {
  const remaining = Math.max(0, Math.ceil((logoutDeadline - Date.now()) / 1000));
  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");
  ui.countdown.textContent = `${t("sessionPrefix")} ${minutes}:${seconds}`;
}

function startSessionTimer() {
  clearInterval(countdownTimer);
  logoutDeadline = Date.now() + (SESSION_SECONDS * 1000);
  updateCountdownLabel();
  countdownTimer = window.setInterval(() => {
    if (Date.now() >= logoutDeadline) {
      clearSession(true);
      return;
    }
    updateCountdownLabel();
  }, 1000);
}

function bumpSession() {
  if (!currentSession) return;
  logoutDeadline = Date.now() + (SESSION_SECONDS * 1000);
  updateCountdownLabel();
}

function showLogin() {
  ui.appShell.classList.add("hidden");
  ui.loginScreen.classList.remove("hidden");
}

function showApp() {
  ui.loginScreen.classList.add("hidden");
  ui.appShell.classList.remove("hidden");
  ui.driverBadge.textContent = `${currentSession.role.toUpperCase()} • ${currentSession.name}`;
  ui.entryTabButton.classList.toggle("hidden", currentSession.role === "admin");
  ui.adminTabButton.classList.toggle("hidden", currentSession.role !== "admin");
  ui.walletPanel.classList.remove("hidden");
  ui.reloginButton.classList.add("hidden");
  ui.logoutButton.classList.remove("hidden");
  if (currentSession.role === "admin") {
    activateTab("earningsPanel");
  } else {
    activateTab("entryPanel");
  }
  setTodayDate();
  updatePreview();
  loadDashboard();
}

function activateTab(tabId) {
  ui.tabButtons.forEach((button) => button.classList.toggle("active", button.dataset.tab === tabId));
  ui.tabPanels.forEach((panel) => panel.classList.toggle("active", panel.id === tabId));
}

function calculateSummary(records) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);
  const dailyTotals = new Map();

  const summary = records.reduce((acc, record) => {
    const recordDate = new Date(`${record.entryDate}T00:00:00`);
    const earning = Number(record.totalEarning || 0);
    const expense = Number(record.expenseAmount || 0);
    acc.totalEarning += earning;
    acc.totalExpense += expense;
    if (recordDate >= sevenDaysAgo && recordDate <= today) acc.sevenDayEarning += earning;
    if (recordDate.getFullYear() === now.getFullYear() && recordDate.getMonth() === now.getMonth()) acc.monthEarning += earning;

    const key = record.entryDate;
    const current = dailyTotals.get(key) || { earning: 0, expense: 0, saving: 0 };
    current.earning += earning;
    current.expense += expense;
    current.saving += Number(record.balance || 0);
    dailyTotals.set(key, current);
    return acc;
  }, { totalEarning: 0, totalExpense: 0, sevenDayEarning: 0, monthEarning: 0, dailyTotals });

  return summary;
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
  currentWallet = {
    availableCash: Number(wallet.availableCash || 0),
    availableOnline: Number(wallet.availableOnline || 0),
    availableTotal: Number(wallet.availableTotal || 0),
    depositedTotal: Number(wallet.depositedTotal || 0)
  };
  ui.availableTotal.textContent = formatCurrency(currentWallet.availableTotal);
  ui.availableCash.textContent = formatCurrency(currentWallet.availableCash);
  ui.availableOnline.textContent = formatCurrency(currentWallet.availableOnline);
  ui.depositedTotal.textContent = formatCurrency(currentWallet.depositedTotal);
}

function renderRecords(records) {
  if (!records.length) {
    ui.recordsBody.innerHTML = `<tr><td colspan="8">${t("noRecords")}</td></tr>`;
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
    ui.depositsBody.innerHTML = `<tr><td colspan="5">${t("noDeposits")}</td></tr>`;
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

function lockEntryForm(locked, message = "") {
  ui.form.classList.toggle("disabled", locked);
  ui.submitEntryButton.disabled = locked;
  [ui.cashEarning, ui.onlineEarning, ui.expenseAmount, ui.form.elements.expenseReason].forEach((input) => {
    input.disabled = locked;
  });
  if (message) setMessage(ui.formStatus, message, locked ? "error" : "success");
}

function updateEntryState(records) {
  if (currentSession.role === "admin") {
    lockEntryForm(true, t("adminEntryDisabled"));
    return;
  }
  const alreadyEntered = records.some((record) => record.entryDate === ui.entryDate.value);
  if (alreadyEntered) {
    lockEntryForm(true, t("alreadyEntered"));
  } else {
    lockEntryForm(false, t("readyEntry"));
  }
}

function computeWalletForUser(records, deposits, username) {
  const scopedRecords = records.filter((record) => record.userKey === username);
  const scopedDeposits = deposits.filter((deposit) => deposit.userKey === username);
  const earnedCash = scopedRecords.reduce((total, row) => total + Number(row.cashEarning || 0), 0);
  const earnedOnline = scopedRecords.reduce((total, row) => total + Number(row.onlineEarning || 0), 0);
  const totalExpense = scopedRecords.reduce((total, row) => total + Number(row.expenseAmount || 0), 0);
  const depositedCash = scopedDeposits.reduce((total, row) => total + Number(row.cashDeposit || 0), 0);
  const depositedOnline = scopedDeposits.reduce((total, row) => total + Number(row.onlineDeposit || 0), 0);
  const expenseFromCash = Math.min(earnedCash, totalExpense);
  const expenseFromOnline = Math.max(totalExpense - expenseFromCash, 0);
  const availableCash = Math.max(earnedCash - expenseFromCash - depositedCash, 0);
  const availableOnline = Math.max(earnedOnline - expenseFromOnline - depositedOnline, 0);
  return {
    availableCash,
    availableOnline,
    availableTotal: availableCash + availableOnline
  };
}

function renderAdminMetrics(records, deposits) {
  const activeUsers = adminUsers.filter((user) => user.role === "user" && user.status === "active");
  const summary = calculateSummary(records);
  const dayCount = Math.max(summary.dailyTotals.size, 1);
  const totalSaving = records.reduce((total, row) => total + Number(row.balance || 0), 0);
  const overallWallet = adminUsers
    .filter((user) => user.role === "user" && user.status === "active")
    .reduce((total, user) => total + computeWalletForUser(records, deposits, user.username).availableTotal, 0);

  ui.activeUsers.textContent = activeUsers.length.toString();
  ui.averageDailyEarning.textContent = formatCurrency(summary.totalEarning / dayCount);
  ui.averageDailySaving.textContent = formatCurrency(totalSaving / dayCount);
  ui.averageExpense.textContent = formatCurrency(summary.totalExpense / dayCount);
  ui.pendingDeposit.textContent = formatCurrency(overallWallet);
}

function renderAdminDepositOptions(records, deposits) {
  const activeUsers = adminUsers.filter((user) => user.role === "user" && user.status === "active");
  if (!activeUsers.length) {
    ui.adminDepositUser.innerHTML = `<option value="">${t("noUsers")}</option>`;
    ui.adminDepositButton.disabled = true;
    return;
  }
  const selected = ui.adminDepositUser.value || activeUsers[0].username;
  ui.adminDepositUser.innerHTML = activeUsers.map((user) => `
    <option value="${escapeHtml(user.username)}">${escapeHtml(user.name)} (${escapeHtml(user.username)})</option>
  `).join("");
  ui.adminDepositUser.value = selected;
  updateAdminDepositSummary(records, deposits);
}

function updateAdminDepositSummary(recordsCache = [], depositsCache = []) {
  const selected = ui.adminDepositUser.value;
  if (!selected) {
    ui.adminDepositCash.textContent = formatCurrency(0);
    ui.adminDepositOnline.textContent = formatCurrency(0);
    ui.adminDepositTotal.textContent = formatCurrency(0);
    ui.adminDepositButton.disabled = true;
    return;
  }
  const wallet = computeWalletForUser(recordsCache, depositsCache, selected);
  ui.adminDepositCash.textContent = formatCurrency(wallet.availableCash);
  ui.adminDepositOnline.textContent = formatCurrency(wallet.availableOnline);
  ui.adminDepositTotal.textContent = formatCurrency(wallet.availableTotal);
  ui.adminDepositButton.disabled = wallet.availableTotal <= 0;
  ui.adminDepositButton.dataset.cash = String(wallet.availableCash);
  ui.adminDepositButton.dataset.online = String(wallet.availableOnline);
}

async function loadUsers() {
  ui.usersBody.innerHTML = `<tr><td colspan="8">${t("loadingUsers")}</td></tr>`;
  const result = await postAction("listUsers", { adminKey: currentSession.userKey });
  adminUsers = result.data.users || [];
  if (!adminUsers.length) {
    ui.usersBody.innerHTML = `<tr><td colspan="8">${t("noUsers")}</td></tr>`;
    return;
  }
  ui.usersBody.innerHTML = adminUsers.map((user) => `
    <tr>
      <td>${escapeHtml(user.name)}</td>
      <td>${escapeHtml(user.username)}</td>
      <td>${escapeHtml(user.pan || "-")}</td>
      <td>${escapeHtml(user.dob || "-")}</td>
      <td>${escapeHtml(user.role)}</td>
      <td>${escapeHtml(user.status)}</td>
      <td>${escapeHtml(user.createdAt)}</td>
      <td>${user.role === "admin" ? "-" : `<button class="secondary-button delete-user-button" data-user-key="${escapeHtml(user.username)}" type="button">${t("delete")}</button>`}</td>
    </tr>
  `).join("");
}

async function loadDashboard() {
  bumpSession();
  ui.recordsBody.innerHTML = `<tr><td colspan="8">${t("loadingRecords")}</td></tr>`;
  ui.depositsBody.innerHTML = `<tr><td colspan="5">${t("loadingDeposits")}</td></tr>`;

  const response = await fetch(getEndpointUrl("read"));
  const result = await response.json();
  if (!result.ok) throw new Error(result.message || "Load failed.");

  const records = result.data.records || [];
  const deposits = result.data.deposits || [];
  renderSummary(records);
  renderWallet(result.data.wallet || {});
  renderRecords(records);
  renderDeposits(deposits);
  updateEntryState(records);

  if (currentSession.role === "admin") {
    await loadUsers();
    renderAdminMetrics(records, deposits);
    renderAdminDepositOptions(records, deposits);
    setMessage(ui.adminDepositStatus, t("quickSuggestion"), "success");
  }

  ui._recordsCache = records;
  ui._depositsCache = deposits;
}

ui.authLinks.forEach((button) => {
  button.addEventListener("click", () => showAuthForm(button.dataset.form));
});

document.querySelectorAll('input[name="loginRole"]').forEach((radio) => {
  radio.addEventListener("change", updateLoginLabel);
});

ui.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(ui.loginStatus, t("loginProgress"));
  try {
    const result = await postAction("login", {
      role: document.querySelector('input[name="loginRole"]:checked').value,
      username: ui.loginKey.value.trim().toUpperCase(),
      password: ui.loginPassword.value
    });
    saveSession(result.data.user);
    ui.loginPassword.value = "";
    setMessage(ui.loginStatus, "");
    showApp();
  } catch (error) {
    setMessage(ui.loginStatus, error.message, "error");
  }
});

ui.registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(ui.loginStatus, t("registerProgress"));
  try {
    await postAction("register", {
      name: $("#registerName").value.trim(),
      username: $("#registerUsername").value.trim().toUpperCase(),
      pan: $("#registerPan").value.trim().toUpperCase(),
      dob: $("#registerDob").value,
      password: $("#registerPassword").value,
      role: "user"
    });
    ui.registerForm.reset();
    showAuthForm("loginForm");
    setMessage(ui.loginStatus, t("accountCreated"), "success");
  } catch (error) {
    setMessage(ui.loginStatus, error.message, "error");
  }
});

ui.forgotForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(ui.loginStatus, t("resetProgress"));
  try {
    await postAction("resetPassword", {
      username: $("#forgotUsername").value.trim().toUpperCase(),
      pan: $("#forgotPan").value.trim().toUpperCase(),
      dob: $("#forgotDob").value,
      newPassword: $("#forgotNewPassword").value
    });
    ui.forgotForm.reset();
    showAuthForm("loginForm");
    setMessage(ui.loginStatus, t("passwordResetSuccess"), "success");
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

ui.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  bumpSession();
  setMessage(ui.formStatus, t("entrySaving"));
  ui.submitEntryButton.disabled = true;
  try {
    await postAction("create", {
      userKey: currentSession.userKey,
      entryDate: ui.entryDate.value,
      cashEarning: Number(ui.cashEarning.value || 0),
      onlineEarning: Number(ui.onlineEarning.value || 0),
      expenseAmount: Number(ui.expenseAmount.value || 0),
      expenseReason: ui.form.elements.expenseReason.value
    });
    ui.form.reset();
    setTodayDate();
    updatePreview();
    setMessage(ui.formStatus, t("entrySaved"), "success");
    await loadDashboard();
  } catch (error) {
    setMessage(ui.formStatus, error.message, "error");
    ui.submitEntryButton.disabled = false;
  }
});

ui.adminCreateUserForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  bumpSession();
  setMessage(ui.adminStatus, t("registerProgress"));
  try {
    await postAction("adminCreateUser", {
      adminKey: currentSession.userKey,
      name: $("#adminUserName").value.trim(),
      username: $("#adminUsername").value.trim().toUpperCase(),
      pan: $("#adminUserPan").value.trim().toUpperCase(),
      dob: $("#adminUserDob").value,
      password: $("#adminUserPassword").value,
      role: "user"
    });
    ui.adminCreateUserForm.reset();
    setMessage(ui.adminStatus, t("accountCreated"), "success");
    await loadDashboard();
  } catch (error) {
    setMessage(ui.adminStatus, error.message, "error");
  }
});

ui.usersBody.addEventListener("click", async (event) => {
  if (!event.target.classList.contains("delete-user-button")) return;
  bumpSession();
  try {
    await postAction("deleteUser", {
      adminKey: currentSession.userKey,
      userKey: event.target.dataset.userKey
    });
    setMessage(ui.adminStatus, t("delete"), "success");
    await loadDashboard();
  } catch (error) {
    setMessage(ui.adminStatus, error.message, "error");
  }
});

ui.adminDepositUser.addEventListener("change", () => {
  updateAdminDepositSummary(ui._recordsCache || [], ui._depositsCache || []);
});

ui.adminDepositButton.addEventListener("click", async () => {
  bumpSession();
  const cashDeposit = Number(ui.adminDepositButton.dataset.cash || 0);
  const onlineDeposit = Number(ui.adminDepositButton.dataset.online || 0);
  if (cashDeposit + onlineDeposit <= 0) {
    setMessage(ui.adminDepositStatus, t("depositUnavailable"), "error");
    return;
  }
  setMessage(ui.adminDepositStatus, t("depositSaving"));
  try {
    await postAction("deposit", {
      adminKey: currentSession.userKey,
      targetUserKey: ui.adminDepositUser.value,
      cashDeposit,
      onlineDeposit
    });
    setMessage(ui.adminDepositStatus, t("depositSaved"), "success");
    await loadDashboard();
  } catch (error) {
    setMessage(ui.adminDepositStatus, error.message, "error");
  }
});

ui.tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activateTab(button.dataset.tab);
    if (button.dataset.tab === "earningsPanel" || button.dataset.tab === "adminPanel") {
      loadDashboard().catch((error) => setMessage(ui.formStatus, error.message, "error"));
    }
  });
});

ui.refreshButton.addEventListener("click", () => loadDashboard().catch((error) => setMessage(ui.formStatus, error.message, "error")));
ui.adminRefreshButton.addEventListener("click", () => loadDashboard().catch((error) => setMessage(ui.adminStatus, error.message, "error")));
ui.languageSelect.addEventListener("change", () => applyLanguage(ui.languageSelect.value));
ui.loginLanguageSelect.addEventListener("change", () => applyLanguage(ui.loginLanguageSelect.value));
[ui.cashEarning, ui.onlineEarning, ui.expenseAmount].forEach((input) => input.addEventListener("input", updatePreview));
["click", "keydown", "input", "pointerdown"].forEach((eventName) => window.addEventListener(eventName, bumpSession, { passive: true }));

setTodayDate();
updatePreview();
applyLanguage(currentLanguage);
updateLoginLabel();

try {
  currentSession = JSON.parse(sessionStorage.getItem(SESSION_KEY));
} catch (error) {
  currentSession = null;
}

if (lastLoginName) ui.loginKey.value = lastLoginName;

if (currentSession?.userKey) {
  startSessionTimer();
  showApp();
}
