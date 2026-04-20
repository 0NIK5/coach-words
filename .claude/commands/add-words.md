# /add-words — Add new words to the CoachWords database

## Usage
```
/add-words <level> <count>
```
Examples:
- `/add-words A2 20` — add 20 new A2 words
- `/add-words B1 30` — add 30 new B1 words
- `/add-words B2 15` — add 15 new B2 words
- `/add-words C1 10` — add 10 new C1 words

---

## Steps to execute

1. **Read `src/data/words.json`** to find the last ID for the requested level and check existing words (avoid duplicates).

2. **Generate words** following all rules below.

3. **Append** new words to `src/data/words.json` (do not overwrite existing words).

4. **Run `npm run build`** to verify no errors.

5. **Report** how many words were added and the new totals per level.

---

## ID format
Continue from the last existing ID for the level:
- A2: `a2_201`, `a2_202`, ...
- B1: `b1_141`, `b1_142`, ...
- B2: `b2_081`, `b2_082`, ...
- C1: `c1_061`, `c1_062`, ...

Always check the actual last ID in the file before starting — the table in CLAUDE.md may be outdated.

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

## JSON format (strict)

Each word must have ALL 10 fields. No field may be empty or null.

```json
{
  "id": "a2_201",
  "word": "example",
  "translation": "пример",
  "transcription": "/ɪɡˈzɑːmpəl/",
  "partOfSpeech": "noun",
  "level": "A2",
  "example1": "This is a good example.",
  "example1_ru": "Это хороший пример.",
  "example2": "Can you give me an example?",
  "example2_ru": "Можешь привести мне пример?"
}
```

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
Before adding a word, check that `word` field doesn't already exist in the file. If a word exists at a different level, skip it.

---

## After adding words — update CLAUDE.md

Update the word count table in `CLAUDE.md`:

```markdown
| Level | Count | Next ID |
|-------|-------|---------|
| A2    | 220   | a2_221  |
...
```
