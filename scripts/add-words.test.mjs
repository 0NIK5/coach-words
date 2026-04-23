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

describe('add-words script — schema validation', () => {
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
});

describe('add-words script — ID assignment', () => {
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
});

describe('add-words script — duplicate detection', () => {
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
          makePendingWord('Scrutinize'),
          makePendingWord('  adventure  '),
          makePendingWord('new-word'),
        ],
      },
    });
    const r = runScript(dir);
    expect(r.exitCode).toBe(2);
    const out = parseStdout(r.stdout);
    expect(out.ADDED).toBe('1');
    expect(out.DUPLICATES_SKIPPED).toBe('2');
    expect(out.REMAINING_NEEDED).toBe('2');
    expect(out.DUPLICATE_WORDS.split(', ').sort()).toEqual(['  adventure  ', 'Scrutinize'].sort());
    expect(r.words.find(w => w.word === 'new-word')).toBeTruthy();
    expect(r.words.filter(w => w.word.toLowerCase().trim() === 'scrutinize')).toHaveLength(1);
  });

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
});

describe('add-words script — preservation', () => {
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
    expect(r.words.slice(0, 3)).toEqual(existing);
    expect(r.words[3].word).toBe('delta');
    expect(r.words[4].word).toBe('echo');
    expect(r.words).toHaveLength(5);
  });
});

describe('add-words script — retry state', () => {
  it('accumulates totalAdded across retry attempts via state file', () => {
    const existing = [makeWord('a2_001', 'existing')];
    const dir = fixture({
      existingWords: existing,
      claudeMd: minimalClaudeMd(),
      pending: {
        level: 'A2',
        requested: 3,
        attempt: 1,
        words: [makePendingWord('one'), makePendingWord('existing')],
      },
    });
    const r1 = runScript(dir);
    expect(r1.exitCode).toBe(2);
    expect(r1.state).toEqual({ totalAdded: 1, level: 'A2', requested: 3 });
    expect(r1.stateExists).toBe(true);

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
    expect(out.ADDED).toBe('2');
    expect(r2.words.map(w => w.word)).toEqual(['existing', 'one', 'two', 'three']);
    expect(r2.stateExists).toBe(false);
  });
});
