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
