# Finance Tracker — Design Document

> **Last updated:** 2026-05-08 (Budget: replaced month navigation with preset date range filter; added transaction pagination)
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
- Persistence of transactions across page reloads.

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

#### CSV Import

- The selected account profile provides `inputCsvFormat` — a positional array mapping column index → field name. `buildHeaderMap()` uses this to locate date, description, amount, category, and fix columns by position rather than header name.
- If the first row of the pasted CSV looks like a header (non-numeric date field), it is skipped automatically.
- Each imported row is validated by `validateImport()` before being processed. Rows with unparseable dates, blank descriptions, or non-finite amounts are rejected with a row-level error message. For split debit/credit layouts (two columns mapped to `amount`), exactly one column must be non-blank per row; both-blank and both-filled are also validation errors.
- Deduplication key: `accountKey|date|description|amount`. Two transactions are considered identical if all four values match. `deduplicateTransactions()` returns the merged array; duplicates are silently skipped (no error).
- `state.transactions` is the single source of truth. It grows monotonically during a session and is never persisted to localStorage.

**Account key format:** `"Account Name *last4"` — produced by `formatAccountKey(name, last4)`.

#### Uncategorized Notice

Uncategorized transactions are allowed in the Load view. After import, if any transactions have a blank category, `#uncategorized-notice` is shown with a link to the Categorize view.

#### Per-Account Export

Each account chip in the summary includes an **Export** button. Clicking it calls `handleLoadExport(accountKey)`, which filters `state.transactions` to that account, sorts ascending with `sortByDateAsc()`, serializes with `toCSV()`, and displays the result in `#load-export-card` below the summary. A **Copy** button copies the textarea to clipboard.

#### Transaction Persistence

Transactions are persisted to `localStorage` key `'financeTrackerTx'` as a JSON array immediately after every import (`handleLoadImport()` calls `saveTransactions()`). On page load, `loadPersistedTransactions()` reads this key, restores `state.transactions`, and reconstructs `state.accounts` from the unique `accountKey` values present in the restored array (chip display only needs `a.key`). If data exists, `renderLoadSummary()` is called, so `#load-summary` appears populated before any new import.

Each account chip also has a **Clear** button (`.chip-clear-btn`) that calls `handleClearAccount(key)`. This filters both `state.transactions` and `state.accounts` to remove all entries for that account, calls `saveTransactions()` to update localStorage, then either hides `#load-summary` (if no transactions remain) or re-renders it.

---

### 2.2 Budget

**Purpose:** Visualize spending by category across a selectable date range, with a full transaction list, pagination, and drill-down into individual categories.

**User flow:**
1. Navigate to Budget. If no transactions are loaded, an empty state is shown.
2. All transactions are shown by default ("All Dates"). The dark banner shows **Month Total** (spending excluding Transfers) and **Transactions** (total count).
3. Select a preset from the **Date range** dropdown to narrow the view: This Month, Last Month, 90 Days, 1 Year, This Year, Last Year. A "From … to …" display shows the active date bounds.
4. The bar chart shows one bar per subcategory, sorted by absolute spend descending.
5. A full transaction list (all categories, sorted by date descending, paginated 100/page) is shown below the bar chart.
6. Click any bar to open the detail panel listing every transaction in that subcategory.
7. Click **← All Categories** to return to the bar chart and transaction list.

#### Empty State

If `state.transactions` is empty, `#budget-empty` is shown and `#budget-content` is hidden. `renderBudget()` checks `state.transactions.length > 0` before rendering.

#### Date Range Filter

`#budget-preset-btn` is a dropdown button showing the active preset label ("All Dates" by default). Clicking it opens `#budget-preset-menu` (a `<ul>` with `hidden` attribute). Clicking a preset item:
1. Computes `{ from, to }` via `computePresetRange(preset)` using the current date.
2. Sets `budgetDateFrom` / `budgetDateTo` (ISO strings or `null` for "All Dates").
3. Updates the button label and shows/hides `#budget-date-display` ("From M/D/YYYY  to  M/D/YYYY").
4. Calls `renderBudgetRange()` to re-filter and re-render.

`filterByDateRange(transactions, from, to)` is the core filter: returns transactions where `t.date >= from` (if from non-null) and `t.date <= to` (if to non-null). Both bounds are inclusive ISO date string comparisons. `computePresetRange(preset)` maps preset keys to `{ from, to }` pairs using `new Date()`:

| Preset key | from | to |
|---|---|---|
| `'all'` | `null` | `null` |
| `'this-month'` | `YYYY-MM-01` | last day of current month |
| `'last-month'` | `YYYY-MM-01` | last day of previous month |
| `'90-days'` | today − 89 days | today |
| `'1-year'` | today − 1 year | today |
| `'this-year'` | `YYYY-01-01` | `YYYY-12-31` |
| `'last-year'` | `(Y-1)-01-01` | `(Y-1)-12-31` |

The dropdown closes on any `document` click. `budgetPreset`, `budgetDateFrom`, `budgetDateTo` are module-level variables reset to `null` each time `renderBudget()` is called (i.e. when switching to the Budget tab).

#### Transaction Search

`#budget-search` sits above both panels and is always visible, including when the category drill-down is active. `filterBySearch(transactions, query)` matches case-insensitively against `description`, `category`, `String(amount)`, and the fix flag (`t.fix && 'fix'.includes(q)` — so queries "f", "fi", "fix" return fix-flagged transactions). An empty or whitespace-only query returns all transactions. When a search query is active, the bar chart, banner, and transaction list all update to reflect only the matching transactions. In the chart panel it filters all range transactions; in the detail panel it filters within the selected subcategory. The banner (total, tx count) always reflects the currently visible filtered set.

#### Bar Chart

`renderBudgetBars(txs)` accepts any transaction array and rebuilds `#budget-bars` from it — making it reusable for both full-range and search-filtered views. Each subcategory with ≥1 transaction gets its own bar, labeled with the subcategory name and its parent category in muted text below. Bars are scaled relative to the largest absolute value (100% = max spend), sorted by `|total|` descending. Data comes from flattening `groups` across all parents: `CAT_LIST.flatMap(({parent, subs}) => subs.filter(sub => groups[parent]?.[sub]).map(...))`. Clicking a bar opens the detail panel.

**Bar colors:**
- `#43a047` (green) — negative total (expense / money leaving)
- `#5c6bc0` (blue) — positive total (income / money received)

#### Banner

`#budget-month-total-banner` and `#budget-month-tx-count` live in the dark `.total-banner` above the card. The total shows `grandTotal` (categorized spend, Transfer excluded); the count shows the total transaction count in the current filtered set (including uncategorized and Transfers). Both update on every date range change and on every search query change.

#### Transfer Exclusion

Transactions in the **Transfer** parent category (subcategory: "Credit Card Payment") are excluded from `aggregateByCategory()` and therefore from the grand total shown in the banner. They are still counted in `#budget-month-tx-count` and shown in the transaction list.

#### Full Transaction List

`#budget-tx-tbody` is populated with all transactions in the active range, sorted by date descending (newest first), paginated 100 rows per page. Shown below the bar chart. Columns: Date, Description, Category, Fix, Amount. The Account field is hidden by default — clicking any row toggles a detail sub-row (spanning all columns) showing the account key. Both the main list and the detail panel share the same column structure and row-click expand behavior, rendered by the shared `appendTxRows(tbody, txs)` helper.

#### Transaction Pagination

When the transaction list or drill-down list exceeds 100 rows, `#budget-pagination` (or `#budget-detail-pagination`) becomes visible with Prev / Next buttons and a "Page X of Y" label. `renderPagination(prefix, page, totalPages)` handles visibility and disabled states. `budgetPage` and `budgetDetailPage` are module-level page indices, reset to 0 on range/search changes and when opening a drill-down.

#### Category Drill-Down

Transactions are filtered to `t.category === sub` (exact subcategory match), then further filtered by the search query via `filterBySearch()`, then sorted by date descending via `sortByDateDesc()`, then paginated. The active subcategory is stored in `budgetSelectedSub` (module-level, `null` when in chart view). Pressing **← All Categories** clears `budgetSelectedSub` to `null`. Navigating away from Budget and back also resets it to `null`.

#### Uncategorized Warning

Transactions without a category are excluded from `aggregateByCategory()` and from the grand total. If any uncategorized transactions exist in the active range, `#budget-warn` is shown with a yellow warning banner. Transfer-category transactions do not trigger this warning.

#### Month Navigation

When `budgetPreset` is `'this-month'` or `'last-month'`, pressing ← / → arrow keys navigates months. Left shifts one month earlier; right advances one month, capped at the current calendar month. `budgetMonthOffset` (module-level integer, reset to 0 in `renderBudget()` and on every preset selection) tracks the offset from the preset's natural month (0 = the preset's own month, negative = earlier).

`computeMonthRange(preset, offset)` returns `{ from, to, label }`. `applyMonthNav()` applies the range to `budgetDateFrom`/`budgetDateTo`, updates the date inputs and preset button text (e.g. "May 2026"), and calls `renderBudgetRange()`. When 'this-month' or 'last-month' is selected from the dropdown, `applyMonthNav()` runs immediately so the button always shows the month name. Arrow keys are suppressed when any input/select/textarea has focus.

Max offsets: `'this-month'` → 0 (cannot advance past current month); `'last-month'` → 1 (can advance to current month, no further).

---

### 2.3 Categorize

**Purpose:** Import raw transactions (without categories), assign a category to each, then export the categorized CSV for later import via Load.

**User flow:**
1. Select an account profile and paste a bank CSV (same as Load).
2. A table renders with one row per transaction: checkbox, date, description, amount, category dropdown, fix checkbox.
3. Assign categories using the dropdowns or keyboard shortcuts. With a row focused, press any letter to enter **edit mode**: the row's category dropdown receives focus and cycles to the first matching category. Press the letter again to continue cycling. Press **ESC** to return to navigation mode.
4. Select multiple rows using the checkboxes; a bulk-action bar appears to apply one category to all selected rows at once.
5. When all rows are categorized, click **Export CSV** to generate a CSV ready to import in Load.

#### CSV Import

`state.catSession[]` holds the working rows for the current Categorize session. It is independent of `state.transactions`. `handleCatImport` sorts the session by date descending (`sortByDateDesc`) at population time so the most recent transactions appear first in the review table; all index-based mutations (category changes, keyboard navigation, bulk-select) operate on this sorted array directly. Rows with no category assigned are highlighted with `.cat-error` (red border on the select).

#### Quoted Field Parsing

`parseCSVLine` uses liberal quote parsing: if a field starts with a `"` it is read as a quoted field, but inner unescaped `"` characters that are not followed by `,` or end-of-line are treated as literal characters rather than closing the field. This handles real-world bank CSVs where field values like `"Payment for "991"; Conf# loc30o69b"` appear without proper escaping.

#### Fix Flag

Each row has a fix checkbox (`input[data-field="fix"]`). Checking or unchecking it immediately updates `state.catSession[idx].fix`. The fix value is included in the exported CSV and is searchable in the Budget view.

#### Category Assignment

Category dropdowns are `<select>` elements with `<optgroup>` per parent category. The full list of subcategories comes from `CAT_LIST`. Selecting a value updates `state.catSession[idx].category` and removes the `.cat-error` class from the cell.

#### Keyboard Cycling

The document keydown listener intercepts letter keys when a row is focused and no input/select has focus — it calls `cycleCategoryByKey(currentValue, key, ALL_SUBS)`, updates `state.catSession`, and then calls `sel.focus()` on the row's `<select>`, entering **edit mode**. While the select is focused, its own `keydown` listener continues cycling on each letter press (no blur between presses). Pressing **ESC** calls `sel.blur()`, returning focus to the document (**navigation mode**). The bulk-assign select (`#cat-bulk-cat`) follows the same pattern.

#### Keyboard Navigation

On the Categorize page, `j` and `k` always move the focus cursor down/up regardless of multi-select mode. If no row has focus yet, the cursor seeds from the lowest-indexed selected row, or row 0 if nothing is selected. `x` toggles row selection but only when multi-select is active. These keys fire only when no input/select/textarea has focus. The focused row is highlighted with a purple tint and left border (`tr.row-focused`). `setCatFocus(idx)` updates the cursor and scrolls the row into view without a full table re-render. `focusedIdx` resets to `-1` when multi-select is turned off or a new import is loaded. **Mouse and keyboard share the same cursor:** hovering a row (`mouseenter` on `<tr>`) calls `setCatFocus(i)`, so j/k/x continue from wherever the mouse last landed. If a category `<select>` is focused when the mouse enters a row, it is blurred first (returning to navigation mode) before the cursor updates.

#### Multi-Select Toggle

A `☐ Multi-select` toggle button sits above the table (right-aligned); clicking it shows the checkbox column (`table.multi-select-active .td-check { display: table-cell }`) and the button becomes `☑ Multi-select` (blue tint). `multiSelectMode` (boolean) tracks whether the column is visible. Turning off multi-select or loading a new import clears selection and hides the column.

#### Row Selection

Row selection is tracked in `selectedIdxs` (a module-level `Set<number>`). Selected rows are highlighted with `.row-selected` (blue-tinted background). Pressing `x` while a row is focused toggles its selection (multi-select mode only). Clicking a checkbox directly also toggles selection.

#### Bulk Category Assignment

When ≥1 row is checked, the `#cat-bulk-bar` panel appears with a count, category dropdown, Apply and Clear buttons. Apply sets the chosen category on all selected rows and clears selection.

#### Select All

`#cat-select-all` is a checkbox in the table header. Checking it selects all rows in `state.catSession`; unchecking it clears all selections. Only visible when multi-select mode is active.

#### Export Validation

`validateExport()` blocks export if any row has a blank category, returning the invalid row indices. The export button shows an inline error listing the row numbers that need a category.

#### Export Success

When all rows have a category, clicking **Export CSV** calls `toCSV(sortByDateAsc(state.catSession))`. The resulting CSV uses the `Date,Description,Amount,Category,Fix` format. `toCSV()` handles quoting of fields containing commas, quotes, or newlines. The output is displayed in `#cat-export-card`.

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
3. Type the column format JSON array directly into the **Column Format** field.
4. Click **Save Account**.
5. Use **Export Settings** to generate a minified JSON blob of all account profiles.
6. Use **Import Settings** to paste a previously exported blob and instantly restore all profiles.

Account profiles are stored in `state.userConfig.accounts[]` and persisted to `localStorage` under key `'financeTrackerConfig'`. `inputCsvFormat` is a positional array; each entry is a field name or `null` (skip). Each account gets a UUID `id` on creation.

#### Add Account Profile

Clicking **Add Account** shows `#settings-form-card` with a blank form. The user fills in account name, last 4 digits, and the column format JSON array in `#sf-format-input`, then clicks **Save Account**. The new profile is pushed to `state.userConfig.accounts`, persisted, and appears in the settings table and account dropdowns.

#### Edit Account Profile

Clicking **Edit** on an existing account row pre-fills the form with the account's current values — including `#sf-format-input` populated with `JSON.stringify(account.inputCsvFormat)` — and shows `#settings-form-title` as "Edit Account". Saving updates the matching entry in `state.userConfig.accounts` by index.

#### Column Format Validation

`#sf-format-input` must contain a valid JSON array. On **Save Account**, the value is parsed and passed to `buildHeaderMap(null, inputCsvFormat)`. If parsing fails or `buildHeaderMap` returns an error, `#sf-form-error` is shown and the save is blocked. Allowed field values: `"date"`, `"description"`, `"amount"`, `"debit_amount"`, `"credit_amount"`, `null` (skip). Constraints enforced by `buildHeaderMap`: `date`, `description`, and `amount` may each appear at most once — duplicates are rejected with an error. `date` and `description` are required. Either `amount` appears exactly once, or both `debit_amount` and `credit_amount` appear together — mixing `amount` with the split pair is rejected, as is providing only one of the split pair.

#### Last 4 Validation

`isValidLast4(val)` enforces that last4 is a string of exactly 4 digits (`/^\d{4}$/`). Save is blocked with an inline error if the value is shorter, longer, or contains non-digit characters.

#### Delete Account Profile

Clicking **Delete** calls `deleteAccountConfig(id)`, which removes the account from `state.userConfig.accounts`, persists the change, and re-renders both the settings table and the account dropdowns in Load and Categorize.

#### Export Settings

`exportAccountsJSON(accounts)` serializes `state.userConfig.accounts` to a minified JSON string. The UI layer shows it in `#settings-export-field` (for copy) and pretty-prints it in `#settings-export-pretty` for review.

#### Import Settings

`importAccountsJSON(jsonString)` parses and validates the string (see §4). On success the UI replaces `state.userConfig.accounts`, assigns any missing `id` values via `crypto.randomUUID()`, calls `saveConfig()`, and re-renders the account table. Validation errors appear inline in `#settings-import-error` if the JSON is malformed or any account has an invalid `last4`.

#### Account Type

Each account profile has a `type` field: `"credit"` (default) or `"bank"`. The value is chosen from a dropdown (`#sf-type`) in the Add/Edit form and persisted with the profile. The settings table displays `"Credit Card"` or `"Bank Account"` accordingly. Missing `type` values are treated as `"credit"` everywhere.

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
  type:           string,   // "credit" (default) or "bank"
  inputCsvFormat: Array,    // e.g. ["date", null, "description", "amount"] or ["date", "description", "debit_amount", "credit_amount"]
}
```

### Runtime State

```javascript
const state = {
  transactions: [],       // All loaded transactions; persisted to localStorage key 'financeTrackerTx'
  accounts:     [],       // { key } — reconstructed from persisted transactions on page load
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
| `parseCSVLine` | `(line: string) → string[]` | Parses a single CSV line. Handles quoted fields, embedded commas, escaped `""` quotes, and unescaped inner quotes (treated as literals — liberal quote handling matching Excel/Sheets behaviour). Trims unquoted fields. |

### Import Pipeline

| Function | Signature | Description |
|---|---|---|
| `formatAccountKey` | `(name, last4) → string` | Returns `"Name *last4"`. |
| `buildHeaderMap` | `(headerRow: string[], inputCsvFormat?: string[]) → HeaderMap \| { error }` | Maps field names to column indices. Uses positional `inputCsvFormat` if provided; otherwise matches lowercase header names. Returns `{ date, description, amount?, debitAmount?, creditAmount?, category, fix }` where `category` and `fix` default to `-1` if absent. `debitAmount` and `creditAmount` are set when the split-column pair is used instead of `amount`. Returns `{ error }` if required columns are missing, if `date`/`description`/`amount` appears more than once, if only one of `debit_amount`/`credit_amount` is present, or if `amount` is mixed with the split pair. |
| `validateImport` | `(rows: string[][], headerMap, requireCategory?) → { valid, errors }` | Validates each row: parseable date, non-blank description, finite amount. For split maps (`headerMap.debitAmount !== undefined`), exactly one of `debitAmount`/`creditAmount` columns must be non-blank per row — both-blank → `'amount is blank'`, both-filled → `'amount is ambiguous (both debit and credit columns have values)'`. Optionally checks category. Returns error strings with 1-based row numbers. |
| `parseTransaction` | `(fields: string[], headerMap, accountKey) → Transaction` | Extracts and coerces fields into a Transaction object. For split maps: reads `debitAmount` column → stored as `−|value|`; reads `creditAmount` column → stored as `+|value|` (absolute value enforced for both). For single `amount` maps: parses as-is. Strips `$` and commas. Assigns UUID. Normalizes date to ISO `YYYY-MM-DD`: accepts YYYY-M-D, YYYY/M/D, YYYY/MM/DD (ISO-order) and M/D/YYYY, MM/DD/YYYY, M-D-YYYY, MM-DD-YYYY (US financial export order). |
| `deduplicateTransactions` | `(existing: Transaction[], incoming: Transaction[]) → Transaction[]` | Merges arrays; skips incoming entries that match an existing `accountKey|date|description|amount` key. |

### Filtering & Aggregation

| Function | Signature | Description |
|---|---|---|
| `filterByMonth` | `(transactions, year: number, month: number) → Transaction[]` | Filters to a calendar month. `month` is **1-based** (1=January, 12=December). |
| `filterByDateRange` | `(transactions, from: string\|null, to: string\|null) → Transaction[]` | Filters by ISO date bounds, both inclusive. Either bound may be `null` (unbounded on that side). |
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
| `isValidLast4` | `(val: unknown) → boolean` | Returns `true` iff `val` is a string matching `/^\d{4}$/` (exactly 4 ASCII digits). Used by both `importAccountsJSON` and the settings form (`saveAccountConfig`) as the single source of truth for last4 validation. |
| `exportAccountsJSON` | `(accounts: AccountProfile[]) → string` | Returns a minified (no newlines) JSON string of the accounts array. |
| `importAccountsJSON` | `(jsonString: string) → { ok: true, accounts: AccountProfile[] } \| { ok: false, error: string }` | Parses and validates a JSON blob. Requires top-level array; each element must have `name` (string), `last4` (passes `isValidLast4`), and `inputCsvFormat` (array). Returns `{ ok: false, error }` on malformed JSON, non-array input, or any account failing validation. Missing `id` values are assigned by the UI caller. |

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
| Automotive | Gas / EV Charging / Toll, Parking, Service / Parts, Uber |
| Entertainment | Entertainment, Hobbies, Travel |
| Food | Coffee / Bakery, Groceries, Restaurants |
| Healthcare | Doctor, Dental, Pharmacy |
| Kids | Activities, Pet Care, Toys |
| Misc | ATM/Cash, Fees, Gifts, Misc, Uncategorized |
| Monthly Expenses | Bills, Home Maintenance, Insurance / DMV, Mortgage |
| Personal Care | Personal Care |
| Shopping | Clothing / Shoes, Electronics, General Merchandise, Home Furnishings |
| Transfer | Credit Card Payment, Education, Paycheck, Tax, Transfer |

### Derived Lookups (exported in `__financeLib`)

- **`CAT_LIST`** — `Array<{ parent: string, subs: string[] }>` — the full hierarchy.
- **`ALL_SUBS`** — `string[]` — flat array of all subcategory names.
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
