import { useEffect, useRef } from 'react'

interface Props {
  min: number
  max: number
  step: number
  valueMin: number
  valueMax: number
  onChange: (min: number, max: number) => void
}

export default function RangeSlider({ min, max, step, valueMin, valueMax, onChange }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<'min' | 'max' | null>(null)

  // Always-current snapshot so the document-level handlers never close over stale values
  const state = useRef({ min, max, step, valueMin, valueMax, onChange })
  state.current = { min, max, step, valueMin, valueMax, onChange }

  const range = max - min || 1
  const minPct = ((valueMin - min) / range) * 100
  const maxPct = ((valueMax - min) / range) * 100

  useEffect(() => {
    const snap = (v: number) => Math.round(v / step) * step

    const valueFromX = (clientX: number) => {
      if (!trackRef.current) return state.current.min
      const rect = trackRef.current.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      const { min, max } = state.current
      return snap(min + pct * (max - min))
    }

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current) return
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const v = valueFromX(clientX)
      const { valueMin, valueMax, onChange, step } = state.current
      if (dragging.current === 'min') onChange(Math.min(v, valueMax - step), valueMax)
      else onChange(valueMin, Math.max(v, valueMin + step))
    }

    const onUp = () => { dragging.current = null }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onUp)
    }
  }, []) // mount/unmount only — latest values come from state.current

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragging.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const snap = (v: number) => Math.round(v / step) * step
    const v = snap(min + pct * range)
    if (Math.abs(v - valueMin) <= Math.abs(v - valueMax)) {
      onChange(Math.min(v, valueMax - step), valueMax)
    } else {
      onChange(valueMin, Math.max(v, valueMin + step))
    }
  }

  const startDrag = (handle: 'min' | 'max') => (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragging.current = handle
  }

  return (
    <div
      ref={trackRef}
      className="relative h-5 mx-2 cursor-pointer select-none"
      onClick={handleTrackClick}
    >
      {/* Base track */}
      <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1.5 rounded-full bg-gray-700 pointer-events-none" />
      {/* Active fill between handles */}
      <div
        className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-strava pointer-events-none"
        style={{ left: `${minPct}%`, right: `${100 - maxPct}%` }}
      />
      {/* Min handle */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-strava shadow-md cursor-grab active:cursor-grabbing hover:scale-110 transition-transform z-10"
        style={{ left: `${minPct}%` }}
        onMouseDown={startDrag('min')}
        onTouchStart={startDrag('min')}
        onClick={(e) => e.stopPropagation()}
      />
      {/* Max handle */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-strava shadow-md cursor-grab active:cursor-grabbing hover:scale-110 transition-transform z-10"
        style={{ left: `${maxPct}%` }}
        onMouseDown={startDrag('max')}
        onTouchStart={startDrag('max')}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}
