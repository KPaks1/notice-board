import { StravaError } from './stravaError.js'

const BASE = 'https://www.strava.com/api/v3'

export async function stravaGet(path, accessToken) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new StravaError(res.status)
  return res.json()
}

export async function stravaPut(path, accessToken, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new StravaError(res.status)
  return res.json()
}
