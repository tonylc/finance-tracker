const { test, expect } = require('playwright/test');
const { ACCOUNT, seedAccounts } = require('./seed');

// Navigate to Settings and click Add Account
async function openAddForm(page) {
  await page.click('[data-view="settings"]');
  await page.click('#settings-add-btn');
  await expect(page.locator('#settings-form-card')).toBeVisible();
}

// Fill form, parse columns with a 3-column header, map all required fields, save
async function fillAndSaveAccount(page, { name = 'Test Bank', last4 = '5678', header = 'Trans Date,Description,Amount' } = {}) {
  await page.fill('#sf-name', name);
  await page.fill('#sf-last4', last4);
  await page.fill('#sf-header-row', header);
  await page.click('#sf-parse-btn');
  // Map: col 0 = date, col 1 = description, col 2 = amount
  await page.selectOption('#sf-columns-grid select[data-col-index="0"]', 'date');
  await page.selectOption('#sf-columns-grid select[data-col-index="1"]', 'description');
  await page.selectOption('#sf-columns-grid select[data-col-index="2"]', 'amount');
  await page.click('#sf-save-btn');
}

test.describe('4.1-4.4 Add / Edit Account Profile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('index.html');
    await openAddForm(page);
  });

  test('filling name, last4, header row; parsing columns; mapping required fields; saving — account appears in table', async ({ page }) => {
    await fillAndSaveAccount(page);
    // Form should hide
    await expect(page.locator('#settings-form-card')).toBeHidden();
    // Account appears in settings table
    await expect(page.locator('#settings-tbody')).toContainText('Test Bank');
    await expect(page.locator('#settings-tbody')).toContainText('*5678');
  });

  test('last4 with non-digit characters shows validation error and blocks save', async ({ page }) => {
    await page.fill('#sf-name', 'Test Bank');
    await page.fill('#sf-last4', '12ab');
    await page.fill('#sf-header-row', 'Date,Desc,Amount');
    await page.click('#sf-parse-btn');
    await page.selectOption('#sf-columns-grid select[data-col-index="0"]', 'date');
    await page.selectOption('#sf-columns-grid select[data-col-index="1"]', 'description');
    await page.selectOption('#sf-columns-grid select[data-col-index="2"]', 'amount');
    await page.click('#sf-save-btn');
    await expect(page.locator('#sf-form-error')).toBeVisible();
    await expect(page.locator('#sf-form-error')).toContainText('4 number');
    await expect(page.locator('#settings-form-card')).toBeVisible();
  });

  test('last4 shorter than 4 digits shows validation error and blocks save', async ({ page }) => {
    await page.fill('#sf-name', 'Test Bank');
    await page.fill('#sf-last4', '123');
    await page.fill('#sf-header-row', 'Date,Desc,Amount');
    await page.click('#sf-parse-btn');
    await page.selectOption('#sf-columns-grid select[data-col-index="0"]', 'date');
    await page.selectOption('#sf-columns-grid select[data-col-index="1"]', 'description');
    await page.selectOption('#sf-columns-grid select[data-col-index="2"]', 'amount');
    await page.click('#sf-save-btn');
    await expect(page.locator('#sf-form-error')).toBeVisible();
  });

  test('saving without assigning required columns (Date, Description, Amount) blocks save', async ({ page }) => {
    await page.fill('#sf-name', 'Test Bank');
    await page.fill('#sf-last4', '5678');
    await page.fill('#sf-header-row', 'Col1,Col2,Col3');
    await page.click('#sf-parse-btn');
    // Leave all columns as '— skip —'
    await page.click('#sf-save-btn');
    await expect(page.locator('#sf-form-error')).toBeVisible();
    await expect(page.locator('#sf-form-error')).toContainText('required field');
  });
});

test.describe('4.5 Delete Account Profile', () => {
  test.beforeEach(async ({ page }) => {
    await seedAccounts(page);
    await page.goto('index.html');
    await page.click('[data-view="settings"]');
  });

  test('clicking delete removes account from table', async ({ page }) => {
    await expect(page.locator('#settings-tbody')).toContainText('Chase');
    await page.click('#settings-tbody button.btn-danger');
    // Account row removed; table should be hidden (empty state shown)
    await expect(page.locator('#settings-empty')).toBeVisible();
    await expect(page.locator('#settings-table')).toBeHidden();
  });

  test('deleted account no longer appears in Load and Categorize dropdowns', async ({ page }) => {
    await page.click('#settings-tbody button.btn-danger');
    // Check Load dropdown
    await page.click('[data-view="load"]');
    const loadOpts = await page.locator('#load-acct-profile option').allTextContents();
    expect(loadOpts.join('')).not.toContain('Chase');
    // Check Categorize dropdown
    await page.click('[data-view="categorize"]');
    const catOpts = await page.locator('#cat-acct-profile option').allTextContents();
    expect(catOpts.join('')).not.toContain('Chase');
  });
});

test.describe('4.6 Export Settings', () => {
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

test.describe('4.7 Import Settings', () => {
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
