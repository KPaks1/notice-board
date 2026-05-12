import { useEffect, useState } from 'react'
import { fetchAthleteEfforts, refreshAthleteEfforts, RateLimitError } from '../api'
import type { BestEffortsResponse } from '../types'

export function useAthleteEfforts() {
  const [efforts, setEfforts] = useState<BestEffortsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null)

  useEffect(() => {
    fetchAthleteEfforts().then(setEfforts).catch(() => setEfforts({ computed: false }))
  }, [])

  async function refresh() {
    setLoading(true)
    setError(null)
    setRateLimitedUntil(null)
    try {
      setEfforts(await refreshAthleteEfforts())
    } catch (e) {
      if (e instanceof RateLimitError) {
        setRateLimitedUntil(Date.now() + e.retryAfter * 1000)
      }
      setError(e instanceof Error ? e.message : 'Failed to compute')
    } finally {
      setLoading(false)
    }
  }

  return { efforts, loading, error, refresh, rateLimitedUntil }
}
