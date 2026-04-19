import type { CardProgress } from '../types'

export function getTodayISO(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(dateISO: string, days: number): string {
  const [year, month, day] = dateISO.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().split('T')[0]
}

export function calculateSM2(
  card: CardProgress,
  correct: boolean,
  today: string = getTodayISO()
): CardProgress {
  const grade = correct ? 4 : 1
  let { easeFactor, interval, repetitions } = card

  if (grade < 3) {
    repetitions = 0
    interval = 1
  } else {
    if (repetitions === 0) {
      interval = 1
    } else if (repetitions === 1) {
      interval = 6
    } else {
      interval = Math.round(interval * easeFactor)
    }
    repetitions++
  }

  easeFactor = easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
  easeFactor = Math.max(1.3, easeFactor)

  return {
    ...card,
    easeFactor,
    interval,
    repetitions,
    nextReview: addDays(today, interval),
  }
}

export function isDue(card: CardProgress, today: string = getTodayISO()): boolean {
  return card.nextReview <= today
}
