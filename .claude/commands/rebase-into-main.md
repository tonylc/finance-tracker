From the current feature branch, rebase all its commits cleanly into `main`:

1. Note current branch: `BRANCH=$(git branch --show-current)`
2. Confirm there are no uncommitted changes (`git status --porcelain`). If there are, stop and tell the user to stash or commit first.
3. Run the full test suite: `node /home/user/finance-tracker/run-tests.js`
   - If any tests fail, stop immediately and report which tests failed. Do NOT proceed.
4. Fetch latest main: `git fetch origin main`
5. Rebase feature onto latest main: `git rebase origin/main`
   - If conflicts arise, stop and show the user which files conflict. Do NOT auto-resolve.
6. Re-run the full test suite: `node /home/user/finance-tracker/run-tests.js`
   - If any tests fail after the rebase, stop and report. Do NOT proceed to touch main.
7. Show the commits that will land on main: `git log --oneline origin/main..HEAD`
8. Switch to main: `git checkout main`
9. Fast-forward main to the rebased feature tip: `git merge --ff-only $BRANCH`
10. Push main: `git push -u origin main`
11. Switch back to the original branch: `git checkout $BRANCH`
12. Force-push the feature branch to sync its remote: `git push --force-with-lease -u origin $BRANCH`

After the push, report which branch you started on, how many commits were integrated, confirm main is now up to date, and confirm you are back on the original branch.
