const MIN = -0.4
const MAX = 0.4
const RANGE = MAX - MIN

const PCT_TOUGH = ((-0.05 - MIN) / RANGE) * 100  // 43.75%
const PCT_CLOSE = ((0 - (-0.05)) / RANGE) * 100   //  6.25%

export default function ScoreGauge({ score }: { score: number }) {
  const markerPct = Math.max(0, Math.min(100, ((score - MIN) / RANGE) * 100))
  const pctLabel = `${score >= 0 ? '+' : ''}${Math.round(score * 100)}%`
  const color = score > 0 ? 'text-green-400' : score > -0.05 ? 'text-amber-400' : 'text-gray-400'

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-white">Beatability</p>
        <span className={`text-xs font-semibold ${color}`}>{pctLabel}</span>
      </div>

      {/* Bar + tick marker */}
      <div className="relative py-1.5">
        <div className="relative h-2 rounded-full overflow-hidden">
          <div className="absolute top-0 left-0 h-full bg-gray-500/60" style={{ width: `${PCT_TOUGH}%` }} />
          <div className="absolute top-0 h-full bg-amber-500/80" style={{ left: `${PCT_TOUGH}%`, width: `${PCT_CLOSE}%` }} />
          <div className="absolute top-0 h-full bg-green-500/80" style={{ left: `${PCT_TOUGH + PCT_CLOSE}%`, right: 0 }} />
        </div>
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white rounded-full shadow"
          style={{ left: `${markerPct}%`, transform: 'translateX(-50%)' }}
        />
      </div>

      {/* Zone labels */}
      <div className="relative h-4 mt-1">
        <span className="absolute left-0 text-[10px] text-gray-500">Tough</span>
        <span className="absolute text-[10px] text-gray-500 -translate-x-1/2" style={{ left: `${PCT_TOUGH}%` }}>Close</span>
        <span className="absolute right-0 text-[10px] text-gray-500">Beatable</span>
      </div>
    </div>
  )
}
