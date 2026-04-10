const { test, expect } = require('playwright/test');
const { ACCOUNT, LOAD_CSV, seedAccounts, loadTransactions, switchToBudget } = require('./seed');

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

test.describe('Month Navigation', () => {
  test('given transactions in multiple months, prev/next arrows navigate and heading updates', async ({ page }) => {
    await setup(page, LOAD_CSV.multiMonth);
    // Start at most recent (March 2024)
    await expect(page.locator('#budget-month-label')).toHaveText('March 2024');
    // Navigate back to February
    await page.click('#budget-prev');
    await expect(page.locator('#budget-month-label')).toHaveText('February 2024');
    // Navigate back to January
    await page.click('#budget-prev');
    await expect(page.locator('#budget-month-label')).toHaveText('January 2024');
    // Navigate forward to February
    await page.click('#budget-next');
    await expect(page.locator('#budget-month-label')).toHaveText('February 2024');
  });

  test('at the oldest month, prev button is disabled', async ({ page }) => {
    await setup(page, LOAD_CSV.multiMonth);
    await page.click('#budget-prev');
    await page.click('#budget-prev');
    await expect(page.locator('#budget-prev')).toBeDisabled();
    await expect(page.locator('#budget-next')).not.toBeDisabled();
  });

  test('at the newest month, next button is disabled', async ({ page }) => {
    await setup(page, LOAD_CSV.multiMonth);
    await expect(page.locator('#budget-next')).toBeDisabled();
    await expect(page.locator('#budget-prev')).not.toBeDisabled();
  });

  test('navigating away from Budget and back resets to most recent month', async ({ page }) => {
    await setup(page, LOAD_CSV.multiMonth);
    await page.click('#budget-prev');
    await page.click('#budget-prev');
    await expect(page.locator('#budget-month-label')).toHaveText('January 2024');
    await page.click('[data-view="load"]');
    await page.click('[data-view="budget"]');
    await expect(page.locator('#budget-month-label')).toHaveText('March 2024');
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

test.describe('Month Banner', () => {
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

  test('navigating months while drill-down is open re-renders detail for same subcategory', async ({ page }) => {
    await seedAccounts(page);
    await page.goto('index.html');
    const multiCatCsv = [
      '2024-01-10,January Coffee,-3.00,Coffee / Bakery,false',
      '2024-03-15,March Coffee,-4.50,Coffee / Bakery,false',
    ].join('\n');
    await loadTransactions(page, multiCatCsv);
    await switchToBudget(page);
    await page.locator('#budget-bars .budget-bar-row').filter({ hasText: 'Coffee / Bakery' }).click();
    await expect(page.locator('#budget-detail-title')).toHaveText('Coffee / Bakery');
    await page.click('#budget-prev');
    await expect(page.locator('#budget-detail-title')).toHaveText('Coffee / Bakery');
    await expect(page.locator('#budget-detail-tbody .tx-row')).toHaveCount(1);
    await expect(page.locator('#budget-detail-tbody .tx-row').first()).toContainText('January Coffee');
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
