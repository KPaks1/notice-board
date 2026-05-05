import { useEffect, useState } from 'react'

interface Coords {
  lat: number
  lng: number
}

export function useLocation() {
  const [coords, setCoords] = useState<Coords | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.')
      setLoading(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
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
