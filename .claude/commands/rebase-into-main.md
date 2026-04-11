Rebase the current feature branch cleanly onto `main` and fast-forward main:

1. `BRANCH=$(git branch --show-current)`
2. `git status --porcelain` — stop if any output; tell user to stash or commit first.
3. `git fetch origin main && git rebase origin/main` — stop on conflict, show conflicting files. Do NOT auto-resolve.
4. Run `/tests` — stop if any tests fail; do NOT proceed.
5. `git log --oneline origin/main..HEAD` — show commits about to land on main.
6. `git checkout main && git merge --ff-only $BRANCH`
7. `git push -u origin main`
8. `git checkout $BRANCH && git push --force-with-lease -u origin $BRANCH`

Report: starting branch, number of commits integrated, push results, current branch.
