const { test, expect } = require('@playwright/test');
const { seedAccounts, seedHoldings, VANGUARD_ACCOUNT, goToView } = require('./seed');

test.describe('Settings', () => {
  test('when no accounts exist, empty state is shown', async ({ page }) => {
    await page.goto('index.html');
    await goToView(page, 'settings');
    await expect(page.locator('#settings-empty')).toBeVisible();
    await expect(page.locator('#settings-table')).not.toBeVisible();
  });

  test('adding an account makes it appear in the table', async ({ page }) => {
    await page.goto('index.html');
    await goToView(page, 'settings');

    await page.click('#settings-add-btn');
    await page.fill('#sf-name', 'Vanguard');
    await page.fill('#sf-last4', '1234');
    await page.fill('#sf-format-input', '["ticker","shares"]');
    await page.click('#sf-save-btn');

    await expect(page.locator('#settings-table')).toBeVisible();
    await expect(page.locator('#settings-tbody')).toContainText('Vanguard');
    await expect(page.locator('#settings-tbody')).toContainText('1234');
  });

  test('saving an account with invalid last4 shows an error', async ({ page }) => {
    await page.goto('index.html');
    await goToView(page, 'settings');

    await page.click('#settings-add-btn');
    await page.fill('#sf-name', 'Test Broker');
    await page.fill('#sf-last4', '12');
    await page.fill('#sf-format-input', '["ticker","shares"]');
    await page.click('#sf-save-btn');

    await expect(page.locator('#sf-form-error')).toBeVisible();
    await expect(page.locator('#sf-form-error')).toContainText('4');
  });

  test('saving an account with invalid column format shows an error', async ({ page }) => {
    await page.goto('index.html');
    await goToView(page, 'settings');

    await page.click('#settings-add-btn');
    await page.fill('#sf-name', 'Test Broker');
    await page.fill('#sf-last4', '1234');
    await page.fill('#sf-format-input', '["ticker"]');  // missing shares
    await page.click('#sf-save-btn');

    await expect(page.locator('#sf-form-error')).toBeVisible();
    await expect(page.locator('#sf-form-error')).toContainText('shares');
  });

  test('editing an existing account updates it in the table', async ({ page }) => {
    await seedAccounts(page, [VANGUARD_ACCOUNT]);
    await page.goto('index.html');
    await goToView(page, 'settings');

    await page.click('button:has-text("Edit")');
    await page.fill('#sf-name', 'Vanguard Brokerage');
    await page.click('#sf-save-btn');

    await expect(page.locator('#settings-tbody')).toContainText('Vanguard Brokerage');
  });

  test('deleting an account removes it from the table', async ({ page }) => {
    await seedAccounts(page, [VANGUARD_ACCOUNT]);
    await page.goto('index.html');
    await goToView(page, 'settings');

    page.on('dialog', d => d.accept());
    await page.click('button:has-text("Delete")');

    await expect(page.locator('#settings-empty')).toBeVisible();
  });

  test('adding an account with a branch saves and displays the branch', async ({ page }) => {
    await page.goto('index.html');
    await goToView(page, 'settings');

    await page.click('#settings-add-btn');
    await page.fill('#sf-branch', 'Robinhood');
    await page.fill('#sf-name', 'Brokerage');
    await page.fill('#sf-last4', '1234');
    await page.fill('#sf-format-input', '["ticker","shares"]');
    await page.click('#sf-save-btn');

    await expect(page.locator('#settings-tbody')).toContainText('Robinhood');
    await expect(page.locator('#settings-tbody')).toContainText('Brokerage');
  });
});

test.describe('Full Backup Export & Import', () => {
  test('exporting data produces JSON that restores accounts, portfolio holdings, prices, and history snapshots on import', async ({ page }) => {
    await seedAccounts(page, [VANGUARD_ACCOUNT]);
    await seedHoldings(
      page,
      [{ id: 'h1', accountKey: 'Vanguard *1234', ticker: 'VTI', securityName: 'Vanguard Total Stock Market ETF', shares: 100, costBasis: 21500 }],
      { fetchedAt: '2026-05-21', prices: { VTI: 285.50 } },
      [{ id: 'snap1', date: '2026-05-21', accounts: { 'Vanguard *1234': { value: 28550, costBasis: 21500 } }, totalValue: 28550, totalCostBasis: 21500 }]
    );
    await page.goto('index.html');
    await goToView(page, 'settings');

    // Export full backup
    await page.click('#settings-export-btn');
    const exportedJson = await page.locator('#settings-export-field').inputValue();
    expect(exportedJson).toContain('VTI');
    expect(exportedJson).toContain('28550');

    // Wipe localStorage to simulate switching to another computer
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await goToView(page, 'settings');
    await expect(page.locator('#settings-empty')).toBeVisible();

    // Import the exported JSON
    await page.fill('#settings-import-field', exportedJson);
    await page.click('#settings-import-btn');
    await expect(page.locator('#settings-import-success')).toBeVisible();
    await expect(page.locator('#settings-tbody')).toContainText('Vanguard');

    // Verify Portfolio view restored
    await goToView(page, 'portfolio');
    await expect(page.locator('#port-total-value')).toContainText('$28,550.00');
    await expect(page.locator('#port-tbody')).toContainText('VTI');

    // Verify History view restored
    await goToView(page, 'history');
    await expect(page.locator('.history-date-header-row')).toHaveCount(1);
    await expect(page.locator('.history-date-header-row')).toContainText('2026-05-21');
    await expect(page.locator('.history-date-header-row')).toContainText('$28,550.00');
  });

  test('importing invalid backup JSON displays an error message', async ({ page }) => {
    await page.goto('index.html');
    await goToView(page, 'settings');

    await page.fill('#settings-import-field', '{"accounts":"not-an-array"}');
    await page.click('#settings-import-btn');

    await expect(page.locator('#settings-import-error')).toBeVisible();
    await expect(page.locator('#settings-import-error')).toContainText('accounts');
  });
});
