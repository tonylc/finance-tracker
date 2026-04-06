Fetch the latest changes from both the remote feature branch and `main` into the current branch, then verify the test suite:

1. Note current branch: `BRANCH=$(git branch --show-current)`
2. Confirm there are no uncommitted changes (`git status --porcelain`). If there are, stop and tell the user to stash or commit first.
3. Fetch the remote feature branch: `git fetch origin $BRANCH`
4. Check if the remote branch is ahead of local: `git log HEAD..origin/$BRANCH --oneline`
   - If there are commits, rebase local onto the remote branch: `git rebase origin/$BRANCH`
   - If conflicts arise, stop and show the user which files conflict. Do NOT auto-resolve.
5. Fetch latest main: `git fetch origin main`
6. Rebase current branch onto latest main: `git rebase origin/main`
   - If conflicts arise, stop and show the user which files conflict. Do NOT auto-resolve.
7. Run the full test suite: `node /home/user/finance-tracker/run-tests.js`
   - If any tests fail, stop and report which tests failed. Do NOT push.
8. Push the rebased branch: `git push --force-with-lease -u origin $BRANCH`

After completing, confirm the branch is up to date with main, report how many new commits were pulled in from the remote branch and from main (if any), and confirm all tests passed.
