import type { SessionResult } from '../types'

interface Props {
  result: SessionResult
  onHome: () => void
}

export default function ResultsScreen({ result, onHome }: Props) {
  const percent = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0
  const emoji = percent === 100 ? '🎉' : percent >= 70 ? '👍' : '💪'

  return (
    <div className="min-h-screen bg-slate-900 p-5 flex flex-col items-center justify-center text-center">
      <div className="text-6xl mb-6">{emoji}</div>
      <h1 className="text-3xl font-bold mb-2">Сессия завершена!</h1>
      <div className="text-slate-400 mb-8">
        Правильных ответов:{' '}
        <span className="text-white font-bold">{result.correct}/{result.total}</span>
      </div>
      <div className="w-full bg-slate-800 rounded-2xl p-6 mb-8">
        <div className="text-5xl font-bold text-green-400 mb-2">{percent}%</div>
        <div className="text-slate-400 text-sm">точность</div>
      </div>
      <button
        onClick={onHome}
        className="w-full py-4 rounded-2xl bg-green-400 text-slate-900 font-bold text-lg active:scale-95 transition-transform"
      >
        🏠 На главную
      </button>
    </div>
  )
}
