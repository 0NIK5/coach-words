# Add-Words Token Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all file mechanics of `/add-words` into a Node.js script, reducing per-run Claude token cost from ~315K to ~11K (≈96% reduction).

**Architecture:** New `scripts/add-words.mjs` owns reading `words.json`, deduplication, ID assignment, atomic append, and `CLAUDE.md` table update. Claude writes generated words to `scripts/pending-words.json` and runs the script. On duplicate collisions the script exits with code 2 and a list of dups; Claude regenerates the missing count (up to 5 attempts).

**Tech Stack:** Node.js ESM (`node:fs`, `node:path`), Vitest v4 for tests.

**Spec:** `docs/superpowers/specs/2026-04-22-add-words-optimization-design.md`

---

## File Structure

**New files:**
- `scripts/add-words.mjs` — the script (single file, all logic)
- `scripts/add-words.test.mjs` — Vitest test suite, Node environment
- `scripts/test-helpers.mjs` — shared test fixture/runner helper

**Modified files:**
- `.claude/commands/add-words.md` — rewrite "Steps to execute" as "Protocol"

**Runtime working files (created/deleted by script; not committed):**
- `scripts/pending-words.json` — Claude → script exchange
- `scripts/.add-words-state.json` — retry accumulator

**Git ignores to add (no action; confirm already-ignored):**
- None needed — working files live under `scripts/` and will be auto-deleted; if a run crashes mid-way and leaves them, they are small and git-committable. No gitignore changes.

---

## Task 1: Scaffolding and test harness

**Files:**
- Create: `scripts/add-words.mjs`
- Create: `scripts/add-words.test.mjs`
- Create: `scripts/test-helpers.mjs`

- [ ] **Step 1: Create `scripts/` directory and script stub**

Create `scripts/add-words.mjs`:

```javascript
#!/usr/bin/env node
// scripts/add-words.mjs
// Appends generated vocabulary entries to src/data/words.json.
// Contract: reads scripts/pending-words.json, writes back to words.json,
// updates CLAUDE.md, signals retry via exit code 2.

import { readFileSync, writeFileSync, renameSync, existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const PENDING = resolve(ROOT, 'scripts/pending-words.json');
const STATE = resolve(ROOT, 'scripts/.add-words-state.json');
const WORDS = resolve(ROOT, 'src/data/words.json');
const CLAUDE_MD = resolve(ROOT, 'CLAUDE.md');
const MAX_ATTEMPTS = 5;

function fail(msg) {
  console.log('=== add-words result ===');
  console.log('STATUS: ERROR');
  console.log(`MESSAGE: ${msg}`);
  process.exit(1);
}

function main() {
  fail('not implemented');
}

main();
```

- [ ] **Step 2: Create test helper**

Create `scripts/test-helpers.mjs`:

```javascript
// scripts/test-helpers.mjs
// Creates a temporary project skeleton (src/data/words.json,
// CLAUDE.md, scripts/pending-words.json), runs the script against
// it, and returns exit code + stdout + resulting file contents.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const SCRIPT_SRC = resolve(process.cwd(), 'scripts/add-words.mjs');

export function makeFixture({ existingWords = [], claudeMd = null, pending = null } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'add-words-'));
  mkdirSync(join(dir, 'src/data'), { recursive: true });
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  writeFileSync(join(dir, 'src/data/words.json'), JSON.stringify(existingWords, null, 2));
  if (claudeMd !== null) {
    writeFileSync(join(dir, 'CLAUDE.md'), claudeMd);
  }
  if (pending !== null) {
    writeFileSync(join(dir, 'scripts/pending-words.json'), JSON.stringify(pending, null, 2));
  }
  // Copy the real script into the fixture so it resolves via cwd.
  copyFileSync(SCRIPT_SRC, join(dir, 'scripts/add-words.mjs'));
  return dir;
}

export function runScript(dir) {
  const result = spawnSync('node', ['scripts/add-words.mjs'], {
    cwd: dir,
    encoding: 'utf8',
  });
  return {
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    words: JSON.parse(readFileSync(join(dir, 'src/data/words.json'), 'utf8')),
    claudeMd: existsSync(join(dir, 'CLAUDE.md')) ? readFileSync(join(dir, 'CLAUDE.md'), 'utf8') : null,
    pendingExists: existsSync(join(dir, 'scripts/pending-words.json')),
    stateExists: existsSync(join(dir, 'scripts/.add-words-state.json')),
    state: existsSync(join(dir, 'scripts/.add-words-state.json'))
      ? JSON.parse(readFileSync(join(dir, 'scripts/.add-words-state.json'), 'utf8'))
      : null,
  };
}

export function parseStdout(stdout) {
  const obj = {};
  for (const line of stdout.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+):\s*(.*)$/);
    if (m) obj[m[1]] = m[2];
  }
  return obj;
}

export function makeWord(id, word, level = 'A2', overrides = {}) {
  return {
    id,
    word,
    translation: 'перевод',
    transcription: '/test/',
    partOfSpeech: 'noun',
    level,
    example1: 'Example one.',
    example1_ru: 'Пример один.',
    example2: 'Example two.',
    example2_ru: 'Пример два.',
    ...overrides,
  };
}

export function makePendingWord(word, level = 'A2', overrides = {}) {
  return {
    word,
    translation: 'перевод',
    transcription: '/test/',
    partOfSpeech: 'noun',
    level,
    example1: 'Example one.',
    example1_ru: 'Пример один.',
    example2: 'Example two.',
    example2_ru: 'Пример два.',
    ...overrides,
  };
}

export function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true });
}
```

- [ ] **Step 3: Create test file with a smoke test**

Create `scripts/add-words.test.mjs`:

```javascript
// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeFixture, runScript, parseStdout, makeWord, makePendingWord, cleanup } from './test-helpers.mjs';

let dirs = [];
function fixture(args) {
  const d = makeFixture(args);
  dirs.push(d);
  return d;
}
afterEach(() => {
  dirs.forEach(cleanup);
  dirs = [];
});

function minimalClaudeMd() {
  return [
    '# CoachWords',
    '',
    '## Word database current state',
    '',
    '| Level | Count | Next ID |',
    '|-------|-------|---------|',
    '| A2    | 3     | a2_006  |',
    '| B1    | 1     | b1_011  |',
    '| B2    | 0     | b2_001  |',
    '| C1    | 0     | c1_001  |',
    '',
  ].join('\n');
}

describe('add-words script — smoke', () => {
  it('exits 1 with ERROR when pending-words.json is missing', () => {
    const dir = fixture({ existingWords: [] });
    const r = runScript(dir);
    expect(r.exitCode).toBe(1);
    expect(r.stdout).toContain('STATUS: ERROR');
  });
});
```

(The `minimalClaudeMd` helper and top-level imports are introduced here so that later tasks can use them without re-declaration.)

- [ ] **Step 4: Run test to confirm harness works**

Run: `npm test -- scripts/add-words.test.mjs`

Expected: PASS (1 passing). Current stub prints STATUS: ERROR unconditionally, so smoke test passes.

- [ ] **Step 5: Commit**

```bash
git add scripts/add-words.mjs scripts/add-words.test.mjs scripts/test-helpers.mjs
git commit -m "feat(add-words): scaffold script and test harness"
```

---

## Task 2: Schema validation (exit code 1)

**Files:**
- Modify: `scripts/add-words.mjs`
- Modify: `scripts/add-words.test.mjs`

- [ ] **Step 1: Write failing tests for schema validation**

Append to `scripts/add-words.test.mjs` (inside the describe block):

```javascript
it('exits 1 when level is missing', () => {
  const dir = fixture({
    existingWords: [],
    pending: { requested: 1, attempt: 1, words: [makePendingWord('hello')] },
  });
  const r = runScript(dir);
  expect(r.exitCode).toBe(1);
  expect(r.stdout).toMatch(/STATUS: ERROR/);
  expect(r.stdout).toMatch(/level/i);
});

it('exits 1 when a word has an empty field', () => {
  const bad = makePendingWord('hello');
  bad.translation = '';
  const dir = fixture({
    existingWords: [],
    pending: { level: 'A2', requested: 1, attempt: 1, words: [bad] },
  });
  const r = runScript(dir);
  expect(r.exitCode).toBe(1);
  expect(r.stdout).toMatch(/translation/);
});

it('exits 1 when a word level does not match top-level level', () => {
  const dir = fixture({
    existingWords: [],
    pending: { level: 'A2', requested: 1, attempt: 1, words: [makePendingWord('hello', 'B1')] },
  });
  const r = runScript(dir);
  expect(r.exitCode).toBe(1);
  expect(r.stdout).toMatch(/level mismatch/i);
});

it('exits 1 when attempt exceeds 5', () => {
  const dir = fixture({
    existingWords: [],
    pending: { level: 'A2', requested: 1, attempt: 6, words: [makePendingWord('hello')] },
  });
  const r = runScript(dir);
  expect(r.exitCode).toBe(1);
});
```

- [ ] **Step 2: Run tests — they should fail**

Run: `npm test -- scripts/add-words.test.mjs`

Expected: 4 FAIL, 1 PASS (smoke).

- [ ] **Step 3: Implement schema validation**

Replace the `main()` function in `scripts/add-words.mjs`:

```javascript
const REQUIRED_WORD_FIELDS = [
  'word', 'translation', 'transcription', 'partOfSpeech',
  'level', 'example1', 'example1_ru', 'example2', 'example2_ru',
];
const VALID_LEVELS = new Set(['A2', 'B1', 'B2', 'C1']);

function readPending() {
  if (!existsSync(PENDING)) fail(`pending-words.json not found at ${PENDING}`);
  let raw;
  try {
    raw = readFileSync(PENDING, 'utf8');
  } catch (e) {
    fail(`cannot read pending-words.json: ${e.message}`);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    fail(`pending-words.json is not valid JSON: ${e.message}`);
  }
  return data;
}

function validatePending(data) {
  if (!data || typeof data !== 'object') fail('pending-words.json must be an object');
  if (!VALID_LEVELS.has(data.level)) fail(`invalid or missing level: ${data.level}`);
  if (!Number.isInteger(data.requested) || data.requested <= 0) {
    fail(`requested must be a positive integer, got: ${data.requested}`);
  }
  if (!Number.isInteger(data.attempt) || data.attempt < 1 || data.attempt > MAX_ATTEMPTS) {
    fail(`attempt must be an integer 1..${MAX_ATTEMPTS}, got: ${data.attempt}`);
  }
  if (!Array.isArray(data.words) || data.words.length === 0) {
    fail('words must be a non-empty array');
  }
  data.words.forEach((w, i) => {
    for (const f of REQUIRED_WORD_FIELDS) {
      if (typeof w[f] !== 'string' || w[f].trim() === '') {
        fail(`word[${i}] missing or empty field: ${f}`);
      }
    }
    if (w.level !== data.level) {
      fail(`word[${i}] level mismatch: "${w.level}" does not match top-level "${data.level}"`);
    }
  });
}

function main() {
  const pending = readPending();
  validatePending(pending);
  fail('validation-only stub — remaining logic not implemented');
}

main();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- scripts/add-words.test.mjs`

Expected: 5 PASS (smoke + 4 schema tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/add-words.mjs scripts/add-words.test.mjs
git commit -m "feat(add-words): validate pending-words.json schema"
```

---

## Task 3: ID assignment for a single level

**Files:**
- Modify: `scripts/add-words.mjs`
- Modify: `scripts/add-words.test.mjs`

- [ ] **Step 1: Write failing test**

Append to `scripts/add-words.test.mjs`:

```javascript
it('assigns sequential IDs starting from max existing + 1', () => {
  const existing = [
    makeWord('a2_001', 'advice'),
    makeWord('a2_002', 'adventure'),
    makeWord('a2_005', 'airport'), // gap — should start from 5, not 3
    makeWord('b1_010', 'achieve', 'B1'),
  ];
  const dir = fixture({
    existingWords: existing,
    claudeMd: minimalClaudeMd(),
    pending: {
      level: 'A2',
      requested: 2,
      attempt: 1,
      words: [makePendingWord('apple'), makePendingWord('banana')],
    },
  });
  const r = runScript(dir);
  expect(r.exitCode).toBe(0);
  const out = parseStdout(r.stdout);
  expect(out.LAST_ID_ASSIGNED).toBe('a2_007');
  expect(r.words.find(w => w.word === 'apple').id).toBe('a2_006');
  expect(r.words.find(w => w.word === 'banana').id).toBe('a2_007');
});
```

(`minimalClaudeMd()` is already defined at the top of `add-words.test.mjs` from Task 1.)

- [ ] **Step 2: Run test — it should fail**

Run: `npm test -- scripts/add-words.test.mjs`

Expected: FAIL (script currently exits 1 after validation).

- [ ] **Step 3: Implement reading words.json, lastId, assignIds, writing**

Replace `main()` in `scripts/add-words.mjs` and add supporting functions:

```javascript
function readExistingWords() {
  let raw;
  try {
    raw = readFileSync(WORDS, 'utf8');
  } catch (e) {
    fail(`cannot read words.json: ${e.message}`);
  }
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) fail('words.json must be an array');
    return arr;
  } catch (e) {
    fail(`words.json is not valid JSON: ${e.message}`);
  }
}

function computeLastId(existing, level) {
  const prefix = `${level.toLowerCase()}_`;
  const re = new RegExp(`^${level.toLowerCase()}_(\\d+)$`);
  let max = 0;
  for (const w of existing) {
    const m = w.id && w.id.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return max;
}

function formatId(level, n) {
  return `${level.toLowerCase()}_${String(n).padStart(3, '0')}`;
}

function buildEntry(id, w) {
  // Explicit field ordering to match existing words.json style and
  // to ignore any unexpected fields Claude may include (e.g. `id`).
  return {
    id,
    word: w.word,
    translation: w.translation,
    transcription: w.transcription,
    partOfSpeech: w.partOfSpeech,
    level: w.level,
    example1: w.example1,
    example1_ru: w.example1_ru,
    example2: w.example2,
    example2_ru: w.example2_ru,
  };
}

function writeWordsAtomic(newArray) {
  const json = JSON.stringify(newArray, null, 2);
  const tmp = `${WORDS}.tmp`;
  writeFileSync(tmp, json);
  renameSync(tmp, WORDS);
}

function cleanupOnSuccess() {
  if (existsSync(PENDING)) unlinkSync(PENDING);
  if (existsSync(STATE)) unlinkSync(STATE);
}

function report(status, fields) {
  console.log('=== add-words result ===');
  console.log(`STATUS: ${status}`);
  for (const [k, v] of Object.entries(fields)) {
    console.log(`${k}: ${v}`);
  }
}

function main() {
  const pending = readPending();
  validatePending(pending);

  const existing = readExistingWords();
  let lastId = computeLastId(existing, pending.level);

  const accepted = [];
  for (const w of pending.words) {
    lastId += 1;
    accepted.push(buildEntry(formatId(pending.level, lastId), w));
  }

  const newArray = existing.concat(accepted);
  writeWordsAtomic(newArray);

  const levelTotal = newArray.filter(w => w.level === pending.level).length;
  cleanupOnSuccess();
  report('OK', {
    ADDED: accepted.length,
    DUPLICATES_SKIPPED: 0,
    DUPLICATE_WORDS: '',
    REMAINING_NEEDED: 0,
    LAST_ID_ASSIGNED: formatId(pending.level, lastId),
    LEVEL_TOTAL: levelTotal,
    ATTEMPT: `${pending.attempt}/${MAX_ATTEMPTS}`,
  });
  process.exit(0);
}

main();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- scripts/add-words.test.mjs`

Expected: 6 PASS. The happy-path ID test should pass; schema tests still pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/add-words.mjs scripts/add-words.test.mjs
git commit -m "feat(add-words): assign sequential IDs and append to words.json"
```

---

## Task 4: Case-insensitive duplicate detection (same level)

**Files:**
- Modify: `scripts/add-words.mjs`
- Modify: `scripts/add-words.test.mjs`

- [ ] **Step 1: Write failing test**

Append to `scripts/add-words.test.mjs`:

```javascript
it('detects duplicates case-insensitively and with trim', () => {
  const existing = [
    makeWord('a2_001', 'scrutinize'),
    makeWord('a2_002', 'adventure'),
  ];
  const dir = fixture({
    existingWords: existing,
    claudeMd: minimalClaudeMd(),
    pending: {
      level: 'A2',
      requested: 3,
      attempt: 1,
      words: [
        makePendingWord('Scrutinize'),     // dup (case-insensitive)
        makePendingWord('  adventure  '),  // dup (trim)
        makePendingWord('new-word'),       // accepted
      ],
    },
  });
  const r = runScript(dir);
  // requested 3, only 1 accepted — should exit 2 NEED_MORE
  expect(r.exitCode).toBe(2);
  const out = parseStdout(r.stdout);
  expect(out.ADDED).toBe('1');
  expect(out.DUPLICATES_SKIPPED).toBe('2');
  expect(out.REMAINING_NEEDED).toBe('2');
  expect(out.DUPLICATE_WORDS.split(', ').sort()).toEqual(['  adventure  ', 'Scrutinize'].sort());
  expect(r.words.find(w => w.word === 'new-word')).toBeTruthy();
  expect(r.words.filter(w => w.word.toLowerCase().trim() === 'scrutinize')).toHaveLength(1);
});
```

- [ ] **Step 2: Run test — it should fail**

Run: `npm test -- scripts/add-words.test.mjs`

Expected: FAIL (script currently accepts duplicates; no exit code 2 yet).

- [ ] **Step 3: Implement duplicate detection + NEED_MORE exit**

Modify `main()` in `scripts/add-words.mjs`:

```javascript
function buildExistingSet(existing) {
  const s = new Set();
  for (const w of existing) s.add(w.word.toLowerCase().trim());
  return s;
}

function main() {
  const pending = readPending();
  validatePending(pending);

  const existing = readExistingWords();
  const existingSet = buildExistingSet(existing);
  let lastId = computeLastId(existing, pending.level);

  const accepted = [];
  const duplicates = [];
  for (const w of pending.words) {
    const key = w.word.toLowerCase().trim();
    if (existingSet.has(key)) {
      duplicates.push(w.word);
    } else {
      lastId += 1;
      accepted.push(buildEntry(formatId(pending.level, lastId), w));
      existingSet.add(key);
    }
  }

  const newArray = existing.concat(accepted);
  writeWordsAtomic(newArray);

  const totalAdded = accepted.length;
  const remaining = pending.requested - totalAdded;

  if (remaining > 0) {
    report('NEED_MORE', {
      ADDED: accepted.length,
      DUPLICATES_SKIPPED: duplicates.length,
      DUPLICATE_WORDS: duplicates.join(', '),
      REMAINING_NEEDED: remaining,
      LAST_ID_ASSIGNED: formatId(pending.level, lastId),
      LEVEL_TOTAL: newArray.filter(w => w.level === pending.level).length,
      ATTEMPT: `${pending.attempt}/${MAX_ATTEMPTS}`,
    });
    process.exit(2);
  }

  const levelTotal = newArray.filter(w => w.level === pending.level).length;
  cleanupOnSuccess();
  report('OK', {
    ADDED: accepted.length,
    DUPLICATES_SKIPPED: duplicates.length,
    DUPLICATE_WORDS: duplicates.join(', '),
    REMAINING_NEEDED: 0,
    LAST_ID_ASSIGNED: formatId(pending.level, lastId),
    LEVEL_TOTAL: levelTotal,
    ATTEMPT: `${pending.attempt}/${MAX_ATTEMPTS}`,
  });
  process.exit(0);
}
```

- [ ] **Step 4: Run tests to verify**

Run: `npm test -- scripts/add-words.test.mjs`

Expected: 7 PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/add-words.mjs scripts/add-words.test.mjs
git commit -m "feat(add-words): case-insensitive dedup with NEED_MORE exit code"
```

---

## Task 5: Cross-level duplicate detection

**Files:**
- Modify: `scripts/add-words.test.mjs`

Implementation is already correct (the existingSet contains words from all levels). This task adds the explicit test.

- [ ] **Step 1: Write test**

Append to `scripts/add-words.test.mjs`:

```javascript
it('rejects a word that exists at a different level', () => {
  const existing = [makeWord('a2_001', 'bank', 'A2')];
  const dir = fixture({
    existingWords: existing,
    claudeMd: minimalClaudeMd(),
    pending: {
      level: 'B2',
      requested: 1,
      attempt: 1,
      words: [makePendingWord('bank', 'B2')],
    },
  });
  const r = runScript(dir);
  expect(r.exitCode).toBe(2);
  const out = parseStdout(r.stdout);
  expect(out.DUPLICATES_SKIPPED).toBe('1');
  expect(out.DUPLICATE_WORDS).toBe('bank');
  expect(r.words.filter(w => w.word === 'bank')).toHaveLength(1);
});
```

- [ ] **Step 2: Run tests**

Run: `npm test -- scripts/add-words.test.mjs`

Expected: 8 PASS (test passes without changes, since existingSet spans all levels).

- [ ] **Step 3: Commit**

```bash
git add scripts/add-words.test.mjs
git commit -m "test(add-words): verify cross-level duplicate rejection"
```

---

## Task 6: Atomic write preserves existing entries

**Files:**
- Modify: `scripts/add-words.test.mjs`

- [ ] **Step 1: Write test**

Append to `scripts/add-words.test.mjs`:

```javascript
it('preserves existing entries unchanged and appends new entries at the end', () => {
  const existing = [
    makeWord('a2_001', 'alpha'),
    makeWord('a2_002', 'bravo'),
    makeWord('b1_001', 'charlie', 'B1'),
  ];
  const dir = fixture({
    existingWords: existing,
    claudeMd: minimalClaudeMd(),
    pending: {
      level: 'A2',
      requested: 2,
      attempt: 1,
      words: [makePendingWord('delta'), makePendingWord('echo')],
    },
  });
  const r = runScript(dir);
  expect(r.exitCode).toBe(0);
  // First 3 entries must be the originals, in order, deeply equal.
  expect(r.words.slice(0, 3)).toEqual(existing);
  // Last 2 entries are the new ones, in order.
  expect(r.words[3].word).toBe('delta');
  expect(r.words[4].word).toBe('echo');
  expect(r.words).toHaveLength(5);
});
```

- [ ] **Step 2: Run tests**

Run: `npm test -- scripts/add-words.test.mjs`

Expected: 9 PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/add-words.test.mjs
git commit -m "test(add-words): verify atomic write preserves existing entries"
```

---

## Task 7: Retry state accumulation

**Files:**
- Modify: `scripts/add-words.mjs`
- Modify: `scripts/add-words.test.mjs`

On exit code 2, the script must persist `totalAdded` so that a subsequent invocation (with incremented `attempt` and fresh `words`) accumulates toward the original `requested` count.

- [ ] **Step 1: Write failing test**

Append to `scripts/add-words.test.mjs`:

```javascript
it('accumulates totalAdded across retry attempts via state file', () => {
  const existing = [makeWord('a2_001', 'existing')];
  const dir = fixture({
    existingWords: existing,
    claudeMd: minimalClaudeMd(),
    pending: {
      level: 'A2',
      requested: 3,
      attempt: 1,
      words: [makePendingWord('one'), makePendingWord('existing')], // 1 accepted, 1 dup
    },
  });
  const r1 = runScript(dir);
  expect(r1.exitCode).toBe(2);
  expect(r1.state).toEqual({ totalAdded: 1, level: 'A2', requested: 3 });
  expect(r1.stateExists).toBe(true);

  // Claude would now generate attempt 2 with 2 more words.
  writeFileSync(
    join(dir, 'scripts/pending-words.json'),
    JSON.stringify({
      level: 'A2',
      requested: 3,
      attempt: 2,
      words: [makePendingWord('two'), makePendingWord('three')],
    })
  );
  const r2 = runScript(dir);
  expect(r2.exitCode).toBe(0);
  const out = parseStdout(r2.stdout);
  // ADDED is per-invocation (2); total progress is implicit from requested.
  expect(out.ADDED).toBe('2');
  expect(r2.words.map(w => w.word)).toEqual(['existing', 'one', 'two', 'three']);
  expect(r2.stateExists).toBe(false); // cleaned up
});
```

(`writeFileSync` and `join` are imported at the top of the test file from Task 1.)

- [ ] **Step 2: Run test — it should fail**

Run: `npm test -- scripts/add-words.test.mjs`

Expected: FAIL — state file is never written.

- [ ] **Step 3: Implement state persistence**

Modify `scripts/add-words.mjs`. Add after `cleanupOnSuccess`:

```javascript
function loadState(level, requested) {
  if (!existsSync(STATE)) return { totalAdded: 0, level, requested };
  try {
    const s = JSON.parse(readFileSync(STATE, 'utf8'));
    if (s.level !== level || s.requested !== requested) {
      return { totalAdded: 0, level, requested };
    }
    return s;
  } catch {
    return { totalAdded: 0, level, requested };
  }
}

function saveState(state) {
  writeFileSync(STATE, JSON.stringify(state, null, 2));
}
```

Update `main()` to use state for `totalAdded`:

```javascript
function main() {
  const pending = readPending();
  validatePending(pending);

  const existing = readExistingWords();
  const existingSet = buildExistingSet(existing);
  let lastId = computeLastId(existing, pending.level);

  const accepted = [];
  const duplicates = [];
  for (const w of pending.words) {
    const key = w.word.toLowerCase().trim();
    if (existingSet.has(key)) {
      duplicates.push(w.word);
    } else {
      lastId += 1;
      accepted.push(buildEntry(formatId(pending.level, lastId), w));
      existingSet.add(key);
    }
  }

  const newArray = existing.concat(accepted);
  writeWordsAtomic(newArray);

  const priorState = loadState(pending.level, pending.requested);
  const totalAdded = priorState.totalAdded + accepted.length;
  const remaining = pending.requested - totalAdded;
  const levelTotal = newArray.filter(w => w.level === pending.level).length;

  if (remaining > 0) {
    saveState({ totalAdded, level: pending.level, requested: pending.requested });
    report('NEED_MORE', {
      ADDED: accepted.length,
      DUPLICATES_SKIPPED: duplicates.length,
      DUPLICATE_WORDS: duplicates.join(', '),
      REMAINING_NEEDED: remaining,
      LAST_ID_ASSIGNED: formatId(pending.level, lastId),
      LEVEL_TOTAL: levelTotal,
      ATTEMPT: `${pending.attempt}/${MAX_ATTEMPTS}`,
    });
    process.exit(2);
  }

  cleanupOnSuccess();
  report('OK', {
    ADDED: accepted.length,
    DUPLICATES_SKIPPED: duplicates.length,
    DUPLICATE_WORDS: duplicates.join(', '),
    REMAINING_NEEDED: 0,
    LAST_ID_ASSIGNED: formatId(pending.level, lastId),
    LEVEL_TOTAL: levelTotal,
    ATTEMPT: `${pending.attempt}/${MAX_ATTEMPTS}`,
  });
  process.exit(0);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- scripts/add-words.test.mjs`

Expected: 10 PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/add-words.mjs scripts/add-words.test.mjs
git commit -m "feat(add-words): persist retry state across NEED_MORE invocations"
```

---

## Task 8: Stale state discarded on parameter mismatch

**Files:**
- Modify: `scripts/add-words.test.mjs`

The logic from Task 7 already handles this (mismatched level/requested returns a fresh state). This task adds the explicit test.

- [ ] **Step 1: Write test**

Append to `scripts/add-words.test.mjs`:

```javascript
it('discards stale state when level or requested changes', () => {
  const dir = fixture({
    existingWords: [],
    claudeMd: minimalClaudeMd(),
    pending: {
      level: 'A2',
      requested: 2,
      attempt: 1,
      words: [makePendingWord('alpha')],
    },
  });
  // Inject stale state from a prior, unrelated run.
  writeFileSync(
    join(dir, 'scripts/.add-words-state.json'),
    JSON.stringify({ totalAdded: 99, level: 'B2', requested: 50 })
  );
  const r = runScript(dir);
  // requested 2, accepted 1, stale state ignored → totalAdded = 1, remaining = 1.
  expect(r.exitCode).toBe(2);
  expect(r.state).toEqual({ totalAdded: 1, level: 'A2', requested: 2 });
});
```

- [ ] **Step 2: Run test**

Run: `npm test -- scripts/add-words.test.mjs`

Expected: 11 PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/add-words.test.mjs
git commit -m "test(add-words): verify stale state is discarded on parameter mismatch"
```

---

## Task 9: Max attempts exit with code 1

**Files:**
- Modify: `scripts/add-words.mjs`
- Modify: `scripts/add-words.test.mjs`

- [ ] **Step 1: Write failing test**

Append to `scripts/add-words.test.mjs`:

```javascript
it('exits 1 when remaining > 0 on the 5th attempt', () => {
  const existing = [makeWord('a2_001', 'dup1'), makeWord('a2_002', 'dup2')];
  const dir = fixture({
    existingWords: existing,
    claudeMd: minimalClaudeMd(),
    pending: {
      level: 'A2',
      requested: 3,
      attempt: 5,
      words: [makePendingWord('dup1'), makePendingWord('dup2')],
    },
  });
  // Simulate prior 4 attempts accumulated 0.
  writeFileSync(
    join(dir, 'scripts/.add-words-state.json'),
    JSON.stringify({ totalAdded: 0, level: 'A2', requested: 3 })
  );
  const r = runScript(dir);
  expect(r.exitCode).toBe(1);
  expect(r.stdout).toMatch(/STATUS: ERROR/);
  expect(r.stdout).toMatch(/5 attempts/i);
});
```

- [ ] **Step 2: Run test — it should fail**

Run: `npm test -- scripts/add-words.test.mjs`

Expected: FAIL (current logic would exit 2, not 1).

- [ ] **Step 3: Implement max-attempts guard**

In `scripts/add-words.mjs`, change the `remaining > 0` branch of `main()`:

```javascript
  if (remaining > 0) {
    if (pending.attempt >= MAX_ATTEMPTS) {
      fail(`exhausted ${MAX_ATTEMPTS} attempts; still need ${remaining} more words`);
    }
    saveState({ totalAdded, level: pending.level, requested: pending.requested });
    report('NEED_MORE', {
      ADDED: accepted.length,
      DUPLICATES_SKIPPED: duplicates.length,
      DUPLICATE_WORDS: duplicates.join(', '),
      REMAINING_NEEDED: remaining,
      LAST_ID_ASSIGNED: formatId(pending.level, lastId),
      LEVEL_TOTAL: levelTotal,
      ATTEMPT: `${pending.attempt}/${MAX_ATTEMPTS}`,
    });
    process.exit(2);
  }
```

- [ ] **Step 4: Run tests**

Run: `npm test -- scripts/add-words.test.mjs`

Expected: 12 PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/add-words.mjs scripts/add-words.test.mjs
git commit -m "feat(add-words): exit 1 after 5 exhausted retry attempts"
```

---

## Task 10: Update `CLAUDE.md` count table

**Files:**
- Modify: `scripts/add-words.mjs`
- Modify: `scripts/add-words.test.mjs`

- [ ] **Step 1: Write failing test**

Append to `scripts/add-words.test.mjs`:

```javascript
it('updates CLAUDE.md count and Next ID for the added level', () => {
  const existing = [
    makeWord('a2_001', 'alpha'),
    makeWord('a2_002', 'bravo'),
    makeWord('a2_003', 'charlie'),
  ];
  const dir = fixture({
    existingWords: existing,
    claudeMd: minimalClaudeMd(),
    pending: {
      level: 'A2',
      requested: 2,
      attempt: 1,
      words: [makePendingWord('delta'), makePendingWord('echo')],
    },
  });
  const r = runScript(dir);
  expect(r.exitCode).toBe(0);
  // A2 row updated: 5 entries total, next id a2_006.
  expect(r.claudeMd).toMatch(/\|\s*A2\s*\|\s*5\s*\|\s*a2_006\s*\|/);
  // Other rows untouched.
  expect(r.claudeMd).toMatch(/\|\s*B1\s*\|\s*1\s*\|\s*b1_011\s*\|/);
  expect(r.claudeMd).toMatch(/\|\s*B2\s*\|\s*0\s*\|\s*b2_001\s*\|/);
  expect(r.claudeMd).toMatch(/\|\s*C1\s*\|\s*0\s*\|\s*c1_001\s*\|/);
});
```

- [ ] **Step 2: Run test — it should fail**

Run: `npm test -- scripts/add-words.test.mjs`

Expected: FAIL — script does not yet touch `CLAUDE.md`.

- [ ] **Step 3: Implement CLAUDE.md update**

Add to `scripts/add-words.mjs` after `cleanupOnSuccess`:

```javascript
function updateClaudeMd(level, newCount, nextId) {
  if (!existsSync(CLAUDE_MD)) {
    console.error(`WARNING: CLAUDE.md not found at ${CLAUDE_MD}`);
    return;
  }
  const eol = detectEol(CLAUDE_MD);
  const original = readFileSync(CLAUDE_MD, 'utf8');
  const levelEsc = level;
  const prefix = level.toLowerCase();
  // Match a row like:   | A2    | 315   | a2_316  |
  const rowRe = new RegExp(
    `^(\\|\\s*)${levelEsc}(\\s*\\|\\s*)\\d+(\\s*\\|\\s*)${prefix}_\\d+(\\s*\\|\\s*)$`,
    'm'
  );
  const m = original.match(rowRe);
  if (!m) {
    console.error(`WARNING: CLAUDE.md table row for ${level} not found. Manual update required.`);
    return;
  }
  const replacement = `${m[1]}${level}${m[2]}${newCount}${m[3]}${nextId}${m[4]}`;
  const updated = original.replace(rowRe, replacement);
  const tmp = `${CLAUDE_MD}.tmp`;
  writeFileSync(tmp, eol === '\r\n' ? updated.replace(/\r?\n/g, '\r\n') : updated);
  renameSync(tmp, CLAUDE_MD);
}

function detectEol(path) {
  const buf = readFileSync(path, 'utf8');
  return buf.includes('\r\n') ? '\r\n' : '\n';
}
```

Call it in `main()` immediately before `cleanupOnSuccess()` on the success path:

```javascript
  // ...inside main(), success branch (remaining === 0), before cleanupOnSuccess():
  const nextId = formatId(pending.level, lastId + 1);
  updateClaudeMd(pending.level, levelTotal, nextId);
  cleanupOnSuccess();
```

- [ ] **Step 4: Run tests**

Run: `npm test -- scripts/add-words.test.mjs`

Expected: 13 PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/add-words.mjs scripts/add-words.test.mjs
git commit -m "feat(add-words): auto-update CLAUDE.md count table on success"
```

---

## Task 11: CLAUDE.md unchanged + warning when row format differs

**Files:**
- Modify: `scripts/add-words.test.mjs`

- [ ] **Step 1: Write test**

Append to `scripts/add-words.test.mjs`:

```javascript
it('preserves CLAUDE.md and warns when table row for level is missing', () => {
  const claudeMd = '# CoachWords\n\nNo table here.\n';
  const dir = fixture({
    existingWords: [],
    claudeMd,
    pending: {
      level: 'A2',
      requested: 1,
      attempt: 1,
      words: [makePendingWord('alpha')],
    },
  });
  const r = runScript(dir);
  expect(r.exitCode).toBe(0);
  expect(r.claudeMd).toBe(claudeMd);
  expect(r.stderr).toMatch(/WARNING.*CLAUDE\.md.*A2/);
});
```

- [ ] **Step 2: Run tests**

Run: `npm test -- scripts/add-words.test.mjs`

Expected: 14 PASS (no code change needed — warning branch already implemented).

- [ ] **Step 3: Commit**

```bash
git add scripts/add-words.test.mjs
git commit -m "test(add-words): verify CLAUDE.md preserved when table row absent"
```

---

## Task 12: Cleanup of working files on success

**Files:**
- Modify: `scripts/add-words.test.mjs`

The `cleanupOnSuccess()` already deletes `pending-words.json` and `.add-words-state.json`. This task adds the explicit test.

- [ ] **Step 1: Write test**

Append to `scripts/add-words.test.mjs`:

```javascript
it('deletes pending-words.json and .add-words-state.json on exit 0', () => {
  const dir = fixture({
    existingWords: [],
    claudeMd: minimalClaudeMd(),
    pending: {
      level: 'A2',
      requested: 1,
      attempt: 1,
      words: [makePendingWord('alpha')],
    },
  });
  // Plant a state file that should be cleaned up even though this run is single-shot.
  writeFileSync(
    join(dir, 'scripts/.add-words-state.json'),
    JSON.stringify({ totalAdded: 0, level: 'A2', requested: 1 })
  );
  const r = runScript(dir);
  expect(r.exitCode).toBe(0);
  expect(r.pendingExists).toBe(false);
  expect(r.stateExists).toBe(false);
});

it('keeps working files on exit 2 (NEED_MORE)', () => {
  const existing = [makeWord('a2_001', 'dup')];
  const dir = fixture({
    existingWords: existing,
    claudeMd: minimalClaudeMd(),
    pending: {
      level: 'A2',
      requested: 2,
      attempt: 1,
      words: [makePendingWord('dup')],
    },
  });
  const r = runScript(dir);
  expect(r.exitCode).toBe(2);
  expect(r.stateExists).toBe(true);
  // pending-words.json can be overwritten by Claude; current spec does not
  // require it to persist on exit 2, but also does not require deletion.
  // Leave this assertion out to avoid pinning undecided behavior.
});
```

- [ ] **Step 2: Run tests**

Run: `npm test -- scripts/add-words.test.mjs`

Expected: 16 PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/add-words.test.mjs
git commit -m "test(add-words): verify working files deleted on exit 0"
```

---

## Task 13: Rewrite `.claude/commands/add-words.md`

**Files:**
- Modify: `.claude/commands/add-words.md`

- [ ] **Step 1: Overwrite the file**

Replace the entire content of `.claude/commands/add-words.md` with:

````markdown
# /add-words — Add new words to the CoachWords database

## Usage
```
/add-words <level> <count>
```
Examples:
- `/add-words A2 20` — add 20 new A2 words
- `/add-words B1 30` — add 30 new B1 words
- `/add-words B2 50` — add 50 new B2 words
- `/add-words C1 10` — add 10 new C1 words

---

## Protocol

**Do NOT read `src/data/words.json`.** All file mechanics (reading the database, assigning IDs, deduplication, appending, updating CLAUDE.md) are handled by `scripts/add-words.mjs`. Your job is only to generate high-quality vocabulary entries.

1. **Generate** `<count>` words for the requested level following the rules in "Word selection rules by level" and "Quality rules" below. Do NOT include an `id` field — the script assigns IDs.

2. **Write** the generated words to `scripts/pending-words.json` with this shape:
   ```json
   {
     "level": "<LEVEL>",
     "requested": <count>,
     "attempt": 1,
     "words": [
       { "word": "...", "translation": "...", "transcription": "...", "partOfSpeech": "...", "level": "<LEVEL>", "example1": "...", "example1_ru": "...", "example2": "...", "example2_ru": "..." }
     ]
   }
   ```

3. **Run** `node scripts/add-words.mjs`.

4. **Handle the exit code:**
   - **Exit 0 (STATUS: OK):** Run `npm run build` to verify TypeScript. Report `LEVEL_TOTAL` and `LAST_ID_ASSIGNED` to the user.
   - **Exit 2 (STATUS: NEED_MORE):** Parse `REMAINING_NEEDED` and `DUPLICATE_WORDS` from stdout. Generate exactly `REMAINING_NEEDED` new words, excluding every word listed in `DUPLICATE_WORDS`. Write them back to `scripts/pending-words.json` with `attempt` incremented by 1 (keep same `level` and `requested`). Re-run `node scripts/add-words.mjs`. Repeat until exit 0 or until the script exits 1.
   - **Exit 1 (STATUS: ERROR):** Report the `MESSAGE` verbatim to the user. Do not retry.

5. **Never update `CLAUDE.md` manually** — the script handles it.

---

## Word selection rules by level

### A2 (Elementary)
- High-frequency everyday vocabulary (top 2000 most common English words)
- Topics: daily life, food, home, family, time, weather, basic emotions, shopping, travel
- Grammar: common verbs, basic adjectives, everyday nouns
- Examples: simple, short sentences (max 8 words), present/past tense only
- Avoid: phrasal verbs, idioms, abstract concepts

### B1 (Intermediate)
- Mid-frequency vocabulary needed for everyday communication
- Topics: work, education, society, health, environment, technology, culture
- Grammar: verbs with nuance (achieve, maintain, involve), abstract nouns, conjunctions
- Examples: medium sentences (8-12 words), varied tenses allowed
- Avoid: rare academic words, highly technical terms

### B2 (Upper-Intermediate)
- Academic and professional vocabulary
- Topics: science, politics, economics, psychology, argumentation
- Grammar: complex verbs (mitigate, scrutinize), formal adjectives, abstract nouns
- Examples: complex sentences showing word in context (10-14 words)
- Avoid: rare literary words, highly specialized jargon

### C1 (Advanced)
- Sophisticated, low-frequency vocabulary
- Topics: philosophy, rhetoric, psychology, advanced argumentation, nuanced expression
- Grammar: rare verbs (acquiesce, ameliorate), formal nouns, literary adjectives
- Examples: advanced sentences showing precise meaning and register (12-16 words)
- Avoid: extremely rare or archaic words that native speakers wouldn't know

---

## Quality rules

### Transcription (IPA)
- Always use IPA format with slashes: `/ˈwɜːrd/`
- Use British English IPA as primary
- Stress marks required: `ˈ` (primary), `ˌ` (secondary)
- Common symbols: `ə æ ɪ ʊ ɒ ʌ ɜː iː uː eɪ aɪ ɔɪ aʊ əʊ ɪə eə ʊə`

### Translation (Russian)
- Use natural Russian, not machine-translated
- Include all main meanings separated by comma: `"решать, принимать решение"`
- For verb/noun pairs include both: `"обещать, обещание"`
- Max 5 words in translation

### Examples
- `example1` and `example2` must use the word (or its inflected form)
- Both examples must be different in meaning/context
- `example1_ru` must be accurate translation of `example1` (not paraphrase)
- Sentences must be grammatically correct natural English
- Avoid repeating the same sentence structure in both examples

### partOfSpeech values
Use one of: `noun`, `verb`, `adjective`, `adverb`, `conjunction`, `preposition`, `determiner`, `pronoun`, `noun/verb`, `verb/noun`, `adjective/verb`, `adjective/noun`, `verb/adjective`

### No duplicates
The script handles duplicate detection (case-insensitive, across all levels). When the script returns a `DUPLICATE_WORDS` list, exclude those words from your next generation and try different vocabulary.
````

- [ ] **Step 2: Verify by reading it back**

Run: `head -30 ".claude/commands/add-words.md"` — confirm the new "Protocol" section is present and the "Steps to execute" / "ID format" / "After adding words — update CLAUDE.md" sections are gone.

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/add-words.md
git commit -m "refactor(add-words): rewrite command prompt to use script protocol"
```

---

## Task 14: Full-suite verification

**Files:** (no file changes)

- [ ] **Step 1: Run full test suite**

Run: `npm test`

Expected: all existing tests pass + all new add-words tests pass. No regressions.

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: TypeScript compiles, Vite build succeeds (the script is pure `.mjs` and not part of the bundle, but the build verifies no collateral damage).

- [ ] **Step 3: Verify no leftover working files**

Run: `ls scripts/pending-words.json scripts/.add-words-state.json 2>/dev/null` — expected: both report "No such file or directory".

If either exists, delete it (residual from a prior development run that wasn't cleaned).

---

## Task 15: Manual end-to-end smoke test

**Goal:** Verify the full Claude → script → `words.json` flow with a tiny real run.

- [ ] **Step 1: Run `/add-words B2 3` in Claude Code**

In a fresh Claude session, invoke `/add-words B2 3`. Claude should:
1. Not read `words.json`.
2. Generate 3 B2 words and write them to `scripts/pending-words.json`.
3. Run `node scripts/add-words.mjs`.
4. Parse `STATUS: OK` from stdout.
5. Run `npm run build`.
6. Report `LEVEL_TOTAL` and `LAST_ID_ASSIGNED` to the user.

- [ ] **Step 2: Verify post-conditions**

Run these checks:

```bash
# No working files left behind
ls scripts/pending-words.json scripts/.add-words-state.json 2>/dev/null
# Expected: both absent

# CLAUDE.md B2 count increased by 3
grep "| B2" CLAUDE.md
# Expected: count is 310, next id is b2_349

# words.json contains the 3 new entries at the end
tail -40 src/data/words.json
# Expected: 3 new B2 word objects with ids b2_346, b2_347, b2_348
```

- [ ] **Step 3: Token-cost sanity check**

Note the approximate token usage reported by Claude Code for the run. For 3 words the run should consume well under 5K tokens total (target is ~11K for 50 words, so 3 words ≈ 1–2K).

If the run is dramatically over budget (e.g. >30K tokens), inspect the transcript: Claude likely read `words.json` or `CLAUDE.md` despite the prompt instruction. Tighten the "Do NOT read" directive and retry.

- [ ] **Step 4: Commit the 3 new words (if the run's content looks good)**

```bash
git add src/data/words.json CLAUDE.md
git commit -m "chore(vocab): add 3 B2 words via new /add-words flow (smoke test)"
```

---

## Acceptance Criteria

- `npm test` passes (including all 14+ new script tests)
- `npm run build` passes
- `/add-words B2 3` end-to-end consumes <5K tokens and adds 3 valid B2 entries
- `scripts/pending-words.json` and `scripts/.add-words-state.json` are absent after a successful run
- `CLAUDE.md` count table reflects the new total
- If a generation produces duplicates, the script emits exit 2 and Claude retries up to 4 more times; a persistent collision chain fails cleanly with exit 1

---

## Out of scope (not implemented by this plan)

- Bulk add beyond one level per invocation (still single-level per run)
- Parallel/concurrent runs (single-developer assumption; working files are not lock-protected)
- Restoring `words.json` from backup if the script crashes mid-rename (atomic rename makes this unnecessary, but no explicit disaster-recovery tooling)
- Migrating pre-existing inconsistencies in `words.json` (e.g. duplicate IDs, malformed entries) — the script trusts the input file
