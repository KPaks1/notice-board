import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet'
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

function FitBounds({ coords }: { coords: LatLngTuple[] }) {
  const map = useMap()
  useEffect(() => {
    if (coords.length > 0) map.fitBounds(coords, { padding: [14, 14] })
  }, [map, coords])
  return null
}

interface Props {
  polyline: string
}

export default function SegmentMiniMap({ polyline }: Props) {
  const coords = decodePolyline(polyline)
  const containerRef = useRef<HTMLDivElement>(null)
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldRender(true)
          observer.disconnect()
        }
      },
      { rootMargin: '150px' }, // start loading slightly before the card is visible
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  if (coords.length === 0) return null
  const center = coords[Math.floor(coords.length / 2)]

  return (
    <div ref={containerRef} style={{ height: '110px' }}>
      {shouldRender && (
        <MapContainer
          center={center}
          zoom={14}
          style={{ height: '110px', width: '100%', pointerEvents: 'none' }}
          zoomControl={false}
          dragging={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          touchZoom={false}
          keyboard={false}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
            keepBuffer={0}
          />
          <Polyline positions={coords} pathOptions={{ color: '#f97316', weight: 3, opacity: 0.9 }} />
          <FitBounds coords={coords} />
        </MapContainer>
      )}
    </div>
  )
}
