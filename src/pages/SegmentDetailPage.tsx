import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, Crosshair, ExternalLink, LocateFixed, Navigation } from 'lucide-react'
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet'
import L from 'leaflet'
import polylineDecoder from '@mapbox/polyline'
import { fetchSegmentElevation } from '../api'
import { fetchRoadDistance } from '../osrm'
import { haversineKm } from '../geo'
import DistanceToStart from '../components/DistanceToStart'
import { MapButton } from '../components/MapButton'
import ElevationChart from '../components/ElevationChart'
import ScoreGauge from '../components/ScoreGauge'
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
  const mapRef = useRef<L.Map | null>(null)
  const mapPanelRef = useRef<HTMLDivElement>(null)

  // Invalidate Leaflet size when the map panel resizes (e.g. mobile→desktop layout shift)
  useEffect(() => {
    const el = mapPanelRef.current
    if (!el) return
    const ro = new ResizeObserver(() => mapRef.current?.invalidateSize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const onMapReady = useCallback((m: L.Map) => { mapRef.current = m }, [])

  const userLat: number | null = state?.userLat ?? null
  const userLng: number | null = state?.userLng ?? null
  const [roadDistance, setRoadDistance] = useState<number | null>(null)
  const [elevation, setElevation] = useState<{ altitude: number[]; distance: number[] } | null>(null)
  const [elevationLoading, setElevationLoading] = useState(true)

  useEffect(() => {
    if (!segment) return
    setElevationLoading(true)
    fetchSegmentElevation(segment.id)
      .then((data) => { if (data) setElevation(data) })
      .finally(() => setElevationLoading(false))
  }, [segment?.id])

  useEffect(() => {
    if (!segment?.startLatlng || userLat == null || userLng == null) return
    const [startLat, startLng] = segment.startLatlng
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    fetchRoadDistance(userLat, userLng, startLat, startLng, segment.activityType, controller.signal)
      .then((dist) => { if (dist != null) setRoadDistance(dist) })
      .finally(() => clearTimeout(timeout))
    return () => { controller.abort(); clearTimeout(timeout) }
  }, [segment?.id, userLat, userLng])

  // Stable memoised path — decoded once so downstream memos don't thrash
  const decodedPath = useMemo(
    () => segment?.polyline ? polylineDecoder.decode(segment.polyline) as [number, number][] : null,
    [segment?.polyline],
  )
  const mapBounds = useMemo(() => decodedPath ? L.latLngBounds(decodedPath) : null, [decodedPath])

  // Cumulative distances (metres) along the decoded polyline
  const cumPathDists = useMemo(() => {
    if (!decodedPath || decodedPath.length < 2) return [] as number[]
    const d: number[] = [0]
    for (let i = 1; i < decodedPath.length; i++) {
      d.push(d[i - 1] + haversineKm(decodedPath[i - 1][0], decodedPath[i - 1][1], decodedPath[i][0], decodedPath[i][1]) * 1000)
    }
    return d
  }, [decodedPath])

  const [hoverDistanceM, setHoverDistanceM] = useState<number | null>(null)

  // Lat/lng on the path that corresponds to the current hover distance
  const hoverLatLng = useMemo((): [number, number] | null => {
    if (hoverDistanceM == null || !decodedPath || cumPathDists.length < 2) return null
    const maxD = cumPathDists[cumPathDists.length - 1]
    const d = Math.max(0, Math.min(hoverDistanceM, maxD))
    for (let i = 1; i < cumPathDists.length; i++) {
      if (cumPathDists[i] >= d) {
        const t = (d - cumPathDists[i - 1]) / (cumPathDists[i] - cumPathDists[i - 1]) || 0
        return [
          decodedPath[i - 1][0] + t * (decodedPath[i][0] - decodedPath[i - 1][0]),
          decodedPath[i - 1][1] + t * (decodedPath[i][1] - decodedPath[i - 1][1]),
        ]
      }
    }
    return decodedPath[decodedPath.length - 1]
  }, [hoverDistanceM, decodedPath, cumPathDists])

  // Map polyline hover → find nearest path point → set hover distance
  const handlePolylineMouseMove = useCallback((e: L.LeafletMouseEvent) => {
    if (!decodedPath || cumPathDists.length < 2) return
    const { lat, lng } = e.latlng
    let best = Infinity, bestDist = 0
    for (let i = 0; i < decodedPath.length; i++) {
      const d2 = (decodedPath[i][0] - lat) ** 2 + (decodedPath[i][1] - lng) ** 2
      if (d2 < best) { best = d2; bestDist = cumPathDists[i] }
    }
    setHoverDistanceM(bestDist)
  }, [decodedPath, cumPathDists])

  if (!segment) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-gray-400 text-sm text-center">Open a segment from the list to see its details.</p>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-strava text-sm"
        >
          <ChevronLeft size={16} /> Back to list
        </button>
      </div>
    )
  }

  const haversineM = segment.startLatlng && userLat != null && userLng != null
    ? haversineKm(userLat, userLng, segment.startLatlng[0], segment.startLatlng[1]) * 1000
    : null
  const displayDistanceM = roadDistance ?? haversineM
  const isByPlane = roadDistance == null && displayDistanceM != null

  const mapsUrl = segment.startLatlng
    ? /iPad|iPhone|iPod/.test(navigator.userAgent)
      ? `maps://maps.apple.com/?daddr=${segment.startLatlng[0]},${segment.startLatlng[1]}`
      : `https://www.google.com/maps/dir/?api=1&destination=${segment.startLatlng[0]},${segment.startLatlng[1]}`
    : null

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col max-w-lg mx-auto sm:rounded-2xl sm:overflow-hidden sm:shadow-2xl sm:shadow-black/60 sm:ring-1 sm:ring-white/10 md:max-w-none md:rounded-none md:shadow-none md:ring-0 md:h-screen md:overflow-hidden">
      <header className="flex items-center gap-2 px-4 pt-6 pb-4 md:px-6 md:shrink-0 md:border-b md:border-gray-800">
        <button
          onClick={() => navigate(-1)}
          className="p-1 -ml-1 rounded-lg text-gray-400 hover:text-white transition-colors"
          aria-label="Back"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-white leading-snug line-clamp-2">{segment.name}</h1>
          {segment.translatedName && (
            <p className="text-xs text-gray-500 italic line-clamp-1">{segment.translatedName}</p>
          )}
        </div>
        <Badge score={segment.score} />
      </header>

      {/* Two-column on desktop (CSS grid), ordered single column on mobile (flex-col) */}
      <div className="flex-1 min-h-0 flex flex-col md:grid md:grid-cols-[420px_1fr] md:grid-rows-[auto_1fr] md:overflow-hidden">

        {/* Segment metadata — order 2 on mobile (below map), top of left column on desktop */}
        <div className="px-4 pt-4 order-2 md:col-start-1 md:row-start-1 md:px-6 md:pt-6 md:border-r md:border-gray-800">
          <div className="text-xs text-gray-500">
            {formatDistance(segment.distance, unit)}
            {segment.elevationGain > 0 && ` · ↑${Math.round(segment.elevationGain)}m ↓${Math.round(segment.elevationLoss)}m`}
            {segment.city && ` · ${segment.city}`}
            {displayDistanceM != null && <> · <DistanceToStart distanceM={displayDistanceM} isByPlane={isByPlane} unit={unit} /></>}
          </div>
        </div>

        {/* Map panel — order 1 on mobile (first), right column on desktop */}
        <div ref={mapPanelRef} className="relative order-1 md:col-start-2 md:row-start-1 md:row-span-2">
          {decodedPath && mapBounds ? (
            <div className="rounded-xl overflow-hidden relative mx-4 my-4 md:mx-0 md:my-0 md:rounded-none h-60 md:h-full">
              <MapContainer bounds={mapBounds} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png" />
                {/* Invisible wider hit area for easier hover */}
                <Polyline
                  positions={decodedPath}
                  pathOptions={{ color: '#FC5200', opacity: 0, weight: 20 }}
                  eventHandlers={{ mousemove: handlePolylineMouseMove, mouseout: () => setHoverDistanceM(null) }}
                />
                <Polyline positions={decodedPath} color="#FC5200" weight={4} interactive={false} />
                {hoverLatLng && (
                  <CircleMarker
                    center={hoverLatLng}
                    radius={5}
                    pathOptions={{ color: '#fff', fillColor: '#60a5fa', fillOpacity: 1, weight: 2 }}
                    interactive={false}
                  />
                )}
                {segment.startLatlng && (
                  <CircleMarker center={segment.startLatlng} radius={6} pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 1 }} />
                )}
                {segment.endLatlng && (
                  <CircleMarker center={segment.endLatlng} radius={6} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1 }} />
                )}
                {userLat != null && userLng != null && (
                  <CircleMarker center={[userLat, userLng]} radius={8} pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.9, weight: 2 }} />
                )}
                <MapController onReady={onMapReady} />
              </MapContainer>
              <div className="absolute bottom-2 right-2 z-[1000] flex flex-col gap-1">
                <MapButton
                  onClick={() => mapRef.current?.fitBounds(mapBounds, { padding: [20, 20] })}
                  className="p-2 rounded-lg bg-gray-900/90 text-white hover:bg-gray-800 transition-colors shadow"
                  aria-label="Recentre on segment"
                >
                  <Crosshair size={16} />
                </MapButton>
                {userLat != null && userLng != null && (
                  <MapButton
                    onClick={() => mapRef.current?.setView([userLat, userLng], 15)}
                    className="p-2 rounded-lg bg-gray-900/90 text-blue-400 hover:bg-gray-800 transition-colors shadow"
                    aria-label="Recentre on my location"
                  >
                    <LocateFixed size={16} />
                  </MapButton>
                )}
              </div>
            </div>
          ) : (
            <div
              className="rounded-xl bg-gray-800 flex items-center justify-center text-gray-500 text-xs mx-4 my-4 md:mx-0 md:my-0 md:rounded-none md:h-full"
              style={{ height: '120px' }}
            >
              Route unavailable
            </div>
          )}
        </div>

        {/* Stats, elevation, buttons — order 3 on mobile, bottom of left column on desktop */}
        <div className="px-4 pt-4 pb-4 space-y-5 order-3 md:col-start-1 md:row-start-2 md:overflow-y-auto md:no-scrollbar md:pt-5 md:pb-6 md:px-6 md:border-r md:border-gray-800">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <StatBox label={segment.targetLabel} value={formatTime(segment.targetTime)} sub={formatPace(segment.targetTime, segment.distance, unit)} />
              <StatBox label="Your PR" value={segment.userPR ? formatTime(segment.userPR) : '—'} sub={segment.userPR ? formatPace(segment.userPR, segment.distance, unit) : undefined} />
            </div>
            {segment.estimatedTime != null && (
              <StatBox label="Est. best" value={formatTime(segment.estimatedTime)} sub={formatPace(segment.estimatedTime, segment.distance, unit)} />
            )}
          </div>

          <ScoreGauge score={segment.score} />

          {elevationLoading ? (
            <div className="bg-gray-800/60 rounded-xl p-3 animate-pulse">
              <div className="h-3 w-24 bg-gray-700 rounded mb-3" />
              <div className="h-3 w-40 bg-gray-700 rounded mb-2" />
              <div className="h-[88px] bg-gray-700 rounded-lg" />
            </div>
          ) : elevation ? (
            <div className="bg-gray-800/60 rounded-xl p-3">
              <p className="text-xs font-semibold text-gray-400 mb-2">Elevation</p>
              <ElevationChart
                altitude={elevation.altitude}
                distance={elevation.distance}
                unit={unit}
                hoverDistanceM={hoverDistanceM}
                onHoverDistance={setHoverDistanceM}
              />
            </div>
          ) : null}

          <div className="flex gap-2">
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 flex-1 py-3 rounded-xl bg-gray-800 text-white text-sm font-semibold hover:bg-gray-700 transition-colors"
              >
                Directions <Navigation size={15} />
              </a>
            )}
            <a
              href={`https://www.strava.com/segments/${segment.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 flex-1 py-3 rounded-xl bg-strava text-white text-sm font-semibold hover:bg-strava-dark transition-colors"
            >
              View on Strava <ExternalLink size={15} />
            </a>
          </div>
        </div>
      </div>

    </div>
  )
}
