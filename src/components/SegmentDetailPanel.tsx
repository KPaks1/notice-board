import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Crosshair, ExternalLink, LocateFixed, Minus, Navigation, Plus, X } from 'lucide-react'
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet'
import L from 'leaflet'
import polylineDecoder from '@mapbox/polyline'
import { fetchSegmentElevation } from '../api'
import { fetchRoadDistance } from '../osrm'
import { haversineKm } from '../geo'
import DistanceToStart from './DistanceToStart'
import { MapButton } from './MapButton'
import ElevationChart from './ElevationChart'
import ScoreGauge from './ScoreGauge'
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
    <div className="bg-gray-800 rounded-lg p-2 text-center">
      <div className="text-[10px] text-gray-400 mb-0.5">{label}</div>
      <div className={`font-mono font-medium text-xs ${highlight ? 'text-green-400' : 'text-white'}`}>{value}</div>
      {sub && <div className={`font-mono text-[10px] mt-0.5 ${highlight ? 'text-green-400/70' : 'text-gray-500'}`}>{sub}</div>}
    </div>
  )
}

interface Props {
  segment: ScoredSegment
  unit: Unit
  userLat: number | null
  userLng: number | null
  onClose?: () => void
}

export default function SegmentDetailPanel({ segment, unit, userLat, userLng, onClose }: Props) {
  const mapRef = useRef<L.Map | null>(null)
  const mapPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = mapPanelRef.current
    if (!el) return
    const ro = new ResizeObserver(() => mapRef.current?.invalidateSize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const onMapReady = useCallback((m: L.Map) => { mapRef.current = m }, [])

  const [roadDistance, setRoadDistance] = useState<number | null>(null)
  const [elevation, setElevation] = useState<{ altitude: number[]; distance: number[] } | null>(null)
  const [elevationLoading, setElevationLoading] = useState(true)

  useEffect(() => {
    setElevationLoading(true)
    setElevation(null)
    fetchSegmentElevation(segment.id)
      .then((data) => { if (data) setElevation(data) })
      .finally(() => setElevationLoading(false))
  }, [segment.id])

  useEffect(() => {
    setRoadDistance(null)
    if (!segment.startLatlng || userLat == null || userLng == null) return
    const [startLat, startLng] = segment.startLatlng
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    fetchRoadDistance(userLat, userLng, startLat, startLng, segment.activityType, controller.signal)
      .then((dist) => { if (dist != null) setRoadDistance(dist) })
      .finally(() => clearTimeout(timeout))
    return () => { controller.abort(); clearTimeout(timeout) }
  }, [segment.id, userLat, userLng])

  const decodedPath = useMemo(
    () => segment.polyline ? polylineDecoder.decode(segment.polyline) as [number, number][] : null,
    [segment.polyline],
  )
  const mapBounds = useMemo(() => decodedPath ? L.latLngBounds(decodedPath) : null, [decodedPath])

  const cumPathDists = useMemo(() => {
    if (!decodedPath || decodedPath.length < 2) return [] as number[]
    const d: number[] = [0]
    for (let i = 1; i < decodedPath.length; i++) {
      d.push(d[i - 1] + haversineKm(decodedPath[i - 1][0], decodedPath[i - 1][1], decodedPath[i][0], decodedPath[i][1]) * 1000)
    }
    return d
  }, [decodedPath])

  const [hoverDistanceM, setHoverDistanceM] = useState<number | null>(null)

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
    <div className="flex flex-col h-full w-full">

      {/* Map */}
      <div ref={mapPanelRef} className="relative h-[30vh] md:h-80 shrink-0">

        {/* Mobile: back button */}
        <button
          onClick={onClose}
          className="md:hidden absolute top-4 left-4 z-[1001] p-2 rounded-xl bg-gray-950/70 backdrop-blur-sm text-white"
          aria-label="Back"
        >
          <ChevronLeft size={22} />
        </button>

        {decodedPath && mapBounds ? (
          <div className="h-full relative">
            <MapContainer bounds={mapBounds} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png" />
              <Polyline
                positions={decodedPath}
                pathOptions={{ color: '#FC5200', opacity: 0, weight: 20 }}
                eventHandlers={{ mousemove: handlePolylineMouseMove, mouseout: () => setHoverDistanceM(null) }}
              />
              <Polyline positions={decodedPath} color="#FC5200" weight={4} interactive={false} />
              {hoverLatLng && (
                <CircleMarker center={hoverLatLng} radius={5} pathOptions={{ color: '#fff', fillColor: '#60a5fa', fillOpacity: 1, weight: 2 }} interactive={false} />
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

            {/* Map controls — vertical on mobile, horizontal row on desktop */}
            <div className="absolute top-4 right-4 md:top-auto md:bottom-3 md:right-3 z-[1002] flex flex-col md:flex-row md:items-center gap-1 md:gap-1.5">
              <span className="hidden md:inline-flex"><Badge score={segment.score} /></span>
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
              <MapButton
                onClick={() => mapRef.current?.zoomIn()}
                className="p-2 rounded-lg bg-gray-900/90 text-gray-300 hover:bg-gray-800 transition-colors shadow"
                aria-label="Zoom in"
              >
                <Plus size={16} />
              </MapButton>
              <MapButton
                onClick={() => mapRef.current?.zoomOut()}
                className="p-2 rounded-lg bg-gray-900/90 text-gray-300 hover:bg-gray-800 transition-colors shadow"
                aria-label="Zoom out"
              >
                <Minus size={16} />
              </MapButton>
            </div>
          </div>
        ) : (
          <div className="h-full bg-gray-800 flex items-center justify-center text-gray-500 text-xs">
            Route unavailable
          </div>
        )}

        {/* Gradient overlay — name, badge, metadata — shown on both mobile and desktop */}
        <div className="absolute bottom-0 left-0 right-0 z-[1001] bg-gradient-to-t from-black/80 via-black/30 to-transparent px-4 pb-3 pt-10 pointer-events-none">
          <div className="flex items-end justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-semibold text-white leading-snug line-clamp-2">{segment.name}</h1>
              {segment.translatedName && <p className="text-xs text-white/60 italic mt-0.5 line-clamp-1">{segment.translatedName}</p>}
              <p className="text-xs text-white/70 mt-0.5">
                {formatDistance(segment.distance, unit)}
                {segment.elevationGain > 0 && ` · ↑${Math.round(segment.elevationGain)}m ↓${Math.round(segment.elevationLoss)}m`}
                {displayDistanceM != null && <> · <DistanceToStart distanceM={displayDistanceM} isByPlane={isByPlane} unit={unit} /></>}
                {segment.city && ` · ${segment.city}`}
              </p>
            </div>
            <span className="md:hidden"><Badge score={segment.score} /></span>
          </div>
        </div>

        {/* Desktop: close button (top-right of map) */}
        {onClose && (
          <button
            onClick={onClose}
            className="hidden md:flex absolute top-3 right-3 z-[1002] items-center justify-center p-1.5 rounded-lg bg-gray-900/90 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors shadow"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar md:overflow-hidden -mt-4 md:mt-0 bg-gray-950 rounded-t-2xl md:rounded-none relative z-10">

        {/* Mobile drag handle */}
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-8 h-1 bg-gray-700 rounded-full" />
        </div>

        <div className="px-5 pt-4 pb-8 md:pb-6 space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-6">

          {/* Left column: stats + gauge + actions */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <StatBox label={segment.targetLabel} value={formatTime(segment.targetTime)} sub={formatPace(segment.targetTime, segment.distance, unit)} />
                <StatBox label="Your PR" value={segment.userPR ? formatTime(segment.userPR) : '—'} sub={segment.userPR ? formatPace(segment.userPR, segment.distance, unit) : undefined} />
              </div>
              {segment.estimatedTime != null && (
                <StatBox label="Est. best" value={formatTime(segment.estimatedTime)} sub={formatPace(segment.estimatedTime, segment.distance, unit)} />
              )}
            </div>

            <ScoreGauge score={segment.score} />

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

          {/* Right column (desktop) / below actions (mobile): elevation */}
          <div className="md:flex md:flex-col">
            {elevationLoading ? (
              <div className="bg-gray-800/60 rounded-xl p-3 animate-pulse md:flex-1">
                <div className="h-3 w-24 bg-gray-700 rounded mb-3" />
                <div className="h-3 w-40 bg-gray-700 rounded mb-2" />
                <div className="h-[88px] md:h-full bg-gray-700 rounded-lg" />
              </div>
            ) : elevation ? (
              <div className="bg-gray-800/60 rounded-xl p-3 md:flex-1 md:flex md:flex-col">
                <p className="text-xs font-semibold text-gray-400 mb-2 shrink-0">Elevation</p>
                <ElevationChart
                  altitude={elevation.altitude}
                  distance={elevation.distance}
                  unit={unit}
                  hoverDistanceM={hoverDistanceM}
                  onHoverDistance={setHoverDistanceM}
                  className="md:flex-1 md:flex md:flex-col md:min-h-0"
                  svgClassName="h-[88px] md:flex-1 md:min-h-[40px]"
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
