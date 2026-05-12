import type { BestEffortsResponse, ScoredSegment, StravaStatus } from './types'

export const TOKEN_KEY = 'en_token'

export function storeToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY)
}

export function authHeaders(): Record<string, string> {
  const token = sessionStorage.getItem(TOKEN_KEY)
  return token ? { 'X-Session-Token': token } : {}
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

export type AdminAthlete = { athleteId: string; athleteName: string | null; athletePhoto: string | null }
type AdminResult = { revoked: number; errors: { athleteId: string; error: string }[] }

function adminHeaders(secret: string): Record<string, string> {
  return { 'x-admin-secret': secret }
}

export async function fetchAdminAthletes(secret: string): Promise<AdminAthlete[]> {
  const res = await fetch('/api/mgmt/athletes', { headers: adminHeaders(secret) })
  if (res.status === 401) throw new Error('Invalid secret')
  if (!res.ok) throw new Error('Failed to fetch athletes')
  return res.json()
}

export async function adminDeauthAll(secret: string): Promise<AdminResult> {
  const res = await fetch('/api/mgmt/force-deauth-all', {
    method: 'POST',
    headers: adminHeaders(secret),
  })
  if (res.status === 401) throw new Error('Invalid secret')
  if (!res.ok) throw new Error('Failed to deauth')
  return res.json()
}

export async function adminDeauthSome(secret: string, athleteIds: string[]): Promise<AdminResult> {
  const res = await fetch('/api/mgmt/force-deauth', {
    method: 'POST',
    headers: { ...adminHeaders(secret), 'Content-Type': 'application/json' },
    body: JSON.stringify({ athleteIds }),
  })
  if (res.status === 401) throw new Error('Invalid secret')
  if (!res.ok) throw new Error('Failed to deauth')
  return res.json()
}

export async function refreshAthleteEfforts(): Promise<BestEffortsResponse> {
  const res = await fetch('/api/athlete-efforts/refresh', {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) {
    const err = Object.assign(new Error('Failed to refresh athlete efforts'), { status: res.status })
    throw err
  }
  return res.json()
}
