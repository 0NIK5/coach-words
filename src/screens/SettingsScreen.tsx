import { useEffect, useState } from 'react'
import type { AppSettings, CardProgress, Word } from '../types'
import { getSettings, getAllProgress, resetAllProgress } from '../lib/db'
import wordsData from '../data/words.json'

const allWords = wordsData as Word[]

export default function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [progress, setProgress] = useState<CardProgress[]>([])
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    Promise.all([getSettings(), getAllProgress()]).then(([s, p]) => { setSettings(s); setProgress(p) })
  }, [])

  async function handleReset() {
    await resetAllProgress()
    const [s, p] = await Promise.all([getSettings(), getAllProgress()])
    setSettings(s); setProgress(p); setShowConfirm(false)
  }

  if (!settings) return <div className="p-4 text-slate-400">Загрузка...</div>

  const learned = progress.filter(p => p.status==='learning' && p.interval>=7).length
  const learning = progress.filter(p => p.status==='learning').length
  const skipped = progress.filter(p => p.status==='skipped').length

  return (
    <div className="min-h-screen bg-slate-900 p-4">
      <h1 className="text-2xl font-bold mt-4 mb-6">Настройки</h1>
      <div className="bg-slate-800 rounded-2xl p-4 mb-4">
        <h2 className="font-semibold mb-3 text-slate-300">Статистика</h2>
        <div className="space-y-2">
          {([
            ['Текущий уровень', settings.currentLevel, 'text-green-400'],
            ['Всего слов в базе', String(allWords.length), ''],
            ['Изучено (interval ≥ 7)', String(learned), 'text-green-400'],
            ['В процессе', String(learning), 'text-yellow-400'],
            ['Пропущено', String(skipped), 'text-slate-500'],
            ['Дней подряд', `🔥 ${settings.streak}`, 'text-orange-400'],
          ] as [string,string,string][]).map(([label,value,color]) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-slate-400">{label}</span>
              <span className={`font-bold ${color}`}>{value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-slate-800 rounded-2xl p-4">
        <h2 className="font-semibold mb-3 text-slate-300">Опасная зона</h2>
        {!showConfirm ? (
          <button onClick={() => setShowConfirm(true)} className="w-full py-3 rounded-xl bg-red-900 text-red-300 font-medium">
            🗑️ Сбросить весь прогресс
          </button>
        ) : (
          <div>
            <p className="text-sm text-red-300 mb-3">Весь прогресс будет удалён. Уверен?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300">Отмена</button>
              <button onClick={handleReset} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold">Да, сбросить</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
