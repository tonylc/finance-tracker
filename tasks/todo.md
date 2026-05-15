# LLM Category Preprocessing

## Goal

Two related changes:
1. **Account import — expose `"category"` field**: the Settings `inputCsvFormat` helper text doesn't document `"category"` or `"fix"` even though the backend already parses them. Make them first-class by updating the UI copy and adding a note that category values must be valid subcategories (child, not parent).
2. **LLM preprocessing on Categorize page**: a new "Categorize with AI" button that sends uncategorized transactions to the Claude API and pre-fills suggestions. User reviews and fixes before export.

---

## What already works (no changes needed)

- `buildHeaderMap` already handles `"category"` and `"fix"` in `inputCsvFormat`.
- `validateImport` already rejects category values not in `VALID_CATS` (subcategories only — parent names like "Food" are not in that set, so they already fail validation).

---

## Part 1 — Account Import: expose `"category"` in Settings UI

### Change
Update the helper text on the Settings account form (currently line 686 in index.html):

**Before:**
> Allowed values: `"date"`, `"description"`, `"amount"`, `"debit_amount"`, `"credit_amount"`, `null` (skip).

**After:**
> Allowed values: `"date"`, `"description"`, `"amount"`, `"debit_amount"`, `"credit_amount"`, `"category"`, `"fix"`, `null` (skip). Category values must be valid subcategory names (e.g. `"Groceries"`, not `"Food"`).

No library or logic changes — this is documentation only.

---

## Part 2 — LLM Category Preprocessing

### New library functions (pure, unit-testable)

**`buildCategorizationPrompt(transactions, subcategories) → string`**
- `transactions`: `Array<{ id: string, description: string }>`
- `subcategories`: `string[]` (ALL_SUBS)
- Returns a prompt string instructing the LLM to return a JSON object `{ id: subcategoryName, ... }` using only the provided subcategory names.

**`parseCategorizationResponse(responseText, validCats) → Map<string, string>`**
- `responseText`: raw LLM response (expected to be a JSON object string)
- `validCats`: `Set<string>` (VALID_CATS)
- Returns a Map of id → valid subcategory name.
- Silently drops entries whose value is not in `validCats` (catches parent names, hallucinations).
- Returns empty Map on JSON parse failure.

### New Settings field — Anthropic API key

- Add a text input `#anthropic-api-key` in the Settings view (below the account section).
- A "Save" button stores the value to `localStorage` under key `"anthropic_api_key"` (not exported with account JSON).
- On Settings load, populate the input from localStorage.
- Input is type `password` so the key isn't plainly visible.

### Categorize page — "Categorize with AI" button

- Button `#ai-categorize-btn` appears in the Categorize header, **only when** an API key is stored in localStorage AND catSession has at least one uncategorized transaction.
- On click: collect `{ id, description }` for all uncategorized transactions → call `buildCategorizationPrompt` → POST to `https://api.anthropic.com/v1/messages` → call `parseCategorizationResponse` → apply valid results to `catSession` → re-render.
- While request is in-flight: button shows "Working…" and is disabled.
- On success: button label reverts; a status line shows "AI suggested N categories — please review."
- On error (network, bad key, etc.): show an inline error message near the button.
- The actual fetch call lives in the UI layer (not in `__financeLib`) so the library stays pure.

### Claude API call details
- Model: `claude-haiku-4-5-20251001` (cheap, fast, good at classification)
- `max_tokens`: 1024
- Single user message containing the prompt from `buildCategorizationPrompt`
- Response: `response.content[0].text` parsed by `parseCategorizationResponse`

---

## Design Doc Changes

### Under `### 2.3 Categorize` — add:
```
#### LLM Category Preprocessing
"Categorize with AI" button in the Categorize header. Visible only when an Anthropic API key
is stored (see §2.5) and at least one transaction is uncategorized. Sends descriptions to
claude-haiku; suggestions are applied to catSession for user review. Parent-category names
and unrecognised values are silently dropped.
```

### Under `### 2.5 Settings` — add:
```
#### Anthropic API Key
Password input to store the user's Anthropic API key in localStorage ("anthropic_api_key").
Not included in account export JSON. Used by LLM features (§2.3 Categorize).
```

### Under `### 2.5 Settings` account format description — update:
Note that `"category"` and `"fix"` are valid column types, and that category values must be
valid subcategory names.

### Under `## 4. Library Functions` — add:
- `buildCategorizationPrompt(transactions, subcategories) → string`
- `parseCategorizationResponse(responseText, validCats) → Map<string, string>`

---

## Test Specifications

### Unit tests (`tests.html`) — new suite under `§2.3 Categorize`

```javascript
// ── buildCategorizationPrompt ──────────────────────────────────────────────
suite('buildCategorizationPrompt', () => {
  test('includes all subcategory names in prompt', () => {
    const txs = [{ id: 'a', description: 'WALMART' }];
    const prompt = buildCategorizationPrompt(txs, ['Groceries', 'Restaurants']);
    assert(prompt.includes('Groceries'), 'prompt includes Groceries');
    assert(prompt.includes('Restaurants'), 'prompt includes Restaurants');
  });

  test('includes each transaction id and description', () => {
    const txs = [
      { id: 'tx-1', description: 'STARBUCKS #1234' },
      { id: 'tx-2', description: 'SHELL OIL' },
    ];
    const prompt = buildCategorizationPrompt(txs, ['Coffee / Bakery', 'Gas / EV Charging / Toll']);
    assert(prompt.includes('tx-1'), 'prompt includes tx-1');
    assert(prompt.includes('STARBUCKS #1234'), 'prompt includes description');
    assert(prompt.includes('tx-2'), 'prompt includes tx-2');
  });

  test('returns a non-empty string', () => {
    const prompt = buildCategorizationPrompt([{ id: 'x', description: 'TEST' }], ['Misc']);
    assert(typeof prompt === 'string' && prompt.length > 0, 'prompt is non-empty string');
  });
});

// ── parseCategorizationResponse ───────────────────────────────────────────
suite('parseCategorizationResponse', () => {
  test('parses valid JSON mapping of id to subcategory', () => {
    const validCats = new Set(['Groceries', 'Restaurants']);
    const result = parseCategorizationResponse(
      JSON.stringify({ tx1: 'Groceries', tx2: 'Restaurants' }),
      validCats
    );
    assertEqual(result.get('tx1'), 'Groceries');
    assertEqual(result.get('tx2'), 'Restaurants');
  });

  test('filters out parent category names not in validCats', () => {
    const validCats = new Set(['Groceries']);
    const result = parseCategorizationResponse(
      JSON.stringify({ tx1: 'Food', tx2: 'Groceries' }),
      validCats
    );
    assert(!result.has('tx1'), 'parent category "Food" filtered out');
    assertEqual(result.get('tx2'), 'Groceries');
  });

  test('filters out hallucinated category names', () => {
    const validCats = new Set(['Groceries']);
    const result = parseCategorizationResponse(
      JSON.stringify({ tx1: 'Made Up Category', tx2: 'Groceries' }),
      validCats
    );
    assert(!result.has('tx1'), 'hallucination filtered out');
  });

  test('returns empty Map on invalid JSON', () => {
    const result = parseCategorizationResponse('not valid json', new Set(['Groceries']));
    assertEqual(result.size, 0);
  });

  test('returns empty Map on empty string', () => {
    const result = parseCategorizationResponse('', new Set(['Groceries']));
    assertEqual(result.size, 0);
  });

  test('returns empty Map when response is a JSON array instead of object', () => {
    const result = parseCategorizationResponse('["Groceries"]', new Set(['Groceries']));
    assertEqual(result.size, 0);
  });
});
```

### E2E tests (`e2e/categorize.spec.js`) — new describe block

```javascript
test.describe('LLM Category Preprocessing', () => {
  test('given API key stored and uncategorized transactions, AI Categorize button is visible', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('anthropic_api_key', 'sk-ant-test-key');
    });
    await seedTransactions(page); // at least one uncategorized transaction in catSession
    await page.goto('index.html');
    await page.click('[data-tab="categorize"]');
    await expect(page.locator('#ai-categorize-btn')).toBeVisible();
  });

  test('given no API key stored, AI Categorize button is not visible', async ({ page }) => {
    await seedTransactions(page);
    await page.goto('index.html');
    await page.click('[data-tab="categorize"]');
    await expect(page.locator('#ai-categorize-btn')).not.toBeVisible();
  });

  test('given API key but all transactions already categorized, AI Categorize button is not visible', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('anthropic_api_key', 'sk-ant-test-key');
    });
    await seedFullyCategorizedTransactions(page);
    await page.goto('index.html');
    await page.click('[data-tab="categorize"]');
    await expect(page.locator('#ai-categorize-btn')).not.toBeVisible();
  });
});
```

### E2E tests (`e2e/settings.spec.js`) — new describe block

```javascript
test.describe('Anthropic API Key', () => {
  test('given API key entered and saved, it persists across page reload', async ({ page }) => {
    await page.goto('index.html');
    await page.click('[data-tab="settings"]');
    await page.fill('#anthropic-api-key', 'sk-ant-test-key');
    await page.click('#save-api-key-btn');
    await page.goto('index.html');
    await page.click('[data-tab="settings"]');
    await expect(page.locator('#anthropic-api-key')).toHaveValue('sk-ant-test-key');
  });

  test('given saved key cleared and saved again, key is removed', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('anthropic_api_key', 'sk-ant-old'));
    await page.goto('index.html');
    await page.click('[data-tab="settings"]');
    await page.fill('#anthropic-api-key', '');
    await page.click('#save-api-key-btn');
    await page.goto('index.html');
    await page.click('[data-tab="settings"]');
    await expect(page.locator('#anthropic-api-key')).toHaveValue('');
  });
});
```

---

## Implementation Order

- [ ] Commit 1 (settings UI copy): Update `inputCsvFormat` helper text to document `"category"` and `"fix"`. Update design.md. Tests pass.
- [ ] Commit 2 (library): Add `buildCategorizationPrompt` and `parseCategorizationResponse` to `__financeLib`. Write failing unit tests, implement, verify passing.
- [ ] Commit 3 (settings — API key): Add `#anthropic-api-key` input + save button in Settings view. Write failing E2E tests, implement, verify passing. Update design.md.
- [ ] Commit 4 (categorize — AI button): Add `#ai-categorize-btn` to Categorize view, wire up fetch to Anthropic API. Write failing E2E tests, implement, verify passing. Update design.md.
