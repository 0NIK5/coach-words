# /add-words — Add new words to the CoachWords database

## Usage
```
/add-words <level> <count>
```
Examples:
- `/add-words A2 20` — add 20 new A2 words
- `/add-words B1 30` — add 30 new B1 words
- `/add-words B2 50` — add 50 new B2 words
- `/add-words C1 10` — add 10 new C1 words

---

## Protocol

**Do NOT read `src/data/words.json`.** All file mechanics (reading the database, assigning IDs, deduplication, appending, updating CLAUDE.md) are handled by `scripts/add-words.mjs`. Your job is only to generate high-quality vocabulary entries.

1. **Generate** `<count>` words for the requested level following the rules in "Word selection rules by level" and "Quality rules" below. Do NOT include an `id` field — the script assigns IDs.

2. **Write** the generated words to `scripts/pending-words.json` with this shape:
   ```json
   {
     "level": "<LEVEL>",
     "requested": <count>,
     "attempt": 1,
     "words": [
       { "word": "...", "translation": "...", "transcription": "...", "partOfSpeech": "...", "level": "<LEVEL>", "example1": "...", "example1_ru": "...", "example2": "...", "example2_ru": "..." }
     ]
   }
   ```

3. **Run** `node scripts/add-words.mjs`.

4. **Handle the exit code:**
   - **Exit 0 (STATUS: OK):** Run `npm run build` to verify TypeScript. Report `LEVEL_TOTAL` and `LAST_ID_ASSIGNED` to the user.
   - **Exit 2 (STATUS: NEED_MORE):** Parse `REMAINING_NEEDED` and `DUPLICATE_WORDS` from stdout. Generate exactly `REMAINING_NEEDED` new words, excluding every word listed in `DUPLICATE_WORDS`. Write them back to `scripts/pending-words.json` with `attempt` incremented by 1 (keep same `level` and `requested`). Re-run `node scripts/add-words.mjs`. Repeat until exit 0 or until the script exits 1.
   - **Exit 1 (STATUS: ERROR):** Report the `MESSAGE` verbatim to the user. Do not retry.

5. **Never update `CLAUDE.md` manually** — the script handles it.

---

## Word selection rules by level

### A2 (Elementary)
- High-frequency everyday vocabulary (top 2000 most common English words)
- Topics: daily life, food, home, family, time, weather, basic emotions, shopping, travel
- Grammar: common verbs, basic adjectives, everyday nouns
- Examples: simple, short sentences (max 8 words), present/past tense only
- Avoid: phrasal verbs, idioms, abstract concepts

### B1 (Intermediate)
- Mid-frequency vocabulary needed for everyday communication
- Topics: work, education, society, health, environment, technology, culture
- Grammar: verbs with nuance (achieve, maintain, involve), abstract nouns, conjunctions
- Examples: medium sentences (8-12 words), varied tenses allowed
- Avoid: rare academic words, highly technical terms

### B2 (Upper-Intermediate)
- Academic and professional vocabulary
- Topics: science, politics, economics, psychology, argumentation
- Grammar: complex verbs (mitigate, scrutinize), formal adjectives, abstract nouns
- Examples: complex sentences showing word in context (10-14 words)
- Avoid: rare literary words, highly specialized jargon

### C1 (Advanced)
- Sophisticated, low-frequency vocabulary
- Topics: philosophy, rhetoric, psychology, advanced argumentation, nuanced expression
- Grammar: rare verbs (acquiesce, ameliorate), formal nouns, literary adjectives
- Examples: advanced sentences showing precise meaning and register (12-16 words)
- Avoid: extremely rare or archaic words that native speakers wouldn't know

---

## Quality rules

### Transcription (IPA)
- Always use IPA format with slashes: `/ˈwɜːrd/`
- Use British English IPA as primary
- Stress marks required: `ˈ` (primary), `ˌ` (secondary)
- Common symbols: `ə æ ɪ ʊ ɒ ʌ ɜː iː uː eɪ aɪ ɔɪ aʊ əʊ ɪə eə ʊə`

### Translation (Russian)
- Use natural Russian, not machine-translated
- Include all main meanings separated by comma: `"решать, принимать решение"`
- For verb/noun pairs include both: `"обещать, обещание"`
- Max 5 words in translation

### Examples
- `example1` and `example2` must use the word (or its inflected form)
- Both examples must be different in meaning/context
- `example1_ru` must be accurate translation of `example1` (not paraphrase)
- Sentences must be grammatically correct natural English
- Avoid repeating the same sentence structure in both examples

### partOfSpeech values
Use one of: `noun`, `verb`, `adjective`, `adverb`, `conjunction`, `preposition`, `determiner`, `pronoun`, `noun/verb`, `verb/noun`, `adjective/verb`, `adjective/noun`, `verb/adjective`

### No duplicates
The script handles duplicate detection (case-insensitive, across all levels). When the script returns a `DUPLICATE_WORDS` list, exclude those words from your next generation and try different vocabulary.
