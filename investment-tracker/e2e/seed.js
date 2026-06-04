// Shared fixtures for Investment Tracker E2E tests

const VANGUARD_ACCOUNT = {
  id: 'seed-vanguard-1',
  name: 'Vanguard',
  last4: '1234',
  inputCsvFormat: ['ticker', 'security_name', 'shares', 'cost_basis_per_share'],
};

const ROBINHOOD_ACCOUNT = {
  id: 'seed-robinhood-1',
  name: 'Robinhood',
  last4: '5678',
  inputCsvFormat: ['ticker', 'security_name', 'shares', 'cost_basis_per_share'],
};

// Holdings CSV — Vanguard format: ticker,security_name,shares,cost_basis_per_share
const VANGUARD_CSV = [
  'VTI,Vanguard Total Stock Market ETF,100,215.00',
  'BND,Vanguard Total Bond Market ETF,50,73.00',
].join('\n');

// Holdings CSV — Robinhood format: same mapping
const ROBINHOOD_CSV = [
  'AAPL,Apple Inc,10,150.00',
  'MSFT,Microsoft Corp,5,280.00',
].join('\n');

// Invalid CSV (missing ticker)
const INVALID_CSV = [
  ',Vanguard Total Stock Market ETF,100,215.00',
].join('\n');

// Prices CSV: Ticker,Price
const PRICES_CSV = [
  'Ticker,Price',
  'VTI,285.50',
  'BND,74.20',
  'AAPL,182.30',
  'MSFT,415.00',
].join('\n');

// Pre-seed localStorage with account config
async function seedAccounts(page, accounts = [VANGUARD_ACCOUNT]) {
  await page.addInitScript(accts => {
    localStorage.setItem('investmentTrackerConfig', JSON.stringify({ accounts: accts }));
  }, accounts);
}

// Pre-seed holdings + prices into localStorage
async function seedHoldings(page, holdings = [], currentPrices = null, networthSnapshots = []) {
  await page.addInitScript(({ h, cp, ns }) => {
    localStorage.setItem('investmentTrackerData', JSON.stringify({
      holdings: h,
      currentPrices: cp,
      networthSnapshots: ns,
    }));
  }, { h: holdings, cp: currentPrices, ns: networthSnapshots });
}

// Full seeded state: Vanguard account + holdings + prices
async function seedFullState(page) {
  await page.addInitScript(() => {
    localStorage.setItem('investmentTrackerConfig', JSON.stringify({
      accounts: [
        { id: 'seed-vanguard-1', name: 'Vanguard', last4: '1234', inputCsvFormat: ['ticker', 'security_name', 'shares', 'cost_basis_per_share'] },
      ],
    }));
    localStorage.setItem('investmentTrackerData', JSON.stringify({
      holdings: [
        { id: 'h1', accountKey: 'Vanguard *1234', ticker: 'VTI', securityName: 'Vanguard Total Stock Market ETF', shares: 100, costBasis: 21500 },
        { id: 'h2', accountKey: 'Vanguard *1234', ticker: 'BND', securityName: 'Vanguard Total Bond Market ETF', shares: 50, costBasis: 3650 },
      ],
      currentPrices: {
        fetchedAt: '2026-05-21',
        prices: { VTI: 285.50, BND: 74.20 },
      },
      networthSnapshots: [],
    }));
  });
}

// Navigate to a view
async function goToView(page, view) {
  await page.click(`[data-view="${view}"]`);
}

module.exports = {
  VANGUARD_ACCOUNT, ROBINHOOD_ACCOUNT,
  VANGUARD_CSV, ROBINHOOD_CSV, INVALID_CSV, PRICES_CSV,
  seedAccounts, seedHoldings, seedFullState, goToView,
};
