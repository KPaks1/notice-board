import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { LatLngTuple } from 'leaflet'

function decodePolyline(encoded: string): LatLngTuple[] {
  const coords: LatLngTuple[] = []
  let idx = 0, lat = 0, lng = 0
  while (idx < encoded.length) {
    let shift = 0, result = 0, b: number
    do { b = encoded.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lat += result & 1 ? ~(result >> 1) : result >> 1
    shift = 0; result = 0
    do { b = encoded.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lng += result & 1 ? ~(result >> 1) : result >> 1
    coords.push([lat / 1e5, lng / 1e5])
  }
  return coords
}

interface Props {
  polyline: string
}

export default function SegmentMiniMap({ polyline }: Props) {
  const coords = decodePolyline(polyline)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el || coords.length === 0) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || mapRef.current) return
        observer.disconnect()

        const map = L.map(el, {
          zoomControl: false,
          dragging: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          touchZoom: false,
          keyboard: false,
          attributionControl: false,
        })
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png').addTo(map)
        L.polyline(coords, { color: '#f97316', weight: 3, opacity: 0.9 }).addTo(map)
        map.fitBounds(coords, { padding: [14, 14] })
        mapRef.current = map
      },
      { rootMargin: '150px' },
    )
    observer.observe(el)

    return () => {
      observer.disconnect()
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [polyline]) // eslint-disable-line react-hooks/exhaustive-deps

  if (coords.length === 0) return null

  return <div ref={containerRef} style={{ height: '110px', width: '100%', pointerEvents: 'none' }} />
}
