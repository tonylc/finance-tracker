# Finance Tracker — Session Memory

This file is auto-updated after each session compaction. It also serves as a place for Claude to record useful learnings, patterns, and user preferences discovered during sessions.

## Commit Discipline

Pure refactors must always land in a **separate commit** before feature changes. Never mix a refactor with a feature in the same commit.

## Verification

Always run `node /home/user/finance-tracker/run-tests.js` and confirm all tests pass before considering any task complete.

## Design Doc

After every commit, update `docs/design.md` to reflect current state. Written as a product spec with engineering detail underneath. Commit it alongside the code change or as an immediate follow-up.
