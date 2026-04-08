const { defineConfig, devices } = require('playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.js',
  use: {
    baseURL: 'file:///home/user/finance-tracker/',
    browserName: 'chromium',
    headless: true,
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
