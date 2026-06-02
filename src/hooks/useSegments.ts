import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchSegments, RateLimitError } from '../api'
import type { ScoredSegment } from '../types'

interface Coords { lat: number; lng: number }

// Snap to ~1km grid so minor GPS jitter doesn't invalidate cache keys
const SNAP = 0.01
const snap = (v: number) => Math.round(v / SNAP) * SNAP


export function useSegments(coords: Coords | null, activityType: string, radiusKm: number, sortBy: string) {
  const [allSegments, setAllSegments] = useState<ScoredSegment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null)
  const coordsRef = useRef(coords)
  coordsRef.current = coords
  const sortByRef = useRef(sortBy)
  sortByRef.current = sortBy
  // Read radiusKm at call time — radius changes are display-only and must not trigger a refetch
  const radiusKmRef = useRef(radiusKm)
  radiusKmRef.current = radiusKm
  const abortRef = useRef<AbortController | null>(null)

  const snappedLat = coords ? snap(coords.lat) : null
  const snappedLng = coords ? snap(coords.lng) : null
  // Radius excluded from fetchKey — it controls tile coverage at fetch time via ref, not re-fetch triggers
  const fetchKey = snappedLat != null
    ? `${snappedLat}:${snappedLng}:${activityType}`
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
        c.lat, c.lng, activityType, radiusKmRef.current, sortByRef.current,
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
        c.lat, c.lng, activityType, radiusKmRef.current, sortByRef.current,
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
  }, [activityType])

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
