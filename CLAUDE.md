# verify we good workflow

Before starting any planned work, always rebase against `origin/main` first:

```bash
git fetch origin main && git rebase origin/main
```

This keeps the branch current and surfaces conflicts early.

## Memory

When you discover something worth remembering across sessions — a user preference, a recurring pattern, a key decision — append it to `memory/notes.md`. Keep entries concise and useful.

## BDD Workflow — Required for All Feature Work

For any task that involves adding or changing application behavior, follow this two-phase process without exception.

### Phase 1 — Plan with Test Specifications (before writing any code)

When asked to implement a feature or fix, produce a written plan that includes a **"Test Specifications"** section. This section must contain the actual test code for **both** suites — not pseudocode, not descriptions, but the real blocks that will be pasted into the files:

- **Unit tests:** `suite()`/`test()`/`assert()` blocks for `tests.html`
- **E2E tests:** `test.describe()`/`test()` blocks for the appropriate `e2e/*.spec.js` file

Also include a **"Design Doc Changes"** section showing exactly what will be added, changed, or removed in `docs/design.md` — new `#### Feature Name` headings, updated engineering specs, revised data shapes, etc.

Use descriptive test names that read like behavior specs:
- `'given <context>, when <action>, <expected result>'`
- or a plain declarative statement of the expected behavior

Example Test Specifications section:

**Unit tests (`tests.html`):**
```javascript
suite('formatCurrency', () => {
  test('given a negative number, formats with minus sign and two decimals', () => {
    assertEqual(formatCurrency(-1234.5), '-$1,234.50');
  });

  test('given zero, returns $0.00', () => {
    assertEqual(formatCurrency(0), '$0.00');
  });
});
```

**E2E tests (`e2e/load.spec.js` or whichever spec applies):**
```javascript
test.describe('Feature Name', () => {
  test('given context, when action, expected result', async ({ page }) => {
    await seedAccounts(page);
    await page.goto('index.html');
    // ...
  });
});
```

**Stop after presenting the plan. Do not write any files. Wait for the user to explicitly approve.**

### Phase 2 — Implement (only after user approves the plan)

Once the user approves, proceed in this strict order:

1. **Update `docs/design.md`** with the approved changes from the "Design Doc Changes" section.

2. **Write both sets of failing tests.**
   - Add the approved `suite()`/`test()` blocks to `tests.html` in the matching section (see **Testing Pyramid** below for structure). Use the existing comment separator style (`// ── SuiteName ──...`).
   - Add the approved `test.describe()`/`test()` blocks to the appropriate `e2e/*.spec.js` file.
   - Run `/tests` — both the new unit tests and the new E2E tests must fail at this point.

3. **Implement the source code.** Make the changes to `index.html` needed to make the new tests pass.

4. **Verify all tests pass.** Run `/tests` and confirm both suites are green before committing.

5. **If implementation required changes** from the approved plan (different function signature, new data field, revised behaviour), go back and update `docs/design.md` and the tests to match before committing.

### Scope

Apply this workflow for:
- Any new function or symbol added to `__financeLib`
- Any behavioral change to an existing library function
- Any UI feature that depends on new or changed library logic

## Testing Pyramid

**Unit tests** (`tests.html`) exhaustively cover all behaviors, edge cases, and error conditions for every library function in `__financeLib`. If a behavior can be exercised through a pure function, it belongs here.

**E2E tests** (`e2e/*.spec.js`) verify UI wiring — not behavior. For each `#### Feature Name` in design.md, the E2E suite needs:
- **One success path** showing the feature works end-to-end through the browser
- **One error path** per distinct error *presentation* (different UI feedback = distinct)

Do **not** repeat in E2E what unit tests already prove. If `buildHeaderMap` unit tests cover 8 validation cases, the E2E only needs one case to confirm errors surface in the form.

**Push coverage down whenever possible.** If a behavior can be tested via a library function in `tests.html`, test it there. Only escalate to E2E when the behavior is UI-specific (DOM state, focus, rendering) or cannot be reached through a library function.

### `tests.html` structure

Organized to mirror design.md. View-specific suites go under their view heading; suites shared across views cluster under a "Shared" heading:

```
§2.2 Budget           — filterByMonth, aggregateByCategory, totalSpend, getMonthList
§2.3 Categorize       — cycleCategoryByKey, validateExport
§2.5 Settings         — isValidLast4, formatAccountKey, exportAccountsJSON, importAccountsJSON
Shared — Import Pipeline  (§2.1 Load · §2.3 Categorize · §2.5 Settings)
                      — parseCSV, buildHeaderMap, validateImport, parseTransaction,
                        deduplicateTransactions
Shared — Search & Sort    (§2.2 Budget · §2.3 Categorize)
                      — sortByDateDesc, sortByDateAsc, filterBySearch
Shared — Export           (§2.1 Load · §2.3 Categorize)
                      — toCSV
```

When adding tests for a new feature, insert the suite in the matching section.

### Naming Conventions

| Layer | Convention | Enforced by |
|---|---|---|
| E2E `test.describe` label | Must exactly match the `#### Feature Name` heading in the mapped design.md section | `check-coverage.js` — bidirectional |
| Unit `suite()` name | Must exactly match a function name listed in design.md `## 4. Library Functions` | `check-coverage.js` — suite→design only |
| `tests.html` section banner | `// ══ §X.Y Name ══` matching the `### X.Y Name` heading | Convention only (not enforced) |

## Commit Discipline

Pure refactors must always land in a **separate commit** before feature changes. Never mix a refactor with a feature in the same commit.

**Before every commit:** Run `/tests` and confirm both suites pass. Never commit with a failing test suite.

## E2E Testing — Playwright

E2E tests live in `e2e/*.spec.js`. Each `test.describe` label uses a plain feature name (no numbers) matching the `#### Feature Name` sub-heading in the corresponding `docs/design.md` section:

| Spec file | design.md section |
|-----------|-------------------|
| `load.spec.js` | `### 2.1 Load` |
| `budget.spec.js` | `### 2.2 Budget` |
| `categorize.spec.js` | `### 2.3 Categorize` |
| `settings.spec.js` | `### 2.5 Settings` |

**When adding or changing a feature, add/update both the `#### Feature Name` heading in `docs/design.md` and the matching `test.describe` block in the spec file in the same commit.**

Run coverage check: `node e2e/check-coverage.js`
Run all tests: `/tests`
