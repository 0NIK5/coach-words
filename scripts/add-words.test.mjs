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
