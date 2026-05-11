import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { ScoredSegment } from '../types'

interface Props {
  segments: ScoredSegment[]
  userLat: number
  userLng: number
  hoveredSegmentId?: number | null
  onSegmentClick: (id: number) => void
  onSegmentHover?: (id: number | null) => void
}

function markerColor(score: number): string {
  if (score > 0) return '#22c55e'
  if (score > -0.05) return '#f59e0b'
  return '#6b7280'
}

function badgeText(score: number): string {
  if (score > 0) return 'BEATABLE'
  if (score > -0.05) return 'CLOSE'
  return 'TOUGH'
}

// Calls invalidateSize when the map container is revealed after being hidden (display:none).
function MapInvalidator() {
  const map = useMap()
  useEffect(() => {
    const container = map.getContainer()
    const ro = new ResizeObserver(() => {
      if (container.offsetWidth > 0 || container.offsetHeight > 0) {
        map.invalidateSize()
      }
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [map])
  return null
}

function SegmentMarker({ seg, hovered, onSegmentClick, onSegmentHover }: { seg: ScoredSegment; hovered: boolean; onSegmentClick: (id: number) => void; onSegmentHover?: (id: number | null) => void }) {
  const markerRef = useRef<L.CircleMarker | null>(null)

  useEffect(() => {
    const m = markerRef.current
    if (!m) return
    if (hovered) m.openPopup()
    else m.closePopup()
  }, [hovered])

  return (
    <CircleMarker
      ref={markerRef}
      center={[seg.midpointLat, seg.midpointLng]}
      radius={hovered ? 12 : 9}
      pathOptions={{
        color: hovered ? '#ffffff' : markerColor(seg.score),
        fillColor: markerColor(seg.score),
        fillOpacity: hovered ? 1 : 0.85,
        weight: hovered ? 3 : 2,
      }}
    >
      <Popup>
        <div
          style={{ minWidth: '140px' }}
          onMouseEnter={() => onSegmentHover?.(seg.id)}
          onMouseLeave={() => onSegmentHover?.(null)}
        >
          <p style={{ fontWeight: 600, marginBottom: '4px' }}>{seg.name}</p>
          <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>
            {(seg.distance / 1000).toFixed(1)} km · {badgeText(seg.score)}
          </p>
          <button
            onClick={() => onSegmentClick(seg.id)}
            style={{ fontSize: '12px', color: '#FC5200', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            View details →
          </button>
        </div>
      </Popup>
    </CircleMarker>
  )
}

export default function SegmentsMap({ segments, userLat, userLng, hoveredSegmentId, onSegmentClick, onSegmentHover }: Props) {
  return (
    <MapContainer
      key={`${userLat},${userLng}`}
      center={[userLat, userLng]}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <MapInvalidator />
      <Marker position={[userLat, userLng]} />
      {segments.map((seg) => (
        <SegmentMarker
          key={seg.id}
          seg={seg}
          hovered={hoveredSegmentId === seg.id}
          onSegmentClick={onSegmentClick}
          onSegmentHover={onSegmentHover}
        />
      ))}
    </MapContainer>
  )
}
