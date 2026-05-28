import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchSegments, RateLimitError } from '../api'
import type { ScoredSegment } from '../types'

interface Coords { lat: number; lng: number }

// Snap to ~1km grid so minor GPS jitter doesn't invalidate cache keys
const SNAP = 0.01
const snap = (v: number) => Math.round(v / SNAP) * SNAP

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

export function useSegments(coords: Coords | null, activityType: string, radiusKm: number, sortBy: string) {
  const [allSegments, setAllSegments] = useState<ScoredSegment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null)
  const coordsRef = useRef(coords)
  coordsRef.current = coords
  // Read sortBy at call time so changing sort re-orders client-side without triggering a refetch
  const sortByRef = useRef(sortBy)
  sortByRef.current = sortBy

  const debouncedRadiusKm = useDebounce(radiusKm, 800)

  const snappedLat = coords ? snap(coords.lat) : null
  const snappedLng = coords ? snap(coords.lng) : null
  const fetchKey = snappedLat != null
    ? `${snappedLat}:${snappedLng}:${activityType}:${debouncedRadiusKm}`
    : null
  const prevFetchKey = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    const c = coordsRef.current
    if (!c) return
    setLoading(true)
    setError(null)
    try {
      setAllSegments(await fetchSegments(c.lat, c.lng, activityType, debouncedRadiusKm, sortByRef.current))
      setRateLimitedUntil(null)
    } catch (e) {
      if (e instanceof RateLimitError) {
        setRateLimitedUntil(Date.now() + e.retryAfter * 1000)
      }
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [activityType, debouncedRadiusKm])

  // Auto-retry when the rate limit window expires
  useEffect(() => {
    if (!rateLimitedUntil) return
    const delay = rateLimitedUntil - Date.now()
    const t = setTimeout(() => {
      setRateLimitedUntil(null)
      refresh()
    }, Math.max(delay, 0))
    return () => clearTimeout(t)
  }, [rateLimitedUntil, refresh])

  useEffect(() => {
    if (!fetchKey) return
    if (prevFetchKey.current === fetchKey && allSegments.length > 0) return
    prevFetchKey.current = fetchKey
    refresh()
  }, [fetchKey, refresh, allSegments.length])

  return { allSegments, loading, error, refresh, rateLimitedUntil }
}
