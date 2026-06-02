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
  const abortRef = useRef<AbortController | null>(null)

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
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const signal = controller.signal

    const onSegment = (segment: ScoredSegment) =>
      setAllSegments((prev) => {
        const idx = prev.findIndex((s) => s.id === segment.id)
        if (idx >= 0) { const next = [...prev]; next[idx] = segment; return next }
        return [...prev, segment]
      })

    // Phase A: cache-only — returns quickly, shows cached segments immediately
    setLoading(true)
    setError(null)
    let cachedCount = 0
    try {
      await fetchSegments(
        c.lat, c.lng, activityType, debouncedRadiusKm, sortByRef.current,
        (seg) => { cachedCount++; onSegment(seg) },
        signal,
        true,
      )
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      // Phase A errors are non-fatal — Phase B may still succeed
    } finally {
      setLoading(false)
    }

    if (signal.aborted) return

    // Phase B: full live fetch — augments Phase A results silently
    try {
      await fetchSegments(
        c.lat, c.lng, activityType, debouncedRadiusKm, sortByRef.current,
        onSegment,
        signal,
      )
      setRateLimitedUntil(null)
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      if (e instanceof RateLimitError) {
        setRateLimitedUntil(Date.now() + e.retryAfter * 1000)
        if (cachedCount === 0) setError(e.message)
        return
      }
      if (cachedCount === 0) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      }
      // cachedCount > 0: user already sees cached segments, suppress the error
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
    if (prevFetchKey.current === fetchKey) return
    prevFetchKey.current = fetchKey
    setAllSegments([])
    refresh()
  }, [fetchKey, refresh])

  return { allSegments, loading, error, refresh, rateLimitedUntil }
}
