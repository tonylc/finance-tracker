const { test, expect } = require('@playwright/test');
const { VANGUARD_ACCOUNT, ROBINHOOD_ACCOUNT, VANGUARD_CSV, ROBINHOOD_CSV, INVALID_CSV, seedAccounts, seedHoldings, goToView } = require('./seed');

test.describe('Holdings Upload', () => {
  test('given a configured account, when a valid CSV is pasted and imported, holdings appear in the table', async ({ page }) => {
    await seedAccounts(page, [VANGUARD_ACCOUNT]);
    await page.goto('index.html');
    await goToView(page, 'upload');

    await page.selectOption('#upload-acct-select', VANGUARD_ACCOUNT.id);
    await page.fill('#upload-csv', VANGUARD_CSV);
    await page.click('#upload-import-btn');

    await expect(page.locator('#upload-success')).toBeVisible();
    await expect(page.locator('#upload-holdings-tbody tr')).toHaveCount(2);
    await expect(page.locator('#upload-holdings-tbody')).toContainText('VTI');
    await expect(page.locator('#upload-holdings-tbody')).toContainText('BND');
  });

  test('given a CSV with a missing ticker, import shows a validation error', async ({ page }) => {
    await seedAccounts(page, [VANGUARD_ACCOUNT]);
    await page.goto('index.html');
    await goToView(page, 'upload');

    await page.selectOption('#upload-acct-select', VANGUARD_ACCOUNT.id);
    await page.fill('#upload-csv', INVALID_CSV);
    await page.click('#upload-import-btn');

    await expect(page.locator('#upload-error')).toBeVisible();
    await expect(page.locator('#upload-error')).toContainText('ticker');
  });

  test('when no accounts are configured, settings prompt is shown instead of account dropdown', async ({ page }) => {
    await page.goto('index.html');
    await goToView(page, 'upload');

    await expect(page.locator('#upload-no-accounts')).toBeVisible();
    await expect(page.locator('#upload-acct-wrap')).not.toBeVisible();
  });

  test('uploading holdings for the same account replaces previous holdings', async ({ page }) => {
    await seedAccounts(page, [VANGUARD_ACCOUNT]);
    await page.goto('index.html');
    await goToView(page, 'upload');

    // First import
    await page.selectOption('#upload-acct-select', VANGUARD_ACCOUNT.id);
    await page.fill('#upload-csv', VANGUARD_CSV);
    await page.click('#upload-import-btn');
    await expect(page.locator('#upload-holdings-tbody tr')).toHaveCount(2);

    // Second import — only one holding
    await page.fill('#upload-csv', 'VTI,Vanguard Total Stock Market ETF,200,220.00');
    await page.click('#upload-import-btn');

    // Should now have 1 row (replaced)
    await expect(page.locator('#upload-holdings-tbody tr')).toHaveCount(1);
    await expect(page.locator('#upload-holdings-tbody')).toContainText('200');
  });

  test('per-account clear button removes only that account\'s holdings', async ({ page }) => {
    await seedAccounts(page, [VANGUARD_ACCOUNT, ROBINHOOD_ACCOUNT]);
    await seedHoldings(page, [
      { id: 'h1', accountKey: 'Vanguard *1234', ticker: 'VTI', securityName: '', shares: 100, costBasis: 21500 },
      { id: 'h2', accountKey: 'Robinhood *5678', ticker: 'AAPL', securityName: '', shares: 10, costBasis: 1500 },
    ]);
    await page.goto('index.html');
    await goToView(page, 'upload');

    page.on('dialog', d => d.accept());
    // Click the × on the Vanguard chip
    await page.locator('.account-chip', { hasText: 'Vanguard *1234' }).locator('button').click();

    // Vanguard gone, Robinhood remains
    await expect(page.locator('#upload-holdings-tbody')).not.toContainText('VTI');
    await expect(page.locator('#upload-holdings-tbody')).toContainText('AAPL');
  });
});
