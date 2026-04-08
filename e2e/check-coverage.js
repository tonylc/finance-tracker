/**
 * check-coverage.js
 *
 * Validates that every test.describe('N.M Feature Name') in e2e/*.spec.js has
 * coverage in docs/design.md. The mapping is:
 *   1.x → design.md § 2.1 Load
 *   2.x → design.md § 2.2 Budget
 *   3.x → design.md § 2.3 Categorize
 *   4.x → design.md § 2.5 Settings
 *
 * For each describe block the feature keywords (words from the name, ignoring
 * the N.M prefix) must appear in the corresponding design.md section.
 */

const fs = require('fs');
const path = require('path');

const designMdPath = path.join(__dirname, '../docs/design.md');
const designMd = fs.readFileSync(designMdPath, 'utf8');

// Split design.md into labelled sections
const sections = {
  load: extractSection(designMd, '### 2.1 Load'),
  budget: extractSection(designMd, '### 2.2 Budget'),
  categorize: extractSection(designMd, '### 2.3 Categorize'),
  settings: extractSection(designMd, '### 2.5 Settings'),
};

function extractSection(md, heading) {
  const start = md.indexOf(heading);
  if (start === -1) return '';
  // Find next same-level heading (###) or end of file
  const rest = md.slice(start + heading.length);
  const nextHeading = rest.search(/\n###\s/);
  return nextHeading === -1 ? rest : rest.slice(0, nextHeading);
}

const TAB_MAP = { '1': 'load', '2': 'budget', '3': 'categorize', '4': 'settings' };

// Collect all test.describe('N.M ...') from spec files
const specFiles = fs.readdirSync(__dirname).filter(f => f.endsWith('.spec.js'));
const describes = [];

for (const f of specFiles) {
  const src = fs.readFileSync(path.join(__dirname, f), 'utf8');
  for (const m of src.matchAll(/test\.describe\(['"]([^'"]+)['"]/g)) {
    describes.push(m[1]);
  }
}

let missing = 0;

for (const desc of describes) {
  const m = desc.match(/^(\d+)\.(\d+)\s+(.*)/);
  if (!m) continue; // skip describes without N.M prefix

  const tabKey = TAB_MAP[m[1]];
  if (!tabKey) {
    console.warn(`⚠  Unknown tab prefix '${m[1]}' in: "${desc}"`);
    missing++;
    continue;
  }

  const section = sections[tabKey];
  if (!section) {
    console.warn(`⚠  design.md section for tab '${tabKey}' not found`);
    missing++;
    continue;
  }

  // Check that at least one significant keyword from the feature name appears
  // in the design.md section (case-insensitive). Stop-words are excluded.
  const stopWords = new Set(['and', 'or', 'the', 'a', 'an', 'in', 'of', 'to', 'for', 'via', 'with', 'per']);
  const keywords = m[3].split(/[\s\/\-–—]+/).filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()));
  const lowerSection = section.toLowerCase();
  const found = keywords.some(kw => lowerSection.includes(kw.toLowerCase()));

  if (!found) {
    console.warn(`⚠  No design.md coverage for: "${desc}" (checked keywords: ${keywords.join(', ')})`);
    missing++;
  }
}

if (missing === 0) {
  console.log('✅  All test.describe blocks have design.md coverage');
}
process.exit(missing > 0 ? 1 : 0);
