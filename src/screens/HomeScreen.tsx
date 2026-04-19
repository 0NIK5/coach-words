import type { Word, CardProgress } from '../types'
interface Props {
  onStartSession: (newWords: Word[], dueCards: Array<{ word: Word; card: CardProgress }>) => void
}
export default function HomeScreen({ onStartSession }: Props) {
  return <div className="p-4">HomeScreen (TODO)</div>
}
