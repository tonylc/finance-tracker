Update `docs/design.md` to reflect the current state of `index.html`.

1. Read the current `docs/design.md` in full.
2. Read the relevant sections of `index.html` that have changed since the last doc update.
3. Draft the minimal diff needed to bring the doc in sync — update any function signatures, behavior descriptions, data shapes, or engineering details that no longer match the code. Do NOT rewrite sections that are still accurate.
4. Show the user the proposed diff (what was added, changed, or removed) and wait for acknowledgment before writing the file.
5. Once acknowledged, apply the changes and update the `> **Last updated:**` datestamp at the top of the file to today's date with a short description of what changed.
6. Commit: `git add docs/design.md && git commit -m "docs: update design.md — <short description>"`
7. Push: `git push -u origin <current-branch>`
