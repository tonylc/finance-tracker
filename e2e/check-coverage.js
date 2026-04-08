/**
 * check-coverage.js
 *
 * Validates that every `#### Feature Name` heading in the mapped design.md section
 * has a corresponding `test.describe('Feature Name', ...)` in the mapped spec file,
 * and vice-versa.
 *
 * Mapping:
 *   load.spec.js       ↔  ### 2.1 Load
 *   budget.spec.js     ↔  ### 2.2 Budget
 *   categorize.spec.js ↔  ### 2.3 Categorize
 *   settings.spec.js   ↔  ### 2.5 Settings
 *
 * Adding a feature: add `#### Feature Name` in design.md AND
 *                       `test.describe('Feature Name', ...)` in the spec file.
 * Removing a feature: delete both — no gaps, no renumbering.
 */

const fs = require('fs');
const path = require('path');

const SECTION_MAP = {
  'load.spec.js':       '### 2.1 Load',
  'budget.spec.js':     '### 2.2 Budget',
  'categorize.spec.js': '### 2.3 Categorize',
  'settings.spec.js':   '### 2.5 Settings',
};

const designMd = fs.readFileSync(path.join(__dirname, '../docs/design.md'), 'utf8');

function extractSection(md, heading) {
  const start = md.indexOf('\n' + heading);
  if (start === -1) return '';
  const rest = md.slice(start + heading.length + 1);
  const next = rest.search(/\n###\s/);
  return next === -1 ? rest : rest.slice(0, next);
}

function extractH4Headings(sectionText) {
  return [...sectionText.matchAll(/^#### (.+)$/gm)].map(m => m[1].trim());
}

function extractDescribes(src) {
  return [...src.matchAll(/test\.describe\(['"]([^'"]+)['"]/g)].map(m => m[1]);
}

let problems = 0;

for (const [specFile, sectionHeading] of Object.entries(SECTION_MAP)) {
  const specPath = path.join(__dirname, specFile);
  if (!fs.existsSync(specPath)) {
    console.warn(`⚠  Spec file not found: ${specFile}`);
    problems++;
    continue;
  }

  const section = extractSection(designMd, sectionHeading);
  if (!section) {
    console.warn(`⚠  design.md section not found: "${sectionHeading}"`);
    problems++;
    continue;
  }

  const designFeatures = extractH4Headings(section);
  const testDescribes = extractDescribes(fs.readFileSync(specPath, 'utf8'));

  // Uncovered: in design but no test.describe
  for (const feat of designFeatures) {
    if (!testDescribes.includes(feat)) {
      console.warn(`⚠  [${specFile}] Uncovered feature in design.md: "${feat}"`);
      problems++;
    }
  }

  // Orphaned: test.describe but no design #### heading
  for (const desc of testDescribes) {
    if (!designFeatures.includes(desc)) {
      console.warn(`⚠  [${specFile}] Orphaned test.describe (no design.md heading): "${desc}"`);
      problems++;
    }
  }
}

if (problems === 0) {
  console.log('✅  All test.describe blocks have matching design.md headings (and vice versa)');
}
process.exit(problems > 0 ? 1 : 0);
