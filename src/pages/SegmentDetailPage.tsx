import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, Crosshair, ExternalLink, LocateFixed, Star } from 'lucide-react'
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet'
import L from 'leaflet'
import polylineDecoder from '@mapbox/polyline'
import { clearToken, starSegment } from '../api'
import { formatDistance, formatPace, formatTime, type Unit } from '../format'
import type { ScoredSegment } from '../types'

function MapController({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap()
  useEffect(() => { onReady(map) }, [map, onReady])
  return null
}

function Badge({ score }: { score: number }) {
  if (score > 0)
    return <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-500/20 text-green-400">BEATABLE</span>
  if (score > -0.05)
    return <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-500/20 text-amber-400">CLOSE</span>
  return <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-700 text-gray-400">TOUGH</span>
}

function StatBox({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className="bg-gray-800 rounded-lg p-3 text-center">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`font-mono font-medium text-sm ${highlight ? 'text-green-400' : 'text-white'}`}>{value}</div>
      {sub && <div className={`font-mono text-xs mt-0.5 ${highlight ? 'text-green-400/70' : 'text-gray-500'}`}>{sub}</div>}
    </div>
  )
}

export default function SegmentDetailPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const segment: ScoredSegment | null = state?.segment ?? (state as ScoredSegment | null)
  const unit: Unit = state?.unit ?? 'km'
  const [starred, setStarred] = useState(segment?.starred ?? false)
  const [starError, setStarError] = useState<string | null>(null)
  const mapRef = useRef<L.Map | null>(null)

  async function toggleStar() {
    if (!segment) return
    const next = !starred
    setStarred(next)
    setStarError(null)
    try {
      await starSegment(segment.id, next)
    } catch (e) {
      setStarred(!next)
      const msg = e instanceof Error ? e.message : ''
      setStarError(
        msg === 'scope_required'
          ? 'Disconnect and reconnect Strava to enable starring segments.'
          : 'Failed to update star.',
      )
    }
  }

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

  const userLat: number | null = state?.userLat ?? null
  const userLng: number | null = state?.userLng ?? null

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
        <button
          onClick={toggleStar}
          className="p-1 rounded-lg text-gray-400 hover:text-white transition-colors"
          aria-label={starred ? 'Unstar segment' : 'Star segment'}
        >
          <Star size={20} className={starred ? 'text-yellow-400 fill-yellow-400' : ''} />
        </button>
        <Badge score={segment.score} />
      </header>

      <div className="px-4 pb-4 flex-1 overflow-y-auto space-y-5">
        <p className="text-xs text-gray-500">
          {formatDistance(segment.distance, unit)}
          {segment.elevationGain > 0 && ` · ${Math.round(segment.elevationGain)}m climb`}
          {segment.city && ` · ${segment.city}`}
        </p>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <StatBox label={segment.targetLabel} value={formatTime(segment.targetTime)} sub={formatPace(segment.targetTime, segment.distance, unit)} />
            <StatBox label="Your PR" value={segment.userPR ? formatTime(segment.userPR) : '—'} sub={segment.userPR ? formatPace(segment.userPR, segment.distance, unit) : undefined} />
          </div>
          {segment.estimatedTime != null && (
            <StatBox label="Est. best" value={formatTime(segment.estimatedTime)} sub={formatPace(segment.estimatedTime, segment.distance, unit)} />
          )}
        </div>
        {starError && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-red-500/10 px-3 py-2">
            <p className="text-xs text-red-400">{starError}</p>
            {starError.includes('reconnect') && (
              <button
                onClick={() => { clearToken(); navigate('/connect-strava', { replace: true }) }}
                className="text-xs text-orange-400 hover:text-orange-300 shrink-0"
              >
                Reconnect
              </button>
            )}
          </div>
        )}

        {decodedPath && mapBounds ? (
          <div className="rounded-xl overflow-hidden relative" style={{ height: '240px' }}>
            <MapContainer bounds={mapBounds} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png" />
              <Polyline positions={decodedPath} color="#f97316" weight={4} />
              {segment.startLatlng && (
                <CircleMarker center={segment.startLatlng} radius={6} pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 1 }} />
              )}
              {segment.endLatlng && (
                <CircleMarker center={segment.endLatlng} radius={6} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1 }} />
              )}
              {userLat != null && userLng != null && (
                <CircleMarker center={[userLat, userLng]} radius={8} pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.9, weight: 2 }} />
              )}
<MapController onReady={(m) => { mapRef.current = m }} />
            </MapContainer>
            <div className="absolute bottom-2 right-2 z-[1000] flex flex-col gap-1">
              <button
                onClick={() => mapRef.current?.fitBounds(mapBounds, { padding: [20, 20] })}
                className="p-2 rounded-lg bg-gray-900/90 text-white hover:bg-gray-800 transition-colors shadow"
                aria-label="Recentre on segment"
              >
                <Crosshair size={16} />
              </button>
              {userLat != null && userLng != null && (
                <button
                  onClick={() => mapRef.current?.setView([userLat, userLng], 15)}
                  className="p-2 rounded-lg bg-gray-900/90 text-blue-400 hover:bg-gray-800 transition-colors shadow"
                  aria-label="Recentre on my location"
                >
                  <LocateFixed size={16} />
                </button>
              )}
            </div>
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
