# Dealskart – Auto Earning Tracker

A responsive, modern financial dashboard connected to your existing **Auto Earning Diary** Google Sheet via Google Apps Script.

## 1. Existing Google Sheet Structure (Single Source of Truth)
This website is built directly around your existing **Auto Earning Diary** spreadsheet without creating a new sheet or altering existing headers:

- **`Auto Earnings`**: `Driver Name`, `Username`, `Entry Date`, `Cash Earning`, `Online Earning`, `Total Earning`, `Expense Amount`, `Expense Reason`, `Balance`, `Created At`
- **`Bank Deposits`**: `Driver Name`, `Username`, `Deposit Date`, `Cash Deposit`, `Online Deposit`, `Total Deposit`, `Created At`
- **`Users`**: `Role`, `Name`, `Username`, `PAN Number`, `DOB`, `Password Hash`, `Status`, `Created At`, `Photo Data`, `Phone`, `Address`, `Admin Notes`, `Approved At`

> Note: `Working hours` and `Kilometres driven` are not present in `Auto Earnings`, so the daily entry form intentionally omits them to stay 100% faithful to your spreadsheet.

## 2. Project Structure
```text
dealskart-auto-earning-tracker/
├── index.html
├── css/styles.css
├── js/
│   ├── config.js       # Web App URL, sheet schema, INR/IST locale settings
│   ├── api.js          # Google Apps Script API client (GET/POST, CORS-safe, retries, auth token)
│   ├── data.js         # INR formatting, IST date normalization, KPI & analytics math, CSV parser
│   ├── dashboard.js    # All 10 dashboard KPI cards + recent entries table
│   ├── charts.js       # Chart.js daily, weekly, monthly, yearly & earnings-vs-expenses charts
│   ├── calendar.js     # Monthly interactive calendar with missing-day highlights & edit support
│   ├── components.js   # Toasts, confirmation modal, HTML sanitizer
│   ├── settings.js     # Dark/light mode & real backend connection status
│   └── app.js          # Main state, routing, entry form, history filters & pagination
├── apps-script/
│   └── Code.gs         # Non-destructive Apps Script JSON API matching your existing sheets
└── README.md
```

## 3. Google Apps Script Backend Setup (`apps-script/Code.gs`)
Your live deployment (`AKfycbyBaa0bgLsl5C6BXoSG6u1-kBsd7Cj14hJ8DQBmtqroSVWuY8rr3ds5QfMOaZ-2dbFaJQ`) currently returns `{"ok": false, "message": "Login required."}` when unauthenticated.

To enable all website actions (`login`, `logout`, `health`, `getEarnings`, `addEarning`, `updateEarning`, `deleteEarning`) while keeping all existing sheet data intact:
1. Open your **Auto Earning Diary** Google Sheet → **Extensions → Apps Script**.
2. Back up your existing script code, then merge or paste `apps-script/Code.gs`.
3. Click **Deploy → Manage deployments → Edit (pencil icon)** on your existing deployment → **New version** → **Deploy** (keeps the exact same Web App URL).
4. Ensure **Execute as: Me** and **Who has access: Anyone** are selected so browser `fetch()` requests succeed.

## 4. Run Locally
Because the modular project uses ES Modules (`type="module"`), serve it over a local HTTP server (not `file://`):
```bash
cd dealskart-auto-earning-tracker
python3 -m http.server 8080
```
Then open `http://localhost:8080` in your browser.

## 5. Deploy to Production (Free Static Hosting)
- **GitHub Pages**: Push the folder to a GitHub repository → **Settings → Pages → Deploy from branch (`main` / root)**.
- **Netlify / Vercel / Cloudflare Pages**: Drag and drop the `dealskart-auto-earning-tracker/` folder (no build step required).

## 6. Authentication Options
The included `Code.gs` integrates with your existing `Users` sheet (SHA-256 `Password Hash`, `Role`, `Status = active`) using short-lived `CacheService` session tokens (12-hour TTL). Drivers only see and edit their own rows; `admin` users can filter across all drivers.
