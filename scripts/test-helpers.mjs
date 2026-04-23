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
