const { test, expect } = require('@playwright/test');
const { seedAccounts, seedHoldings, VANGUARD_ACCOUNT, ROBINHOOD_ACCOUNT, goToView } = require('./seed');

test.describe('History Branch Totals', () => {
  test('snapshot with multiple branches shows a header row per branch', async ({ page }) => {
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

    await expect(page.locator('.history-branch-header-row')).toHaveCount(2);
    await expect(page.locator('#history-tbody')).toContainText('Robinhood');
    await expect(page.locator('#history-tbody')).toContainText('Vanguard');
    await expect(page.locator('#history-tbody')).toContainText('28,550');
    await expect(page.locator('#history-tbody')).toContainText('5,200');
  });

  test('snapshot with a single branch shows one branch header row and one date sub-row', async ({ page }) => {
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

    await expect(page.locator('.history-branch-header-row')).toHaveCount(1);
    await expect(page.locator('.history-date-row')).toHaveCount(1);
    await expect(page.locator('#history-tbody')).toContainText('28,550');
  });

  test('two snapshots for the same branch show one header row with two date sub-rows', async ({ page }) => {
    await seedAccounts(page, [VANGUARD_ACCOUNT]);
    await seedHoldings(page, [], null, [
      {
        id: 'snap1',
        date: '2026-05-01',
        accounts: { 'Vanguard *1234': { value: 26000, costBasis: 21500 } },
        totalValue: 26000,
        totalCostBasis: 21500,
      },
      {
        id: 'snap2',
        date: '2026-05-21',
        accounts: { 'Vanguard *1234': { value: 28550, costBasis: 21500 } },
        totalValue: 28550,
        totalCostBasis: 21500,
      },
    ]);
    await page.goto('index.html');
    await goToView(page, 'history');

    await expect(page.locator('.history-branch-header-row')).toHaveCount(1);
    await expect(page.locator('.history-date-row')).toHaveCount(2);
    await expect(page.locator('.history-branch-header-row')).toContainText('28,550');
  });
});
