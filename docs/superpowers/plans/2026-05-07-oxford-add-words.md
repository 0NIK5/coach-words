# Oxford-Based Word Addition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `scripts/add-words.mjs` so it selects words from `src/data/Oxford5000.json` instead of having Claude generate them, with Claude's role reduced to enrichment (translation + second example + Russian translations).

**Architecture:** Two-phase script. SELECT phase (`node add-words.mjs B2 20`) picks random unprocessed words from Oxford, writes `pending-words.json`, exits 3. COMMIT phase (`node add-words.mjs`) reads the Claude-enriched pending file, writes to `words.json`, marks Oxford entries. Progress tracked via `status` field written directly into `Oxford5000.json`.

**Tech Stack:** Node.js ESM (`.mjs`), `node:test` for unit tests, existing `src/data/words.json` + `src/data/Oxford5000.json`.

---

### Task 1: Write failing unit tests + make script importable

Vitest runs in jsdom environment — not suitable for Node CLI scripts. Use the built-in `node:test` runner instead.

**Files:**
- Modify: `scripts/add-words.mjs` (add `fileURLToPath` import + `isMain` guard + `export` on `formatId`)
- Create: `scripts/add-words.test.mjs`

- [ ] **Step 1: Make the script importable without running it**

In `scripts/add-words.mjs`, add `fileURLToPath` to the top import:
```js
import { readFileSync, writeFileSync, renameSync, existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
```

At the bottom, replace `main();` with:
```js
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) main();
```

Add `export` to the existing `formatId` function (only change `function` to `export function` — body stays the same):
```js
export function formatId(level, n) {
  return `${level.toLowerCase()}_${String(n).padStart(3, '0')}`;
}
```

- [ ] **Step 2: Write `scripts/add-words.test.mjs`**

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapOxfordType, formatId, shuffleArray } from './add-words.mjs';

describe('mapOxfordType', () => {
  it('maps direct types', () => {
    assert.equal(mapOxfordType('noun'), 'noun');
    assert.equal(mapOxfordType('verb'), 'verb');
    assert.equal(mapOxfordType('adjective'), 'adjective');
    assert.equal(mapOxfordType('adverb'), 'adverb');
    assert.equal(mapOxfordType('conjunction'), 'conjunction');
    assert.equal(mapOxfordType('preposition'), 'preposition');
    assert.equal(mapOxfordType('determiner'), 'determiner');
    assert.equal(mapOxfordType('pronoun'), 'pronoun');
  });

  it('maps verb subtypes to verb', () => {
    assert.equal(mapOxfordType('auxiliary verb'), 'verb');
    assert.equal(mapOxfordType('modal verb'), 'verb');
    assert.equal(mapOxfordType('linking verb'), 'verb');
  });

  it('returns null for unsupported types', () => {
    assert.equal(mapOxfordType('indefinite article'), null);
    assert.equal(mapOxfordType('definite article'), null);
    assert.equal(mapOxfordType('number'), null);
    assert.equal(mapOxfordType('ordinal number'), null);
    assert.equal(mapOxfordType('exclamation'), null);
    assert.equal(mapOxfordType('infinitive marker'), null);
    assert.equal(mapOxfordType('unknown'), null);
  });
});

describe('formatId', () => {
  it('pads number to 3 digits', () => {
    assert.equal(formatId('B2', 1), 'b2_001');
    assert.equal(formatId('A2', 99), 'a2_099');
    assert.equal(formatId('C1', 700), 'c1_700');
  });
});

describe('shuffleArray', () => {
  it('returns array of same length', () => {
    const arr = [1, 2, 3, 4, 5];
    assert.equal(shuffleArray(arr).length, arr.length);
  });

  it('does not mutate the original array', () => {
    const arr = [1, 2, 3];
    shuffleArray(arr);
    assert.deepEqual(arr, [1, 2, 3]);
  });

  it('contains same elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffleArray(arr);
    assert.deepEqual([...result].sort((a, b) => a - b), [1, 2, 3, 4, 5]);
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL (mapOxfordType and shuffleArray not yet defined)**

```
node --test scripts/add-words.test.mjs
```

Expected: import error — `does not provide an export named 'mapOxfordType'`. This is the TDD red phase.

---

### Task 2: Add SELECT infrastructure (pure functions + selectPhase)

Do NOT touch `main()` in this task — that happens in Task 3.

**Files:**
- Modify: `scripts/add-words.mjs`

- [ ] **Step 1: Add OXFORD constant, remove STATE and MAX_ATTEMPTS**

After `const CLAUDE_MD = resolve(ROOT, 'CLAUDE.md');` add:
```js
const OXFORD = resolve(ROOT, 'src/data/Oxford5000.json');
```

Delete these two lines (no longer needed):
```js
const STATE = resolve(ROOT, 'scripts/.add-words-state.json');
const MAX_ATTEMPTS = 5;
```

- [ ] **Step 2: Add TYPE_MAP and two exported pure functions after `const VALID_LEVELS`**

```js
const TYPE_MAP = {
  'noun': 'noun',
  'verb': 'verb',
  'auxiliary verb': 'verb',
  'modal verb': 'verb',
  'linking verb': 'verb',
  'adjective': 'adjective',
  'adverb': 'adverb',
  'conjunction': 'conjunction',
  'preposition': 'preposition',
  'determiner': 'determiner',
  'pronoun': 'pronoun',
};

export function mapOxfordType(type) {
  return TYPE_MAP[type] ?? null;
}

export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```

- [ ] **Step 3: Run unit tests — expect all 8 to pass (green phase)**

```
node --test scripts/add-words.test.mjs
```

Expected: all 8 assertions pass.

- [ ] **Step 4: Add readOxford and writeOxford helpers after the existing `readExistingWords` function**

```js
function readOxford() {
  try {
    return JSON.parse(readFileSync(OXFORD, 'utf8'));
  } catch (e) {
    fail(`cannot read Oxford5000.json: ${e.message}`);
  }
}

function writeOxford(data) {
  const tmp = `${OXFORD}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, OXFORD);
}
```

- [ ] **Step 5: Add selectPhase function before the existing `main()` function**

```js
function selectPhase(level, count) {
  if (!VALID_LEVELS.has(level)) fail(`Invalid level: ${level}. Must be one of A2, B1, B2, C1`);
  if (!Number.isInteger(count) || count <= 0) fail(`count must be a positive integer, got: ${count}`);

  const oxford = readOxford();
  const existing = readExistingWords();
  const existingSet = buildExistingSet(existing);

  const candidates = shuffleArray(
    Object.entries(oxford).filter(([, e]) => e.cefr === level.toLowerCase() && !e.status)
  );

  const pool = [];
  const toMarkExisting = [];

  for (const [idx, entry] of candidates) {
    if (pool.length >= count) break;

    const partOfSpeech = mapOxfordType(entry.type);
    if (!partOfSpeech) {
      toMarkExisting.push(idx);
      continue;
    }
    if (existingSet.has(entry.word.toLowerCase().trim())) {
      toMarkExisting.push(idx);
      continue;
    }

    pool.push({
      oxfordIndex: idx,
      word: entry.word,
      transcription: entry.phon_br || '',
      partOfSpeech,
      level,
      definition: entry.definition || '',
      example1: entry.example || '',
      translation: '',
      example1_ru: '',
      example2: '',
      example2_ru: '',
    });
  }

  if (pool.length === 0) {
    fail(`No unprocessed words available for level ${level}`);
  }

  for (const idx of toMarkExisting) {
    oxford[idx].status = 'existing';
  }
  writeOxford(oxford);

  writeFileSync(PENDING, JSON.stringify(
    { level, requested: count, phase: 'enrichment', words: pool },
    null, 2
  ));

  report('NEED_ENRICHMENT', { SELECTED: pool.length });
  process.exit(3);
}
```

---

### Task 3: Refactor COMMIT phase and add dispatcher

The old `main()` function contains the commit logic. This task renames it to `commitPhase()`, updates it for the new flow, then adds a new `main()` dispatcher. The key constraint: add `commitPhase()` BEFORE adding the new `main()` so there are never two functions with the same name simultaneously.

**Files:**
- Modify: `scripts/add-words.mjs`

- [ ] **Step 1: Rename the existing `main()` to `commitPhase()` and update its validation**

Change `function main() {` → `function commitPhase() {`.

Replace the `validatePending(pending)` call inside `commitPhase` with `validateCommitPending(pending)`.

Replace the entire `validatePending` function with `validateCommitPending`:
```js
function validateCommitPending(data) {
  if (!data || typeof data !== 'object') fail('pending-words.json must be an object');
  if (data.phase !== 'commit') fail(`expected phase "commit", got "${data.phase}"`);
  if (!VALID_LEVELS.has(data.level)) fail(`invalid or missing level: ${data.level}`);
  if (!Number.isInteger(data.requested) || data.requested <= 0) {
    fail(`requested must be a positive integer, got: ${data.requested}`);
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
```

Note: `REQUIRED_WORD_FIELDS` already contains all 9 fields including `translation`, `example1_ru`, `example2`, `example2_ru` — these will correctly fail validation if left empty, which is exactly what we want.

- [ ] **Step 2: Add Oxford marking inside `commitPhase`, after `writeWordsAtomic(newArray)`**

Add a parallel array `acceptedIndices` alongside `accepted`. In the word-processing loop, push `w.oxfordIndex` to it whenever a word is accepted (same condition as pushing to `accepted`). After `writeWordsAtomic`, add:

```js
const oxford = readOxford();
for (const idx of acceptedIndices) {
  if (idx != null && oxford[idx]) oxford[idx].status = 'added';
}
writeOxford(oxford);
```

The full updated loop in commitPhase:
```js
const accepted = [];
const acceptedIndices = [];
const duplicates = [];

for (const w of pending.words) {
  const key = w.word.toLowerCase().trim();
  if (existingSet.has(key)) {
    duplicates.push(w.word);
  } else {
    lastId += 1;
    accepted.push(buildEntry(formatId(pending.level, lastId), w));
    acceptedIndices.push(w.oxfordIndex);
    existingSet.add(key);
  }
}

const newArray = existing.concat(accepted);
writeWordsAtomic(newArray);

const oxford = readOxford();
for (const idx of acceptedIndices) {
  if (idx != null && oxford[idx]) oxford[idx].status = 'added';
}
writeOxford(oxford);
```

- [ ] **Step 3: Remove exit-2 logic and state file usage from commitPhase**

Delete the entire `if (remaining > 0) { ... }` block that calls `saveState` and exits 2. The COMMIT phase always exits 0 on success — there is no retry loop anymore.

Update `cleanupOnSuccess` to only delete pending file (remove state file deletion):
```js
function cleanupOnSuccess() {
  if (existsSync(PENDING)) unlinkSync(PENDING);
}
```

Delete the `loadState` and `saveState` functions entirely.

Update the final `report('OK', ...)` call to remove the fields that no longer exist (`DUPLICATES_SKIPPED`, `DUPLICATE_WORDS`, `REMAINING_NEEDED`, `ATTEMPT`):
```js
report('OK', {
  ADDED: accepted.length,
  LEVEL_TOTAL: levelTotal,
  LAST_ID_ASSIGNED: formatId(pending.level, lastId),
});
```

- [ ] **Step 4: Add new `main()` dispatcher after `commitPhase()`**

```js
function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    commitPhase();
  } else if (args.length === 2) {
    const level = args[0].toUpperCase();
    const count = parseInt(args[1], 10);
    if (isNaN(count)) fail(`count must be a number, got: ${args[1]}`);
    selectPhase(level, count);
  } else {
    fail('Usage: add-words.mjs [LEVEL COUNT]');
  }
}
```

- [ ] **Step 5: Run unit tests — expect all pass**

```
node --test scripts/add-words.test.mjs
```

Expected: all 8 test cases pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/add-words.mjs scripts/add-words.test.mjs
git commit -m "feat: rewrite add-words.mjs with Oxford SELECT + COMMIT phases"
```

---

### Task 4: Integration test — run the full flow

- [ ] **Step 1: Run SELECT phase with 3 B2 words**

```
node scripts/add-words.mjs B2 3
```

Expected stdout:
```
=== add-words result ===
STATUS: NEED_ENRICHMENT
SELECTED: 3
```

Open `scripts/pending-words.json` and verify it has `phase: "enrichment"`, 3 words, each with `oxfordIndex`, `definition`, `example1` filled from Oxford, and empty `translation`, `example1_ru`, `example2`, `example2_ru`.

- [ ] **Step 2: Simulate Claude enrichment — fill the 4 fields and change phase**

Edit `scripts/pending-words.json`. For each word: fill `translation`, `example1_ru`, `example2`, `example2_ru` with real content. Change `phase` from `"enrichment"` to `"commit"`. Save.

Example of a completed entry:
```json
{
  "oxfordIndex": "1",
  "word": "abandon",
  "transcription": "/əˈbændən/",
  "partOfSpeech": "verb",
  "level": "B2",
  "definition": "to leave somebody with no intention of returning",
  "example1": "The baby had been abandoned by its mother.",
  "translation": "бросать, оставлять",
  "example1_ru": "Мать бросила ребёнка.",
  "example2": "They had to abandon the ship during the storm.",
  "example2_ru": "Во время шторма им пришлось покинуть корабль."
}
```

- [ ] **Step 3: Run COMMIT phase**

```
node scripts/add-words.mjs
```

Expected stdout:
```
=== add-words result ===
STATUS: OK
ADDED: 3
LEVEL_TOTAL: <previous B2 count + 3>
LAST_ID_ASSIGNED: b2_<NNN>
```

- [ ] **Step 4: Verify Oxford5000.json has 3 entries marked "added"**

```
node --input-type=module <<'EOF'
import { readFileSync } from 'fs';
const d = JSON.parse(readFileSync('./src/data/Oxford5000.json', 'utf8'));
const added = Object.values(d).filter(e => e.status === 'added');
console.log('Added count:', added.length);
console.log('Words:', added.map(e => e.word).join(', '));
EOF
```

Expected: `Added count: 3`

- [ ] **Step 5: Verify pending-words.json was deleted**

```
node --input-type=module -e "import { existsSync } from 'fs'; console.log(existsSync('scripts/pending-words.json'));"
```

Expected: `false`

- [ ] **Step 6: Run npm run build**

```
npm run build
```

Expected: no errors.

- [ ] **Step 7: Revert the 3 test words (optional)**

If the 3 test words shouldn't be in production data, remove the last 3 entries from `src/data/words.json`, restore their Oxford entries' `status` field to absent in `Oxford5000.json`, and manually fix CLAUDE.md counts. Skip if words are good additions.

---

### Task 5: Update skill file

**Files:**
- Modify: `.claude/commands/add-words.md`

- [ ] **Step 1: Replace the entire `## Protocol` section (lines 16–41)**

```markdown
## Protocol

**Do NOT read `src/data/words.json` or `src/data/Oxford5000.json` directly.** All word selection, deduplication, and Oxford tracking is handled by `scripts/add-words.mjs`.

1. **Run** `node scripts/add-words.mjs <LEVEL> <COUNT>`

2. **Handle exit code:**
   - **Exit 3 (STATUS: NEED_ENRICHMENT):** Read `scripts/pending-words.json`. For each word, fill in these 4 fields:
     - `translation` — natural Russian, max 5 words; use `definition` field as context
     - `example1_ru` — accurate Russian translation of `example1` (not a paraphrase)
     - `example2` — new English example using the word in a different context from `example1`
     - `example2_ru` — Russian translation of `example2`

     Rules: transcription is already set — do NOT change it. Do NOT copy `definition` into output. Follow "Quality rules" below for translation and example style. Change `phase` from `"enrichment"` to `"commit"`. Write the file back to `scripts/pending-words.json`. Then run `node scripts/add-words.mjs` (no arguments).

   - **Exit 0 (STATUS: OK):** Run `npm run build` to verify TypeScript. Report `LEVEL_TOTAL` and `LAST_ID_ASSIGNED` to the user.
   - **Exit 1 (STATUS: ERROR):** Report the `MESSAGE` verbatim to the user. Do not retry.

3. **Never update `CLAUDE.md` manually** — the script handles it.
```

- [ ] **Step 2: Delete the `### No duplicates` subsection from Quality rules**

Find and delete this block (duplicates are now handled automatically by the script):
```
### No duplicates
The script handles duplicate detection (case-insensitive, across all levels). When the script returns a `DUPLICATE_WORDS` list, exclude those words from your next generation and try different vocabulary.
```

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/add-words.md
git commit -m "feat: update add-words skill for Oxford-based word selection"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run unit tests**

```
node --test scripts/add-words.test.mjs
```

Expected: all 8 pass.

- [ ] **Step 2: Smoke test on C1 level**

```
node scripts/add-words.mjs C1 2
```

Expected: EXIT 3, `pending-words.json` with 2 C1 words. Then clean up:
```bash
rm scripts/pending-words.json
```

- [ ] **Step 3: Run npm run build one final time**

```
npm run build
```

Expected: success.
