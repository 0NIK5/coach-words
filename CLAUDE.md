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
- `src/data/words.json` — bundled word database (currently 480 words)
- `src/lib/sm2.ts` — SM-2 algorithm (pure functions)
- `src/lib/db.ts` — IndexedDB CRUD
- `src/lib/session.ts` — session logic (due cards, quiz options, level unlock)
- `src/screens/` — 6 screens: Home, Learning, Quiz, Results, WordList, Settings
- `src/components/` — TabBar, ProgressBar
- `src/App.tsx` — navigation state machine (no router)
- `src/types.ts` — shared TypeScript interfaces

## Word database current state
| Level | Count | Next ID |
|-------|-------|---------|
| A2    | 200   | a2_201  |
| B1    | 140   | b1_141  |
| B2    | 80    | b2_081  |
| C1    | 60    | c1_061  |

## SM-2 algorithm summary
- Correct answer → grade 4, interval grows (1→6→15→38... days)
- Wrong answer → grade 1, interval resets to 1, repetitions = 0
- easeFactor starts at 2.5, min 1.3
- Level unlock: 90% of words at current level have interval ≥ 7

## Word interface (TypeScript)
```ts
interface Word {
  id: string           // e.g. "a2_201"
  word: string         // English word
  translation: string  // Russian translation
  transcription: string // IPA e.g. "/ˈwɜːrd/"
  partOfSpeech: string // noun | verb | adjective | adverb | etc.
  level: 'A2' | 'B1' | 'B2' | 'C1'
  example1: string     // English sentence
  example1_ru: string  // Russian translation of example1
  example2: string     // English sentence
  example2_ru: string  // Russian translation of example2
}
```

## Important rules
- `vite.config.ts` uses `defineConfig` from `vitest/config` (not `vite`) — required for vitest v4
- `base: '/coach-words/'` in vite config — required for GitHub Pages
- Run `npm test` after any logic changes
- Run `npm run build` after any changes to verify no TypeScript errors

## Deployment
Push to `main` → GitHub Actions builds → deploys to GitHub Pages automatically.
