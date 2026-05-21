const { test, expect } = require('@playwright/test');
const { seedFullState, seedHoldings, seedAccounts, VANGUARD_ACCOUNT, goToView } = require('./seed');

test.describe('Portfolio View', () => {
  test('given holdings and prices, portfolio shows value and gain', async ({ page }) => {
    await seedFullState(page);
    await page.goto('index.html');
    await goToView(page, 'portfolio');

    // VTI: 100 shares × $285.50 = $28,550.00; BND: 50 × $74.20 = $3,710.00; Total = $32,260.00
    await expect(page.locator('#port-total-value')).toContainText('$32,260');
    await expect(page.locator('#port-tbody')).toContainText('VTI');
    await expect(page.locator('#port-tbody')).toContainText('BND');
    await expect(page.locator('#port-snapshot-btn')).toBeEnabled();
  });

  test('given holdings but no prices, value columns show em dash and snapshot button is disabled', async ({ page }) => {
    await seedAccounts(page, [VANGUARD_ACCOUNT]);
    await seedHoldings(page, [
      { id: 'h1', accountKey: 'Vanguard *1234', ticker: 'VTI', securityName: '', shares: 100, costBasis: 21500 },
    ]);
    await page.goto('index.html');
    await goToView(page, 'portfolio');

    await expect(page.locator('#port-no-prices')).toBeVisible();
    await expect(page.locator('#port-snapshot-btn')).toBeDisabled();
    // Cost basis should still show
    await expect(page.locator('#port-tbody')).toContainText('VTI');
  });

  test('given no holdings, no-holdings warning is shown', async ({ page }) => {
    await page.goto('index.html');
    await goToView(page, 'portfolio');
    await expect(page.locator('#port-no-holdings')).toBeVisible();
  });

  test('clicking Save Snapshot persists to history', async ({ page }) => {
    await seedFullState(page);
    await page.goto('index.html');
    await goToView(page, 'portfolio');

    await page.click('#port-snapshot-btn');
    await expect(page.locator('#port-snapshot-btn')).toContainText('Saved!');

    // Navigate to history and verify snapshot appears
    await goToView(page, 'history');
    await expect(page.locator('#history-tbody tr')).toHaveCount(1);
    await expect(page.locator('#history-tbody')).toContainText('32,260');
  });
});
