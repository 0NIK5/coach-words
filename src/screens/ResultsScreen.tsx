import type { SessionResult } from '../types'
interface Props { result: SessionResult; onHome: () => void }
export default function ResultsScreen({ result, onHome }: Props) {
  return <div className="p-4">ResultsScreen (TODO)</div>
}
