import { useEffect, useRef, useState } from 'react'
import type { SegmentMode, ScoredSegment } from '../types'
import type { Unit } from '../format'
import SegmentCard from './SegmentCard'

const PAGE_SIZE = 25

function Skeleton() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse">
      <div className="flex justify-between mb-2">
        <div className="h-4 bg-gray-700 rounded w-2/3" />
        <div className="h-5 bg-gray-700 rounded-full w-16" />
      </div>
      <div className="h-3 bg-gray-800 rounded w-1/3 mb-3" />
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-gray-800 rounded-lg h-12" />
        ))}
      </div>
    </div>
  )
}

interface Props {
  segments: ScoredSegment[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  mode: SegmentMode
  unit: Unit
  userLat: number
  userLng: number
  roadDistances: Record<number, number>
  onHoverSegment?: (id: number | null) => void
  onSelect?: (segment: ScoredSegment) => void
  selectedSegmentId?: number | null
  rateLimitedUntil?: number | null
  targetType?: string
  onSwitchToKom?: () => void
}

function useSecondsUntil(timestamp: number | null | undefined): number | null {
  const [seconds, setSeconds] = useState<number | null>(null)
  useEffect(() => {
    if (!timestamp) { setSeconds(null); return }
    const update = () => setSeconds(Math.max(Math.ceil((timestamp - Date.now()) / 1000), 0))
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [timestamp])
  return seconds
}

export default function EvictionsList({ segments, loading, error, onRefresh, mode, unit, userLat, userLng, roadDistances, onHoverSegment, onSelect, selectedSegmentId, rateLimitedUntil, targetType, onSwitchToKom }: Props) {
  const secondsLeft = useSecondsUntil(rateLimitedUntil)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Reset to first page whenever the segment list changes (new fetch, sort change, filter change)
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [segments])

  // Auto-load next page when the sentinel scrolls into view
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount((c) => Math.min(c + PAGE_SIZE, segments.length)) },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [segments.length])

  if (loading && segments.length === 0) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} />)}
      </div>
    )
  }

  if (error) {
    const isRateLimited = rateLimitedUntil != null
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 text-sm mb-4">{error}</p>
        {isRateLimited && secondsLeft !== null && secondsLeft > 0 ? (
          <p className="text-xs text-gray-500">Retrying automatically in {secondsLeft}s</p>
        ) : (
          <button
            onClick={onRefresh}
            className="text-sm text-strava hover:text-strava-light underline"
          >
            Try again
          </button>
        )}
      </div>
    )
  }

  if (segments.length === 0) {
    if (targetType === 'personal_best') {
      return (
        <div className="text-center py-16">
          <p className="text-4xl mb-4">🏅</p>
          <p className="text-white font-medium mb-1">No personal records found nearby</p>
          <p className="text-gray-400 text-sm mb-4">
            Get out there and take some segments — your PRs will show up here once you've ridden them.
          </p>
          {onSwitchToKom && (
            <button
              onClick={onSwitchToKom}
              className="text-sm text-strava hover:text-strava-light underline"
            >
              Switch to KOM Hunt mode
            </button>
          )}
        </div>
      )
    }
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-4">🏳️</p>
        <p className="text-white font-medium mb-1">No segments found</p>
        <p className="text-gray-400 text-sm">
          {mode === 'hunt'
            ? 'No segments within 35% of your pace nearby. Try a wider radius.'
            : 'No beatable segments nearby. Try Hunt mode to find segments within reach.'}
        </p>
      </div>
    )
  }

  const label = mode === 'hunt' ? '🎯 In Range' : '🌾 Easy Wins'
  const visible = segments.slice(0, visibleCount)
  const hasMore = visibleCount < segments.length

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1 flex items-center gap-2">
        {label} ({segments.length})
        {loading && (
          <span className="inline-block w-3 h-3 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
        )}
      </p>
      {visible.map((s) => <SegmentCard key={s.id} segment={s} unit={unit} userLat={userLat} userLng={userLng} roadDistance={roadDistances[s.id]} onHover={onHoverSegment} onSelect={onSelect} isSelected={selectedSegmentId === s.id} />)}
      {hasMore && <div ref={sentinelRef} className="h-4" />}
    </div>
  )
}
