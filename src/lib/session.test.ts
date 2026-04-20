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
  it('returns new words across all levels with no progress', () => {
    const words = [
      makeWord('a1', 'A2'), makeWord('a2', 'A2'), makeWord('a3', 'A2'),
      makeWord('b1', 'B1'), makeWord('b2', 'B1'), makeWord('b3', 'B1'),
      makeWord('c1', 'B2'), makeWord('c2', 'B2'), makeWord('c3', 'B2'),
      makeWord('d1', 'C1'),
    ]
    const { newWords, dueCards } = getSessionCards(words, [])
    expect(newWords).toHaveLength(10)
    expect(dueCards).toHaveLength(0)
  })

  it('returns due cards from all levels', () => {
    const words = [makeWord('a1', 'A2'), makeWord('b1', 'B1'), makeWord('c1', 'C1')]
    const progress = [
      makeCard('a1', 'learning', '2026-01-01'),
      makeCard('b1', 'learning', '2026-01-01'),
      makeCard('c1', 'learning', '2026-01-01'),
    ]
    const { dueCards } = getSessionCards(words, progress)
    expect(dueCards).toHaveLength(3)
  })

  it('skips words with status skipped', () => {
    const words = [makeWord('w1', 'A2')]
    const progress = [makeCard('w1', 'skipped', '2026-01-01')]
    const { newWords, dueCards } = getSessionCards(words, progress)
    expect(newWords).toHaveLength(0)
    expect(dueCards).toHaveLength(0)
  })

  it('redistributes A2 quota to C1 when A2 runs out', () => {
    // Only 1 A2 word available (quota is 3), so 2 extra go to C1
    const words = [
      makeWord('a1', 'A2'),
      makeWord('b1', 'B1'), makeWord('b2', 'B1'), makeWord('b3', 'B1'),
      makeWord('c1', 'B2'), makeWord('c2', 'B2'), makeWord('c3', 'B2'),
      makeWord('d1', 'C1'), makeWord('d2', 'C1'), makeWord('d3', 'C1'),
    ]
    const { newWords } = getSessionCards(words, [])
    const c1Words = newWords.filter(w => w.level === 'C1')
    // C1 base quota 1 + 2 redistributed from A2 = 3
    expect(c1Words).toHaveLength(3)
    expect(newWords).toHaveLength(10)
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
