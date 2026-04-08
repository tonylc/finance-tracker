const { test, expect } = require('playwright/test');
const { ACCOUNT, LOAD_CSV, seedAccounts, loadTransactions } = require('./seed');

test.describe('1.1 CSV Import', () => {
  test.beforeEach(async ({ page }) => {
    await seedAccounts(page);
    await page.goto('index.html');
  });

  test('given account profile, when valid CSV pasted and imported, shows account chip and transaction count', async ({ page }) => {
    await loadTransactions(page, LOAD_CSV.simple);
    // Account chip appears in accounts-list
    const chip = page.locator('#accounts-list .account-chip').first();
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('Chase');
    // Total count banner
    await expect(page.locator('#total-tx-count')).toHaveText('3');
  });

  test('given CSV where first row is a header, header row is skipped', async ({ page }) => {
    await loadTransactions(page, LOAD_CSV.withHeader);
    await expect(page.locator('#total-tx-count')).toHaveText('2');
  });

  test('given CSV with a duplicate transaction, duplicate is silently skipped and count reflects deduplicated total', async ({ page }) => {
    await loadTransactions(page, LOAD_CSV.withDuplicate);
    await expect(page.locator('#total-tx-count')).toHaveText('1');
  });

  test('given CSV with an unparseable date, import blocked and validation error appears', async ({ page }) => {
    await loadTransactions(page, LOAD_CSV.badDate);
    const errDiv = page.locator('#load-errors');
    await expect(errDiv).toBeVisible();
    await expect(errDiv).toContainText('not-a-date');
    // Summary card should NOT appear
    await expect(page.locator('#load-summary')).toBeHidden();
  });

  test('given no account profile selected, the CSV section and import button are hidden', async ({ page }) => {
    await page.click('[data-view="load"]');
    // UI protection: #load-csv-section only appears after an account is selected
    await expect(page.locator('#load-csv-section')).toBeHidden();
    await expect(page.locator('#load-import-btn')).toBeHidden();
  });
});

test.describe('1.2 Uncategorized Notice', () => {
  test.beforeEach(async ({ page }) => {
    await seedAccounts(page);
    await page.goto('index.html');
  });

  test('given loaded transactions with no uncategorized rows, uncategorized notice is hidden', async ({ page }) => {
    await loadTransactions(page, LOAD_CSV.simple);
    // All rows in LOAD_CSV.simple have a category, so notice should stay hidden
    const notice = page.locator('#uncategorized-notice');
    await expect(notice).toBeHidden();
  });
});

test.describe('1.3 Per-Account Export', () => {
  test.beforeEach(async ({ page }) => {
    await seedAccounts(page);
    await page.goto('index.html');
    await loadTransactions(page, LOAD_CSV.simple);
  });

  test('given loaded transactions, export button shows CSV sorted date-ascending', async ({ page }) => {
    const chipExportBtn = page.locator('#accounts-list .chip-export-btn').first();
    await chipExportBtn.click();
    await expect(page.locator('#load-export-card')).toBeVisible();
    const csv = await page.locator('#load-export-output').inputValue();
    const lines = csv.trim().split('\n');
    // Header + 3 rows
    expect(lines.length).toBe(4);
    // First data row should be the earliest date (2024-03-01)
    expect(lines[1]).toContain('2024-03-01');
    // Last data row should be the latest date (2024-03-20)
    expect(lines[3]).toContain('2024-03-20');
  });

  test('export CSV contains correct header row', async ({ page }) => {
    const chipExportBtn = page.locator('#accounts-list .chip-export-btn').first();
    await chipExportBtn.click();
    const csv = await page.locator('#load-export-output').inputValue();
    const header = csv.split('\n')[0];
    expect(header).toBe('Date,Description,Amount,Category,Fix');
  });
});
