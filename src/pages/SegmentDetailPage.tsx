import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, ExternalLink } from 'lucide-react'
import { MapContainer, TileLayer, Polyline, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import polylineDecoder from '@mapbox/polyline'
import type { ScoredSegment } from '../types'

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`
  return `${Math.round(meters)} m`
}

function formatPace(seconds: number, distanceM: number): string {
  const secsPerKm = (seconds / distanceM) * 1000
  const m = Math.floor(secsPerKm / 60)
  const s = Math.floor(secsPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')} /km`
}

function Badge({ score }: { score: number }) {
  if (score > 0)
    return <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-500/20 text-green-400">BEATABLE</span>
  if (score > -0.05)
    return <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-500/20 text-amber-400">CLOSE</span>
  return <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-700 text-gray-400">TOUGH</span>
}

function StatBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-gray-800 rounded-lg p-3 text-center">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`font-mono font-medium text-sm ${highlight ? 'text-green-400' : 'text-white'}`}>{value}</div>
    </div>
  )
}

export default function SegmentDetailPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const segment = state as ScoredSegment | null

  if (!segment) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-gray-400 text-sm text-center">Open a segment from the list to see its details.</p>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-orange-400 text-sm"
        >
          <ChevronLeft size={16} /> Back to list
        </button>
      </div>
    )
  }

  const needTime = Math.max(0, segment.targetTime - 1)
  const decodedPath = segment.polyline ? polylineDecoder.decode(segment.polyline) as [number, number][] : null
  const mapBounds = decodedPath ? L.latLngBounds(decodedPath) : null

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col max-w-lg mx-auto">
      <header className="flex items-center gap-2 px-4 pt-6 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="p-1 -ml-1 rounded-lg text-gray-400 hover:text-white transition-colors"
          aria-label="Back"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-base font-semibold text-white leading-snug flex-1 line-clamp-2">{segment.name}</h1>
        <Badge score={segment.score} />
      </header>

      <div className="px-4 pb-4 flex-1 overflow-y-auto space-y-5">
        <p className="text-xs text-gray-500">
          {formatDistance(segment.distance)}
          {segment.elevationGain > 0 && ` · ${Math.round(segment.elevationGain)}m climb`}
          {segment.city && ` · ${segment.city}`}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <StatBox label={segment.targetLabel} value={formatTime(segment.targetTime)} />
          <StatBox label="Your PR" value={segment.userPR ? formatTime(segment.userPR) : '—'} />
          <StatBox label="Need" value={formatTime(needTime)} highlight={segment.score > 0} />
          <StatBox label="Pace needed" value={formatPace(needTime, segment.distance)} />
        </div>

        {decodedPath && mapBounds ? (
          <div className="rounded-xl overflow-hidden" style={{ height: '240px' }}>
            <MapContainer bounds={mapBounds} style={{ height: '100%', width: '100%' }} zoomControl={false}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              <Polyline positions={decodedPath} color="#f97316" weight={4} />
              {segment.startLatlng && (
                <CircleMarker center={segment.startLatlng} radius={6} pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 1 }} />
              )}
              {segment.endLatlng && (
                <CircleMarker center={segment.endLatlng} radius={6} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1 }} />
              )}
            </MapContainer>
          </div>
        ) : (
          <div className="rounded-xl bg-gray-800 flex items-center justify-center text-gray-500 text-xs" style={{ height: '120px' }}>
            Route unavailable
          </div>
        )}

        <a
          href={`https://www.strava.com/segments/${segment.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
        >
          View on Strava <ExternalLink size={15} />
        </a>
      </div>
    </div>
  )
}
