import type { BestEffortsResponse, ScoredSegment, StravaStatus } from './types'

export const TOKEN_KEY = 'en_token'

export function storeToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY)
  return token ? { 'X-Session-Token': token } : {}
}

export class RateLimitError extends Error {
  retryAfter: number
  constructor(retryAfter = 60) {
    super('Strava rate limit exceeded. Retrying automatically…')
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
  }
}

function parseRetryAfter(res: Response): number {
  const raw = res.headers.get('Retry-After')
  const parsed = raw ? parseInt(raw, 10) : NaN
  return isNaN(parsed) ? 60 : parsed
}

export async function fetchStravaStatus(): Promise<StravaStatus> {
  const res = await fetch('/api/strava-status', { headers: authHeaders() })
  if (res.status === 401) { clearToken(); return { connected: false } }
  if (!res.ok) throw new Error(`status ${res.status}`)
  return res.json()
}

export async function fetchPublicSession(): Promise<void> {
  const res = await fetch('/api/public-session')
  if (!res.ok) throw new Error('No public session available')
  const { token } = await res.json()
  storeToken(token)
}

export async function fetchSegments(
  lat: number,
  lng: number,
  activityType: string,
  targetType: string,
  radiusKm: number,
): Promise<ScoredSegment[]> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    activityType,
    targetType,
    radiusKm: String(radiusKm),
  })
  const res = await fetch(`/api/segments?${params}`, { headers: authHeaders() })
  if (res.status === 429) throw new RateLimitError(parseRetryAfter(res))
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? 'Failed to fetch segments')
  }
  return res.json()
}

export async function resetSegmentPool(activityType: string): Promise<void> {
  const res = await fetch(`/api/segment-pool?activityType=${activityType}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? 'Failed to reset segment pool')
  }
}


export async function fetchAthleteEfforts(): Promise<BestEffortsResponse> {
  const res = await fetch('/api/athlete-efforts', { headers: authHeaders() })
  if (!res.ok) throw new Error('Failed to fetch athlete efforts')
  return res.json()
}

export async function fetchSegmentElevation(id: number): Promise<{ altitude: number[]; distance: number[] } | null> {
  const res = await fetch(`/api/segment-elevation?id=${id}`, { headers: authHeaders() })
  if (!res.ok) return null
  return res.json()
}

export async function deauthorizeStrava(): Promise<void> {
  await fetch('/api/strava-deauthorize', {
    method: 'POST',
    headers: authHeaders(),
  }).catch(() => {})
}

export async function refreshAthleteEfforts(): Promise<BestEffortsResponse> {
  const res = await fetch('/api/athlete-efforts/refresh', {
    method: 'POST',
    headers: authHeaders(),
  })
  if (res.status === 429) throw new RateLimitError(parseRetryAfter(res))
  if (!res.ok) {
    const err = Object.assign(new Error('Failed to refresh athlete efforts'), { status: res.status })
    throw err
  }
  return res.json()
}
