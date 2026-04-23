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
