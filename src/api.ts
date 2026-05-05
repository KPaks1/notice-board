import type { BestEffortsResponse, ScoredSegment, StravaStatus } from './types'

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
  if (res.status === 401) return { connected: false }
  if (!res.ok) throw new Error(`status ${res.status}`)
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

export async function starSegment(id: number, starred: boolean): Promise<void> {
  const res = await fetch(`/api/segment-star?id=${id}`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ starred }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? 'Failed to star segment')
  }
}


export async function fetchAthleteEfforts(): Promise<BestEffortsResponse> {
  const res = await fetch('/api/athlete-efforts', { headers: authHeaders() })
  if (!res.ok) throw new Error('Failed to fetch athlete efforts')
  return res.json()
}

export async function refreshAthleteEfforts(): Promise<BestEffortsResponse> {
  const res = await fetch('/api/athlete-efforts/refresh', {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to refresh athlete efforts')
  return res.json()
}
