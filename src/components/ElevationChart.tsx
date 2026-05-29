import { useEffect, useRef, useState } from 'react'
import type { Unit } from '../format'

interface Props {
  altitude: number[]
  distance: number[]
  unit: Unit
  hoverDistanceM?: number | null
  onHoverDistance?: (d: number | null) => void
  className?: string
  svgClassName?: string
}

const PAD = { t: 6, r: 8, b: 20, l: 38 }

function fmtEle(m: number, unit: Unit) {
  return unit === 'mile' ? `${Math.round(m * 3.281)}ft` : `${Math.round(m)}m`
}

function fmtDist(m: number, unit: Unit) {
  return unit === 'mile' ? `${(m / 1609.34).toFixed(1)}mi` : `${(m / 1000).toFixed(1)}km`
}

function elevationAt(altitude: number[], distance: number[], d: number): number {
  for (let i = 1; i < distance.length; i++) {
    if (distance[i] >= d) {
      const t = (d - distance[i - 1]) / (distance[i] - distance[i - 1]) || 0
      return altitude[i - 1] + t * (altitude[i] - altitude[i - 1])
    }
  }
  return altitude[altitude.length - 1]
}

export default function ElevationChart({ altitude, distance, unit, hoverDistanceM, onHoverDistance, className, svgClassName }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(400)
  const [h, setH] = useState(88)

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      if (r.width > 0) setW(Math.floor(r.width))
      if (r.height > 0) setH(Math.floor(r.height))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (altitude.length < 2 || distance.length < 2) return null

  const IW = w - PAD.l - PAD.r
  const IH = h - PAD.t - PAD.b

  const step = Math.max(1, Math.floor(altitude.length / 120))
  const pts: { alt: number; dist: number }[] = []
  for (let i = 0; i < altitude.length; i += step) pts.push({ alt: altitude[i], dist: distance[i] })
  if (pts[pts.length - 1].dist !== distance[distance.length - 1]) {
    pts.push({ alt: altitude[altitude.length - 1], dist: distance[distance.length - 1] })
  }

  const maxDist = distance[distance.length - 1]
  const rawMin = Math.min(...pts.map((p) => p.alt))
  const rawMax = Math.max(...pts.map((p) => p.alt))
  const range = Math.max(rawMax - rawMin, 15)
  const pad = range * 0.12
  const yMin = rawMin - pad
  const yMax = rawMax + pad

  const xOf = (d: number) => PAD.l + (d / maxDist) * IW
  const yOf = (a: number) => PAD.t + (1 - (a - yMin) / (yMax - yMin)) * IH

  const coords = pts.map((p) => `${xOf(p.dist).toFixed(1)},${yOf(p.alt).toFixed(1)}`)
  const linePath = `M${coords.join('L')}`
  const areaPath = `M${PAD.l},${(PAD.t + IH).toFixed(1)}L${coords.join('L')}L${(w - PAD.r).toFixed(1)},${(PAD.t + IH).toFixed(1)}Z`

  const yTicks = [rawMin, (rawMin + rawMax) / 2, rawMax]
  const xTicks = [0, maxDist / 2, maxDist]

  let gain = 0
  for (let i = 1; i < altitude.length; i++) {
    if (altitude[i] > altitude[i - 1]) gain += altitude[i] - altitude[i - 1]
  }

  const clampedHover = hoverDistanceM != null ? Math.max(0, Math.min(hoverDistanceM, maxDist)) : null
  const crosshairX = clampedHover != null ? xOf(clampedHover) : null
  const crosshairAlt = clampedHover != null ? elevationAt(altitude, distance, clampedHover) : null
  const crosshairY = crosshairAlt != null ? yOf(crosshairAlt) : null

  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement!
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const { x } = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    const d = ((x - PAD.l) / IW) * maxDist
    onHoverDistance?.(Math.max(0, Math.min(d, maxDist)))
  }

  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      <div className="flex items-center gap-3 text-xs text-gray-500 shrink-0">
        <span>↑ {fmtEle(gain, unit)} gain</span>
        <span>Start {fmtEle(altitude[0], unit)}</span>
        <span>Peak {fmtEle(rawMax, unit)}</span>
      </div>
      <div ref={wrapperRef} className={`relative ${svgClassName ?? 'h-[88px]'}`}>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="absolute inset-0 w-full h-full block rounded-lg overflow-hidden"
        >
          <defs>
            <linearGradient id="ele-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {yTicks.map((v, i) => (
            <line key={i} x1={PAD.l} y1={yOf(v).toFixed(1)} x2={w - PAD.r} y2={yOf(v).toFixed(1)}
              stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          ))}

          <path d={areaPath} fill="url(#ele-fill)" />
          <path d={linePath} fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinejoin="round" />

          {yTicks.map((v, i) => (
            <text key={i} x={PAD.l - 4} y={yOf(v).toFixed(1)} textAnchor="end" dominantBaseline="middle"
              fontSize="8" fill="rgba(156,163,175,0.8)">
              {fmtEle(v, unit)}
            </text>
          ))}

          {xTicks.map((d, i) => (
            <text key={i} x={xOf(d).toFixed(1)} y={h - 4}
              textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
              fontSize="8" fill="rgba(156,163,175,0.8)">
              {fmtDist(d, unit)}
            </text>
          ))}

          {crosshairX != null && crosshairY != null && crosshairAlt != null && (() => {
            const tipX = Math.max(PAD.l + 18, Math.min(crosshairX, w - PAD.r - 18))
            const tipY = Math.max(PAD.t + 10, crosshairY - 14)
            return (
              <>
                <line x1={crosshairX.toFixed(1)} y1={PAD.t} x2={crosshairX.toFixed(1)} y2={PAD.t + IH}
                  stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="3,2" pointerEvents="none" />
                <circle cx={crosshairX.toFixed(1)} cy={crosshairY.toFixed(1)} r="3.5"
                  fill="#60a5fa" stroke="white" strokeWidth="1.5" pointerEvents="none" />
                <rect x={tipX - 16} y={tipY - 8} width="32" height="13" rx="3"
                  fill="rgba(15,23,42,0.92)" pointerEvents="none" />
                <text x={tipX} y={tipY} textAnchor="middle" dominantBaseline="middle"
                  fontSize="8" fill="white" pointerEvents="none">
                  {fmtEle(crosshairAlt, unit)}
                </text>
              </>
            )
          })()}

          <rect
            x={PAD.l} y={PAD.t} width={IW} height={IH}
            fill="transparent"
            style={{ cursor: 'crosshair' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => onHoverDistance?.(null)}
          />
        </svg>
      </div>
    </div>
  )
}
