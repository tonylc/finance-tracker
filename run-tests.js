#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

// ── 1. Load __financeLib from index.html via VM ──────────────────────────────
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const appScript = indexHtml.match(/<script>([\s\S]*?)<\/script>/)[1];

function mockEl() {
  const el = {
    addEventListener: () => {},
    style:    {},
    innerHTML:   '',
    className:   '',
    disabled:    false,
    value:       '',
    textContent: '',
    dataset:     {},
    checked:     false,
    select:      () => {},
    appendChild:    () => {},
    scrollIntoView: () => {},
    classList: { toggle: () => {}, add: () => {}, remove: () => {} },
  };
  el.querySelector    = () => mockEl();
  el.querySelectorAll = () => ({ forEach: () => {}, length: 0 });
  el.closest          = () => mockEl();
  return el;
}

const appCtx = vm.createContext({
  window:    {},
  crypto:    { randomUUID: () => require('crypto').randomUUID() },
  localStorage: { getItem: () => null, setItem: () => {} },
  document:  {
    getElementById:    mockEl,
    querySelectorAll:  () => ({ forEach: () => {} }),
    createElement:     mockEl,
    querySelector:     mockEl,
    execCommand:       () => {},
  },
  console,
});

try { vm.runInContext(appScript, appCtx); } catch (_) { /* DOM wiring errors expected */ }

const lib = appCtx.window.__financeLib;
if (!lib) {
  console.error('ERROR: Could not extract __financeLib from index.html');
  process.exit(1);
}

// ── 2. Mini test runner (matches tests.html signatures) ──────────────────────
const suites = [];
let currentSuite = null;

function suite(name, fn) {
  currentSuite = { name, tests: [] };
  suites.push(currentSuite);
  fn();
}

function test(name, fn) {
  try {
    fn();
    currentSuite.tests.push({ name, pass: true });
  } catch (e) {
    currentSuite.tests.push({ name, pass: false, err: e.message });
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b) {
  const as = JSON.stringify(a), bs = JSON.stringify(b);
  if (as !== bs) throw new Error(`Expected ${bs}\n  Got     ${as}`);
}

// ── 3. Extract suite() calls from tests.html and run them ────────────────────
const testsHtml = fs.readFileSync(path.join(__dirname, 'tests.html'), 'utf8');
const testsScript = testsHtml.match(/<script>([\s\S]*?)<\/script>/)[1];

// Grab everything from the first suite() call up to (but not including) renderResults()
const suiteStart  = testsScript.indexOf("suite('parseCSV'");
const renderStart = testsScript.indexOf('  renderResults()');
const testBody    = testsScript.slice(suiteStart, renderStart);

// Run tests in the main Node.js context (avoids cross-vm-realm issues with arrays/Sets)
// eslint-disable-next-line no-new-func
const runTestsFn = new Function('suite', 'test', 'assert', 'assertEqual', ...Object.keys(lib), testBody);
runTestsFn(suite, test, assert, assertEqual, ...Object.values(lib));

// ── 4. Report results ────────────────────────────────────────────────────────
let totalPass = 0, totalFail = 0;

for (const s of suites) {
  const p = s.tests.filter(t => t.pass).length;
  console.log(`\n${s.name}  (${p}/${s.tests.length})`);
  for (const t of s.tests) {
    if (t.pass) {
      console.log(`  ✓ ${t.name}`);
      totalPass++;
    } else {
      console.log(`  ✗ ${t.name}\n    ${t.err}`);
      totalFail++;
    }
  }
}

const bar = '─'.repeat(48);
console.log(`\n${bar}`);
if (totalFail === 0) {
  console.log(`✅  All ${totalPass} tests passed`);
} else {
  console.log(`❌  ${totalFail} failed, ${totalPass} passed  (${totalPass + totalFail} total)`);
}
process.exit(totalFail > 0 ? 1 : 0);
