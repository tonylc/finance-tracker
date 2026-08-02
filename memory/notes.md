# Finance Tracker — Session Memory

This file is auto-updated after each session compaction. It also serves as a place for Claude to record useful learnings, patterns, and user preferences discovered during sessions.

## Commit Discipline

Pure refactors must always land in a **separate commit** before feature changes. Never mix a refactor with a feature in the same commit.

## Verification

Always run `node /home/user/finance-tracker/run-tests.js` and confirm all tests pass before considering any task complete.

## Design Doc

After every commit, update `docs/design.md` to reflect current state. Written as a product spec with engineering detail underneath. Commit it alongside the code change or as an immediate follow-up.

**Review before committing:** After drafting design doc changes, show the user the diff (what was added/changed/removed) and get acknowledgment before including it in the commit.

## Push Reporting

Always report the result of `git push` explicitly. If the push to remote fails, flag it clearly to the user — a successful local commit is irrelevant if the push failed.

## Refactor Before Patching

When a bug fix doesn't fully resolve the issue and a second (or third) patch is needed
for the same symptom, stop and ask: is the root cause structural? If scattered
responsibilities or a missing single-source-of-truth is the cause, do the refactor first
(in its own commit), then the fix becomes trivial or disappears entirely.

Concrete trigger: if you find yourself writing a second commit to fix the same broken
behavior, treat that as a signal to reconsider the design before writing more patches.

## Test Every Pipeline Stage a Field Touches

When a feature adds a field or behavior that more than one stage of a pipeline reads,
unit-test EVERY stage that touches it — or add one integration/E2E test that crosses the
seam. Testing only the stage with the "interesting" logic leaves the seam untested.

Concrete miss: `description_fallback` was unit-tested in `parseTransaction` (where the
fallback logic lives) but not in `validateImport` (which also reads the description and
runs FIRST). Validation rejected blank-primary rows before the fallback could apply, so
the feature was broken for exactly its intended case. The import path is
`validateImport → parseTransaction`; both read `description`, so both needed coverage.

Do NOT justify skipping an E2E with "behavior is reachable through pure functions" unless
you have actually tested every pure function on the path. "Existing tests already thread
this through" is only true if an existing test exercises THIS specific input case.

---
## 2026-04-04 13:42



---
## 2026-04-08 10:17



---
## 2026-04-08 15:27



---
## 2026-04-10 02:53



---
## 2026-04-17 02:56



---
## 2026-05-08 06:07



---
## 2026-05-20 06:08



---
## 2026-06-04 03:02



---
## 2026-07-25 19:15


