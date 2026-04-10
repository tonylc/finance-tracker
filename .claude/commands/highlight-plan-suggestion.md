When the user makes a suggestion during planning that changes the current plan, update the plan .md file as follows:

1. **Add a row to the `## User Suggestions` table** immediately after `## Context`. If the table does not exist yet, create it with this header:

   ```markdown
   ## User Suggestions
   | # | Section affected | Before → After |
   |---|-----------------|----------------|
   ```

   Each row captures the section name, what the original approach was, and what it changed to. Keep entries concise (one line each).

2. **Append an inline marker** to every bullet or line in the plan body that changed:

   ```
   ← CHANGED (see #N)
   ```

   where N is the row number in the User Suggestions table. Do NOT rewrite or remove the original text — only append the marker so the change is visible in context.

3. **Do not re-number existing rows.** New suggestions always get the next available number.

This convention lets the user scan the plan file quickly: the table gives a summary of all user-driven changes; the inline markers show exactly where in the plan each change landed.
