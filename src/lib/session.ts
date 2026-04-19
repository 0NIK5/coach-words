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

export function getSessionCards(
  words: Word[],
  progress: CardProgress[],
  currentLevel: Word['level']
): { newWords: Word[]; dueCards: Array<{ word: Word; card: CardProgress }> } {
  const progressMap = new Map(progress.map(p => [p.wordId, p]))
  const today = getTodayISO()

  const levelWords = words.filter(w => w.level === currentLevel)

  const newWords = levelWords.filter(w => {
    const p = progressMap.get(w.id)
    return !p || p.status === 'new'
  })

  const dueCards = levelWords
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
