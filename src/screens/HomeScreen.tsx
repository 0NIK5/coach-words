import { useEffect, useState } from 'react'
import type { Word, CardProgress, AppSettings } from '../types'
import { getAllProgress, getSettings, saveSettings } from '../lib/db'
import { getSessionCards, shouldUnlockNextLevel, getNextLevel } from '../lib/session'
import { getTodayISO } from '../lib/sm2'
import ProgressBar from '../components/ProgressBar'
import wordsData from '../data/words.json'

const allWords = wordsData as Word[]

interface Props {
  onStartSession: (newWords: Word[], dueCards: Array<{ word: Word; card: CardProgress }>) => void
}

export default function HomeScreen({ onStartSession }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [progress, setProgress] = useState<CardProgress[]>([])
  const [dueCount, setDueCount] = useState(0)
  const [newCount, setNewCount] = useState(0)

  useEffect(() => {
    async function load() {
      const [s, p] = await Promise.all([getSettings(), getAllProgress()])
      setSettings(s)
      setProgress(p)

      if (shouldUnlockNextLevel(allWords, p, s.currentLevel)) {
        const next = getNextLevel(s.currentLevel)
        if (next) {
          const updated = { ...s, currentLevel: next }
          await saveSettings(updated)
          setSettings(updated)
        }
      }

      const { newWords, dueCards } = getSessionCards(allWords, p, s.currentLevel)
      setNewCount(newWords.length)
      setDueCount(dueCards.length)
    }
    load()
  }, [])

  async function handleStart() {
    if (!settings) return
    const all = await getAllProgress()
    const { newWords, dueCards } = getSessionCards(allWords, all, settings.currentLevel)

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

    onStartSession(newWords.slice(0, 10), dueCards)
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-400">
        Загрузка...
      </div>
    )
  }

  const levelWords = allWords.filter(w => w.level === settings.currentLevel)
  const progressMap = new Map(progress.map(p => [p.wordId, p]))
  const learnedCount = levelWords.filter(w => {
    const p = progressMap.get(w.id)
    return p && p.status === 'learning' && p.interval >= 7
  }).length
  const progressPercent = levelWords.length > 0 ? (learnedCount / levelWords.length) * 100 : 0
  const total = dueCount + newCount

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

      <div className="bg-slate-800 rounded-2xl p-4 mb-4">
        <div className="flex justify-between items-center mb-3">
          <span className="font-semibold">Уровень {settings.currentLevel}</span>
          <span className="text-slate-400 text-sm">{learnedCount}/{levelWords.length} слов</span>
        </div>
        <ProgressBar value={progressPercent} label="" />
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

      <button
        onClick={handleStart}
        disabled={total === 0}
        className="w-full py-4 rounded-2xl font-bold text-lg bg-green-400 text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform"
      >
        {total > 0 ? '▶ Начать повторение' : '✓ На сегодня готово'}
      </button>
    </div>
  )
}
