import { useEffect, useRef, useState } from 'react'

const MIN = -0.4
const MAX = 0.4
const RANGE = MAX - MIN

const PCT_TOUGH = ((-0.05 - MIN) / RANGE) * 100  // 43.75%
const PCT_CLOSE = ((0 - (-0.05)) / RANGE) * 100   //  6.25%

export default function ScoreGauge({ score }: { score: number }) {
  const [showInfo, setShowInfo] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const markerPct = Math.max(0, Math.min(100, ((score - MIN) / RANGE) * 100))
  const pctLabel = `${score >= 0 ? '+' : ''}${Math.round(score * 100)}%`
  const color = score > 0 ? 'text-green-400' : score > -0.05 ? 'text-amber-400' : 'text-gray-400'

  useEffect(() => {
    if (!showInfo) return
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setShowInfo(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showInfo])

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium text-white">Beatability</p>
          <button
            ref={buttonRef}
            onClick={() => setShowInfo((v) => !v)}
            className={`w-4 h-4 rounded-full border text-[10px] font-bold flex items-center justify-center transition-colors ${showInfo ? 'border-strava text-strava' : 'border-gray-600 text-gray-500 hover:border-gray-400 hover:text-gray-300'}`}
            aria-label="About beatability score"
          >
            ?
          </button>
        </div>
        <span className={`text-xs font-semibold ${color}`}>{pctLabel}</span>
      </div>

      {showInfo && (
        <div
          ref={popoverRef}
          className="absolute left-0 top-7 z-20 w-64 bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-xl"
        >
          {/* Arrow */}
          <div className="absolute -top-1.5 left-[72px] w-3 h-3 bg-gray-900 border-l border-t border-gray-700 rotate-45" />
          <p className="text-[11px] text-gray-300 leading-relaxed">
            How far your estimated pace is from beating the target time, as a percentage.
          </p>
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
              <p className="text-[11px] text-gray-300"><span className="text-green-400 font-medium">Beatable</span> — you're already fast enough.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <p className="text-[11px] text-gray-300"><span className="text-amber-400 font-medium">Close</span> — within 5% of the target.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-500 shrink-0" />
              <p className="text-[11px] text-gray-300"><span className="text-gray-400 font-medium">Tough</span> — more than 5% off, but worth chasing.</p>
            </div>
          </div>
        </div>
      )}

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
