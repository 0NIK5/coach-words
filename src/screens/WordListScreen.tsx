import { useEffect, useState } from 'react'
import type { Word, CardProgress } from '../types'
import { getAllProgress } from '../lib/db'
import { getTodayISO } from '../lib/sm2'
import wordsData from '../data/words.json'

const allWords = wordsData as Word[]
type LevelFilter = 'all' | 'A2' | 'B1' | 'B2' | 'C1'
type StatusFilter = 'all' | 'new' | 'learning' | 'skipped'

export default function WordListScreen() {
  const [progress, setProgress] = useState<CardProgress[]>([])
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    getAllProgress().then(setProgress)
  }, [])

  const progressMap = new Map(progress.map(p => [p.wordId, p]))
  const today = getTodayISO()

  const filtered = allWords.filter(w => {
    if (levelFilter !== 'all' && w.level !== levelFilter) return false
    const p = progressMap.get(w.id)
    const status = p?.status ?? 'new'
    if (statusFilter !== 'all' && status !== statusFilter) return false
    return true
  })

  function getStatusLabel(word: Word): string {
    const p = progressMap.get(word.id)
    if (!p || p.status === 'new') return 'новое'
    if (p.status === 'skipped') return 'пропущено'
    if (p.nextReview <= today) return 'сегодня 📌'
    const days = Math.ceil(
      (new Date(p.nextReview).getTime() - new Date(today).getTime()) / 86400000
    )
    return `через ${days} д.`
  }

  function getStatusColor(word: Word): string {
    const p = progressMap.get(word.id)
    if (!p || p.status === 'new') return 'text-slate-500'
    if (p.status === 'skipped') return 'text-yellow-500'
    if (p.nextReview <= today) return 'text-green-400'
    return 'text-slate-400'
  }

  return (
    <div className="min-h-screen bg-slate-900 p-4">
      <h1 className="text-2xl font-bold mt-4 mb-4">Все слова</h1>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
        {(['all', 'A2', 'B1', 'B2', 'C1'] as LevelFilter[]).map(l => (
          <button
            key={l}
            onClick={() => setLevelFilter(l)}
            className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
              levelFilter === l
                ? 'bg-green-400 text-slate-900 font-bold'
                : 'bg-slate-700 text-slate-300'
            }`}
          >
            {l === 'all' ? 'Все' : l}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
        {(['all', 'new', 'learning', 'skipped'] as StatusFilter[]).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
              statusFilter === s
                ? 'bg-blue-500 text-white font-bold'
                : 'bg-slate-700 text-slate-300'
            }`}
          >
            {{ all: 'Все', new: 'Новые', learning: 'Учу', skipped: 'Пропущено' }[s]}
          </button>
        ))}
      </div>

      <div className="text-slate-500 text-sm mb-3">{filtered.length} слов</div>

      <div className="space-y-2">
        {filtered.map(word => (
          <div
            key={word.id}
            className="bg-slate-800 rounded-xl p-3 flex justify-between items-center"
          >
            <div>
              <div className="font-semibold">{word.word}</div>
              <div className="text-slate-400 text-sm">{word.translation}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-600">{word.level}</div>
              <div className={`text-xs mt-1 ${getStatusColor(word)}`}>
                {getStatusLabel(word)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
