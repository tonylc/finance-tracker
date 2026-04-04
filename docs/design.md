# Finance Tracker — Design Document

> **Last updated:** 2026-04-04 (buildHeaderMap error message capitalization fix)  
> **Status:** Current

This document describes the Finance Tracker application: what it does, why it is built the way it is, and the detailed engineering decisions underlying each part. It is the authoritative reference for future development.

---

## 1. Product Overview

Finance Tracker is a zero-server personal finance tool that runs entirely in the browser. The user imports bank CSVs, categorizes transactions, reviews monthly spending via a visual bar chart, and exports categorized data back to CSV. No data leaves the device; no account or login is required.

### Goals

- Make it frictionless to import transactions from multiple bank accounts with different CSV formats.
- Give a clear month-by-month view of spending by category.
- Allow offline categorization of transactions before adding them to the main store.
- Stay fully local — no backend, no third-party services.

### Non-goals

- Real-time bank connectivity (Plaid/OFX integrations).
- Budgeting targets or alerts.
- Multi-user or sync across devices.
- Persistence of transactions across page reloads (by design — session-only).

---

## 2. Views

The app is a single HTML page (`index.html`) with four views toggled by a top nav bar. Only one view is visible at a time.

### 2.1 Load

**Purpose:** Import transactions from a bank CSV into the in-memory transaction store.

**User flow:**
1. Select an account profile from the dropdown (configured in Settings).
2. Paste the raw CSV from the bank into the textarea.
3. Click **Load Transactions**.
4. The app deduplicates against existing transactions, reports the count added, and shows a summary of loaded accounts with transaction counts.

**Engineering details:**

- The selected account profile provides `inputCsvFormat` — a positional array mapping column index → field name. `buildHeaderMap()` uses this to locate date, description, amount, category, and fix columns by position rather than header name.
- If the first row of the pasted CSV looks like a header (non-numeric date field), it is skipped automatically.
- Each imported row is validated by `validateImport()` before being processed. Rows with unparseable dates, blank descriptions, or non-finite amounts are rejected with a row-level error message.
- Deduplication key: `accountKey|date|description|amount`. Two transactions are considered identical if all four values match. `deduplicateTransactions()` returns the merged array; duplicates are silently skipped (no error).
- Uncategorized transactions are allowed. A notice is shown after load if any exist, with a link to the Categorize view.
- `state.transactions` is the single source of truth. It grows monotonically during a session and is never persisted to localStorage.

**Account key format:** `"Account Name *last4"` — produced by `formatAccountKey(name, last4)`.

---

### 2.2 Budget

**Purpose:** Visualize spending by category for a chosen month, with drill-down into individual transactions.

**User flow:**
1. Navigate to Budget. If no transactions are loaded, an empty state is shown.
2. The most recent month with transactions is displayed by default.
3. Use **←** / **→** arrows to navigate months.
4. The bar chart shows one bar per parent category, sorted by absolute spend descending.
5. Click any bar to open the detail panel listing every transaction in that category for the month.
6. Click **← All Categories** to return to the bar chart.

**Engineering details:**

**Month list generation:** `getMonthList(transactions)` extracts all unique `{ year, month }` pairs (1-based month, 1=January) from transaction dates, sorted chronologically. Transactions with blank or invalid dates are skipped. The result is stored in `budgetMonths[]`; `budgetIdx` tracks the currently displayed entry.

**Month filtering:** `filterByMonth(transactions, year, month)` filters the full transaction list to a single calendar month. Month is 1-based. Implementation: `d.getMonth() + 1 === month`.

**Bar chart rendering:** Categories are derived from `CAT_LIST` filtered to parents that have at least one transaction in the month. Each parent's total and count are summed across its subcategories. Bars are scaled relative to the largest absolute value (100% width = max spend). Bars are sorted by `|total|` descending.

**Bar colors:**
- `#43a047` (green) — negative total (expense / money leaving)
- `#5c6bc0` (blue) — positive total (income / money received)

**Detail panel:** Transactions are filtered to `SUB_TO_PARENT[t.category] === parent`, then sorted by date ascending.

**Uncategorized warning:** Transactions without a category are excluded from `aggregateByCategory()` and from the grand total. A yellow warning banner is shown if any exist in the current month.

**Navigation state:** `budgetMonths` and `budgetIdx` are module-level variables reset on each call to `renderBudget()`. Navigating away from Budget and back resets to the most recent month.

---

### 2.3 Categorize

**Purpose:** Import raw transactions (without categories), assign a category to each, then export the categorized CSV for later import via Load.

**User flow:**
1. Select an account profile and paste a bank CSV (same as Load).
2. A table renders with one row per transaction: date, description, amount, category dropdown, fix checkbox.
3. Assign categories using the dropdowns or the keyboard shortcut (single letter key cycles matching categories).
4. When all rows are categorized, click **Export CSV** to generate a CSV ready to import in Load.

**Engineering details:**

- `state.catSession[]` holds the working rows for the current Categorize session. It is independent of `state.transactions`.
- Category dropdowns are `<select>` elements with `<optgroup>` per parent category. The full list of subcategories comes from `CAT_LIST`.
- **Keyboard cycling:** A `keydown` listener on each category select calls `cycleCategoryByKey(currentValue, key, ALL_SUBS)`. The function finds all subcategories whose name starts with the pressed letter (case-insensitive), then advances to the next match after the current selection, wrapping around.
- Rows with no category assigned are highlighted with `.cat-error` (red background).
- `validateExport()` blocks export if any row has a blank category, returning the invalid row indices.
- The exported CSV format: `Date,Description,Amount,Category,Fix` — identical to what Load expects.
- `toCSV()` handles quoting of fields containing commas, quotes, or newlines.

---

### 2.4 Settings

**Purpose:** Configure one or more bank account profiles, each describing how to parse that bank's CSV format.

**User flow:**
1. Click **Add Account** (or Edit on an existing account).
2. Enter account name and last 4 digits.
3. Paste the header row from the bank's CSV file.
4. Click **Parse Columns** — the app splits the header and renders a dropdown for each column.
5. Map each column to: skip, Date, Description, Amount, Category, or Fix.
6. Click **Save Account**.

**Engineering details:**

- Account profiles are stored in `state.userConfig.accounts[]` and persisted to `localStorage` under key `'financeTrackerConfig'`.
- `inputCsvFormat` is a positional array the length of the bank's header row. Each entry is a field name (`'date'`, `'description'`, `'amount'`, `'category'`, `'fix'`) or `null` (skip).
- `buildHeaderMap(headerRow, inputCsvFormat)` uses `inputCsvFormat` when provided, ignoring the header values. This allows banks that rename or reorder columns to work correctly.
- Required fields: Date, Description, Amount. Save is blocked if any are unmapped.
- Each account gets a UUID `id` on creation. Deleting an account removes it from `state.userConfig.accounts` and from the account dropdowns in Load and Categorize.

---

## 3. Data Model

### Transaction

```javascript
{
  id:          string,   // UUID, generated at import time
  accountKey:  string,   // "Account Name *1234"
  date:        string,   // ISO-like date, e.g. "2025-03-15"
  description: string,
  amount:      number,   // Negative = debit/expense, positive = credit/income
  category:    string,   // Subcategory name (see §5), or "" if uncategorized
  fix:         boolean,  // User-defined flag; imported from CSV "Fix" column
}
```

### Account Profile (persisted)

```javascript
{
  id:             string,   // UUID
  name:           string,   // e.g. "Chase Checking"
  last4:          string,   // 4-digit string
  inputCsvFormat: Array,    // e.g. ["date", null, "description", "amount", "category", "fix"]
}
```

### Runtime State

```javascript
const state = {
  transactions: [],       // All loaded transactions (session-only, not persisted)
  accounts:     [],       // { key, name, last4 } — populated on load, session-only
  catSession:   [],       // Working rows in Categorize view
  userConfig:   {
    accounts: [],         // Array of Account Profile objects (persisted to localStorage)
  },
};
```

---

## 4. Library Functions (`window.__financeLib`)

All pure functions are exposed on `window.__financeLib` for testing in `tests.html`.

### CSV Parsing

| Function | Signature | Description |
|---|---|---|
| `parseCSV` | `(raw: string) → string[][]` | Parses full CSV text into a 2D array of fields. Strips BOM, normalizes CRLF, skips blank lines. |
| `parseCSVLine` | `(line: string) → string[]` | Parses a single CSV line. Handles quoted fields, embedded commas, escaped `""` quotes. Trims unquoted fields. |

### Import Pipeline

| Function | Signature | Description |
|---|---|---|
| `formatAccountKey` | `(name, last4) → string` | Returns `"Name *last4"`. |
| `buildHeaderMap` | `(headerRow: string[], inputCsvFormat?: string[]) → HeaderMap \| { error }` | Maps field names to column indices. Uses positional `inputCsvFormat` if provided; otherwise matches lowercase header names. Returns `{ date, description, amount, category, fix }` where `category` and `fix` default to `-1` if absent. Returns `{ error: "Missing required columns: Date, Description, ..." }` (capitalized) if a required field is missing. |
| `validateImport` | `(rows: string[][], headerMap, requireCategory?) → { valid, errors }` | Validates each row: parseable date, non-blank description, finite amount. Optionally checks category. Returns error strings with 1-based row numbers. |
| `parseTransaction` | `(fields: string[], headerMap, accountKey) → Transaction` | Extracts and coerces fields into a Transaction object. Strips `$` and commas from amount. Assigns UUID. |
| `deduplicateTransactions` | `(existing: Transaction[], incoming: Transaction[]) → Transaction[]` | Merges arrays; skips incoming entries that match an existing `accountKey|date|description|amount` key. |

### Filtering & Aggregation

| Function | Signature | Description |
|---|---|---|
| `filterByMonth` | `(transactions, year: number, month: number) → Transaction[]` | Filters to a calendar month. `month` is **1-based** (1=January, 12=December). |
| `aggregateByCategory` | `(transactions) → { groups, grandTotal }` | Groups by parent → subcategory. `groups[parent][sub] = { total, count }`. Skips uncategorized. |
| `totalSpend` | `(transactions) → number` | Sum of all `amount` values. |
| `getMonthList` | `(transactions) → { year, month }[]` | Returns unique year-month pairs sorted chronologically. Month is 1-based. Skips blank/invalid dates. |

### Category Utilities

| Function | Signature | Description |
|---|---|---|
| `cycleCategoryByKey` | `(currentValue, key: string, subcategories: string[]) → string` | Finds all subcategories starting with `key` (case-insensitive). Returns the next match after `currentValue`, wrapping around. Returns `currentValue` unchanged if no match. |

### Export

| Function | Signature | Description |
|---|---|---|
| `validateExport` | `(rows) → { valid, invalidRows: number[] }` | Returns valid=false and indices of rows with blank category. |
| `toCSV` | `(rows) → string` | Serializes rows to CSV string with header `Date,Description,Amount,Category,Fix`. Quotes fields containing commas, quotes, or newlines. |

### Formatting

| Function | `fmtAmount(n: number) → string` | Description |
|---|---|---|
| `fmtAmount` | `(n: number) → string` | Formats as `$X,XXX.XX` with leading minus for negatives. |

---

## 5. Category System

Categories are two-level: **parent** (display grouping) → **subcategory** (the value stored on a transaction).

### Hierarchy

| Parent | Subcategories |
|---|---|
| Automotive | Gas / EV Charging, Service / Parts |
| Food | Coffee / Bakery, Groceries, Restaurants |
| Shopping | Clothing / Shoes, General Merchandise |
| Entertainment | Entertainment, Travel |
| Gifts | Gifts |
| Healthcare | Doctor, Dental, Pharmacy |
| Kids | Activities, Pets / Pet Care |
| Monthly Expenses | Bills, Home Maintenance |
| Misc | Misc, Uncategorized |

### Derived Lookups (exported in `__financeLib`)

- **`CAT_LIST`** — `Array<{ parent: string, subs: string[] }>` — the full hierarchy.
- **`ALL_SUBS`** — `string[]` — flat array of all 18 subcategory names.
- **`VALID_CATS`** — `Set<string>` — for O(1) validation.
- **`SUB_TO_PARENT`** — `{ [sub: string]: string }` — reverse lookup used in Budget drill-down.

---

## 6. Architecture & Key Constraints

### Single-file, no build step

The entire app is `index.html`. All JS, CSS, and HTML live in one file. There is no bundler, no npm, no build process. This is intentional — the app must be openable by double-clicking the file.

### No server, no persistence of transactions

Transactions exist only in `state.transactions` for the duration of the page session. Only account profiles (CSV column mappings) are persisted to `localStorage`. This keeps the data model simple and avoids any privacy concerns.

### Pure library functions for testability

All logic that can be tested without the DOM is extracted into pure functions in the lower half of `index.html` and exposed on `window.__financeLib`. The test runner (`tests.html` + `run-tests.js`) loads `index.html` in a headless browser, then calls these functions directly.

### Amount sign convention

Negative amounts are debits (money leaving). Positive amounts are credits (money arriving). This matches the convention used by most US bank export formats.

### 1-based months throughout

All month values in the codebase (in `getMonthList` output, in `filterByMonth` parameters, in `budgetMonths` entries) are **1-based** (January = 1, December = 12). This matches human-readable conventions and avoids off-by-one confusion when reading or debugging data.

---

## 7. File Map

| File | Purpose |
|---|---|
| `index.html` | Entire application: HTML structure, CSS, and JavaScript |
| `tests.html` | Test suite using custom `suite()`/`test()`/`assertEqual()` harness |
| `run-tests.js` | Node.js script that loads `tests.html` in jsdom and reports results |
| `docs/design.md` | This document |
| `memory/notes.md` | Per-session learnings and user preferences for Claude |
| `CLAUDE.md` | Workflow instructions for Claude Code sessions |
