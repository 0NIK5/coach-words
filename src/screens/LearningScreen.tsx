import type { Word } from '../types'
interface Props { words: Word[]; onComplete: () => void }
export default function LearningScreen({ words, onComplete }: Props) {
  return <div className="p-4">LearningScreen (TODO)</div>
}
