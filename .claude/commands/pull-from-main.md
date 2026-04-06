Fetch the latest changes from the remote feature branch and `main`, then verify and push:

1. `BRANCH=$(git branch --show-current)`
2. `git status --porcelain` — stop if any output; tell user to stash or commit first.
3. `git fetch origin $BRANCH main`
4. `git log HEAD..origin/$BRANCH --oneline` — if commits exist, `git rebase origin/$BRANCH`; stop on conflict, show conflicting files.
5. `git rebase origin/main` — stop on conflict, show conflicting files. Do NOT auto-resolve.
6. `node /home/user/finance-tracker/run-tests.js` — stop if any tests fail; do NOT push.
7. `git push --force-with-lease -u origin $BRANCH`

Report: commits pulled from remote branch and from main (if any), test count, push result.
