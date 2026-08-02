const { test, expect } = require('@playwright/test');
const { seedAccounts, VANGUARD_ACCOUNT, goToView } = require('./seed');

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
