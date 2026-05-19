const CX = 100, CY = 84, R = 70, STROKE = 10, NEEDLE = 54
const MIN = -0.4, MAX = 0.4

function toAngle(score: number) {
  return 180 + (Math.max(MIN, Math.min(MAX, score)) - MIN) / (MAX - MIN) * 180
}

function arc(a1: number, a2: number) {
  const p = (a: number): [number, number] => {
    const rad = a * Math.PI / 180
    return [+(CX + R * Math.cos(rad)).toFixed(2), +(CY + R * Math.sin(rad)).toFixed(2)]
  }
  const [x1, y1] = p(a1), [x2, y2] = p(a2)
  return `M ${x1} ${y1} A ${R} ${R} 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${x2} ${y2}`
}

const A_START = 180
const A_CLOSE = 180 + ((-0.05 - MIN) / (MAX - MIN)) * 180  // ≈ 258.75°
const A_BEAT  = 270
const A_END   = 360

export default function ScoreGauge({ score }: { score: number }) {
  const a = toAngle(score)
  const rad = a * Math.PI / 180
  const nx = +(CX + NEEDLE * Math.cos(rad)).toFixed(2)
  const ny = +(CY + NEEDLE * Math.sin(rad)).toFixed(2)

  const color = score > 0 ? '#22c55e' : score > -0.05 ? '#f59e0b' : '#6b7280'
  const label = score > 0 ? 'BEATABLE' : score > -0.05 ? 'CLOSE' : 'TOUGH'
  const pct = `${score >= 0 ? '+' : ''}${(score * 100).toFixed(0)}%`

  return (
    <div className="bg-gray-800/60 rounded-xl p-3">
      <p className="text-xs font-semibold text-gray-400 mb-1">Beatability</p>
      <svg viewBox="0 0 200 116" className="w-full">
        {/* Shadow track */}
        <path d={arc(A_START, A_END)} fill="none" stroke="#111827" strokeWidth={STROKE + 4} strokeLinecap="round" />
        {/* Coloured zones */}
        <path d={arc(A_START, A_CLOSE)} fill="none" stroke="#6b7280" strokeWidth={STROKE} strokeLinecap="butt" />
        <path d={arc(A_CLOSE, A_BEAT)} fill="none" stroke="#f59e0b" strokeWidth={STROKE} strokeLinecap="butt" />
        <path d={arc(A_BEAT, A_END)}   fill="none" stroke="#22c55e" strokeWidth={STROKE} strokeLinecap="butt" />
        {/* Zone boundary ticks */}
        {[A_CLOSE, A_BEAT].map((tickAngle) => {
          const pt = (r: number): [number, number] => {
            const rad = tickAngle * Math.PI / 180
            return [+(CX + r * Math.cos(rad)).toFixed(2), +(CY + r * Math.sin(rad)).toFixed(2)]
          }
          const [ox, oy] = pt(R + 2)
          const [ix, iy] = pt(R - STROKE - 2)
          return <line key={tickAngle} x1={ox} y1={oy} x2={ix} y2={iy} stroke="#1f2937" strokeWidth={2} />
        })}
        {/* Needle */}
        <line x1={CX} y1={CY} x2={nx} y2={ny} stroke="#e5e7eb" strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={CX} cy={CY} r={5} fill="#e5e7eb" />
        {/* Labels */}
        <text x={CX} y={CY + 16} textAnchor="middle" fontSize={11} fontWeight="700" fill={color} fontFamily="ui-sans-serif,system-ui,sans-serif">{label}</text>
        <text x={CX} y={CY + 27} textAnchor="middle" fontSize={9} fill="#9ca3af" fontFamily="ui-sans-serif,system-ui,sans-serif">{pct}</text>
      </svg>
    </div>
  )
}
