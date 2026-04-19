Run the full finance-tracker test suite — unit tests, Playwright E2E tests, then design/test coverage check.

**Step 1 — Unit tests:**
```bash
node /home/user/finance-tracker/run-tests.js
```

**Step 2 — E2E tests:**
```bash
NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node /opt/node22/lib/node_modules/playwright/cli.js test --config=e2e/playwright.config.js
```

**Step 3 — Design/test coverage check:**
```bash
node /home/user/finance-tracker/e2e/check-coverage.js
```

Report results for each suite:
- Unit tests: show pass/fail count; on failure, list failing test names and error messages.
- E2E tests: show pass/fail count; on failure, list failing test names and error messages.
- Coverage check: pass or list mismatches (uncovered design features, orphaned describes, orphaned unit suites).

If all three pass, confirm success. If any fails, stop and report the failures — do NOT proceed with any commit or other action.
