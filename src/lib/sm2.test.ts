import { describe, it, expect } from 'vitest'
import { calculateSM2, getTodayISO, addDays } from './sm2'
import type { CardProgress } from '../types'

const newCard = (): CardProgress => ({
  wordId: 'test',
  status: 'learning',
  easeFactor: 2.5,
  interval: 0,
  repetitions: 0,
  nextReview: getTodayISO(),
})

describe('calculateSM2', () => {
  it('wrong answer resets interval to 1', () => {
    const card = newCard()
    const result = calculateSM2(card, false)
    expect(result.interval).toBe(1)
    expect(result.repetitions).toBe(0)
  })

  it('first correct answer sets interval to 1', () => {
    const card = newCard()
    const result = calculateSM2(card, true)
    expect(result.interval).toBe(1)
    expect(result.repetitions).toBe(1)
  })

  it('second correct answer sets interval to 6', () => {
    const card = { ...newCard(), repetitions: 1, interval: 1 }
    const result = calculateSM2(card, true)
    expect(result.interval).toBe(6)
    expect(result.repetitions).toBe(2)
  })

  it('third correct answer multiplies interval by easeFactor', () => {
    const card = { ...newCard(), repetitions: 2, interval: 6, easeFactor: 2.5 }
    const result = calculateSM2(card, true)
    expect(result.interval).toBe(15)
    expect(result.repetitions).toBe(3)
  })

  it('easeFactor does not drop below 1.3', () => {
    const card = { ...newCard(), easeFactor: 1.3 }
    const result = calculateSM2(card, false)
    expect(result.easeFactor).toBeGreaterThanOrEqual(1.3)
  })

  it('nextReview is today + interval days', () => {
    const card = newCard()
    const result = calculateSM2(card, true)
    const expected = addDays(getTodayISO(), 1)
    expect(result.nextReview).toBe(expected)
  })
})

describe('addDays', () => {
  it('adds days to ISO date string', () => {
    expect(addDays('2026-01-01', 7)).toBe('2026-01-08')
  })
})
