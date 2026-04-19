interface Props {
  value: number
  label: string
}
export default function ProgressBar({ value, label }: Props) {
  return (
    <div>
      <div className="flex justify-between text-sm text-slate-400 mb-1">
        <span>{label}</span>
        <span>{Math.round(value)}%</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-400 rounded-full transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}
