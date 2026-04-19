import { useState, useEffect, useRef } from 'react'
import type { Word, CardProgress, SessionResult } from '../types'
import { saveProgress } from '../lib/db'
import { calculateSM2 } from '../lib/sm2'
import { buildQuizOptions, type QuizOption } from '../lib/session'
import wordsData from '../data/words.json'

const allWords = wordsData as Word[]

interface Props {
  dueCards: Array<{ word: Word; card: CardProgress }>
  onComplete: (result: SessionResult) => void
}

export default function QuizScreen({ dueCards, onComplete }: Props) {
  const [index, setIndex] = useState(0)
  const [options, setOptions] = useState<QuizOption[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const correctRef = useRef(0)
  const [direction, setDirection] = useState<'en-to-ru' | 'ru-to-en'>('en-to-ru')

  const current = dueCards[index]

  useEffect(() => {
    if (!current) return
    const dir: 'en-to-ru' | 'ru-to-en' = Math.random() > 0.5 ? 'en-to-ru' : 'ru-to-en'
    setDirection(dir)
    setOptions(buildQuizOptions(current.word, allWords, dir))
    setSelected(null)
  }, [index])

  if (!current) return null

  async function handleSelect(option: QuizOption) {
    if (selected !== null) return
    setSelected(option.text)
    if (option.correct) correctRef.current++
    const updated = calculateSM2(current.card, option.correct)
    await saveProgress(updated)
  }

  function handleNext() {
    if (index + 1 < dueCards.length) {
      setIndex(index + 1)
    } else {
      onComplete({ correct: correctRef.current, total: dueCards.length })
    }
  }

  const questionText = direction === 'en-to-ru' ? current.word.word : current.word.translation
  const questionSub = direction === 'en-to-ru' ? current.word.transcription : ''

  return (
    <div className="min-h-screen bg-slate-900 p-5 flex flex-col">
      <div className="text-slate-400 text-sm mt-4 mb-2">
        Вопрос {index + 1}/{dueCards.length}
      </div>
      <div className="h-1 bg-slate-700 rounded mb-6">
        <div
          className="h-full bg-green-400 rounded transition-all"
          style={{ width: `${(index / dueCards.length) * 100}%` }}
        />
      </div>

      <div className="text-center mb-8">
        <div className="text-3xl font-bold mb-2">{questionText}</div>
        {questionSub && <div className="text-slate-400">{questionSub}</div>}
        <div className="text-slate-500 text-sm mt-2">
          {direction === 'en-to-ru' ? 'Выбери перевод' : 'Выбери слово'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {options.map((option, i) => {
          let bg = 'bg-slate-700'
          if (selected !== null) {
            if (option.correct) bg = 'bg-green-600'
            else if (option.text === selected && !option.correct) bg = 'bg-red-600'
          }
          return (
            <button
              key={i}
              onClick={() => handleSelect(option)}
              className={`${bg} py-4 px-3 rounded-xl text-sm font-medium text-center active:scale-95 transition-all`}
            >
              {option.text}
            </button>
          )
        })}
      </div>

      {selected !== null && (
        <div className="mb-4">
          <div className="bg-slate-800 rounded-xl p-4 mb-4">
            <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Пример</div>
            <p className="text-sm leading-relaxed mb-1">{current.word.example1}</p>
            <p className="text-slate-400 text-sm">{current.word.example1_ru}</p>
          </div>
          <button
            onClick={handleNext}
            className="w-full py-4 rounded-2xl bg-green-400 text-slate-900 font-bold text-lg active:scale-95 transition-transform"
          >
            Далее →
          </button>
        </div>
      )}
    </div>
  )
}
