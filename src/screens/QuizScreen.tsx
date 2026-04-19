import type { Word, CardProgress, SessionResult } from '../types'
interface Props {
  dueCards: Array<{ word: Word; card: CardProgress }>
  onComplete: (result: SessionResult) => void
}
export default function QuizScreen({ dueCards, onComplete }: Props) {
  return <div className="p-4">QuizScreen (TODO)</div>
}
