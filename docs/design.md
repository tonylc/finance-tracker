# Finance Tracker — Design Document

> **Last updated:** 2026-04-06 (budget search always visible, unified columns, fix label + searchable, row-click expand; account settings export / import; Load page account export; date-ascending CSV exports)
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

**Export:** Each account chip in the summary includes an **Export** button. Clicking it calls `handleLoadExport(accountKey)`, which filters `state.transactions` to that account, sorts ascending with `sortByDateAsc()`, serializes with `toCSV()`, and displays the result in `#load-export-card` below the summary. A **Copy** button copies the textarea to clipboard.

---

### 2.2 Budget

**Purpose:** Visualize spending by category for a chosen month, with a full transaction list and drill-down into individual categories.

**User flow:**
1. Navigate to Budget. If no transactions are loaded, an empty state is shown.
2. The most recent month is displayed by default. The dark banner shows **Month Total** and **Transactions** for that month; both update as you navigate with ← →.
3. Use **←** / **→** arrows to navigate months. The heading, banner stats, bar chart, and transaction list all update.
4. The bar chart shows one bar per subcategory (e.g. Groceries, Gas / EV Charging), sorted by absolute spend descending.
5. A full transaction list for the current month (all categories, sorted by date) is shown below the bar chart.
6. Click any bar to open the detail panel listing every transaction in that category for the month.
7. Click **← All Categories** to return to the bar chart and transaction list.

**Engineering details:**

**Month list generation:** `getMonthList(transactions)` extracts all unique `{ year, month }` pairs (1-based month, 1=January) from transaction dates, sorted chronologically. Transactions with blank or invalid dates are skipped. The result is stored in `budgetMonths[]`; `budgetIdx` tracks the currently displayed entry.

**Month filtering:** `filterByMonth(transactions, year, month)` filters the full transaction list to a single calendar month. Month is 1-based. Implementation: `d.getMonth() + 1 === month`.

**Transaction search:** A search input (`#budget-search`) sits above both panels and is always visible, including during category drill-down. `filterBySearch(transactions, query)` matches case-insensitively against `description`, `category`, `String(amount)`, and the fix flag (`t.fix && 'fix'.includes(q)` — so queries "f", "fi", "fix" return fix-flagged transactions). An empty or whitespace-only query returns all transactions. When a search query is active, the bar chart, banner, and transaction list all update to reflect only the matching transactions.

**Bar chart rendering:** `renderBudgetBars(txs)` accepts any transaction array and rebuilds `#budget-bars` from it — making it reusable for both full-month and search-filtered views. Each subcategory with ≥1 transaction gets its own bar, labeled with the subcategory name and its parent category in muted text below. Bars are scaled relative to the largest absolute value (100% = max spend), sorted by `|total|` descending. Data comes from flattening `groups` across all parents: `CAT_LIST.flatMap(({parent, subs}) => subs.filter(sub => groups[parent]?.[sub]).map(...))`. Clicking a bar opens the detail panel.

**Bar colors:**
- `#43a047` (green) — negative total (expense / money leaving)
- `#5c6bc0` (blue) — positive total (income / money received)

**Month heading:** `#budget-month-heading` is a large (22px bold) centered element set to e.g. "April 2025" at the top of the card. The smaller `#budget-month-label` inside the nav row is also kept for layout symmetry.

**Banner stats:** `#budget-month-total-banner` and `#budget-month-tx-count` live in the dark `.total-banner` above the card and are written in `renderBudgetMonth()` from `grandTotal` (categorized spend only) and `monthTx.length` (all transactions including uncategorized). They update on every month navigation.

**Search bar:** `#budget-search` sits above both panels and is always visible, including when the category drill-down is active. Typing filters the transaction list in whichever view is active: in the chart panel it filters all month transactions; in the detail panel it filters within the selected subcategory. The banner (month total, tx count) always reflects the currently visible filtered set.

**Transaction list:** `#budget-tx-tbody` is populated with all transactions for the month, sorted by date descending (newest first). Shown below the bar chart. Columns: Date, Description, Category, Fix, Amount. The Account field is hidden by default — clicking any row toggles a detail sub-row (spanning all columns) showing the account key. Both the main list and the detail panel share the same column structure and row-click expand behavior, rendered by the shared `appendTxRows(tbody, txs)` helper.

**Detail panel:** Transactions are filtered to `t.category === sub` (exact subcategory match), then further filtered by the search query via `filterBySearch()`, then sorted by date descending via `sortByDateDesc()`. The active subcategory is stored in `budgetSelectedSub` (module-level, `null` when in chart view). When the user navigates months while the detail panel is open, `renderBudgetMonth()` re-renders the detail view for the same subcategory, so the drill-down persists across navigation. Pressing **← All Categories** clears `budgetSelectedSub` to `null`. Navigating away from Budget and back also resets it to `null`.

**Uncategorized warning:** Transactions without a category, and transactions in the **Transfer** parent category (e.g. Credit Card Payment), are excluded from `aggregateByCategory()` and from the grand total. A yellow warning banner is shown if any uncategorized transactions exist in the current month.

**Navigation state:** `budgetMonths` and `budgetIdx` are module-level variables reset on each call to `renderBudget()`. Navigating away from Budget and back resets to the most recent month.

---

### 2.3 Categorize

**Purpose:** Import raw transactions (without categories), assign a category to each, then export the categorized CSV for later import via Load.

**User flow:**
1. Select an account profile and paste a bank CSV (same as Load).
2. A table renders with one row per transaction: checkbox, date, description, amount, category dropdown, fix checkbox.
3. Assign categories using the dropdowns or keyboard shortcuts. With a row focused, press any letter to enter **edit mode**: the row's category dropdown receives focus and cycles to the first matching category. Press the letter again to continue cycling. Press **ESC** to return to navigation mode.
4. Select multiple rows using the checkboxes; a bulk-action bar appears to apply one category to all selected rows at once.
5. When all rows are categorized, click **Export CSV** to generate a CSV ready to import in Load.

**Engineering details:**

- `state.catSession[]` holds the working rows for the current Categorize session. It is independent of `state.transactions`.
- Category dropdowns are `<select>` elements with `<optgroup>` per parent category. The full list of subcategories comes from `CAT_LIST`.
- **Keyboard cycling (edit mode):** The document keydown listener intercepts letter keys when a row is focused and no input/select has focus — it calls `cycleCategoryByKey(currentValue, key, ALL_SUBS)`, updates `state.catSession`, and then calls `sel.focus()` on the row's `<select>`, entering **edit mode**. While the select is focused, its own `keydown` listener continues cycling on each letter press (no blur between presses). Pressing **ESC** calls `sel.blur()`, returning focus to the document (**navigation mode**). The bulk-assign select (`#cat-bulk-cat`) follows the same pattern.
- **Bulk edit:** Checkboxes are hidden by default. A `☐ Multi-select` toggle button sits above the table (right-aligned); clicking it shows the checkbox column (`table.multi-select-active .td-check { display: table-cell }`) and the button becomes `☑ Multi-select` (blue tint). Row selection is tracked in `selectedIdxs` (a module-level `Set<number>`); `multiSelectMode` (boolean) tracks whether the column is visible. When ≥1 row is checked, the `#cat-bulk-bar` panel appears with a count, category dropdown, Apply and Clear. Apply sets the chosen category on all selected rows and clears selection. Turning off multi-select or loading a new import clears selection and hides the column.
- **Keyboard navigation (navigation mode):** On the Categorize page, `j` and `k` always move the focus cursor down/up regardless of multi-select mode. If no row has focus yet, the cursor seeds from the lowest-indexed selected row, or row 0 if nothing is selected. `x` toggles row selection but only when multi-select is active. These keys fire only when no input/select/textarea has focus. The focused row is highlighted with a purple tint and left border (`tr.row-focused`). `setCatFocus(idx)` updates the cursor and scrolls the row into view without a full table re-render. `focusedIdx` resets to `-1` when multi-select is turned off or a new import is loaded.
- Rows with no category assigned are highlighted with `.cat-error` (red border on the select). Selected rows are highlighted with `.row-selected` (blue-tinted background). Focused row: `.row-focused` (purple tint + left border).
- `validateExport()` blocks export if any row has a blank category, returning the invalid row indices.
- The exported CSV format: `Date,Description,Amount,Category,Fix` — identical to what Load expects.
- `toCSV()` handles quoting of fields containing commas, quotes, or newlines. Transactions are sorted date-ascending (`sortByDateAsc()`) before serialization.

---

### 2.4 Responsive Design

All views are mobile-friendly via a `@media (max-width: 600px)` block. Key adaptations:
- Reduced card, main, and header padding.
- Budget bar labels narrowed to 90px; bar count column hidden.
- `#budget-month-heading` reduced from 22px to 17px.
- Tables wrapped in `overflow-x: auto` to prevent horizontal overflow.
- `.form-row` wraps on small screens.
- The viewport meta tag (`width=device-width, initial-scale=1`) is present in `<head>`.

---

### 2.5 Settings

**Purpose:** Configure one or more bank account profiles, each describing how to parse that bank's CSV format.

**User flow:**
1. Click **Add Account** (or Edit on an existing account).
2. Enter account name and last 4 digits.
3. Paste the header row from the bank's CSV file.
4. Click **Parse Columns** — the app splits the header and renders a dropdown for each column.
5. Map each column to: skip, Date, Description, Amount, Category, or Fix.
6. Click **Save Account**.
7. Use **Export Settings** to generate a minified JSON blob of all account profiles. Copy it from the read-only textarea; a pretty-printed preview is shown below for review.
8. Use **Import Settings** to paste a previously exported blob and instantly restore all profiles. A pretty-printed preview of the imported config is shown on success; validation errors appear inline if the JSON is malformed or missing required fields.

**Engineering details:**

- Account profiles are stored in `state.userConfig.accounts[]` and persisted to `localStorage` under key `'financeTrackerConfig'`.
- `inputCsvFormat` is a positional array the length of the bank's header row. Each entry is a field name (`'date'`, `'description'`, `'amount'`, `'category'`, `'fix'`) or `null` (skip).
- `buildHeaderMap(headerRow, inputCsvFormat)` uses `inputCsvFormat` when provided, ignoring the header values. This allows banks that rename or reorder columns to work correctly.
- Required fields: Date, Description, Amount. Save is blocked if any are unmapped.
- Each account gets a UUID `id` on creation. Deleting an account removes it from `state.userConfig.accounts` and from the account dropdowns in Load and Categorize.
- `exportAccountsJSON(accounts)` serializes `state.userConfig.accounts` to a minified JSON string. The UI layer pretty-prints it for the preview display.
- `importAccountsJSON(jsonString)` parses and validates the string (see §4). On success the UI layer replaces `state.userConfig.accounts`, assigns any missing `id` values via `crypto.randomUUID()`, calls `saveConfig()`, and re-renders the account table.

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
| `parseTransaction` | `(fields: string[], headerMap, accountKey) → Transaction` | Extracts and coerces fields into a Transaction object. Strips `$` and commas from amount. Assigns UUID. Normalizes date to ISO `YYYY-MM-DD`: accepts YYYY-M-D, YYYY/M/D, YYYY/MM/DD (ISO-order) and M/D/YYYY, MM/DD/YYYY, M-D-YYYY, MM-DD-YYYY (US financial export order). |
| `deduplicateTransactions` | `(existing: Transaction[], incoming: Transaction[]) → Transaction[]` | Merges arrays; skips incoming entries that match an existing `accountKey|date|description|amount` key. |

### Filtering & Aggregation

| Function | Signature | Description |
|---|---|---|
| `filterByMonth` | `(transactions, year: number, month: number) → Transaction[]` | Filters to a calendar month. `month` is **1-based** (1=January, 12=December). |
| `filterBySearch` | `(transactions, query: string) → Transaction[]` | Case-insensitive match against `description`, `category`, `String(amount)`, and fix flag (`t.fix && 'fix'.includes(q)`). Returns all transactions when query is blank. |
| `aggregateByCategory` | `(transactions, excludeParents?: string[]) → { groups, grandTotal }` | Groups by parent → subcategory. `groups[parent][sub] = { total, count }`. Skips uncategorized. Skips any parent listed in `excludeParents` (e.g. `['Transfer']`). |
| `totalSpend` | `(transactions) → number` | Sum of all `amount` values. |
| `getMonthList` | `(transactions) → { year, month }[]` | Returns unique year-month pairs sorted chronologically. Month is 1-based. Skips blank/invalid dates. |
| `sortByDateDesc` | `(transactions: Transaction[]) → Transaction[]` | Returns a new array sorted by `date` descending (newest first). Does not mutate the input. |
| `sortByDateAsc` | `(transactions: Transaction[]) → Transaction[]` | Returns a new array sorted by `date` ascending (oldest first). Does not mutate the input. |

### Category Utilities

| Function | Signature | Description |
|---|---|---|
| `cycleCategoryByKey` | `(currentValue, key: string, subcategories: string[]) → string` | Finds all subcategories starting with `key` (case-insensitive). Returns the next match after `currentValue`, wrapping around. Returns `currentValue` unchanged if no match. |

### Export

| Function | Signature | Description |
|---|---|---|
| `validateExport` | `(rows) → { valid, invalidRows: number[] }` | Returns valid=false and indices of rows with blank category. |
| `toCSV` | `(rows) → string` | Serializes rows to CSV string with header `Date,Description,Amount,Category,Fix`. Quotes fields containing commas, quotes, or newlines. |

### Settings Import / Export

| Function | Signature | Description |
|---|---|---|
| `exportAccountsJSON` | `(accounts: AccountProfile[]) → string` | Returns a minified (no newlines) JSON string of the accounts array. |
| `importAccountsJSON` | `(jsonString: string) → { ok: true, accounts: AccountProfile[] } \| { ok: false, error: string }` | Parses and validates a JSON blob. Requires top-level array; each element must have `name` (string), `last4` (string), and `inputCsvFormat` (array). Returns `{ ok: false, error }` on malformed JSON, non-array input, or any account missing a required field. Missing `id` values are assigned by the UI caller. |

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
