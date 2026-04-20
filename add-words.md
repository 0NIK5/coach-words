# Adding Words to CoachWords Database

## Overview
This document describes the process for adding new words to the CoachWords vocabulary database.

## Current Database Status
As of latest update (2026-04-20):
- **Total words:** 790
- **A2 (Elementary):** 300 words (a2_001 → a2_300)
- **B1 (Intermediate):** 240 words (b1_001 → b1_240)
- **B2 (Upper-Intermediate):** 135 words (b2_001 → b2_135)
- **C1 (Advanced):** 115 words (c1_001 → c1_115)

## Word Selection Criteria

### A2 Level (Elementary)
- High-frequency everyday vocabulary (top 2000 most common English words)
- Topics: daily life, food, home, family, time, weather, basic emotions, shopping, travel
- Grammar: common verbs, basic adjectives, everyday nouns
- Examples: simple sentences (max 8 words), present/past tense only
- **Avoid:** phrasal verbs, idioms, abstract concepts

### B1 Level (Intermediate)
- Mid-frequency vocabulary needed for everyday communication
- Topics: work, education, society, health, environment, technology, culture
- Grammar: verbs with nuance (achieve, maintain, involve), abstract nouns, conjunctions
- Examples: medium sentences (8-12 words), varied tenses allowed
- **Avoid:** rare academic words, highly technical terms

### B2 Level (Upper-Intermediate)
- Academic and professional vocabulary
- Topics: science, politics, economics, psychology, argumentation
- Grammar: complex verbs (mitigate, scrutinize), formal adjectives, abstract nouns
- Examples: complex sentences (10-14 words)
- **Avoid:** rare literary words, highly specialized jargon

### C1 Level (Advanced)
- Sophisticated, low-frequency vocabulary
- Topics: philosophy, rhetoric, psychology, advanced argumentation, nuanced expression
- Grammar: rare verbs (acquiesce, ameliorate), formal nouns, literary adjectives
- Examples: advanced sentences (12-16 words)
- **Avoid:** extremely rare or archaic words

## Adding Words: Step-by-Step

### 1. Prepare Word List
Create a JSON array with 10 required fields per word:
```json
{
  "id": "a2_301",
  "word": "example",
  "translation": "русский перевод",
  "transcription": "/ɪɡˈzɑːmpəl/",
  "partOfSpeech": "noun",
  "level": "A2",
  "example1": "Simple English sentence.",
  "example1_ru": "Простой русский перевод предложения.",
  "example2": "Another example sentence.",
  "example2_ru": "Русский перевод второго примера."
}
```

### 2. IPA Transcription Rules
- Use British English IPA as primary
- Always use slashes: `/word/`
- Include stress marks: `ˈ` (primary), `ˌ` (secondary)
- Common symbols: `ə æ ɪ ʊ ɒ ʌ ɜː iː uː eɪ aɪ ɔɪ aʊ əʊ ɪə eə ʊə`

### 3. Translation Guidelines
- Use natural Russian, not machine-translated
- Include all main meanings separated by comma
- Max 5 words per translation
- For verb/noun pairs: include both forms

### 4. Example Sentences
- Must use the word (or inflected form)
- Different meanings/contexts for each example
- Must be grammatically correct
- No repeated sentence structures

### 5. Part of Speech Values
Valid values: `noun`, `verb`, `adjective`, `adverb`, `conjunction`, `preposition`, `determiner`, `pronoun`, `noun/verb`, `verb/noun`, `adjective/verb`, `adjective/noun`, `verb/adjective`

### 6. Quality Checks
- [ ] No duplicate words (check existing database)
- [ ] All 10 fields present
- [ ] No empty or null fields
- [ ] IPA transcription correct
- [ ] Examples use the word
- [ ] Russian translations are natural
- [ ] No grammar errors in English

### 7. Update Database
1. Read `src/data/words.json`
2. Find the last word of the target level
3. Append new words before closing `]`
4. Run `npm run build` to verify

### 8. Update Documentation
Update `CLAUDE.md` table:
```markdown
| Level | Count | Next ID |
|-------|-------|---------|
| A2    | 300   | a2_301  |
...
```

## Bulk Addition Strategy
For adding 50+ words at once:
1. Group by level (A2, B1, B2, C1)
2. Generate IDs sequentially
3. Create one large JSON block
4. Single Edit operation to words.json
5. Single build verification

## Recent Additions (2026-04-20)

### Added 200 words (50 per level)
- **A2 (a2_251–a2_300):** ankle, attempt, awake, balance, banner... buffer
- **B1 (b1_191–b1_240):** absorbed, accommodate, accompany, accomplish, accordingly... angle
- **B2 (b2_086–b2_135):** subvert, substantive, succinct, suffice, supposition... tangible
- **C1 (c1_066–c1_115):** ephemeral, epitome, equanimity, esoteric, ethereal... flamboyant

## Performance Notes
- Bundle size increased: 449 KB → 522 KB (gzipped: 127 KB → 145 KB)
- Warning: chunks > 500 KB (consider code splitting if exceeds 600 KB)
- IndexedDB handles large databases efficiently

## Future Considerations
- Consider splitting words.json if exceeds 1000+ entries
- Monitor bundle size and gzip metrics
- Validate IPA transcriptions quarterly
- Update translations for consistency
