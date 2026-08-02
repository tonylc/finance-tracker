const { test, expect } = require('@playwright/test');
const { seedAccounts, seedHoldings, VANGUARD_ACCOUNT, ROBINHOOD_ACCOUNT, goToView } = require('./seed');

test.describe('History Branch Totals', () => {
  test('snapshot renders as a date header row with branch and account sub-rows', async ({ page }) => {
    await seedAccounts(page, [VANGUARD_ACCOUNT, ROBINHOOD_ACCOUNT]);
    await seedHoldings(page, [], null, [
      {
        id: 'snap1',
        date: '2026-05-21',
        accounts: {
          'Vanguard *1234':  { value: 28550, costBasis: 21500 },
          'Robinhood *5678': { value: 5200,  costBasis: 4100  },
        },
        totalValue: 33750,
        totalCostBasis: 25600,
      },
    ]);
    await page.goto('index.html');
    await goToView(page, 'history');

    await expect(page.locator('.history-date-header-row')).toHaveCount(1);
    await expect(page.locator('.history-date-header-row')).toContainText('2026-05-21');
    await expect(page.locator('.history-date-header-row')).toContainText('33,750');
    await expect(page.locator('.history-branch-row')).toHaveCount(2);
    await expect(page.locator('.history-account-row')).toHaveCount(2);
  });

  test('two accounts sharing a branch render as one branch row with summed value', async ({ page }) => {
    await seedAccounts(page, [
      { id: 'rh1', name: 'Brokerage', last4: '1111', branch: 'Robinhood',
        inputCsvFormat: ['ticker', 'security_name', 'shares', 'cost_basis_per_share'] },
      { id: 'rh2', name: 'Roth IRA',  last4: '2222', branch: 'Robinhood',
        inputCsvFormat: ['ticker', 'security_name', 'shares', 'cost_basis_per_share'] },
    ]);
    await seedHoldings(page, [], null, [
      {
        id: 'snap1',
        date: '2026-05-21',
        accounts: {
          'Brokerage *1111': { value: 5200, costBasis: 4100 },
          'Roth IRA *2222':  { value: 3000, costBasis: 2500 },
        },
        totalValue: 8200,
        totalCostBasis: 6600,
      },
    ]);
    await page.goto('index.html');
    await goToView(page, 'history');

    await expect(page.locator('.history-branch-row')).toHaveCount(1);
    await expect(page.locator('.history-branch-row')).toContainText('Robinhood');
    await expect(page.locator('.history-branch-row')).toContainText('8,200');
    await expect(page.locator('.history-account-row')).toHaveCount(2);
  });
});
