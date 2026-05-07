import { authHeaders } from './api'

export async function fetchRoadDistance(
  userLat: number,
  userLng: number,
  destLat: number,
  destLng: number,
  activityType?: string | null,
  signal?: AbortSignal,
): Promise<number | null> {
  try {
    const res = await fetch('/api/road-distance', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ userLat, userLng, destinations: [{ id: 0, lat: destLat, lng: destLng }], activityType }),
      signal,
    })
    if (!res.ok) return null
    const data = await res.json()
    const dist = data?.[0]
    return typeof dist === 'number' ? dist : null
  } catch {
    return null
  }
}

export async function fetchRoadDistances(
  userLat: number,
  userLng: number,
  segments: { id: number; startLatlng: [number, number] | null }[],
  signal?: AbortSignal,
  activityType?: string | null,
): Promise<Record<number, number>> {
  const segs = segments.filter((s) => s.startLatlng != null)
  if (segs.length === 0) return {}
  const destinations = segs.map((s) => ({ id: s.id, lat: s.startLatlng![0], lng: s.startLatlng![1] }))
  try {
    const res = await fetch('/api/road-distance', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ userLat, userLng, destinations, activityType }),
      signal,
    })
    if (!res.ok) return {}
    const data: Record<string, number> = await res.json()
    const map: Record<number, number> = {}
    for (const [key, val] of Object.entries(data)) {
      if (typeof val === 'number') map[Number(key)] = val
    }
    return map
  } catch {
    return {}
  }
}
