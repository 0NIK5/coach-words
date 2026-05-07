#!/usr/bin/env node
// scripts/add-words.mjs
// Two-phase word addition from Oxford5000.json to src/data/words.json.
// SELECT phase (with args): picks random Oxford words, exits 3.
// COMMIT phase (no args): validates enriched pending-words.json, writes to DB, exits 0.

import { readFileSync, writeFileSync, renameSync, existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const PENDING = resolve(ROOT, 'scripts/pending-words.json');
const WORDS = resolve(ROOT, 'src/data/words.json');
const CLAUDE_MD = resolve(ROOT, 'CLAUDE.md');
const OXFORD = resolve(ROOT, 'src/data/Oxford5000.json');

const REQUIRED_WORD_FIELDS = [
  'word', 'translation', 'transcription', 'partOfSpeech',
  'level', 'example1', 'example1_ru', 'example2', 'example2_ru',
];
const VALID_LEVELS = new Set(['A2', 'B1', 'B2', 'C1']);

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

export function formatId(level, n) {
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
}

function detectEol(path) {
  const buf = readFileSync(path, 'utf8');
  return buf.includes('\r\n') ? '\r\n' : '\n';
}

function updateClaudeMd(level, newCount, nextId, totalWords) {
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
  let updated = original;
  if (m) {
    const replacement = `${m[1]}${level}${m[2]}${newCount}${m[3]}${nextId}${m[4]}`;
    updated = original.replace(rowRe, replacement);
  } else {
    console.error(`WARNING: CLAUDE.md table row for ${level} not found. Manual update required.`);
  }
  const totalRe = /\(currently \d+ unique words\)/;
  updated = updated.replace(totalRe, `(currently ${totalWords} unique words)`);
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

    const transcription = entry.phon_br || entry.phon_n_am || '';
    if (!transcription) {
      toMarkExisting.push(idx);
      continue;
    }
    const rawExample = entry.example || '';
    const example1 = rawExample.replace(/^[\w\s]+,\s*/, '').trim() || rawExample;
    pool.push({
      oxfordIndex: idx,
      word: entry.word,
      transcription,
      partOfSpeech,
      level,
      definition: entry.definition || '',
      example1,
      translation: '',
      example1_ru: '',
      example2: '',
      example2_ru: '',
    });
  }

  if (pool.length === 0) {
    fail(`No unprocessed words available for level ${level}`);
  }

  if (pool.length < count) {
    console.warn(`WARNING: only ${pool.length} unprocessed words available for level ${level} (requested ${count})`);
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

function commitPhase() {
  const pending = readPending();
  validateCommitPending(pending);

  const existing = readExistingWords();
  const existingSet = buildExistingSet(existing);
  let lastId = computeLastId(existing, pending.level);

  const accepted = [];
  const acceptedIndices = [];

  for (const w of pending.words) {
    const key = w.word.toLowerCase().trim();
    if (existingSet.has(key)) {
      continue;
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

  const levelTotal = newArray.filter(w => w.level === pending.level).length;
  const nextId = formatId(pending.level, lastId + 1);
  updateClaudeMd(pending.level, levelTotal, nextId, newArray.length);
  cleanupOnSuccess();

  report('OK', {
    ADDED: accepted.length,
    LEVEL_TOTAL: levelTotal,
    LAST_ID_ASSIGNED: formatId(pending.level, lastId),
  });
  process.exit(0);
}

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

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) main();
