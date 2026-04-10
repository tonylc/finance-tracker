const { test, expect } = require('playwright/test');
const { ACCOUNT, seedAccounts } = require('./seed');

// Navigate to Settings and click Add Account
async function openAddForm(page) {
  await page.click('[data-view="settings"]');
  await page.click('#settings-add-btn');
  await expect(page.locator('#settings-form-card')).toBeVisible();
}

// Fill form with JSON format array and save
async function fillAndSaveAccount(page, {
  name = 'Test Bank',
  last4 = '5678',
  format = '["date","description","amount"]',
} = {}) {
  await page.fill('#sf-name', name);
  await page.fill('#sf-last4', last4);
  await page.fill('#sf-format-input', format);
  await page.click('#sf-save-btn');
}

test.describe('Add Account Profile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('index.html');
    await openAddForm(page);
  });

  test('filling name, last4, format; saving — account appears in table', async ({ page }) => {
    await fillAndSaveAccount(page);
    await expect(page.locator('#settings-form-card')).toBeHidden();
    await expect(page.locator('#settings-tbody')).toContainText('Test Bank');
    await expect(page.locator('#settings-tbody')).toContainText('*5678');
  });
});

test.describe('Edit Account Profile', () => {
  test('editing name and saving updates the account in the table', async ({ page }) => {
    await seedAccounts(page);
    await page.goto('index.html');
    await page.click('[data-view="settings"]');
    await page.click('#settings-tbody button:not(.btn-danger)'); // Edit button
    await expect(page.locator('#settings-form-title')).toHaveText('Edit Account');
    await page.fill('#sf-name', 'Updated Bank');
    await page.click('#sf-save-btn');
    await expect(page.locator('#settings-tbody')).toContainText('Updated Bank');
    await expect(page.locator('#settings-tbody')).not.toContainText('Chase');
  });
});

test.describe('Last 4 Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('index.html');
    await openAddForm(page);
  });

  test('last4 with non-digit characters shows validation error and blocks save', async ({ page }) => {
    await page.fill('#sf-name', 'Test Bank');
    await page.fill('#sf-last4', '12ab');
    await page.fill('#sf-format-input', '["date","description","amount"]');
    await page.click('#sf-save-btn');
    await expect(page.locator('#sf-form-error')).toBeVisible();
    await expect(page.locator('#sf-form-error')).toContainText('4 number');
    await expect(page.locator('#settings-form-card')).toBeVisible();
  });

  test('last4 shorter than 4 digits shows validation error and blocks save', async ({ page }) => {
    await page.fill('#sf-name', 'Test Bank');
    await page.fill('#sf-last4', '123');
    await page.fill('#sf-format-input', '["date","description","amount"]');
    await page.click('#sf-save-btn');
    await expect(page.locator('#sf-form-error')).toBeVisible();
  });
});

test.describe('Column Format Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('index.html');
    await openAddForm(page);
  });

  test('saving with invalid JSON shows error and blocks save', async ({ page }) => {
    await page.fill('#sf-name', 'Test Bank');
    await page.fill('#sf-last4', '5678');
    await page.fill('#sf-format-input', 'not json');
    await page.click('#sf-save-btn');
    await expect(page.locator('#sf-form-error')).toBeVisible();
    await expect(page.locator('#sf-form-error')).toContainText('JSON');
  });

  test('saving without amount field shows error and blocks save', async ({ page }) => {
    await page.fill('#sf-name', 'Test Bank');
    await page.fill('#sf-last4', '5678');
    await page.fill('#sf-format-input', '["date","description"]');
    await page.click('#sf-save-btn');
    await expect(page.locator('#sf-form-error')).toBeVisible();
    await expect(page.locator('#sf-form-error')).toContainText('Amount');
  });

  test('saving with debit_amount only (no credit_amount) shows error', async ({ page }) => {
    await page.fill('#sf-name', 'Test Bank');
    await page.fill('#sf-last4', '5678');
    await page.fill('#sf-format-input', '["date","description","debit_amount"]');
    await page.click('#sf-save-btn');
    await expect(page.locator('#sf-form-error')).toBeVisible();
    await expect(page.locator('#sf-form-error')).toContainText('credit_amount');
  });

  test('saving with debit_amount and credit_amount succeeds', async ({ page }) => {
    await page.fill('#sf-name', 'Test Bank');
    await page.fill('#sf-last4', '5678');
    await page.fill('#sf-format-input', '["date","description","debit_amount","credit_amount"]');
    await page.click('#sf-save-btn');
    await expect(page.locator('#settings-form-card')).toBeHidden();
    await expect(page.locator('#settings-tbody')).toContainText('Test Bank');
  });

  test('saving with duplicate date field shows error and blocks save', async ({ page }) => {
    await page.fill('#sf-name', 'Test Bank');
    await page.fill('#sf-last4', '5678');
    await page.fill('#sf-format-input', '["date","date","description","amount"]');
    await page.click('#sf-save-btn');
    await expect(page.locator('#sf-form-error')).toBeVisible();
    await expect(page.locator('#sf-form-error')).toContainText('date');
  });

  test('saving with duplicate amount field shows error and blocks save', async ({ page }) => {
    await page.fill('#sf-name', 'Test Bank');
    await page.fill('#sf-last4', '5678');
    await page.fill('#sf-format-input', '["date","description","amount","amount"]');
    await page.click('#sf-save-btn');
    await expect(page.locator('#sf-form-error')).toBeVisible();
    await expect(page.locator('#sf-form-error')).toContainText('amount');
  });
});

test.describe('Delete Account Profile', () => {
  test.beforeEach(async ({ page }) => {
    await seedAccounts(page);
    await page.goto('index.html');
    await page.click('[data-view="settings"]');
  });

  test('clicking delete removes account from table', async ({ page }) => {
    await expect(page.locator('#settings-tbody')).toContainText('Chase');
    await page.click('#settings-tbody button.btn-danger');
    await expect(page.locator('#settings-empty')).toBeVisible();
    await expect(page.locator('#settings-table')).toBeHidden();
  });

  test('deleted account no longer appears in Load and Categorize dropdowns', async ({ page }) => {
    await page.click('#settings-tbody button.btn-danger');
    await page.click('[data-view="load"]');
    const loadOpts = await page.locator('#load-acct-profile option').allTextContents();
    expect(loadOpts.join('')).not.toContain('Chase');
    await page.click('[data-view="categorize"]');
    const catOpts = await page.locator('#cat-acct-profile option').allTextContents();
    expect(catOpts.join('')).not.toContain('Chase');
  });
});

test.describe('Export Settings', () => {
  test('export button shows JSON textarea containing all account profiles', async ({ page }) => {
    await seedAccounts(page);
    await page.goto('index.html');
    await page.click('[data-view="settings"]');
    await page.click('#settings-export-btn');
    await expect(page.locator('#settings-export-section')).toBeVisible();
    const json = await page.locator('#settings-export-field').inputValue();
    expect(json).toContain('seed-acct-1');
    expect(json).toContain('Chase');
    expect(json).toContain('1234');
  });
});

test.describe('Import Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('index.html');
    await page.click('[data-view="settings"]');
  });

  test('pasting valid exported JSON and importing restores all accounts', async ({ page }) => {
    const validJSON = JSON.stringify([{
      id: 'imported-1',
      name: 'Imported Bank',
      last4: '9999',
      inputCsvFormat: ['date', 'description', null, 'amount'],
    }]);
    await page.fill('#settings-import-field', validJSON);
    await page.click('#settings-import-btn');
    await expect(page.locator('#settings-import-error')).toBeHidden();
    await expect(page.locator('#settings-tbody')).toContainText('Imported Bank');
    await expect(page.locator('#settings-tbody')).toContainText('*9999');
  });

  test('importing malformed JSON shows inline validation error', async ({ page }) => {
    await page.fill('#settings-import-field', '{not valid json}');
    await page.click('#settings-import-btn');
    await expect(page.locator('#settings-import-error')).toBeVisible();
  });

  test('importing JSON with invalid last4 shows inline validation error', async ({ page }) => {
    const badJSON = JSON.stringify([{
      id: 'bad-1',
      name: 'Bad Bank',
      last4: '12ab',
      inputCsvFormat: ['date', 'description', null, 'amount'],
    }]);
    await page.fill('#settings-import-field', badJSON);
    await page.click('#settings-import-btn');
    await expect(page.locator('#settings-import-error')).toBeVisible();
    await expect(page.locator('#settings-import-error')).toContainText('last4');
  });
});
