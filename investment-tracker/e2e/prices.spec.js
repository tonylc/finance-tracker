const { test, expect } = require('@playwright/test');
const { seedFullState, seedAccounts, seedHoldings, VANGUARD_ACCOUNT, PRICES_CSV, goToView } = require('./seed');

test.describe('Prices', () => {
  test('when no holdings exist, fetch button is disabled and no-tickers message shown', async ({ page }) => {
    await page.goto('index.html');
    await goToView(page, 'prices');

    await expect(page.locator('#prices-no-tickers')).toBeVisible();
    await expect(page.locator('#prices-fetch-btn')).toBeDisabled();
  });

  test('given holdings, price inputs are shown for each tracked ticker', async ({ page }) => {
    await seedAccounts(page, [VANGUARD_ACCOUNT]);
    await seedHoldings(page, [
      { id: 'h1', accountKey: 'Vanguard *1234', ticker: 'VTI', securityName: '', shares: 100, costBasis: 21500 },
      { id: 'h2', accountKey: 'Vanguard *1234', ticker: 'BND', securityName: '', shares: 50, costBasis: 3650 },
    ]);
    await page.goto('index.html');
    await goToView(page, 'prices');

    await expect(page.locator('#prices-table-wrap')).toBeVisible();
    await expect(page.locator('#prices-tbody tr')).toHaveCount(2);
    await expect(page.locator('#prices-tbody')).toContainText('VTI');
    await expect(page.locator('#prices-tbody')).toContainText('BND');
  });

  test('manually entering prices and saving persists them', async ({ page }) => {
    await seedAccounts(page, [VANGUARD_ACCOUNT]);
    await seedHoldings(page, [
      { id: 'h1', accountKey: 'Vanguard *1234', ticker: 'VTI', securityName: '', shares: 100, costBasis: 21500 },
    ]);
    await page.goto('index.html');
    await goToView(page, 'prices');

    const input = page.locator('input[data-ticker="VTI"]');
    await input.fill('290.00');
    await page.click('#prices-save-btn');

    await expect(page.locator('#prices-success')).toBeVisible();
    await expect(page.locator('#prices-success')).toContainText('Saved 1');
    await expect(page.locator('#prices-last-fetched')).toContainText('Last saved:');
  });
});
