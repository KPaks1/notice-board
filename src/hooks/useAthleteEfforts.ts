import { useEffect, useState } from 'react'
import { fetchAthleteEfforts, refreshAthleteEfforts } from '../api'
import type { BestEffortsResponse } from '../types'

export function useAthleteEfforts() {
  const [efforts, setEfforts] = useState<BestEffortsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAthleteEfforts().then(setEfforts).catch(() => setEfforts({ computed: false }))
  }, [])

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      setEfforts(await refreshAthleteEfforts())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to compute')
    } finally {
      setLoading(false)
    }
  }

  return { efforts, loading, error, refresh }
}
