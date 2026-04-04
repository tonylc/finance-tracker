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

When asked to implement a feature or fix, produce a written plan that includes a **"Test Specifications"** section. This section must contain the actual test code — not pseudocode, not a description of tests, but the real `suite()`/`test()`/`assert()` blocks that will be pasted into `tests.html`.

Use descriptive test names that read like behavior specs:
- `'given <context>, when <action>, <expected result>'`
- or a plain declarative statement of the expected behavior

Example Test Specifications section:

```javascript
suite('formatCurrency', () => {
  test('given a negative number, formats with minus sign and two decimals', () => {
    assertEqual(formatCurrency(-1234.5), '-$1,234.50');
  });

  test('given zero, returns $0.00', () => {
    assertEqual(formatCurrency(0), '$0.00');
  });

  test('given a positive number, formats with dollar sign and commas', () => {
    assertEqual(formatCurrency(9999.99), '$9,999.99');
  });
});
```

**Stop after presenting the plan. Do not write any files. Wait for the user to explicitly approve.**

### Phase 2 — Implement (only after user approves the plan)

Once the user approves, proceed in this strict order:

1. **Write the failing tests first.** Add the approved `suite()`/`test()` blocks to `tests.html`, inserted before the `  renderResults()` call and after the last existing suite. Use the existing comment separator style (`// ── SuiteName ──...`). Run `node /home/user/finance-tracker/run-tests.js` — the new tests must fail at this point.

2. **Implement the source code.** Make the changes to `index.html` needed to make the new tests pass.

3. **Verify all tests pass.** Run `node /home/user/finance-tracker/run-tests.js` and confirm the full suite is green before committing.

### Scope

Apply this workflow for:
- Any new function or symbol added to `__financeLib`
- Any behavioral change to an existing library function
- Any UI feature that depends on new or changed library logic

## Commit Discipline

Pure refactors must always land in a **separate commit** before feature changes. Never mix a refactor with a feature in the same commit.

## Design Doc — Required After Every Commit

After every commit, update `docs/design.md` to reflect the current state of the code. The doc is structured as a **product spec** (what the product does and why, written for a reader who hasn't seen the code) with a **detailed engineering specification** beneath each section (data shapes, function signatures, algorithms, constraints).

The doc must stay in sync with the code — it is the authoritative reference for any future work.

Commit the updated design doc in the same commit as the code change it describes, or as an immediate follow-up commit if the code change was already committed.
