import { describe, it, expect } from 'vitest'
import { buildQuizOptions, getSessionCards, shouldUnlockNextLevel } from './session'
import type { Word, CardProgress } from '../types'

const makeWord = (id: string, level: Word['level'] = 'A2'): Word => ({
  id, word: `word_${id}`, translation: `перевод_${id}`,
  transcription: '/test/', partOfSpeech: 'noun', level,
  example1: 'ex1', example1_ru: 'пр1', example2: 'ex2', example2_ru: 'пр2',
})

const makeCard = (wordId: string, status: CardProgress['status'], nextReview: string, interval = 1): CardProgress => ({
  wordId, status, easeFactor: 2.5, interval, repetitions: 1, nextReview,
})

describe('buildQuizOptions', () => {
  it('returns 4 options including the correct answer', () => {
    const words = Array.from({ length: 10 }, (_, i) => makeWord(`w${i}`))
    const options = buildQuizOptions(words[0], words, 'en-to-ru')
    expect(options).toHaveLength(4)
    expect(options.some(o => o.text === words[0].translation && o.correct)).toBe(true)
  })

  it('has exactly one correct option', () => {
    const words = Array.from({ length: 10 }, (_, i) => makeWord(`w${i}`))
    const options = buildQuizOptions(words[0], words, 'en-to-ru')
    expect(options.filter(o => o.correct)).toHaveLength(1)
  })
})

describe('getSessionCards', () => {
  it('returns new words for learning when no progress exists', () => {
    const words = [makeWord('w1'), makeWord('w2'), makeWord('w3')]
    const { newWords, dueCards } = getSessionCards(words, [], 'A2')
    expect(newWords).toHaveLength(3)
    expect(dueCards).toHaveLength(0)
  })

  it('returns due cards for review', () => {
    const words = [makeWord('w1')]
    const progress = [makeCard('w1', 'learning', '2026-01-01')]
    const { dueCards } = getSessionCards(words, progress, 'A2')
    expect(dueCards).toHaveLength(1)
  })

  it('skips words with status skipped', () => {
    const words = [makeWord('w1')]
    const progress = [makeCard('w1', 'skipped', '2026-01-01')]
    const { newWords, dueCards } = getSessionCards(words, progress, 'A2')
    expect(newWords).toHaveLength(0)
    expect(dueCards).toHaveLength(0)
  })
})

describe('shouldUnlockNextLevel', () => {
  it('returns true when 90% of level words have interval >= 7', () => {
    const words = Array.from({ length: 10 }, (_, i) => makeWord(`w${i}`, 'A2'))
    const progress = words.map(w => makeCard(w.id, 'learning', '2030-01-01', 7))
    expect(shouldUnlockNextLevel(words, progress, 'A2')).toBe(true)
  })

  it('returns false when less than 90% learned', () => {
    const words = Array.from({ length: 10 }, (_, i) => makeWord(`w${i}`, 'A2'))
    const progress = words.slice(0, 5).map(w => makeCard(w.id, 'learning', '2030-01-01', 7))
    expect(shouldUnlockNextLevel(words, progress, 'A2')).toBe(false)
  })
})
