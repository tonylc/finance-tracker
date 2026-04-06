Rebase the current feature branch cleanly onto `main` and fast-forward main:

1. `BRANCH=$(git branch --show-current)`
2. `git status --porcelain` — stop if any output; tell user to stash or commit first.
3. `node /home/user/finance-tracker/run-tests.js` — stop if any tests fail; do NOT proceed.
4. `git fetch origin main && git rebase origin/main` — stop on conflict, show conflicting files. Do NOT auto-resolve.
5. `node /home/user/finance-tracker/run-tests.js` — stop if any tests fail; do NOT proceed.
6. `git log --oneline origin/main..HEAD` — show commits about to land on main.
7. `git checkout main && git merge --ff-only $BRANCH`
8. `git push -u origin main`
9. `git checkout $BRANCH && git push --force-with-lease -u origin $BRANCH`

Report: starting branch, number of commits integrated, push results, current branch.
