/**
 * seed.js — shared fixtures for all E2E tests
 *
 * Load tab CSV format (fixed): date,description,amount,category,fix
 * Categorize tab CSV format: varies by account's inputCsvFormat
 */

// Account profile for the Categorize tab (4-col bank CSV: date,desc,skip,amount)
const ACCOUNT = {
  id: 'seed-acct-1',
  name: 'Chase',
  last4: '1234',
  inputCsvFormat: ['date', 'description', null, 'amount'],
};

// ─── Load-tab CSV fixtures ──────────────────────────────────────────
// Format: date,description,amount,category,fix  (5 columns, fixed)
const LOAD_CSV = {
  // 3 transactions: 2 expenses + 1 income, same month
  simple: [
    '2024-03-15,Coffee Roasters,-4.50,Coffee / Bakery,false',
    '2024-03-20,Whole Foods,-87.32,Groceries,false',
    '2024-03-01,Direct Deposit,2500.00,Misc,false',
  ].join('\n'),

  // Header row is auto-skipped when it matches 'date,description,amount,category,fix'
  withHeader: [
    'Date,Description,Amount,Category,Fix',
    '2024-03-15,Coffee Roasters,-4.50,Coffee / Bakery,false',
    '2024-03-20,Whole Foods,-87.32,Groceries,false',
  ].join('\n'),

  // Two identical rows → deduplicated to 1
  withDuplicate: [
    '2024-03-15,Coffee Roasters,-4.50,Coffee / Bakery,false',
    '2024-03-15,Coffee Roasters,-4.50,Coffee / Bakery,false',
  ].join('\n'),

  // Transactions spread across 3 calendar months
  multiMonth: [
    '2024-01-10,Starbucks,-5.00,Coffee / Bakery,false',
    '2024-02-14,Amazon,-45.00,General Merchandise,false',
    '2024-03-15,Coffee Roasters,-4.50,Coffee / Bakery,false',
  ].join('\n'),

  // Unparseable date — triggers validation error
  badDate: [
    'not-a-date,Coffee Roasters,-4.50,Coffee / Bakery,false',
  ].join('\n'),

  // Pre-categorized for budget tests
  // Totals (Transfer excluded): Coffee/Bakery = -$7.75, Groceries = -$87.32, grand = -$95.07
  // Coffee Roasters has fix=true for fix-search tests
  categorized: [
    '2024-03-15,Coffee Roasters,-4.50,Coffee / Bakery,true',
    '2024-03-20,Starbucks,-3.25,Coffee / Bakery,false',
    '2024-03-25,Whole Foods,-87.32,Groceries,false',
  ].join('\n'),
};

// ─── Categorize-tab CSV fixtures ────────────────────────────────────
// Format for ACCOUNT: date,description,<skip>,amount  (4 columns)
const CAT_CSV = {
  simple: [
    '2024-03-15,Coffee Roasters,,-4.50',
    '2024-03-20,Whole Foods,,-87.32',
    '2024-03-01,Direct Deposit,,2500.00',
  ].join('\n'),

  // All rows already categorized — for export test (uses in-page category dropdowns,
  // but you can pre-fill via a 6-col account; for export test we just need all assigned)
  allCategorized: [
    '2024-03-15,Coffee Roasters,,-4.50',
  ].join('\n'),
};

// Pre-seed localStorage with account profiles before page load.
// Call inside page.addInitScript so it runs before the app's loadConfig().
async function seedAccounts(page, accounts = [ACCOUNT]) {
  await page.addInitScript((accts) => {
    localStorage.setItem('financeTrackerConfig', JSON.stringify({ accounts: accts }));
  }, accounts);
}

// Navigate to Load tab, select account, paste CSV, click Import.
async function loadTransactions(page, csv, account = ACCOUNT) {
  await page.click('[data-view="load"]');
  await page.selectOption('#load-acct-profile', account.id);
  await page.fill('#load-csv', csv);
  await page.click('#load-import-btn');
}

// Navigate to Budget tab.
async function switchToBudget(page) {
  await page.click('[data-view="budget"]');
}

module.exports = { ACCOUNT, LOAD_CSV, CAT_CSV, seedAccounts, loadTransactions, switchToBudget };
