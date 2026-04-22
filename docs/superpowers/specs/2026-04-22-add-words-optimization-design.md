# Add-Words Command Token Optimization — Design

**Date:** 2026-04-22
**Status:** Draft — pending user approval
**Owner:** Mykyta Danylov

## Problem

The `/add-words` slash command for adding new vocabulary entries to `src/data/words.json` consumes a disproportionate amount of tokens relative to its value. Adding 50 B2 words currently consumes roughly half of a 5-hour Claude session.

### Cost breakdown (current implementation)

| Operation | Tokens |
|-----------|--------|
| Reading `src/data/words.json` (~600 KB, 13,933 lines) | ~150K input |
| Rewriting `words.json` via `Write` (worst case) | ~150K output |
| Reading `CLAUDE.md` | ~3K input |
| Generating 50 words with `id` field in JSON | ~12K output |
| **Total per 50-word run** | **~315K tokens** |

Approximately 96% of the tokens are spent on file mechanics (reading the database, rewriting it, updating the count table). Only ~4% is spent on the actual creative work — producing correct English vocabulary with IPA transcription, Russian translations, and example sentences.

## Goal

Move all file mechanics (reading, deduplication, ID assignment, appending, count-table maintenance) out of Claude and into a Node.js script. Claude retains only the generative work: producing high-quality vocabulary entries according to level-specific rules.

**Target:** Reduce per-run cost from ~315K tokens to ~11K tokens (≈96% reduction).

## Non-Goals

- Changing the format of `src/data/words.json` (must remain backward-compatible with all existing code that imports it)
- Changing the slash command interface (`/add-words <level> <count>` remains identical to the user)
- Replacing the Claude-driven generation with a non-Claude source (quality of examples and translations must remain at current level)
- Optimizing any other slash command

## Architecture

### Artifacts

1. **`scripts/add-words.mjs`** — Node.js ESM script that owns all file mechanics. No external npm dependencies; uses only Node standard library (`node:fs`, `node:path`).
2. **`.claude/commands/add-words.md`** — rewritten command prompt. Retains all word-quality rules (level descriptions, IPA, translation style, example guidelines). Replaces the file-manipulation steps with a short protocol for invoking the script.

### Working files

- **`scripts/pending-words.json`** — temporary exchange file written by Claude and consumed by the script. Deleted by the script on success.
- **`scripts/.add-words-state.json`** — internal state file used by the script to accumulate `totalAdded` across retry attempts. Deleted on success.
- **`src/data/words.json`** — target database. Format unchanged.
- **`CLAUDE.md`** — count table auto-updated by the script.

## Contract between Claude and the script

### Input file: `scripts/pending-words.json`

```json
{
  "level": "B2",
  "requested": 50,
  "attempt": 1,
  "words": [
    {
      "word": "scrutinize",
      "translation": "тщательно изучать",
      "transcription": "/ˈskruːtɪnaɪz/",
      "partOfSpeech": "verb",
      "level": "B2",
      "example1": "The committee will scrutinize the proposal carefully.",
      "example1_ru": "Комитет будет тщательно изучать предложение.",
      "example2": "Scientists scrutinize data before publishing.",
      "example2_ru": "Учёные тщательно изучают данные перед публикацией."
    }
  ]
}
```

**Notes:**
- No `id` field — the script assigns IDs.
- `level` on each word must match the top-level `level`; mismatch is a schema error.
- `attempt` starts at `1`, is incremented by Claude on each retry.

### Invocation

```
node scripts/add-words.mjs
```

No CLI arguments — everything comes from `pending-words.json`.

### Output (stdout)

Human-readable plus a block of machine-parseable `KEY: VALUE` lines:

```
=== add-words result ===
STATUS: OK
ADDED: 47
DUPLICATES_SKIPPED: 3
DUPLICATE_WORDS: achieve, maintain, involve
REMAINING_NEEDED: 0
LAST_ID_ASSIGNED: b2_353
LEVEL_TOTAL: 354
ATTEMPT: 1/5
```

### Exit codes

| Code | Meaning | Claude's next action |
|------|---------|----------------------|
| `0` | All requested words added successfully | Run `npm run build`, report totals to user |
| `2` | Partial success — duplicates reduced count below `requested`, retry needed | Parse `DUPLICATE_WORDS` and `REMAINING_NEEDED`, generate that many new words excluding the duplicate list, increment `attempt`, re-run script |
| `1` | Fatal error (invalid schema, I/O error, exceeded 5 attempts) | Report error to user, stop |

## Script logic

### Pseudocode

```
1. Read pending-words.json → { level, requested, attempt, words }
2. Validate schema:
   - level is one of A2 | B1 | B2 | C1
   - requested is positive integer
   - attempt is 1..5
   - each word has exactly 9 non-empty string fields (word, translation,
     transcription, partOfSpeech, level, example1, example1_ru, example2, example2_ru)
   - each word.level === top-level level
   On failure → print ERROR, exit 1.

3. Read words.json → existingWords (full array).

4. existingWordsSet = Set(existingWords.map(w => w.word.toLowerCase().trim()))

5. lastId = max of numeric suffixes for {level} — e.g. for B2,
   filter ids matching /^b2_(\d+)$/, parse suffix, take max.
   If none exist, start at 0.

6. accepted = [], duplicates = []
   for w of pending.words:
     key = w.word.toLowerCase().trim()
     if existingWordsSet.has(key):
       duplicates.push(w.word)
     else:
       lastId += 1
       accepted.push({ id: `${level.toLowerCase()}_${lastId}`, ...w })
       existingWordsSet.add(key)

7. Load prior attempt state from scripts/.add-words-state.json
   (or { totalAdded: 0, level, requested } if absent).
   If the stored { level, requested } differ from current → discard stale state.
   totalAdded += accepted.length

8. Append accepted entries to words.json via atomic temp-file rewrite:
   - Build the new array: existingWords.concat(accepted).
   - Serialize with JSON.stringify and 2-space indent, matching current file style
     (one object per entry, trailing newline).
   - Write to `src/data/words.json.tmp`.
   - `fs.renameSync(tmp, 'src/data/words.json')` — atomic on NTFS and POSIX.
   - This costs O(filesize) in Node I/O (~600 KB) but zero Claude tokens.

9. remainingNeeded = pending.requested - totalAdded

10. If remainingNeeded > 0:
      - If attempt >= 5 → print ERROR "Too many duplicates after 5 attempts",
        exit 1.
      - Else → save updated state (totalAdded, level, requested),
        print STATUS: NEED_MORE with remainingNeeded and DUPLICATE_WORDS,
        exit 2.

11. remainingNeeded == 0:
      - Update CLAUDE.md count table (see below).
      - Delete pending-words.json and .add-words-state.json.
      - Print STATUS: OK with LEVEL_TOTAL and LAST_ID_ASSIGNED.
      - Exit 0.
```

### Write strategy — atomic temp-file rewrite

Since duplicate detection and last-ID discovery already require parsing the full `words.json`, we reuse the parsed array and write it back atomically:

1. `const newArray = existingWords.concat(accepted);`
2. `const json = JSON.stringify(newArray, null, 2) + '\n';`
3. `fs.writeFileSync('src/data/words.json.tmp', json);`
4. `fs.renameSync('src/data/words.json.tmp', 'src/data/words.json');`

**Why not streaming append:** an in-place `ftruncate` + append would be O(1) on file size but offers no benefit here — the script already holds the full array in memory for dedup. Atomic rename gives crash safety (no half-written file if power fails mid-write) and is simple to test.

**Formatting:** `JSON.stringify(_, null, 2)` produces the same shape the file currently uses (verified by byte-diff in test 4 — adding zero new words should produce a file byte-identical to the original, modulo the trailing newline).

### Duplicate detection

- **Case-insensitive** match on the `word` field, trimmed.
- Matches **across all levels**. A word that exists at A2 is a duplicate when B2 adds it. (Matches current rule from `add-words.md`: "If a word exists at a different level, skip it.")
- Duplicates are reported by their **original casing** from the pending file (for user display and so Claude can exclude them on retry).

### `CLAUDE.md` update

Target section (in `## Word database current state`):

```
| Level | Count | Next ID |
|-------|-------|---------|
| A2    | 315   | a2_316  |
| B1    | 339   | b1_379  |
| B2    | 307   | b2_346  |
| C1    | 215   | c1_216  |
```

**Approach:** regex match the row for the current level and replace.

Regex: `/^\|\s*${LEVEL}\s*\|\s*\d+\s*\|\s*${level.toLowerCase()}_\d+\s*\|\s*$/m`
Replacement: `| ${LEVEL.padEnd(5)} | ${newCount.toString().padEnd(5)} | ${level.toLowerCase()}_${nextId.toString().padStart(3,'0')}  |`

Padding chosen to preserve existing column alignment. Count padding is a best-effort — the markdown table renders correctly regardless of exact whitespace.

**Failure mode:** if the regex finds no match (table was reformatted or moved), the script prints a warning to stderr but does **not** fail. Rationale: the word addition is the critical operation; the table is documentation. Warning text: `WARNING: CLAUDE.md table row for ${LEVEL} not found. Manual update required.`

## New `add-words.md` command prompt — structure

Replace the current **Steps to execute** section with a **Protocol** section:

```markdown
## Protocol

1. Do NOT read `src/data/words.json`. All file mechanics are handled by the script.

2. Generate `<count>` words for the requested level according to the rules below.
   Do NOT include the `id` field — the script assigns IDs.

3. Write the generated words to `scripts/pending-words.json` in this shape:
   { "level": "<LEVEL>", "requested": <count>, "attempt": 1, "words": [ ... ] }

4. Run `node scripts/add-words.mjs`.

5. Parse the stdout. Exit code handling:
   - Exit 0: Run `npm run build`. Report LEVEL_TOTAL and LAST_ID_ASSIGNED to the user.
   - Exit 2: Parse REMAINING_NEEDED and DUPLICATE_WORDS. Generate exactly
     REMAINING_NEEDED new words excluding every word in DUPLICATE_WORDS.
     Write them back to pending-words.json with attempt incremented by 1.
     Re-run the script.
   - Exit 1: Report the error verbatim to the user. Do not retry.

6. Never update CLAUDE.md manually — the script handles it.
```

**Preserved sections** (unchanged from current):
- Usage
- Word selection rules by level (A2 / B1 / B2 / C1)
- Quality rules (transcription / translation / examples / partOfSpeech / no duplicates)
- JSON format (except: remove the `"id"` field from the example, add a note that the script assigns it)

**Removed sections:**
- "ID format" — no longer Claude's concern
- "After adding words — update CLAUDE.md" — handled by the script

## Testing

Create `scripts/add-words.test.mjs` using Vitest. Tests operate on a temporary directory with fixture `words.json` and `CLAUDE.md`.

| # | Test |
|---|------|
| 1 | Assigns sequential IDs starting from the next integer after the last existing id for that level |
| 2 | Case-insensitive duplicate detection (`"Scrutinize"` matches existing `"scrutinize"`) |
| 3 | Duplicate detection works across levels (B2 add rejects a word already present at A2) |
| 4 | Appends preserve all existing entries unchanged (parse file before and after, assert existing entries are deeply equal and appear in the same order, new entries appear at the end) |
| 5 | Returns exit code 2 with correct `REMAINING_NEEDED` when duplicates reduce accepted count below requested |
| 6 | Returns exit code 1 on invalid input schema (missing field, empty field, level mismatch) |
| 7 | Returns exit code 1 after 5 failed attempts with persistent duplicates |
| 8 | Updates `CLAUDE.md` table row for the correct level; preserves other levels |
| 9 | Preserves `CLAUDE.md` and emits warning when table format cannot be matched |
| 10 | State file accumulates `totalAdded` across retry attempts |
| 11 | State file is discarded when level/requested change between invocations |
| 12 | State file and pending-words.json are deleted on exit code 0 |

## Implementation order (TDD)

1. Write tests 1–3 (ID assignment, duplicate detection). Implement just enough of the script to pass.
2. Write test 4 (streaming append). Implement the truncate+append logic.
3. Write tests 5–7 (exit codes, retry, schema). Implement validation and state file.
4. Write tests 8–9 (CLAUDE.md). Implement regex update.
5. Write tests 10–12 (state lifecycle). Implement state cleanup.
6. Rewrite `.claude/commands/add-words.md`.
7. Manual end-to-end test: run `/add-words B2 3` and verify result.

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| `words.json` corruption mid-write (e.g. power loss) | Atomic temp-file rewrite: write to `words.json.tmp`, then `fs.renameSync`. Rename is atomic on NTFS and POSIX. On crash, the original file is preserved intact. |
| Claude ignores the protocol and reads `words.json` anyway | The rewritten command prompt explicitly instructs NOT to read it; if Claude still does, the run still works — just less token-efficient. No correctness risk. |
| `CLAUDE.md` format drift breaks regex replacement | Warning-only failure mode (step 11 of script logic). Manual fix is a one-line edit. |
| Concurrent runs of the script | Not supported. The working files (`pending-words.json`, `.add-words-state.json`) are per-user and per-run. Two parallel `/add-words` invocations would corrupt state. Not a concern for single-developer workflow. |
| Windows line endings vs Unix | The script reads and writes using the file's existing line endings (detect from first read, preserve). `words.json` currently uses `\n`; `CLAUDE.md` on Windows may use `\r\n`. Both handled explicitly. |
| Schema drift in `Word` type | Script validates all 9 required fields. If `src/types.ts` adds a field, tests will catch the mismatch and the script can be updated in one place. |

## Expected savings

| Operation | Before | After |
|-----------|--------|-------|
| Read `words.json` | ~150K input | 0 |
| Rewrite `words.json` | ~150K output (worst case) | 0 |
| Read `CLAUDE.md` | ~3K | 0 |
| Generate 50 words (no `id` field) | ~12K output | ~11K output |
| Run script + parse stdout | — | ~200 tokens |
| **Total per 50-word run** | **~315K tokens** | **~11K tokens** |

**Reduction: ≈96%.** A 5-hour session previously capable of 1–2 runs now supports 20+ runs of 50 words each.

## Out of scope

- Editing `words.json` directly by hand (no tooling change)
- Backup/export features (already handled elsewhere in the app)
- Localization of script output messages (English only, matching other dev tooling)
