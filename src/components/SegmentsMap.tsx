import { MapContainer, TileLayer, CircleMarker, Marker, Popup } from 'react-leaflet'
import type { ScoredSegment } from '../types'

interface Props {
  segments: ScoredSegment[]
  userLat: number
  userLng: number
  onSegmentClick: (id: number) => void
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

export default function SegmentsMap({ segments, userLat, userLng, onSegmentClick }: Props) {
  return (
    <MapContainer
      center={[userLat, userLng]}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <Marker position={[userLat, userLng]} />
      {segments.map((seg) => (
        <CircleMarker
          key={seg.id}
          center={[seg.midpointLat, seg.midpointLng]}
          radius={9}
          pathOptions={{ color: markerColor(seg.score), fillColor: markerColor(seg.score), fillOpacity: 0.85, weight: 2 }}
        >
          <Popup>
            <div style={{ minWidth: '140px' }}>
              <p style={{ fontWeight: 600, marginBottom: '4px' }}>{seg.name}</p>
              <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>
                {(seg.distance / 1000).toFixed(1)} km · {badgeText(seg.score)}
              </p>
              <button
                onClick={() => onSegmentClick(seg.id)}
                style={{ fontSize: '12px', color: '#f97316', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                View details →
              </button>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
