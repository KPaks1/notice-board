import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchSegments } from '../api'
import type { ScoredSegment } from '../types'

interface Coords { lat: number; lng: number }

export function useSegments(coords: Coords | null, activityType: string, targetType: string) {
  const [allSegments, setAllSegments] = useState<ScoredSegment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetchKey = `${activityType}:${targetType}`
  const prevFetchKey = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    if (!coords) return
    setLoading(true)
    setError(null)
    try {
      setAllSegments(await fetchSegments(coords.lat, coords.lng, activityType, targetType))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [coords, activityType, targetType])

  useEffect(() => {
    if (!coords) return
    if (prevFetchKey.current === fetchKey && allSegments.length > 0) return
    prevFetchKey.current = fetchKey
    refresh()
  }, [coords, fetchKey, refresh, allSegments.length])

  return { allSegments, loading, error, refresh }
}
