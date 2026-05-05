import type { ScoredSegment, StravaStatus } from './types'

export const TOKEN_KEY = 'en_token'

export function storeToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY)
}

function authHeaders(): Record<string, string> {
  const token = sessionStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchStravaStatus(): Promise<StravaStatus> {
  const res = await fetch('/api/strava-status', { headers: authHeaders() })
  if (!res.ok) throw new Error('Failed to fetch Strava status')
  return res.json()
}

export async function fetchSegments(
  lat: number,
  lng: number,
  activityType: string,
  targetType: string,
): Promise<ScoredSegment[]> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    activityType,
    targetType,
  })
  const res = await fetch(`/api/segments?${params}`, { headers: authHeaders() })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? 'Failed to fetch segments')
  }
  return res.json()
}
