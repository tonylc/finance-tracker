# Investment Tracker — Design Document

## 1. Product Overview

Investment Tracker is a zero-server, frontend-only web application for tracking investment portfolio holdings across brokerage accounts. It stores all data in the browser's `localStorage`; no login, no sync, no backend.

**Core workflow:**
1. Configure account profiles in **Settings** (one per broker, defines CSV column mapping)
2. Upload holdings CSVs from each broker in **Upload** (replaces current holdings for that account)
3. Fetch or manually enter current market prices in **Prices**
4. View portfolio breakdown, gains/losses in **Portfolio**
5. Save a networth snapshot; track portfolio value over time in **History**

**Architecture constraints:**
- Single HTML file — no build step, openable by double-clicking
- All application logic in pure JS functions exposed on `window.__investmentLib`
- No external dependencies at runtime

---

## 2. Views

### 2.1 Upload

Import holdings CSVs per account.

- **Account dropdown** — select a configured account profile
- **CSV input** — paste CSV text or use file picker (`.csv`, `.txt`)
- **Import button** — parses CSV according to account's `inputCsvFormat`, validates, then replaces all holdings for that account
- **Current holdings table** — shows all accounts' holdings: Account, Ticker, Security Name, Shares, Cost Basis, Cost/Share
- Account chips show a count of positions per account

**Import behavior:**
- Uploading for account X replaces all previous holdings for X; other accounts are untouched
- A leading header row is automatically detected (if the shares column is non-numeric on the first row, it is skipped)
- In header-name fallback mode (no `inputCsvFormat` set), the first row is always the header

### 2.2 Portfolio

Current portfolio value using the latest saved prices.

- **Summary banner** — Total Value, Cost Basis, Unrealized Gain, Return %
- **Positions table** — grouped by account with subtotals; columns: Account, Ticker, Security Name, Shares, Price, Value, Cost Basis, Gain/Loss, Return
- **Save Snapshot** button — computes account-level totals and persists to History
- Warnings shown when holdings or prices are missing
- Prices label shows the date prices were last saved

### 2.3 Prices

Manage the current price set used by Portfolio.

- **Fetch from Yahoo Finance** — calls `https://query1.finance.yahoo.com/v7/finance/quote?symbols=...` with all tracked tickers; populates the editable price table. Degrades gracefully if Yahoo Finance is unavailable.
- **Import CSV** — accepts a two-column CSV (`Ticker,Price`); populates the editable price table
- **Manual entry** — price input per ticker; always available
- **Save Prices** button — persists the current price table to `localStorage` as `currentPrices`
- Prices are stored as a single "current" snapshot with a `fetchedAt` date; no historical price series is kept

### 2.4 History

Networth snapshots over time, grouped by branch.

- **Sparkline chart** — SVG line chart of `totalValue` across all saved snapshots (oldest→newest)
- **Snapshots table** — grouped by branch; columns: Branch/Date, Value, Cost Basis, Gain/Loss, Return
  - **Branch header row** (`history-branch-header-row`) — branch name with its most-recent snapshot's totals; no delete button
  - **Date sub-row** (`history-date-row`) — per-snapshot values for that branch, indented; delete button removes the snapshot
  - Branches sorted alphabetically; date sub-rows within each branch sorted newest-first
- Snapshots store account-level breakdowns; per-position history is not stored
- Snapshots without account-level data are not displayed in the branch view

#### History Branch Totals

### 2.5 Settings

Configure broker account profiles.

- **Account profile table** — Name, Last 4, Columns Mapped; Edit / Delete per row
- **Add / Edit form** — Name, Last 4 digits (required, exactly 4 digits), Column Format (JSON array)
- **Export Settings** — minified JSON of all account profiles; copy to clipboard/paste elsewhere
- **Import Settings** — paste exported JSON to restore account profiles in another browser

---

## 3. Data Model

### 3.1 localStorage keys

| Key | Contents |
|-----|----------|
| `investmentTrackerConfig` | Account profiles (`{ accounts: [...] }`) |
| `investmentTrackerData` | Holdings, current prices, networth snapshots |

### 3.2 Account Profile

```json
{
  "id": "uuid",
  "name": "Vanguard",
  "last4": "1234",
  "inputCsvFormat": ["ticker", "security_name", "shares", "cost_basis_per_share", null]
}
```

### 3.3 Holding (current state only, per account)

```json
{
  "id": "uuid",
  "accountKey": "Vanguard *1234",
  "ticker": "VTI",
  "securityName": "Vanguard Total Stock Market ETF",
  "shares": 100.5,
  "costBasis": 21500.00
}
```

Holdings are **current state only** — uploading a CSV for account X replaces all holdings for X.

### 3.4 Current Prices

```json
{
  "fetchedAt": "2026-05-21",
  "prices": { "VTI": 285.50, "BND": 74.20 }
}
```

A single object; overwritten each time prices are saved. No historical price series.

### 3.5 Networth Snapshot (immutable after save)

```json
{
  "id": "uuid",
  "date": "2026-05-21",
  "accounts": {
    "Vanguard *1234": { "value": 28550.00, "costBasis": 21500.00 }
  },
  "totalValue": 28550.00,
  "totalCostBasis": 21500.00
}
```

Snapshots store pre-computed account-level totals. Per-position data is not stored in snapshots.

---

## 4. `inputCsvFormat` Tokens

| Token | Meaning |
|-------|---------|
| `"ticker"` | Ticker symbol — uppercased (required) |
| `"shares"` | Number of shares (required) |
| `"security_name"` | Full security name (optional) |
| `"cost_basis"` | Total cost basis in USD (optional) |
| `"cost_basis_per_share"` | Per-share cost; multiplied by shares to get total (optional) |
| `null` | Skip this column |

Required: `"ticker"` and `"shares"`. If neither `"cost_basis"` nor `"cost_basis_per_share"` is present, `costBasis` defaults to `0`.

---

## 5. Library Functions (`window.__investmentLib`)

### CSV Parsing

| Function | Signature | Description |
|----------|-----------|-------------|
| `parseCSV` | `(raw: string) → string[][]` | Parse full CSV; handles BOM, CRLF, quoted fields |
| `parseCSVLine` | `(line: string) → string[]` | Parse a single CSV line |

### Holdings Import Pipeline

| Function | Signature | Description |
|----------|-----------|-------------|
| `buildHoldingsHeaderMap` | `(headerRow, inputCsvFormat?) → map \| { error }` | Positional or header-name mode; validates tokens; requires ticker + shares |
| `validateHoldingsImport` | `(rows, headerMap) → { valid, errors[] }` | Row-level validation: non-blank ticker, positive numeric shares |
| `parseHolding` | `(fields, headerMap, accountKey) → Holding` | Builds holding object; uppercases ticker; strips `$` and commas |
| `replaceHoldings` | `(existing, incoming, accountKey) → Holding[]` | Removes all rows for accountKey, appends incoming |

### Portfolio Computation

| Function | Signature | Description |
|----------|-----------|-------------|
| `getTrackedTickers` | `(holdings) → string[]` | Unique tickers sorted alphabetically |
| `computePortfolioValue` | `(holdings, priceMap) → Position[]` | Each position: `{ accountKey, ticker, securityName, shares, costBasis, price, value, gain, gainPct }` — `price/value/gain/gainPct` are `null` if ticker not in priceMap |
| `computeAccountTotals` | `(positions) → { [accountKey]: { value, costBasis } }` | Per-account sums; null values skipped in sum |
| `computeNetworth` | `(positions) → number` | Sum of non-null position values |
| `buildNetworthSnapshot` | `(accountTotals, date) → Snapshot` | Creates a snapshot object ready to persist |

### Formatting

| Function | Example output |
|----------|---------------|
| `fmtCurrency(n)` | `$28,550.00` / `-$500.00` / `—` (null) |
| `fmtPercent(n)` | `+12.34%` / `-5.50%` / `—` (null) |
| `fmtShares(n)` | `100` / `100.5` / `1234.567891` / `—` (null) |

### Settings / Utilities

| Function | Description |
|----------|-------------|
| `formatAccountKey(name, last4)` | Returns `"Name *1234"` |
| `isValidLast4(val)` | Returns `true` for exactly 4 digits |
| `exportAccountsJSON(accounts)` | Minified JSON string of account array |
| `importAccountsJSON(str)` | `{ ok: true, accounts }` or `{ ok: false, error }` |
