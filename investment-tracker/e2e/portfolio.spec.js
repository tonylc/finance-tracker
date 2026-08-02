const { test, expect } = require('@playwright/test');
const { seedFullState, seedHoldings, seedAccounts, VANGUARD_ACCOUNT, ROBINHOOD_ACCOUNT, goToView } = require('./seed');

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
    await expect(page.locator('#history-tbody .history-date-header-row')).toHaveCount(1);
    await expect(page.locator('#history-tbody')).toContainText('32,260');
  });
});

test.describe('Holdings Aggregation', () => {
  test('two holdings of the same ticker in one account are merged into a single portfolio row', async ({ page }) => {
    await seedAccounts(page, [VANGUARD_ACCOUNT]);
    await seedHoldings(page, [
      { id: 'h1', accountKey: 'Vanguard *1234', ticker: 'VTI', securityName: 'Vanguard Total Stock Market ETF', shares: 100, costBasis: 21500 },
      { id: 'h2', accountKey: 'Vanguard *1234', ticker: 'VTI', securityName: 'Vanguard Total Stock Market ETF', shares: 50, costBasis: 11000 },
    ], { fetchedAt: '2026-05-21', prices: { VTI: 285.50 } });
    await page.goto('index.html');
    await goToView(page, 'portfolio');

    // Only one position row for VTI (branch-row and acct-row are not data rows)
    const positionRows = page.locator('#port-tbody tr:not(.branch-row):not(.acct-row):not(.total-row)');
    await expect(positionRows).toHaveCount(1);
    // Aggregated shares: 100 + 50 = 150
    await expect(page.locator('#port-tbody')).toContainText('150');
  });

  test('same ticker across different accounts appears as separate rows', async ({ page }) => {
    await seedAccounts(page, [VANGUARD_ACCOUNT, ROBINHOOD_ACCOUNT]);
    await seedHoldings(page, [
      { id: 'h1', accountKey: 'Vanguard *1234', ticker: 'VTI', securityName: '', shares: 100, costBasis: 21500 },
      { id: 'h2', accountKey: 'Robinhood *5678', ticker: 'VTI', securityName: '', shares: 50, costBasis: 11000 },
    ], { fetchedAt: '2026-05-21', prices: { VTI: 285.50 } });
    await page.goto('index.html');
    await goToView(page, 'portfolio');

    // One row per account (Vanguard has 100 shares, Robinhood has 50)
    const positionRows = page.locator('#port-tbody tr:not(.branch-row):not(.acct-row):not(.total-row)');
    await expect(positionRows).toHaveCount(2);
  });

  test('two accounts sharing a branch appear under one branch header row', async ({ page }) => {
    await seedAccounts(page, [
      { id: 'v1', name: 'Brokerage', last4: '1111', branch: 'Robinhood',
        inputCsvFormat: ['ticker', 'security_name', 'shares', 'cost_basis_per_share'] },
      { id: 'v2', name: 'Roth IRA',  last4: '2222', branch: 'Robinhood',
        inputCsvFormat: ['ticker', 'security_name', 'shares', 'cost_basis_per_share'] },
    ]);
    await seedHoldings(page, [
      { id: 'h1', accountKey: 'Brokerage *1111', ticker: 'VTI', securityName: '', shares: 100, costBasis: 21500 },
      { id: 'h2', accountKey: 'Roth IRA *2222',  ticker: 'VTI', securityName: '', shares: 50,  costBasis: 11000 },
    ], { fetchedAt: '2026-05-21', prices: { VTI: 285.50 } });
    await page.goto('index.html');
    await goToView(page, 'portfolio');

    await expect(page.locator('#port-tbody tr.branch-row')).toHaveCount(1);
    await expect(page.locator('#port-tbody tr.branch-row')).toContainText('Robinhood');
  });
});
