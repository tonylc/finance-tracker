Summarize the BDD workflow for this project:

**Phase 1 — Plan (no code yet)**
Produce a plan with a "Test Specifications" section containing real `suite()`/`test()`/`assert()` blocks — not pseudocode. Use descriptive Given/When/Then-style test names. Stop and wait for explicit user approval before touching any file.

**Phase 2 — Implement (after approval)**
1. Add the approved test blocks to `tests.html` before `  renderResults()`, after the last existing suite.
2. Run `node /home/user/finance-tracker/run-tests.js` — confirm new tests **fail** (red).
3. Implement the feature in `index.html`.
4. Run tests again — confirm all pass (green).

**Test name style:** `'given <context>, when <action>, <expected result>'`

**Test insertion point in `tests.html`:** after the last `}); // end of suite`, before `  renderResults()`.

For full details see `CLAUDE.md` § BDD Workflow.
