const { test, expect } = require('playwright/test');
const { ACCOUNT, BANK_ACCOUNT, LOAD_CSV, seedAccounts, seedBankAccount, loadTransactions, switchToBudget, buildCsv, seedMultiAccountTransactions } = require('./seed');
const INDEX_URL = 'index.html';

// Helper: load transactions, navigate to Budget tab
async function setup(page, csv = LOAD_CSV.categorized) {
  await seedAccounts(page);
  await page.goto('index.html');
  await loadTransactions(page, csv);
  await switchToBudget(page);
}

test.describe('Empty State', () => {
  test('given no transactions loaded, budget shows empty state and hides content', async ({ page }) => {
    await seedAccounts(page);
    await page.goto('index.html');
    await page.click('[data-view="budget"]');
    await expect(page.locator('#budget-empty')).toBeVisible();
    await expect(page.locator('#budget-content')).toBeHidden();
  });
});

test.describe('Date Range Filter', () => {
  test('given a date range, shows only transactions within that range', async ({ page }) => {
    await seedAccounts(page);
    const csv = [
      '2026-01-10,January Expense,-50.00,Groceries,false',
      '2026-01-20,January Coffee,-5.00,Groceries,false',
      '2026-03-15,March Expense,-40.00,Groceries,false',
    ].join('\n');
    await page.goto(INDEX_URL);
    await loadTransactions(page, csv);
    await switchToBudget(page);
    await page.evaluate(() => { budgetDateFrom = '2026-01-01'; budgetDateTo = '2026-01-31'; renderBudgetRange(); });
    await expect(page.locator('#budget-month-tx-count')).toHaveText('2');
  });

  test('clearing the date range restores all transactions', async ({ page }) => {
    await seedAccounts(page);
    const csv = ['2026-01-10,Jan,-50.00,Groceries,false', '2026-03-15,Mar,-40.00,Groceries,false'].join('\n');
    await page.goto(INDEX_URL);
    await loadTransactions(page, csv);
    await switchToBudget(page);
    await page.evaluate(() => { budgetDateFrom = '2026-01-01'; budgetDateTo = '2026-01-31'; renderBudgetRange(); });
    await expect(page.locator('#budget-month-tx-count')).toHaveText('1');
    await page.evaluate(() => { budgetDateFrom = null; budgetDateTo = null; renderBudgetRange(); });
    await expect(page.locator('#budget-month-tx-count')).toHaveText('2');
  });
});

test.describe('Transaction Pagination', () => {
  test('given fewer than 100 transactions, pagination controls are hidden', async ({ page }) => {
    await seedAccounts(page);
    await page.goto(INDEX_URL);
    await loadTransactions(page, buildCsv(5));
    await switchToBudget(page);
    await expect(page.locator('#budget-pagination')).toBeHidden();
  });

  test('given more than 100 transactions, next page button appears and navigates to page 2', async ({ page }) => {
    await seedAccounts(page);
    await page.goto(INDEX_URL);
    await loadTransactions(page, buildCsv(110));
    await switchToBudget(page);
    await expect(page.locator('#budget-pagination')).toBeVisible();
    const firstDesc = await page.locator('#budget-tx-tbody tr.tx-row:first-child td:nth-child(2)').textContent();
    await page.click('#budget-page-next');
    const secondDesc = await page.locator('#budget-tx-tbody tr.tx-row:first-child td:nth-child(2)').textContent();
    expect(secondDesc).not.toBe(firstDesc);
  });
});

test.describe('Transaction Search', () => {
  test.beforeEach(async ({ page }) => {
    await setup(page, LOAD_CSV.categorized);
  });

  test('given transactions loaded, typing in search filters the transaction list', async ({ page }) => {
    await page.fill('#budget-search', 'whole');
    await expect(page.locator('#budget-tx-tbody .tx-row')).toHaveCount(1);
  });

  test('given search query with no matches, transaction list is empty', async ({ page }) => {
    await page.fill('#budget-search', 'zzz-no-match');
    await expect(page.locator('#budget-tx-tbody .tx-row')).toHaveCount(0);
  });

});

test.describe('Bar Chart', () => {
  test.beforeEach(async ({ page }) => {
    await setup(page, LOAD_CSV.categorized);
  });

  test('given categorized transactions, bar chart shows subcategory bars sorted by absolute spend descending', async ({ page }) => {
    const bars = page.locator('#budget-bars .budget-bar-row');
    await expect(bars).toHaveCount(2);
    // Groceries (-$87.32) > Coffee/Bakery (-$7.75), so Groceries bar first
    await expect(bars.nth(0).locator('.budget-bar-sub')).toHaveText('Groceries');
    await expect(bars.nth(1).locator('.budget-bar-sub')).toHaveText('Coffee / Bakery');
  });

  test('clicking a bar opens the category detail panel for that subcategory', async ({ page }) => {
    const coffeeBar = page.locator('#budget-bars .budget-bar-row').filter({ hasText: 'Coffee / Bakery' });
    await coffeeBar.click();
    await expect(page.locator('#budget-detail-panel')).toBeVisible();
    await expect(page.locator('#budget-chart-panel')).toBeHidden();
    await expect(page.locator('#budget-detail-title')).toHaveText('Coffee / Bakery');
  });
});

test.describe('Banner', () => {
  test('banner shows correct total and transaction count for the selected month', async ({ page }) => {
    await setup(page, LOAD_CSV.categorized);
    // 3 transactions totalling -$95.07 (no Transfers)
    await expect(page.locator('#budget-month-total-banner')).toHaveText('-$95.07');
    await expect(page.locator('#budget-month-tx-count')).toHaveText('3');
  });
});

test.describe('Transfer Exclusion', () => {
  test('Credit Card Payment is excluded from grand total but counted in tx count', async ({ page }) => {
    await seedAccounts(page);
    await page.goto('index.html');
    const csvWithTransfer = [
      '2024-03-15,Coffee Roasters,-4.50,Coffee / Bakery,false',
      '2024-03-10,CC Payment,-200.00,Credit Card Payment,false',
    ].join('\n');
    await loadTransactions(page, csvWithTransfer);
    await switchToBudget(page);
    // Banner total excludes the -$200 Transfer; tx count includes it
    await expect(page.locator('#budget-month-total-banner')).toHaveText('-$4.50');
    await expect(page.locator('#budget-month-tx-count')).toHaveText('2');
  });
});

test.describe('Full Transaction List', () => {
  test.beforeEach(async ({ page }) => {
    await setup(page, LOAD_CSV.categorized);
  });

  test('transactions are sorted newest-first', async ({ page }) => {
    const rows = page.locator('#budget-tx-tbody .tx-row');
    await expect(rows).toHaveCount(3);
    // After sortByDateDesc: Whole Foods (03-25), Starbucks (03-20), Coffee Roasters (03-15)
    await expect(rows.nth(0)).toContainText('Whole Foods');
    await expect(rows.nth(2)).toContainText('Coffee Roasters');
  });

  test('clicking a row toggles the account-key detail sub-row', async ({ page }) => {
    const firstRow = page.locator('#budget-tx-tbody .tx-row').first();
    const detailRow = page.locator('#budget-tx-tbody .tx-detail-row').first();
    await expect(detailRow).toBeHidden();
    await firstRow.click();
    await expect(detailRow).toBeVisible();
    await firstRow.click();
    await expect(detailRow).toBeHidden();
  });
});

test.describe('Category Drill-Down', () => {
  test.beforeEach(async ({ page }) => {
    await setup(page, LOAD_CSV.categorized);
  });

  test('clicking a bar opens detail panel; clicking back returns to bar chart', async ({ page }) => {
    await page.locator('#budget-bars .budget-bar-row').filter({ hasText: 'Groceries' }).click();
    await expect(page.locator('#budget-detail-panel')).toBeVisible();
    await page.click('#budget-back-btn');
    await expect(page.locator('#budget-chart-panel')).toBeVisible();
    await expect(page.locator('#budget-detail-panel')).toBeHidden();
  });

  test('search in drill-down filters within the selected subcategory only', async ({ page }) => {
    await page.locator('#budget-bars .budget-bar-row').filter({ hasText: 'Coffee / Bakery' }).click();
    await expect(page.locator('#budget-detail-tbody .tx-row')).toHaveCount(2);
    await page.fill('#budget-search', 'roasters');
    await expect(page.locator('#budget-detail-tbody .tx-row')).toHaveCount(1);
  });

  test('search updates banner total and tx list count in sync', async ({ page }) => {
    await page.fill('#budget-search', 'coffee');
    await expect(page.locator('#budget-month-tx-count')).toHaveText('2');
    await expect(page.locator('#budget-month-total-banner')).toHaveText('-$7.75');
    await expect(page.locator('#budget-tx-tbody .tx-row')).toHaveCount(2);
  });

  test('clearing search restores full-month banner and list', async ({ page }) => {
    await page.fill('#budget-search', 'coffee');
    await expect(page.locator('#budget-tx-tbody .tx-row')).toHaveCount(2);
    await page.fill('#budget-search', '');
    await expect(page.locator('#budget-month-tx-count')).toHaveText('3');
    await expect(page.locator('#budget-tx-tbody .tx-row')).toHaveCount(3);
  });

  test("typing 'fix' returns only fix-flagged transactions; banner stays in sync", async ({ page }) => {
    await page.fill('#budget-search', 'fix');
    await expect(page.locator('#budget-month-tx-count')).toHaveText('1');
    await expect(page.locator('#budget-tx-tbody .tx-row')).toHaveCount(1);
    await page.fill('#budget-search', 'fi');
    await expect(page.locator('#budget-tx-tbody .tx-row')).toHaveCount(1);
    await page.fill('#budget-search', '');
    await expect(page.locator('#budget-month-tx-count')).toHaveText('3');
  });

  test('clicking bar with active search opens drill-down scoped to category AND search', async ({ page }) => {
    await page.fill('#budget-search', 'coffee');
    await page.locator('#budget-bars .budget-bar-row').filter({ hasText: 'Coffee / Bakery' }).click();
    await expect(page.locator('#budget-detail-panel')).toBeVisible();
    await expect(page.locator('#budget-detail-title')).toHaveText('Coffee / Bakery');
    await expect(page.locator('#budget-month-tx-count')).toHaveText('2');
    await expect(page.locator('#budget-month-total-banner')).toHaveText('-$7.75');
    await expect(page.locator('#budget-detail-tbody .tx-row')).toHaveCount(2);
  });

  test('search within drill-down updates banner and list in sync', async ({ page }) => {
    await page.locator('#budget-bars .budget-bar-row').filter({ hasText: 'Coffee / Bakery' }).click();
    await expect(page.locator('#budget-detail-tbody .tx-row')).toHaveCount(2);
    await page.fill('#budget-search', 'roasters');
    await expect(page.locator('#budget-month-tx-count')).toHaveText('1');
    await expect(page.locator('#budget-month-total-banner')).toHaveText('-$4.50');
    await expect(page.locator('#budget-detail-tbody .tx-row')).toHaveCount(1);
    await page.fill('#budget-search', '');
    await expect(page.locator('#budget-month-tx-count')).toHaveText('2');
    await expect(page.locator('#budget-detail-tbody .tx-row')).toHaveCount(2);
  });

  test('back button from drill-down restores full-month chart and banner', async ({ page }) => {
    await page.locator('#budget-bars .budget-bar-row').filter({ hasText: 'Groceries' }).click();
    await page.click('#budget-back-btn');
    await expect(page.locator('#budget-chart-panel')).toBeVisible();
    await expect(page.locator('#budget-detail-panel')).toBeHidden();
    await expect(page.locator('#budget-month-tx-count')).toHaveText('3');
    await expect(page.locator('#budget-month-total-banner')).toHaveText('-$95.07');
  });
});

test.describe('Uncategorized Warning', () => {
  test('given a month with uncategorized transactions, yellow warning banner appears', async ({ page }) => {
    await seedAccounts(page);
    await page.goto('index.html');
    // Inject an uncategorized transaction directly (state is global, not on window)
    await page.evaluate(() => {
      state.transactions = [{
        id: 'uncategorized-test-1',
        accountKey: 'Chase *1234',
        date: '2024-03-15',
        description: 'Mystery charge',
        amount: -9.99,
        category: '',
        fix: false,
      }];
    });
    await switchToBudget(page);
    await expect(page.locator('#budget-warn')).toBeVisible();
    await expect(page.locator('#budget-warn')).toContainText('no category');
  });
});

test.describe('Month Navigation', () => {
  test('given This Month preset, ArrowLeft shifts range to previous month', async ({ page }) => {
    await seedAccounts(page);
    await page.goto('index.html');
    await loadTransactions(page, LOAD_CSV.categorized);
    await switchToBudget(page);
    await page.click('#budget-preset-btn');
    await page.click('#budget-preset-menu li[data-preset="this-month"]');
    const fromBefore = await page.locator('#budget-from-input').inputValue();
    await page.locator('#budget-content').click();
    await page.keyboard.press('ArrowLeft');
    const fromAfter = await page.locator('#budget-from-input').inputValue();
    expect(fromAfter).not.toBe(fromBefore);
    expect(fromAfter < fromBefore).toBe(true);
  });

  test('given current month displayed, ArrowRight does not advance past current month', async ({ page }) => {
    await seedAccounts(page);
    await page.goto('index.html');
    await loadTransactions(page, LOAD_CSV.categorized);
    await switchToBudget(page);
    await page.click('#budget-preset-btn');
    await page.click('#budget-preset-menu li[data-preset="this-month"]');
    const fromBefore = await page.locator('#budget-from-input').inputValue();
    await page.locator('#budget-content').click();
    await page.keyboard.press('ArrowRight');
    const fromAfter = await page.locator('#budget-from-input').inputValue();
    expect(fromAfter).toBe(fromBefore);
  });
});

test.describe('Account Filter', () => {
  test('given multiple accounts loaded, account filter chips are visible', async ({ page }) => {
    await seedMultiAccountTransactions(page);
    await page.goto('index.html');
    await switchToBudget(page);
    await expect(page.locator('#budget-account-filter')).toBeVisible();
  });

  test('given only one account loaded, account filter is hidden', async ({ page }) => {
    await seedAccounts(page);
    await page.goto('index.html');
    await loadTransactions(page, LOAD_CSV.categorized);
    await switchToBudget(page);
    await expect(page.locator('#budget-account-filter')).not.toBeVisible();
  });

  test('given a chip clicked to deselect, its transactions are excluded from the count', async ({ page }) => {
    await seedMultiAccountTransactions(page);
    await page.goto('index.html');
    await switchToBudget(page);
    await expect(page.locator('#budget-month-tx-count')).toHaveText('3');
    await page.locator('#budget-account-filter [data-account-key="Bank of America *5678"]').click();
    await expect(page.locator('#budget-month-tx-count')).toHaveText('2');
  });

  test('double-clicking a chip isolates the view to only that account', async ({ page }) => {
    await seedMultiAccountTransactions(page);
    await page.goto('index.html');
    await switchToBudget(page);
    await expect(page.locator('#budget-month-tx-count')).toHaveText('3');
    // Isolate to Chase (2 tx)
    await page.locator('#budget-account-filter [data-account-key="Chase *1234"]').dblclick();
    await expect(page.locator('#budget-month-tx-count')).toHaveText('2');
    // Double-clicking a different chip switches isolation (BofA: 1 tx)
    await page.locator('#budget-account-filter [data-account-key="Bank of America *5678"]').dblclick();
    await expect(page.locator('#budget-month-tx-count')).toHaveText('1');
  });

  test('after isolating via double-click, single-clicking another chip adds it back', async ({ page }) => {
    await seedMultiAccountTransactions(page);
    await page.goto('index.html');
    await switchToBudget(page);
    await page.locator('#budget-account-filter [data-account-key="Chase *1234"]').dblclick();
    await expect(page.locator('#budget-month-tx-count')).toHaveText('2'); // isolated to Chase
    await page.locator('#budget-account-filter [data-account-key="Bank of America *5678"]').click();
    await expect(page.locator('#budget-month-tx-count')).toHaveText('3'); // BofA added back
  });
});
