import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUp, List, LocateFixed, Map, RefreshCw } from 'lucide-react'
import L from 'leaflet'
import { useLocation } from '../hooks/useLocation'
import { useSegments } from '../hooks/useSegments'
import { formatRadius } from '../format'
import type { Settings, ScoredSegment, SortBy, StravaStatus } from '../types'
import { fetchRoadDistances } from '../osrm'
import { resetSegmentPool } from '../api'
import { APP_NAME } from '../constants'
import { haversineKm } from '../geo'
import EvictionsList from '../components/EvictionsList'
import { MapButton } from '../components/MapButton'
import SegmentsMap from '../components/SegmentsMap'
import SettingsPanel from '../components/SettingsPanel'
import MapFilterOverlay from '../components/MapFilterOverlay'
import ProfilePage from './ProfilePage'
import poweredByStrava from '../assets/strava/powered-by/api_logo_pwrdBy_strava_horiz_white.svg'

const SETTINGS_KEY = 'notice-board-settings'

function getDefaultSettings(status: StravaStatus): Settings {
  return {
    radiusKm: 5,
    activityType: status.primaryActivity ?? 'running',
    targetType: 'kom',
    minSegmentKm: 0,
    maxSegmentKm: 10,
    minElevationChange: 0,
    maxElevationChange: 9999,
    mode: 'hunt',
    sortBy: 'score',
    unit: 'km',
  }
}

function loadSettings(status: StravaStatus): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      return { ...getDefaultSettings(status), ...saved, radiusKm: Math.min(saved.radiusKm ?? 5, 20) }
    }
  } catch {}
  return getDefaultSettings(status)
}


type Tab = 'board' | 'settings' | 'profile'

export default function Dashboard({ stravaStatus: initialStravaStatus }: { stravaStatus: StravaStatus }) {
  const navigate = useNavigate()
  const stravaStatus = initialStravaStatus
  const [tab, setTab] = useState<Tab>('board')
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [settings, setSettings] = useState<Settings>(() => loadSettings(stravaStatus))
  const { coords, error: locError } = useLocation()
  const { allSegments, loading, error, refresh, rateLimitedUntil } = useSegments(coords, settings.activityType, settings.radiusKm, settings.sortBy)
  const listRef = useRef<HTMLDivElement>(null)
  const segMapRef = useRef<L.Map | null>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [roadDistances, setRoadDistances] = useState<Record<number, number>>({})
  const [hoveredSegmentId, setHoveredSegmentId] = useState<number | null>(null)
  const hoverClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleHoverSegment = useCallback((id: number | null) => {
    if (hoverClearTimer.current) clearTimeout(hoverClearTimer.current)
    if (id !== null) {
      setHoveredSegmentId(id)
    } else {
      hoverClearTimer.current = setTimeout(() => setHoveredSegmentId(null), 400)
    }
  }, [])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const onScroll = () => setShowScrollTop(el.scrollTop > 150)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!coords || allSegments.length === 0) return
    setRoadDistances({})
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    fetchRoadDistances(coords.lat, coords.lng, allSegments, controller.signal, settings.activityType)
      .then(setRoadDistances)
      .finally(() => clearTimeout(timeout))
    return () => { controller.abort(); clearTimeout(timeout) }
  }, [allSegments, coords])

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  const segmentDistanceRange = useMemo(() => {
    if (allSegments.length === 0) return null
    const distances = allSegments.map((s) => s.distance / 1000)
    return {
      min: Math.floor(Math.min(...distances) * 2) / 2,
      max: Math.ceil(Math.max(...distances) * 2) / 2,
    }
  }, [allSegments])

  const segmentElevationRange = useMemo(() => {
    if (allSegments.length === 0) return null
    const gains = allSegments.map((s) => s.elevationGain + s.elevationLoss)
    return {
      min: 0,
      max: Math.ceil(Math.max(...gains) / 25) * 25,
    }
  }, [allSegments])

  // Re-score segments client-side for personal_best mode — no API call needed
  const scoredPool = useMemo(() => {
    if (settings.targetType !== 'personal_best') return allSegments
    return allSegments
      .filter((s) => s.userPR != null)
      .map((s) => ({
        ...s,
        score: (s.userPR! - 1 - (s.estimatedTime ?? s.userPR!)) / (s.userPR! - 1),
        targetTime: s.userPR!,
        targetLabel: 'Your Best',
      }))
  }, [allSegments, settings.targetType])

  const segmentCounts = useMemo(() => {
    if (!coords) return { hunt: 0, harvest: 0 }
    const distFromUser = (s: ScoredSegment) => s.startLatlng
      ? haversineKm(coords.lat, coords.lng, s.startLatlng[0], s.startLatlng[1])
      : haversineKm(coords.lat, coords.lng, s.midpointLat, s.midpointLng)
    const base = scoredPool.filter((s) => {
      const distKm = s.distance / 1000
      return (
        distFromUser(s) <= settings.radiusKm &&
        distKm >= settings.minSegmentKm &&
        distKm <= settings.maxSegmentKm &&
        (s.elevationGain + s.elevationLoss) >= settings.minElevationChange &&
        (s.elevationGain + s.elevationLoss) <= settings.maxElevationChange
      )
    })
    return {
      hunt: base.filter((s) => s.score >= -0.35 && s.score <= 0.35).length,
      harvest: base.filter((s) => s.score > 0).length,
    }
  }, [scoredPool, coords, settings.radiusKm, settings.minSegmentKm, settings.maxSegmentKm, settings.minElevationChange, settings.maxElevationChange])

  // Filter cached segments by radius + distance + mode — no API call
  const segments = useMemo(() => {
    if (!coords) return []
    const distFromUser = (s: ScoredSegment) => s.startLatlng
      ? haversineKm(coords.lat, coords.lng, s.startLatlng[0], s.startLatlng[1])
      : haversineKm(coords.lat, coords.lng, s.midpointLat, s.midpointLng)

    let filtered = scoredPool.filter((s) => {
      const distKm = s.distance / 1000
      return (
        distFromUser(s) <= settings.radiusKm &&
        distKm >= settings.minSegmentKm &&
        distKm <= settings.maxSegmentKm &&
        (s.elevationGain + s.elevationLoss) >= settings.minElevationChange &&
        (s.elevationGain + s.elevationLoss) <= settings.maxElevationChange
      )
    })
    if (settings.mode === 'hunt') {
      filtered = filtered.filter((s) => s.score >= -0.35 && s.score <= 0.35)
    } else {
      filtered = filtered.filter((s) => s.score > 0)
    }
    if (settings.sortBy === 'nearest') {
      filtered.sort((a, b) => distFromUser(a) - distFromUser(b))
    } else if (settings.sortBy === 'length') {
      filtered.sort((a, b) => a.distance - b.distance)
    } else {
      filtered.sort((a, b) => b.score - a.score)
    }
    return filtered
  }, [scoredPool, coords, settings.radiusKm, settings.minSegmentKm, settings.maxSegmentKm, settings.minElevationChange, settings.maxElevationChange, settings.mode, settings.sortBy])

  const displayError = locError ?? error
  const isMapMode = tab === 'board' && viewMode === 'map'

  const mapClickHandler = (id: number) =>
    navigate(`/segment/${id}`, {
      state: {
        segment: allSegments.find((s) => s.id === id),
        unit: settings.unit,
        userLat: coords?.lat,
        userLng: coords?.lng,
      },
    })

  return (
    <div className="h-screen bg-gray-950 flex flex-col max-w-lg mx-auto sm:rounded-2xl sm:overflow-hidden sm:shadow-2xl sm:shadow-black/60 sm:ring-1 sm:ring-white/10 md:max-w-none md:rounded-none md:shadow-none md:ring-0">
      <header className="relative flex items-center justify-between px-4 pt-6 pb-4 md:px-6 md:pt-4 md:pb-3 md:border-b md:border-gray-800 shrink-0">
        <div>
          <h1 className="text-xl font-black text-white tracking-tight uppercase -mb-1">{APP_NAME}</h1>
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Beatable segments, near you.</span>
          <div className="flex items-center gap-2 mt-0.5">
            {coords && (
              <p className="text-xs text-gray-500">
                {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)} · {formatRadius(settings.radiusKm, settings.unit)}
              </p>
            )}
            {locError && <p className="text-xs text-red-400">{locError}</p>}
            <img src={poweredByStrava} alt="Powered by Strava" className="h-3 opacity-40" />
          </div>
        </div>

        {/* Desktop inline nav — absolutely centered so it doesn't shift when right-side controls appear/disappear */}
        <nav className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
          <DesktopTabButton active={tab === 'board'} onClick={() => setTab('board')} label="Board" />
          <DesktopTabButton active={tab === 'settings'}  onClick={() => setTab('settings')}  label="Settings"  />
          <DesktopTabButton active={tab === 'profile'}   onClick={() => setTab('profile')}   label="Profile"   />
        </nav>

        {tab === 'board' && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
              className="md:hidden p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              aria-label={viewMode === 'list' ? 'Switch to map' : 'Switch to list'}
            >
              {viewMode === 'list' ? <Map size={18} /> : <List size={18} />}
            </button>
            <button
              onClick={refresh}
              disabled={loading || !coords}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        )}
      </header>

      {/* All panels always mounted — CSS show/hide avoids remounting Leaflet and form state */}
      <main className="flex-1 min-h-0 flex overflow-hidden">

        {/* List panel */}
        <div className={[
          tab === 'board' && viewMode === 'list' ? 'flex-1 flex flex-col' : 'hidden',
          tab === 'board'
            ? 'md:flex md:flex-col md:relative md:flex-none md:w-96 md:shrink-0 md:border-r md:border-gray-800'
            : 'md:hidden',
        ].join(' ')}>
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto no-scrollbar"
          >
          <div className="px-4 pb-28 md:px-4 md:pb-4 md:pt-4">
            <div className="flex gap-1 mb-2">
              {(['hunt', 'harvest'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setSettings({ ...settings, mode: m })}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                    settings.mode === m ? 'bg-strava text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {m === 'hunt' ? '🎯 Hunt' : '🌾 Harvest'}
                </button>
              ))}
            </div>
            <div className="flex gap-1 mb-4">
              {([
                { value: 'score', label: 'Beatability' },
                { value: 'nearest', label: 'Nearest' },
                { value: 'length', label: 'Length' },
              ] as { value: SortBy; label: string }[]).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setSettings({ ...settings, sortBy: value })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    settings.sortBy === value ? 'bg-gray-600 text-white' : 'bg-gray-800/50 text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <EvictionsList
              segments={segments}
              loading={loading || (!coords && !locError)}
              error={displayError}
              onRefresh={refresh}
              mode={settings.mode}
              unit={settings.unit}
              userLat={coords?.lat ?? 0}
              userLng={coords?.lng ?? 0}
              roadDistances={roadDistances}
              onHoverSegment={handleHoverSegment}
              rateLimitedUntil={rateLimitedUntil}
              targetType={settings.targetType}
              onSwitchToKom={() => setSettings((s) => ({ ...s, targetType: 'kom' }))}
            />
          </div>
          </div>

          {/* Desktop back-to-top — anchored to list column */}
          <button
            onClick={() => listRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            className={`hidden md:flex absolute bottom-4 right-4 z-[1005] items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-800 border border-gray-700 text-white text-xs shadow-lg transition-opacity duration-300 ${showScrollTop ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            aria-label="Back to top"
          >
            <ArrowUp size={13} />
            Back to top
          </button>
        </div>

        {/* Map panel */}
        <div className={[
          tab === 'board' && viewMode === 'map' ? 'flex-1 overflow-hidden pb-14 relative' : 'hidden',
          tab === 'board' ? 'md:flex md:flex-1 md:pb-0 md:relative' : 'md:hidden',
        ].join(' ')}>
          {coords ? (
            <>
              <SegmentsMap
                segments={segments}
                userLat={coords.lat}
                userLng={coords.lng}
                hoveredSegmentId={hoveredSegmentId}
                onSegmentClick={mapClickHandler}
                onSegmentHover={handleHoverSegment}
                onMapReady={(m) => { segMapRef.current = m }}
              />
              <MapButton
                onClick={() => segMapRef.current?.setView([coords.lat, coords.lng], 13)}
                className="absolute top-4 right-4 z-[1003] p-2 rounded-xl bg-gray-900/90 border border-gray-800 text-blue-400 hover:text-white hover:bg-gray-800 transition-colors shadow"
                aria-label="Recentre on my location"
              >
                <LocateFixed size={16} />
              </MapButton>
              <MapFilterOverlay
                settings={settings}
                onChange={setSettings}
                segmentDistanceRange={segmentDistanceRange}
                segmentElevationRange={segmentElevationRange}
                segmentCount={settings.mode === 'hunt' ? segmentCounts.hunt : segmentCounts.harvest}
              />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-gray-500 text-sm">
              Waiting for location…
            </div>
          )}
        </div>

        {/* Settings / Profile panel */}
        <div className={
          tab === 'board'
            ? 'hidden'
            : 'flex-1 overflow-y-auto no-scrollbar px-4 pb-28 md:pb-8 md:flex md:justify-center'
        }>
          <div className="md:max-w-2xl md:w-full">
            <div className={tab !== 'settings' ? 'hidden' : ''}>
              <SettingsPanel
                settings={settings}
                onChange={setSettings}
                onResetPool={async () => { await resetSegmentPool(settings.activityType); refresh() }}
                segmentDistanceRange={segmentDistanceRange}
                segmentElevationRange={segmentElevationRange}
                segmentCounts={segmentCounts}
              />
            </div>
            <div className={tab !== 'profile' ? 'hidden' : ''}>
              <ProfilePage stravaStatus={stravaStatus} unit={settings.unit} />
            </div>
          </div>
        </div>
      </main>

      {/* Mobile back-to-top */}
      <button
        onClick={() => listRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`md:hidden fixed bottom-20 right-4 z-[1004] p-2.5 rounded-full bg-gray-800 border border-gray-700 text-white shadow-lg transition-opacity duration-300 ${showScrollTop && !isMapMode ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        aria-label="Back to top"
      >
        <ArrowUp size={18} />
      </button>

      <nav className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-gray-900 border-t border-gray-800 z-[1001]">
        <div className="flex">
          <TabButton active={tab === 'board'} onClick={() => setTab('board')} icon="🎯" label="Board" />
          <TabButton active={tab === 'settings'}  onClick={() => setTab('settings')}  icon="⚙️" label="Settings"  />
          <TabButton active={tab === 'profile'}   onClick={() => setTab('profile')}   icon="👤" label="Profile"   />
        </div>
      </nav>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: string
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
        active ? 'text-strava' : 'text-gray-500 hover:text-gray-300'
      }`}
    >
      <span className="text-lg">{icon}</span>
      {label}
    </button>
  )
}

function DesktopTabButton({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-gray-800 text-strava' : 'text-gray-400 hover:text-white hover:bg-gray-800'
      }`}
    >
      {label}
    </button>
  )
}
