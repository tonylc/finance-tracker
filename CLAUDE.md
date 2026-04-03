# verify we good workflow

Before starting any planned work, always rebase against `origin/main` first:

```bash
git fetch origin main && git rebase origin/main
```

This keeps the branch current and surfaces conflicts early.
