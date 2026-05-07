import { useEffect, useState } from 'react'
import type { Word, CardProgress, AppSettings } from '../types'
import { getAllProgress, getSettings, saveSettings } from '../lib/db'
import { getSessionCards } from '../lib/session'
import { getTodayISO } from '../lib/sm2'
import ProgressBar from '../components/ProgressBar'
import wordsData from '../data/words.json'

const allWords = wordsData as Word[]
const LEVELS: Word['level'][] = ['A2', 'B1', 'B2', 'C1']

interface Props {
  onStartNew: (newWords: Word[], reservePool: Word[]) => void
  onStartReview: (dueCards: Array<{ word: Word; card: CardProgress }>) => void
}

export default function HomeScreen({ onStartNew, onStartReview }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [progress, setProgress] = useState<CardProgress[]>([])
  const [dueCount, setDueCount] = useState(0)
  const [newCount, setNewCount] = useState(0)

  useEffect(() => {
    async function load() {
      const [s, p] = await Promise.all([getSettings(), getAllProgress()])
      setSettings(s)
      setProgress(p)

      const { newWords, dueCards } = getSessionCards(allWords, p)
      setNewCount(newWords.length)
      setDueCount(dueCards.length)

    }
    load()
  }, [])

  async function startSession(mode: 'new' | 'review') {
    if (!settings) return
    const all = await getAllProgress()
    const { newWords, dueCards, reservePool } = getSessionCards(allWords, all)

    const today = getTodayISO()
    let streak = settings.streak
    if (settings.lastStudyDate === '') {
      streak = 1
    } else {
      const yesterday = new Date(today + 'T00:00:00')
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]
      if (settings.lastStudyDate === yesterdayStr) {
        streak += 1
      } else if (settings.lastStudyDate !== today) {
        streak = 1
      }
    }
    await saveSettings({ ...settings, streak, lastStudyDate: today })

    if (mode === 'new') {
      onStartNew(newWords, reservePool)
    } else {
      onStartReview(dueCards)
    }
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-400">
        Загрузка...
      </div>
    )
  }

  const progressMap = new Map(progress.map(p => [p.wordId, p]))
  const total = dueCount + newCount

  // Per-level progress stats
  const levelStats = LEVELS.map(level => {
    const words = allWords.filter(w => w.level === level)
    const learned = words.filter(w => {
      const p = progressMap.get(w.id)
      return p && (p.status === 'skipped' || (p.status === 'learning' && p.interval >= 7))
    }).length
    const introduced = words.filter(w => {
      const p = progressMap.get(w.id)
      return p && (p.status === 'learning' || p.status === 'skipped')
    }).length
    return { level, learned, introduced, total: words.length }
  })

  return (
    <div className="min-h-screen bg-slate-900 p-5 flex flex-col">
      <div className="mt-8 mb-6">
        <p className="text-slate-400 text-sm mb-1">CoachWords</p>
        <h1 className="text-3xl font-bold">
          {total > 0 ? (
            <><span className="text-green-400">{total}</span> карточек</>
          ) : (
            <span className="text-slate-300">Всё готово!</span>
          )}
        </h1>
        <p className="text-slate-400 text-sm mt-1">на сегодня</p>
      </div>

      <div className="bg-slate-800 rounded-2xl p-4 mb-4 space-y-3">
        {levelStats.map(({ level, learned, total: t }) => (
          <div key={level}>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-slate-300">{level}</span>
              <span className="text-slate-400">{learned}/{t}</span>
            </div>
            <ProgressBar value={t > 0 ? (learned / t) * 100 : 0} label="" />
          </div>
        ))}
      </div>

      <div className="flex gap-3 mb-6">
        <div className="flex-1 bg-slate-800 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-blue-400">{newCount}</div>
          <div className="text-xs text-slate-400 mt-1">новых</div>
        </div>
        <div className="flex-1 bg-slate-800 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-yellow-400">{dueCount}</div>
          <div className="text-xs text-slate-400 mt-1">повторений</div>
        </div>
        <div className="flex-1 bg-slate-800 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-orange-400">{settings.streak}</div>
          <div className="text-xs text-slate-400 mt-1">🔥 дней</div>
        </div>
      </div>

      {newCount === 0 && dueCount === 0 ? (
        <button
          disabled
          className="w-full py-4 rounded-2xl font-bold text-lg bg-green-400 text-slate-900 opacity-40 cursor-not-allowed"
        >
          ✓ На сегодня готово
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          {newCount > 0 && (
            <button
              onClick={() => startSession('new')}
              className="w-full py-4 rounded-2xl font-bold text-lg bg-green-400 text-slate-900 active:scale-95 transition-transform"
            >
              📖 Новые слова ({newCount})
            </button>
          )}
          {dueCount > 0 && (
            <button
              onClick={() => startSession('review')}
              className="w-full py-4 rounded-2xl font-bold text-lg bg-blue-500 text-white active:scale-95 transition-transform"
            >
              🔁 Повторение ({dueCount})
            </button>
          )}
        </div>
      )}
    </div>
  )
}
