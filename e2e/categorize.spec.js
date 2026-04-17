const { test, expect } = require('playwright/test');
const { ACCOUNT, BANK_ACCOUNT, CAT_CSV, seedAccounts, seedBankAccount } = require('./seed');

// Import a CSV via the Categorize tab
async function catImport(page, csv = CAT_CSV.simple) {
  await page.click('[data-view="categorize"]');
  await page.selectOption('#cat-acct-profile', ACCOUNT.id);
  await page.fill('#cat-csv', csv);
  await page.click('#cat-import-btn');
}

async function catImportBank(page, csv) {
  await page.click('[data-view="categorize"]');
  await page.selectOption('#cat-acct-profile', BANK_ACCOUNT.id);
  await page.fill('#cat-csv', csv);
  await page.click('#cat-import-btn');
}

test.describe('CSV Import', () => {
  test('imported transactions are displayed newest-first', async ({ page }) => {
    await seedAccounts(page);
    await page.goto('index.html');
    await catImport(page);
    // CAT_CSV.simple dates: 2024-03-15, 2024-03-20, 2024-03-01
    // After sortByDateDesc: 2024-03-20 (Whole Foods), 2024-03-15 (Coffee Roasters), 2024-03-01 (Direct Deposit)
    const rows = page.locator('#cat-tbody tr[data-idx]');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('Whole Foods');
    await expect(rows.nth(2)).toContainText('Direct Deposit');
  });
});

test.describe('Fix Flag', () => {
  test('toggling fix checkbox updates state.catSession fix value', async ({ page }) => {
    await seedAccounts(page);
    await page.goto('index.html');
    await catImport(page, '2024-03-15,Coffee Roasters,,-4.50');
    const fixCb = page.locator('#cat-tbody tr[data-idx="0"] input[data-field="fix"]');
    await expect(fixCb).not.toBeChecked();
    await fixCb.click();
    await expect(fixCb).toBeChecked();
    expect(await page.evaluate(() => state.catSession[0].fix)).toBe(true);
  });
});

test.describe('Category Assignment', () => {
  test('clicking category dropdown and selecting a value assigns category to that row', async ({ page }) => {
    await seedAccounts(page);
    await page.goto('index.html');
    await catImport(page, '2024-03-15,Coffee Roasters,,-4.50');
    // Select Groceries from the first row's dropdown
    await page.selectOption('#cat-tbody tr[data-idx="0"] select', 'Groceries');
    // The td should no longer have cat-error
    await expect(page.locator('#cat-tbody tr[data-idx="0"] td.td-cat')).not.toHaveClass(/cat-error/);
    // Progress should update to 1/1
    await expect(page.locator('#cat-progress')).toHaveText('1 / 1 categorized');
  });
});

test.describe('Keyboard Cycling', () => {
  test.beforeEach(async ({ page }) => {
    await seedAccounts(page);
    await page.goto('index.html');
    await catImport(page, '2024-03-15,Coffee Roasters,,-4.50\n2024-03-20,Whole Foods,,-87.32');
  });

  test('given row focused, pressing a letter key enters edit mode and cycles category dropdown', async ({ page }) => {
    // Press j to focus row 0
    await page.keyboard.press('j');
    await expect(page.locator('#cat-tbody tr[data-idx="0"]')).toHaveClass(/row-focused/);
    // Press 'g' → should cycle to first category starting with G (Gas / EV Charging)
    await page.keyboard.press('g');
    const selValue = await page.locator('#cat-tbody tr[data-idx="0"] select').inputValue();
    expect(selValue).toMatch(/^G/i);
    // The select should now be focused (edit mode)
    await expect(page.locator('#cat-tbody tr[data-idx="0"] select')).toBeFocused();
  });

  test('pressing ESC from edit mode returns to navigation mode (dropdown blurred)', async ({ page }) => {
    await page.keyboard.press('j');
    await page.keyboard.press('g'); // enter edit mode
    await expect(page.locator('#cat-tbody tr[data-idx="0"] select')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#cat-tbody tr[data-idx="0"] select')).not.toBeFocused();
  });

});

test.describe('Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await seedAccounts(page);
    await page.goto('index.html');
    await catImport(page);
  });

  test('pressing j moves row focus down; k moves focus up', async ({ page }) => {
    await page.keyboard.press('j'); // idx 0
    await expect(page.locator('#cat-tbody tr[data-idx="0"]')).toHaveClass(/row-focused/);
    await page.keyboard.press('j'); // idx 1
    await expect(page.locator('#cat-tbody tr[data-idx="1"]')).toHaveClass(/row-focused/);
    await page.keyboard.press('k'); // back to idx 0
    await expect(page.locator('#cat-tbody tr[data-idx="0"]')).toHaveClass(/row-focused/);
  });

  test('pressing j with no prior focus starts at row 0', async ({ page }) => {
    // No prior focus — focusedIdx = -1
    await page.keyboard.press('j');
    await expect(page.locator('#cat-tbody tr[data-idx="0"]')).toHaveClass(/row-focused/);
  });

  test('hovering a row with mouse sets keyboard focus to that row', async ({ page }) => {
    await page.hover('#cat-tbody tr[data-idx="1"]');
    await expect(page.locator('#cat-tbody tr[data-idx="1"]')).toHaveClass(/row-focused/);
  });

  test('hovering a row while a select is focused blurs the select then sets mouse focus', async ({ page }) => {
    // Focus the select on row 0
    await page.click('#cat-tbody tr[data-idx="0"] select');
    await expect(page.locator('#cat-tbody tr[data-idx="0"] select')).toBeFocused();
    // Hover row 1 — should blur the select and focus row 1
    await page.hover('#cat-tbody tr[data-idx="1"]');
    await expect(page.locator('#cat-tbody tr[data-idx="0"] select')).not.toBeFocused();
    await expect(page.locator('#cat-tbody tr[data-idx="1"]')).toHaveClass(/row-focused/);
  });
});

test.describe('Multi-Select Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await seedAccounts(page);
    await page.goto('index.html');
    await catImport(page);
  });

  test('clicking multi-select button makes checkbox column visible', async ({ page }) => {
    await page.click('#cat-multiselect-btn');
    await expect(page.locator('#cat-table')).toHaveClass(/multi-select-active/);
  });

  test('clicking again hides checkbox column and clears selection', async ({ page }) => {
    await page.click('#cat-multiselect-btn');
    await page.click('#cat-multiselect-btn');
    await expect(page.locator('#cat-table')).not.toHaveClass(/multi-select-active/);
  });
});

test.describe('Row Selection', () => {
  test.beforeEach(async ({ page }) => {
    await seedAccounts(page);
    await page.goto('index.html');
    await catImport(page);
    await page.click('#cat-multiselect-btn'); // enable multi-select
    await page.keyboard.press('j'); // focus row 0
  });

  test('pressing x in multi-select mode toggles selection on the focused row', async ({ page }) => {
    await page.keyboard.press('x');
    await expect(page.locator('#cat-tbody tr[data-idx="0"]')).toHaveClass(/row-selected/);
    await page.keyboard.press('x');
    await expect(page.locator('#cat-tbody tr[data-idx="0"]')).not.toHaveClass(/row-selected/);
  });

  test('selected row shows blue highlight; unselected row does not', async ({ page }) => {
    await page.keyboard.press('x');
    const selectedRow = page.locator('#cat-tbody tr[data-idx="0"]');
    await expect(selectedRow).toHaveClass(/row-selected/);
    const unselectedRow = page.locator('#cat-tbody tr[data-idx="1"]');
    await expect(unselectedRow).not.toHaveClass(/row-selected/);
  });
});

test.describe('Bulk Category Assignment', () => {
  test.beforeEach(async ({ page }) => {
    await seedAccounts(page);
    await page.goto('index.html');
    await catImport(page);
    await page.click('#cat-multiselect-btn');
  });

  test('given multiple rows selected, applying bulk category assigns to all and clears selection', async ({ page }) => {
    // Focus and select row 0
    await page.keyboard.press('j');
    await page.keyboard.press('x');
    // Move to row 1 and select it
    await page.keyboard.press('j');
    await page.keyboard.press('x');
    // Apply bulk category
    await page.selectOption('#cat-bulk-cat', 'Groceries');
    await page.click('#cat-bulk-apply');
    // Both rows should now have Groceries
    await expect(page.locator('#cat-tbody tr[data-idx="0"] select')).toHaveValue('Groceries');
    await expect(page.locator('#cat-tbody tr[data-idx="1"] select')).toHaveValue('Groceries');
    // Selection cleared
    await expect(page.locator('#cat-tbody tr[data-idx="0"]')).not.toHaveClass(/row-selected/);
  });

  test('bulk bar appears when 1+ rows selected; disappears when selection cleared', async ({ page }) => {
    const bulkBar = page.locator('#cat-bulk-bar');
    // Initially hidden (no .visible class)
    await expect(bulkBar).not.toHaveClass(/visible/);
    await page.keyboard.press('j');
    await page.keyboard.press('x');
    await expect(bulkBar).toHaveClass(/visible/);
    await page.click('#cat-bulk-clear');
    await expect(bulkBar).not.toHaveClass(/visible/);
  });
});

test.describe('Select All', () => {
  test('checking select-all selects every row; unchecking deselects all', async ({ page }) => {
    await seedAccounts(page);
    await page.goto('index.html');
    await catImport(page);
    await page.click('#cat-multiselect-btn');
    await page.check('#cat-select-all');
    const rows = page.locator('#cat-tbody tr[data-idx]');
    const count = await rows.count();
    for (let i = 0; i < count; i++) await expect(rows.nth(i)).toHaveClass(/row-selected/);
    await page.uncheck('#cat-select-all');
    for (let i = 0; i < count; i++) await expect(rows.nth(i)).not.toHaveClass(/row-selected/);
  });
});

test.describe('Export Validation', () => {
  test('given rows with uncategorized entries, export button shows validation error', async ({ page }) => {
    await seedAccounts(page);
    await page.goto('index.html');
    await catImport(page, '2024-03-15,Coffee Roasters,,-4.50');
    // Do not assign any category
    await page.click('#cat-export-btn');
    await expect(page.locator('#cat-export-error')).toBeVisible();
    await expect(page.locator('#cat-export-error')).toContainText('missing a category');
    await expect(page.locator('#cat-export-card')).toBeHidden();
  });
});

test.describe('Export Success', () => {
  test('given all rows categorized, export generates CSV with correct columns and date-ascending order', async ({ page }) => {
    await seedAccounts(page);
    await page.goto('index.html');
    // Import 2 rows with different dates
    await catImport(page, '2024-03-20,Whole Foods,,-87.32\n2024-03-15,Coffee Roasters,,-4.50');
    // Assign categories to both rows
    await page.selectOption('#cat-tbody tr[data-idx="0"] select', 'Groceries'); // row 0 = Whole Foods (sorted desc)
    await page.selectOption('#cat-tbody tr[data-idx="1"] select', 'Coffee / Bakery'); // row 1 = Coffee Roasters
    await page.click('#cat-export-btn');
    await expect(page.locator('#cat-export-card')).toBeVisible();
    const csv = await page.locator('#export-output').inputValue();
    const lines = csv.trim().split('\n');
    // Header + 2 data rows
    expect(lines[0]).toBe('Date,Description,Amount,Category,Fix');
    expect(lines.length).toBe(3);
    // Date-ascending: Coffee Roasters (03-15) first, then Whole Foods (03-20)
    expect(lines[1]).toContain('2024-03-15');
    expect(lines[2]).toContain('2024-03-20');
  });
});
