const { test, expect } = require('@playwright/test');
const { seedAccounts, seedHoldings, VANGUARD_ACCOUNT, ROBINHOOD_ACCOUNT, goToView } = require('./seed');

test.describe('History Branch Totals', () => {
  test('snapshot with multiple accounts shows per-branch value breakdown', async ({ page }) => {
    await seedAccounts(page, [VANGUARD_ACCOUNT, ROBINHOOD_ACCOUNT]);
    await seedHoldings(page, [], null, [
      {
        id: 'snap1',
        date: '2026-05-21',
        accounts: {
          'Vanguard *1234': { value: 28550, costBasis: 21500 },
          'Robinhood *5678': { value: 5200, costBasis: 4100 },
        },
        totalValue: 33750,
        totalCostBasis: 25600,
      },
    ]);
    await page.goto('index.html');
    await goToView(page, 'history');

    await expect(page.locator('#history-tbody')).toContainText('33,750');
    await expect(page.locator('.history-branch-row')).toHaveCount(2);
    await expect(page.locator('#history-tbody')).toContainText('Vanguard');
    await expect(page.locator('#history-tbody')).toContainText('Robinhood');
    await expect(page.locator('#history-tbody')).toContainText('28,550');
    await expect(page.locator('#history-tbody')).toContainText('5,200');
  });

  test('snapshot with a single account shows no branch sub-rows', async ({ page }) => {
    await seedAccounts(page, [VANGUARD_ACCOUNT]);
    await seedHoldings(page, [], null, [
      {
        id: 'snap1',
        date: '2026-05-21',
        accounts: {
          'Vanguard *1234': { value: 28550, costBasis: 21500 },
        },
        totalValue: 28550,
        totalCostBasis: 21500,
      },
    ]);
    await page.goto('index.html');
    await goToView(page, 'history');

    await expect(page.locator('#history-tbody')).toContainText('28,550');
    await expect(page.locator('.history-branch-row')).toHaveCount(0);
  });
});
