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

const REQUIRED_WORD_FIELDS = [
  'word', 'translation', 'transcription', 'partOfSpeech',
  'level', 'example1', 'example1_ru', 'example2', 'example2_ru',
];
const VALID_LEVELS = new Set(['A2', 'B1', 'B2', 'C1']);

function fail(msg) {
  console.log('=== add-words result ===');
  console.log('STATUS: ERROR');
  console.log(`MESSAGE: ${msg}`);
  process.exit(1);
}

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

function detectEol(path) {
  const buf = readFileSync(path, 'utf8');
  return buf.includes('\r\n') ? '\r\n' : '\n';
}

function updateClaudeMd(level, newCount, nextId) {
  if (!existsSync(CLAUDE_MD)) {
    console.error(`WARNING: CLAUDE.md not found at ${CLAUDE_MD}`);
    return;
  }
  const eol = detectEol(CLAUDE_MD);
  const original = readFileSync(CLAUDE_MD, 'utf8');
  const prefix = level.toLowerCase();
  const rowRe = new RegExp(
    `^(\\|\\s*)${level}(\\s*\\|\\s*)\\d+(\\s*\\|\\s*)${prefix}_\\d+(\\s*\\|\\s*)$`,
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

function report(status, fields) {
  console.log('=== add-words result ===');
  console.log(`STATUS: ${status}`);
  for (const [k, v] of Object.entries(fields)) {
    console.log(`${k}: ${v}`);
  }
}

function buildExistingSet(existing) {
  const s = new Set();
  for (const w of existing) s.add(w.word.toLowerCase().trim());
  return s;
}

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

  const nextId = formatId(pending.level, lastId + 1);
  updateClaudeMd(pending.level, levelTotal, nextId);
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

main();
