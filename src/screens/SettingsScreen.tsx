import { useEffect, useRef, useState } from 'react'
import type { AppSettings, CardProgress, ThemeName, Word } from '../types'
import { getSettings, getAllProgress, resetAllProgress, saveAllProgress, saveSettings } from '../lib/db'

const THEMES: { id: ThemeName; label: string; bg: string; accent: string }[] = [
  { id: 'standard', label: 'Standard', bg: '#0f172a', accent: '#4ade80' },
  { id: 'obsidian', label: 'Obsidian', bg: '#080b14', accent: '#818cf8' },
  { id: 'chalk',    label: 'Chalk',    bg: '#faf7f0', accent: '#d97706' },
  { id: 'terminal', label: 'Terminal', bg: '#000000', accent: '#00ff50' },
]
import wordsData from '../data/words.json'

const allWords = wordsData as Word[]

interface BackupData {
  version: 1
  exportedAt: string
  settings: AppSettings
  progress: CardProgress[]
}

export default function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [progress, setProgress] = useState<CardProgress[]>([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([getSettings(), getAllProgress()]).then(([s, p]) => { setSettings(s); setProgress(p) })
  }, [])

  async function handleThemeChange(theme: ThemeName) {
    if (!settings) return
    const updated = { ...settings, theme }
    await saveSettings(updated)
    setSettings(updated)
    document.documentElement.dataset.theme = theme
  }

  async function handleReset() {
    await resetAllProgress()
    const [s, p] = await Promise.all([getSettings(), getAllProgress()])
    setSettings(s); setProgress(p); setShowConfirm(false)
  }

  function handleExport() {
    if (!settings) return
    const backup: BackupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings,
      progress,
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `coachwords-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportClick() {
    setImportStatus('idle')
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const backup = JSON.parse(text) as BackupData
      if (backup.version !== 1 || !backup.settings || !Array.isArray(backup.progress)) {
        throw new Error('invalid format')
      }
      await saveAllProgress(backup.progress)
      await saveSettings(backup.settings)
      const [s, p] = await Promise.all([getSettings(), getAllProgress()])
      setSettings(s); setProgress(p)
      setImportStatus('success')
    } catch {
      setImportStatus('error')
    }
    e.target.value = ''
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

      <div className="bg-slate-800 rounded-2xl p-4 mb-4">
        <h2 className="font-semibold mb-3 text-slate-300">Оформление</h2>
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map(({ id, label, bg, accent }) => {
            const isActive = (settings.theme ?? 'standard') === id
            return (
              <button
                key={id}
                onClick={() => handleThemeChange(id)}
                className={`py-2 px-3 rounded-xl text-sm font-medium flex items-center gap-2 border-2 ${
                  isActive ? 'border-green-400 bg-slate-700' : 'border-transparent bg-slate-700 text-slate-300'
                }`}
              >
                <span className="flex gap-1 shrink-0">
                  <span className="w-3 h-3 rounded-full" style={{ background: bg, border: '1px solid #ffffff22' }} />
                  <span className="w-3 h-3 rounded-full" style={{ background: accent }} />
                </span>
                <span className={isActive ? 'text-green-400' : ''}>{label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="bg-slate-800 rounded-2xl p-4 mb-4">
        <h2 className="font-semibold mb-3 text-slate-300">Резервная копия</h2>
        <div className="space-y-3">
          <button onClick={handleExport} className="w-full py-3 rounded-xl bg-slate-700 text-green-400 font-medium">
            💾 Сохранить прогресс на устройство
          </button>
          <button onClick={handleImportClick} className="w-full py-3 rounded-xl bg-slate-700 text-blue-400 font-medium">
            📂 Загрузить прогресс с устройства
          </button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />
          {importStatus === 'success' && (
            <p className="text-sm text-green-400 text-center">Прогресс успешно загружен!</p>
          )}
          {importStatus === 'error' && (
            <p className="text-sm text-red-400 text-center">Ошибка: неверный файл резервной копии</p>
          )}
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
