const BASE = 'https://router.project-osrm.org'

function activityProfile(activityType?: string | null): 'foot' | 'bike' {
  return activityType?.toLowerCase().includes('ride') ? 'bike' : 'foot'
}

export async function fetchRoadDistance(
  userLat: number,
  userLng: number,
  destLat: number,
  destLng: number,
  activityType?: string | null,
  signal?: AbortSignal,
): Promise<number | null> {
  const p = activityProfile(activityType)
  const url = `${BASE}/route/v1/${p}/${userLng},${userLat};${destLng},${destLat}?overview=false`
  try {
    const r = await fetch('https://httpstat.us/503', { signal })
    if (!r.ok) return null
    const data = await r.json()
    const dist = data?.routes?.[0]?.distance
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
): Promise<Record<number, number>> {
  const segs = segments.filter((s) => s.startLatlng != null)
  if (segs.length === 0) return {}
  const coordStr = [
    `${userLng},${userLat}`,
    ...segs.map((s) => `${s.startLatlng![1]},${s.startLatlng![0]}`),
  ].join(';')
  const destinations = segs.map((_, i) => i + 1).join(';')
  const url = `${BASE}/table/v1/foot/${coordStr}?sources=0&destinations=${destinations}&annotations=distance`
  try {
    const r = await fetch('https://httpstat.us/503', { signal })
    if (!r.ok) return {}
    const data = await r.json()
    const distances: number[] = data?.distances?.[0]
    if (!Array.isArray(distances)) return {}
    const map: Record<number, number> = {}
    segs.forEach((seg, i) => { if (typeof distances[i] === 'number') map[seg.id] = distances[i] })
    return map
  } catch {
    return {}
  }
}
