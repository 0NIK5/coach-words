import { useState } from 'react'
import type { Screen, SessionResult } from './types'
import type { Word, CardProgress } from './types'
import TabBar from './components/TabBar'
import HomeScreen from './screens/HomeScreen'
import LearningScreen from './screens/LearningScreen'
import QuizScreen from './screens/QuizScreen'
import ResultsScreen from './screens/ResultsScreen'
import WordListScreen from './screens/WordListScreen'
import SettingsScreen from './screens/SettingsScreen'

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [sessionNew, setSessionNew] = useState<Word[]>([])
  const [sessionDue, setSessionDue] = useState<Array<{ word: Word; card: CardProgress }>>([])
  const [sessionResult, setSessionResult] = useState<SessionResult>({ correct: 0, total: 0 })
  const [reservePool, setReservePool] = useState<Word[]>([])

  const showTabs = screen === 'home' || screen === 'wordlist' || screen === 'settings'

  function getReplacement(skippedLevel: Word['level']): Word | null {
    // Try same level first, then any level
    let idx = reservePool.findIndex(w => w.level === skippedLevel)
    if (idx === -1) idx = reservePool.length > 0 ? 0 : -1
    if (idx === -1) return null
    const word = reservePool[idx]
    setReservePool(prev => prev.filter((_, i) => i !== idx))
    return word
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className={showTabs ? 'pb-16' : ''}>
        {screen === 'home' && (
          <HomeScreen
            onStartSession={(newWords, dueCards, reserve) => {
              setSessionNew(newWords)
              setSessionDue(dueCards)
              setReservePool(reserve)
              if (newWords.length > 0) {
                setScreen('learning')
              } else if (dueCards.length > 0) {
                setScreen('quiz')
              }
            }}
          />
        )}
        {screen === 'learning' && (
          <LearningScreen
            words={sessionNew}
            onGetReplacement={getReplacement}
            onComplete={() => {
              if (sessionDue.length > 0) {
                setScreen('quiz')
              } else {
                setScreen('home')
              }
            }}
          />
        )}
        {screen === 'quiz' && (
          <QuizScreen
            dueCards={sessionDue}
            onComplete={(result) => {
              setSessionResult(result)
              setScreen('results')
            }}
          />
        )}
        {screen === 'results' && (
          <ResultsScreen
            result={sessionResult}
            onHome={() => setScreen('home')}
          />
        )}
        {screen === 'wordlist' && <WordListScreen />}
        {screen === 'settings' && <SettingsScreen />}
      </div>
      {showTabs && <TabBar current={screen} onChange={setScreen} />}
    </div>
  )
}
