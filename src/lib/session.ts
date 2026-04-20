import type { Word, CardProgress } from '../types'
import { getTodayISO } from './sm2'

export interface QuizOption {
  text: string
  correct: boolean
}

export function buildQuizOptions(
  word: Word,
  allWords: Word[],
  direction: 'en-to-ru' | 'ru-to-en'
): QuizOption[] {
  const correctText = direction === 'en-to-ru' ? word.translation : word.word
  const pool = allWords
    .filter(w => w.id !== word.id)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map(w => direction === 'en-to-ru' ? w.translation : w.word)

  const options: QuizOption[] = [
    { text: correctText, correct: true },
    ...pool.map(text => ({ text, correct: false })),
  ]
  return options.sort(() => Math.random() - 0.5)
}

const LEVELS: Word['level'][] = ['A2', 'B1', 'B2', 'C1']

// Base quotas for new words per session (total = 10)
const BASE_NEW_QUOTA: Record<Word['level'], number> = {
  A2: 3,
  B1: 3,
  B2: 3,
  C1: 1,
}

export function getSessionCards(
  words: Word[],
  progress: CardProgress[]
): { newWords: Word[]; dueCards: Array<{ word: Word; card: CardProgress }> } {
  const progressMap = new Map(progress.map(p => [p.wordId, p]))
  const today = getTodayISO()

  // Available new words per level (status new or no progress)
  const availableNew: Record<Word['level'], Word[]> = {
    A2: [], B1: [], B2: [], C1: [],
  }
  for (const word of words) {
    const p = progressMap.get(word.id)
    if (!p || p.status === 'new') {
      availableNew[word.level].push(word)
    }
  }

  // Calculate quotas: if A2/B1/B2 has fewer words than quota, redistribute to C1
  const quota = { ...BASE_NEW_QUOTA }
  for (const level of ['A2', 'B1', 'B2'] as Word['level'][]) {
    const shortfall = quota[level] - availableNew[level].length
    if (shortfall > 0) {
      quota[level] = availableNew[level].length
      quota['C1'] += shortfall
    }
  }

  // Pick new words according to quota
  const newWords: Word[] = []
  for (const level of LEVELS) {
    const take = Math.min(quota[level], availableNew[level].length)
    newWords.push(...availableNew[level].slice(0, take))
  }

  // Due cards from ALL levels
  const dueCards = words
    .filter(w => {
      const p = progressMap.get(w.id)
      return p && p.status === 'learning' && p.nextReview <= today
    })
    .map(w => ({ word: w, card: progressMap.get(w.id)! }))

  return { newWords, dueCards }
}

export function shouldUnlockNextLevel(
  allWords: Word[],
  progress: CardProgress[],
  level: Word['level']
): boolean {
  const progressMap = new Map(progress.map(p => [p.wordId, p]))
  const levelWords = allWords.filter(w => w.level === level)
  if (levelWords.length === 0) return false

  const learnedCount = levelWords.filter(w => {
    const p = progressMap.get(w.id)
    return p && p.status === 'learning' && p.interval >= 7
  }).length

  return learnedCount / levelWords.length >= 0.9
}

export function getNextLevel(level: Word['level']): Word['level'] | null {
  const levels: Word['level'][] = ['A2', 'B1', 'B2', 'C1']
  const idx = levels.indexOf(level)
  return idx < levels.length - 1 ? levels[idx + 1] : null
}
