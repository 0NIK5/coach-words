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

**Do NOT read `src/data/words.json` or `src/data/Oxford5000.json` directly.** All word selection, deduplication, and Oxford tracking is handled by `scripts/add-words.mjs`.

1. **Run** `node scripts/add-words.mjs <LEVEL> <COUNT>`

2. **Handle exit code:**
   - **Exit 3 (STATUS: NEED_ENRICHMENT):** Read `scripts/pending-words.json`. For each word, fill in these 4 fields:
     - `translation` — natural Russian, max 5 words; use `definition` field as context
     - `example1_ru` — accurate Russian translation of `example1` (not a paraphrase)
     - `example2` — new English example using the word in a different context from `example1`
     - `example2_ru` — Russian translation of `example2`

     Rules: transcription is already set — do NOT change it. Do NOT copy `definition` into output. Follow "Quality rules" below for translation and example style. Change `phase` from `"enrichment"` to `"commit"`. Write the file back to `scripts/pending-words.json`. Then run `node scripts/add-words.mjs` (no arguments).

   - **Exit 0 (STATUS: OK):** Run `npm run build` to verify TypeScript. Report `LEVEL_TOTAL` and `LAST_ID_ASSIGNED` to the user.
   - **Exit 1 (STATUS: ERROR):** Report the `MESSAGE` verbatim to the user. Do not retry.

3. **Never update `CLAUDE.md` manually** — the script handles it.

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

