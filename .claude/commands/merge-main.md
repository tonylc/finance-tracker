Perform a safe merge of the current feature branch into main:

1. Run the following to get the current branch name:
```bash
git branch --show-current
```
If the branch is `main` or `master`, stop immediately with: "Error: already on main — switch to a feature branch first."

2. Rebase against origin/main:
```bash
git fetch origin main && git rebase origin/main
```
If this fails, stop and tell the user to resolve conflicts before retrying.

3. Run the test suite:
```bash
node /home/user/finance-tracker/run-tests.js
```
If any tests fail, stop and report the failing test names and errors. Do NOT proceed to merge.

4. Merge into main and push:
```bash
git checkout main && git merge --ff-only <branch-from-step-1> && git push -u origin main
```

5. Report success: state which branch was merged and the resulting commit hash on main.
