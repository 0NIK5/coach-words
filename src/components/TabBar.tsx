import type { Screen } from '../types'

interface Props {
  current: Screen
  onChange: (screen: Screen) => void
}

export default function TabBar({ current, onChange }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex">
      {([
        ['home', '🏠', 'Главная'],
        ['wordlist', '📋', 'Слова'],
        ['settings', '⚙️', 'Настройки'],
      ] as [Screen, string, string][]).map(([screen, icon, label]) => (
        <button
          key={screen}
          onClick={() => onChange(screen)}
          className={`flex-1 py-3 flex flex-col items-center gap-1 text-xs ${
            current === screen ? 'text-green-400' : 'text-slate-400'
          }`}
        >
          <span className="text-xl">{icon}</span>
          {label}
        </button>
      ))}
    </nav>
  )
}
