Run the full finance-tracker test suite — unit tests first, then Playwright E2E tests.

**Step 1 — Unit tests:**
```bash
node /home/user/finance-tracker/run-tests.js
```

**Step 2 — E2E tests:**
```bash
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test --config=e2e/playwright.config.js
```

Report results for each suite:
- Unit tests: show pass/fail count; on failure, list failing test names and error messages.
- E2E tests: show pass/fail count; on failure, list failing test names and error messages.

If both suites pass, confirm success. If either fails, stop and report the failures — do NOT proceed with any commit or other action.
