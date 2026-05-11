export type Unit = 'km' | 'mile'

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatDistance(meters: number, unit: Unit = 'km'): string {
  if (unit === 'mile') return `${(meters / 1609.34).toFixed(2)} mi`
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`
  return `${Math.round(meters)} m`
}

export function formatPace(timeSecs: number, distanceM: number, unit: Unit = 'km'): string {
  if (!timeSecs || !distanceM) return '—'
  const unitDist = unit === 'mile' ? 1609.34 : 1000
  const secs = (timeSecs / distanceM) * unitDist
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${String(s).padStart(2, '0')} /${unit === 'mile' ? 'mi' : 'km'}`
}

export function formatRadius(km: number, unit: Unit = 'km'): string {
  if (unit === 'mile') return `${(km / 1.60934).toFixed(1)} mi`
  return `${km} km`
}

export function formatKm(km: number, unit: Unit = 'km'): string {
  if (unit === 'mile') return `${(km / 1.60934).toFixed(2)} mi`
  return `${km} km`
}

export function formatElevation(metres: number, unit: Unit = 'km'): string {
  if (unit === 'mile') return `${Math.round(metres * 3.281)}ft`
  return `${Math.round(metres)}m`
}
