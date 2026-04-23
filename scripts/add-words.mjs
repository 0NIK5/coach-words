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

function main() {
  const pending = readPending();
  validatePending(pending);
  fail('validation-only stub — remaining logic not implemented');
}

main();
