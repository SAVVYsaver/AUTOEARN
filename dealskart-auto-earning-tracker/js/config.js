/**
 * Dealskart – Auto Earning Tracker
 * Centralized Application & Backend Configuration
 */
export const APP_CONFIG = {
  APP_NAME: 'Dealskart Auto Earning Tracker',
  CURRENCY_CODE: 'INR',
  CURRENCY_SYMBOL: '₹',
  LOCALE: 'en-IN',
  TIMEZONE: 'Asia/Kolkata',
  DEFAULT_WEB_APP_URL:
    'https://script.google.com/macros/s/AKfycbyBaa0bgLsl5C6BXoSG6u1-kBsd7Cj14hJ8DQBmtqroSVWuY8rr3ds5QfMOaZ-2dbFaJQ/exec',
  DEPLOYMENT_ID:
    'AKfycbyBaa0bgLsl5C6BXoSG6u1-kBsd7Cj14hJ8DQBmtqroSVWuY8rr3ds5QfMOaZ-2dbFaJQ',
  PAGE_SIZE: 25,
  REQUEST_TIMEOUT_MS: 20000,
  MAX_RETRIES: 2,
  STORAGE_KEYS: {
    THEME: 'dealskart_theme',
    WEB_APP_URL: 'dealskart_webapp_url',
    SESSION: 'dealskart_session',
    PREFS: 'dealskart_prefs'
  },
  // Exact column headers from Google Sheet "Auto Earning Diary"
  SHEET_SCHEMA: {
    AUTO_EARNINGS: [
      'Driver Name',
      'Username',
      'Entry Date',
      'Cash Earning',
      'Online Earning',
      'Total Earning',
      'Expense Amount',
      'Expense Reason',
      'Balance',
      'Created At'
    ],
    BANK_DEPOSITS: [
      'Driver Name',
      'Username',
      'Deposit Date',
      'Cash Deposit',
      'Online Deposit',
      'Total Deposit',
      'Created At'
    ],
    USERS: [
      'Role',
      'Name',
      'Username',
      'PAN Number',
      'DOB',
      'Password Hash',
      'Status',
      'Created At',
      'Photo Data',
      'Phone',
      'Address',
      'Admin Notes',
      'Approved At'
    ]
  }
};
