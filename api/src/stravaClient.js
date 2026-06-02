import { StravaError } from './stravaError.js'

const BASE = 'https://www.strava.com/api/v3'

// Per-token in-memory rate limit state (best-effort within a single function instance).
// Strava's 15-minute windows are clock-aligned: :00, :15, :30, :45.
const tokenRateLimits = new Map()

function alignedWindowResetMs() {
  const now = Date.now()
  const windowMs = 15 * 60 * 1000
  return now - (now % windowMs) + windowMs
}

function getState(accessToken) {
  let s = tokenRateLimits.get(accessToken)
  if (!s) {
    s = { limit15: 200, used15: 0, windowResetMs: alignedWindowResetMs() }
    tokenRateLimits.set(accessToken, s)
  }
  if (Date.now() >= s.windowResetMs) {
    s.used15 = 0
    s.windowResetMs = alignedWindowResetMs()
  }
  return s
}

function syncFromHeaders(accessToken, headers) {
  const limitHdr = headers.get('X-RateLimit-Limit')
  const usageHdr = headers.get('X-RateLimit-Usage')
  if (!limitHdr || !usageHdr) return
  const [l15] = limitHdr.split(',').map(Number)
  const [u15] = usageHdr.split(',').map(Number)
  const s = getState(accessToken)
  if (!isNaN(l15)) s.limit15 = l15
  if (!isNaN(u15)) s.used15 = u15
}

function probeRateLimit(accessToken) {
  const s = getState(accessToken)
  if (s.used15 >= s.limit15 - 5) {
    const retryAfter = Math.max(Math.ceil((s.windowResetMs - Date.now()) / 1000), 60)
    throw new StravaError(429, retryAfter)
  }
}

async function stravaFetch(path, accessToken, options = {}) {
  probeRateLimit(accessToken)
  const { headers: extraHeaders, ...rest } = options
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: { ...extraHeaders, Authorization: `Bearer ${accessToken}` },
  })
  syncFromHeaders(accessToken, res.headers)
  if (!res.ok) {
    if (res.status === 429) {
      const s = getState(accessToken)
      s.used15 = s.limit15  // mark window as exhausted
      const retryAfter = Math.max(Math.ceil((s.windowResetMs - Date.now()) / 1000), 60)
      throw new StravaError(429, retryAfter)
    }
    throw new StravaError(res.status)
  }
  return res.json()
}

export async function stravaGet(path, accessToken) {
  return stravaFetch(path, accessToken)
}

export async function stravaPut(path, accessToken, body) {
  return stravaFetch(path, accessToken, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
