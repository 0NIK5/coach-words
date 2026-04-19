export interface Word {
  id: string
  word: string
  translation: string
  transcription: string
  partOfSpeech: string
  level: 'A2' | 'B1' | 'B2' | 'C1'
  example1: string
  example1_ru: string
  example2: string
  example2_ru: string
}

export interface CardProgress {
  wordId: string
  status: 'new' | 'learning' | 'skipped'
  easeFactor: number
  interval: number
  repetitions: number
  nextReview: string // ISO date string YYYY-MM-DD
}

export interface AppSettings {
  currentLevel: 'A2' | 'B1' | 'B2' | 'C1'
  streak: number
  lastStudyDate: string // ISO date YYYY-MM-DD
}

export type Screen =
  | 'home'
  | 'learning'
  | 'quiz'
  | 'results'
  | 'wordlist'
  | 'settings'

export interface SessionResult {
  correct: number
  total: number
}
