import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchSegments } from '../api'
import type { ScoredSegment } from '../types'

interface Coords { lat: number; lng: number }

// Snap to ~1km grid so minor GPS jitter doesn't invalidate cache keys
const SNAP = 0.01
const snap = (v: number) => Math.round(v / SNAP) * SNAP

export function useSegments(coords: Coords | null, activityType: string, targetType: string, radiusKm: number) {
  const [allSegments, setAllSegments] = useState<ScoredSegment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const coordsRef = useRef(coords)
  coordsRef.current = coords

  const snappedLat = coords ? snap(coords.lat) : null
  const snappedLng = coords ? snap(coords.lng) : null
  const fetchKey = snappedLat != null ? `${snappedLat}:${snappedLng}:${activityType}:${targetType}:${radiusKm}` : null
  const prevFetchKey = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    const c = coordsRef.current
    if (!c) return
    setLoading(true)
    setError(null)
    try {
      setAllSegments(await fetchSegments(c.lat, c.lng, activityType, targetType, radiusKm))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [activityType, targetType, radiusKm])

  useEffect(() => {
    if (!fetchKey) return
    if (prevFetchKey.current === fetchKey && allSegments.length > 0) return
    prevFetchKey.current = fetchKey
    refresh()
  }, [fetchKey, refresh, allSegments.length])

  return { allSegments, loading, error, refresh }
}
