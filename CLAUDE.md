# CoachWords — Project Context for Claude

## What this project is
A PWA (Progressive Web App) for memorizing English vocabulary using the SM-2 spaced repetition algorithm. Built with React 18 + TypeScript + Vite + Tailwind CSS. Hosted on GitHub Pages at https://0nik5.github.io/coach-words/

## Tech stack
- React 18 + TypeScript + Vite 8
- Tailwind CSS v3 (dark theme: slate-900 bg, green-400 accents)
- IndexedDB via `idb` library (local storage, no backend)
- vite-plugin-pwa (Service Worker + manifest)
- Vitest + @testing-library/react
- GitHub Actions → GitHub Pages deployment

## Key architecture
- `src/data/words.json` — bundled word database (currently 1161 unique words)
- `src/lib/sm2.ts` — SM-2 algorithm (pure functions)
- `src/lib/db.ts` — IndexedDB CRUD
- `src/lib/session.ts` — session logic (due cards, quiz options, level unlock, reserve pool)
- `src/screens/` — 6 screens: Home, Learning, Quiz, Results, WordList, Settings
- `src/components/` — TabBar, ProgressBar
- `src/App.tsx` — navigation state machine (no router), owns reservePool state
- `src/types.ts` — shared TypeScript interfaces

## Word database current state
| Level | Count | Next ID |
|-------|-------|---------|
| A2    | 413   | a2_449  |
| B1    | 439   | b1_479  |
| B2    | 357   | b2_396  |
| C1    | 210   | c1_226  |

---

## Business Logic

### Session flow
```
Home → [new words exist] → Learning → [due cards exist] → Quiz → Results → Home
Home → [no new words]   → Quiz → Results → Home
Home → [nothing today]  → shows "На сегодня готово"
```

### Daily session composition
Each day a session is built with up to **10 new words** split across levels:

| Level | Base quota | Notes |
|-------|-----------|-------|
| A2    | 3 words   | If fewer available, shortfall → C1 |
| B1    | 3 words   | If fewer available, shortfall → C1 |
| B2    | 3 words   | If fewer available, shortfall → C1 |
| C1    | 1 word    | Receives redistributed quota |

Example: if A2 has only 1 word left → C1 gets 1 + 2 = 3 words that day.

**Due cards** (words whose `nextReview ≤ today`) are collected from **all levels** with no quota limit — all due cards are always shown.

### Reserve pool
When the session is built, all available new words **not included in the session quota** are stored as `reservePool` in `App.tsx` state.

**When a user presses ⚡ Знаю (skip):**
1. Word is saved to IndexedDB with `status: 'skipped'` — never shown again
2. A replacement is pulled from `reservePool` (same level preferred, any level as fallback)
3. Replacement is appended to the end of the current learning list
4. Counter updates: was `5/10` → becomes `5/11`
5. If reserve pool is empty — session continues without replacement

### Learning Screen (new words — status: 'new')
Shows full word card: word, transcription, translation, part of speech, 2 examples with Russian.

| Button | Action |
|--------|--------|
| ↩️ Ещё раз | Stay on same word (re-read) |
| ✓ Запомнил | Save as `status:'learning'`, `interval:1`, `nextReview: tomorrow` |
| ⚡ Знаю | Save as `status:'skipped'`, pull replacement from reserve pool |

### Quiz Screen (due words — status: 'learning', nextReview ≤ today)
- Random direction each card: EN→RU or RU→EN
- 4 answer options (1 correct + 3 random from full word database)
- After answer: show correct answer + example sentence
- Uses `correctRef = useRef(0)` (not useState) to avoid React batching bug when calling `onComplete`

| Result | SM-2 outcome |
|--------|-------------|
| Correct | grade=4, interval grows |
| Wrong   | grade=1, interval resets to 1, repetitions=0 |

### SM-2 algorithm (`src/lib/sm2.ts`)
```
Correct answer (grade = 4):
  repetitions = 0 → interval = 1 day
  repetitions = 1 → interval = 6 days
  repetitions ≥ 2 → interval = round(interval × easeFactor)
  repetitions++

Wrong answer (grade = 1):
  repetitions = 0
  interval = 1 day

easeFactor = easeFactor + (0.1 - (5 - grade) × (0.08 + (5 - grade) × 0.02))
easeFactor = max(1.3, easeFactor)
nextReview = today + interval days
```

Typical interval progression for correct answers: **1 → 6 → 15 → 38 → 95 days...**

### Word statuses
| Status | Meaning |
|--------|---------|
| `new` | Not yet introduced (no IndexedDB record, or record with status:'new') |
| `learning` | Introduced, in spaced repetition cycle |
| `skipped` | User pressed ⚡ Знаю — never shown in sessions again |

### Level progression (display only)
`shouldUnlockNextLevel` returns true when **90% of words** at a level have `interval ≥ 7`.
This is used to auto-advance `currentLevel` in `AppSettings` for display purposes in SettingsScreen stats. It does **not** gate word delivery — all levels are always in the session mix.

### Backup / restore (Settings screen)
- **Export**: downloads `coachwords-backup-YYYY-MM-DD.json` with `{ version:1, exportedAt, settings, progress }`
- **Import**: reads JSON file, validates `version===1`, restores progress and settings to IndexedDB

### Streak logic
- First study ever → streak = 1
- Study on consecutive day → streak + 1
- Miss a day → streak resets to 1
- Study twice same day → streak unchanged

---

## TypeScript interfaces

```ts
interface Word {
  id: string            // "a2_201"
  word: string          // English word
  translation: string   // Russian translation
  transcription: string // IPA "/ˈwɜːrd/"
  partOfSpeech: string  // noun | verb | adjective | adverb | conjunction | preposition | etc.
  level: 'A2' | 'B1' | 'B2' | 'C1'
  example1: string
  example1_ru: string
  example2: string
  example2_ru: string
}

interface CardProgress {
  wordId: string
  status: 'new' | 'learning' | 'skipped'
  easeFactor: number    // starts at 2.5, min 1.3
  interval: number      // days until next review
  repetitions: number
  nextReview: string    // ISO date "2026-04-21"
}

interface AppSettings {
  currentLevel: 'A2' | 'B1' | 'B2' | 'C1'  // for display only
  streak: number
  lastStudyDate: string  // ISO date
}
```

---

## Important technical rules
- `vite.config.ts` uses `defineConfig` from `vitest/config` (not `vite`) — required for vitest v4
- `base: '/coach-words/'` in vite config — required for GitHub Pages
- `start_url: '/coach-words/'` and `scope: '/coach-words/'` in PWA manifest
- Run `npm test` after any logic changes
- Run `npm run build` after any changes to verify no TypeScript errors

## Deployment
Push to `main` → GitHub Actions (`npm ci --legacy-peer-deps` + `npm run build`) → deploys to GitHub Pages automatically.
