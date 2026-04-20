import { useState } from 'react'
import type { Word } from '../types'
import { saveProgress } from '../lib/db'
import { getTodayISO, addDays } from '../lib/sm2'

interface Props {
  words: Word[]
  onGetReplacement: (skippedLevel: Word['level']) => Word | null
  onComplete: () => void
}

export default function LearningScreen({ words, onGetReplacement, onComplete }: Props) {
  const [localWords, setLocalWords] = useState<Word[]>(words)
  const [index, setIndex] = useState(0)

  const word = localWords[index]

  if (!word) {
    onComplete()
    return null
  }

  function advance(updatedWords: Word[]) {
    if (index + 1 < updatedWords.length) {
      setIndex(index + 1)
    } else {
      onComplete()
    }
  }

  async function handleRemember() {
    await saveProgress({
      wordId: word.id,
      status: 'learning',
      easeFactor: 2.5,
      interval: 1,
      repetitions: 0,
      nextReview: addDays(getTodayISO(), 1),
    })
    advance(localWords)
  }

  async function handleSkip() {
    await saveProgress({
      wordId: word.id,
      status: 'skipped',
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      nextReview: getTodayISO(),
    })
    const replacement = onGetReplacement(word.level)
    const updated = replacement ? [...localWords, replacement] : localWords
    if (replacement) setLocalWords(updated)
    advance(updated)
  }

  return (
    <div className="min-h-screen bg-slate-900 p-5 flex flex-col">
      <div className="text-slate-400 text-sm mt-4 mb-6">
        📖 Новое слово ({index + 1}/{localWords.length})
      </div>

      <div className="text-center mb-8">
        <div className="text-4xl font-bold mb-2">{word.word}</div>
        <div className="text-slate-400 text-lg mb-4">{word.transcription}</div>
        <div className="inline-block bg-blue-600 px-6 py-2 rounded-full text-lg font-semibold">
          {word.translation}
        </div>
        <div className="text-slate-400 text-sm mt-2">{word.partOfSpeech}</div>
      </div>

      <div className="flex-1">
        <div className="text-slate-500 text-xs uppercase tracking-widest mb-3">
          Примеры использования
        </div>
        <div className="bg-slate-800 rounded-xl p-4 mb-3">
          <p className="text-sm leading-relaxed mb-2">{word.example1}</p>
          <p className="text-slate-400 text-sm">{word.example1_ru}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-sm leading-relaxed mb-2">{word.example2}</p>
          <p className="text-slate-400 text-sm">{word.example2_ru}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-6">
        <button
          onClick={() => setIndex(index)}
          className="py-3 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium active:scale-95 transition-transform"
        >
          ↩️ Ещё раз
        </button>
        <button
          onClick={handleRemember}
          className="py-3 rounded-xl bg-green-400 text-slate-900 text-sm font-bold active:scale-95 transition-transform"
        >
          ✓ Запомнил
        </button>
        <button
          onClick={handleSkip}
          className="py-3 rounded-xl bg-slate-700 text-yellow-400 text-sm font-medium active:scale-95 transition-transform"
        >
          ⚡ Знаю
        </button>
      </div>
    </div>
  )
}
