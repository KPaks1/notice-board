import { useEffect, useState } from 'react'
import { haversineKm } from '../geo'

interface Coords {
  lat: number
  lng: number
}

const CACHE_KEY = 'eviction-notice-location'
// Only update coords (and trigger potential re-fetches) if user moved this far
const MOVE_THRESHOLD_KM = 0.5

function readCached(): Coords | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Coords
  } catch {
    return null
  }
}

function writeCached(coords: Coords) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(coords))
  } catch {}
}

export function useLocation() {
  const [coords, setCoords] = useState<Coords | null>(() => readCached())
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(() => readCached() === null)

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.')
      setLoading(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const fresh = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setCoords((prev) => {
          writeCached(fresh)
          if (!prev || haversineKm(prev.lat, prev.lng, fresh.lat, fresh.lng) >= MOVE_THRESHOLD_KM) {
            return fresh
          }
          return prev
        })
        setLoading(false)
      },
      () => {
        setError('Unable to get your location. Please allow location access.')
        setLoading(false)
      },
    )
  }, [])

  return { coords, error, loading }
}
