import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUp, List, Map, RefreshCw } from 'lucide-react'
import { useLocation } from '../hooks/useLocation'
import { useSegments } from '../hooks/useSegments'
import { formatRadius } from '../format'
import type { Settings, StravaStatus } from '../types'
import { fetchRoadDistances } from '../osrm'
import { haversineKm } from '../geo'
import EvictionsList from '../components/EvictionsList'
import SegmentsMap from '../components/SegmentsMap'
import SettingsPanel from '../components/SettingsPanel'
import ProfilePage from './ProfilePage'

const SETTINGS_KEY = 'eviction-notice-settings'

function getDefaultSettings(status: StravaStatus): Settings {
  return {
    radiusKm: 5,
    activityType: status.primaryActivity ?? 'running',
    targetType: 'kom',
    minSegmentKm: 0,
    maxSegmentKm: 10,
    mode: 'hunt',
    unit: 'km',
  }
}

function loadSettings(status: StravaStatus): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...getDefaultSettings(status), ...JSON.parse(raw) }
  } catch {}
  return getDefaultSettings(status)
}


type Tab = 'evictions' | 'settings' | 'profile'

export default function Dashboard({ stravaStatus: initialStravaStatus }: { stravaStatus: StravaStatus }) {
  const navigate = useNavigate()
  const stravaStatus = initialStravaStatus
  const [tab, setTab] = useState<Tab>('evictions')
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [settings, setSettings] = useState<Settings>(() => loadSettings(stravaStatus))
  const { coords, error: locError } = useLocation()
  const { allSegments, loading, error, refresh } = useSegments(coords, settings.activityType, settings.targetType)
  const mainRef = useRef<HTMLElement>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [roadDistances, setRoadDistances] = useState<Record<number, number>>({})

  useEffect(() => {
    const el = mainRef.current
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
    fetchRoadDistances(coords.lat, coords.lng, allSegments, controller.signal)
      .then(setRoadDistances)
      .finally(() => clearTimeout(timeout))
    return () => { controller.abort(); clearTimeout(timeout) }
  }, [allSegments, coords])

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  // Filter cached segments by radius + distance + mode — no API call
  const segments = useMemo(() => {
    if (!coords) return []
    let filtered = allSegments.filter((s) => {
      const distKm = s.distance / 1000
      return (
        haversineKm(coords.lat, coords.lng, s.midpointLat, s.midpointLng) <= settings.radiusKm &&
        distKm >= settings.minSegmentKm &&
        distKm <= settings.maxSegmentKm
      )
    })
    if (settings.mode === 'hunt') {
      filtered = filtered.filter((s) => s.score >= -0.35 && s.score <= 0.35)
      filtered.sort((a, b) => a.score - b.score)
    } else {
      filtered = filtered.filter((s) => s.score > 0)
      filtered.sort((a, b) => b.score - a.score)
    }
    return filtered
  }, [allSegments, coords, settings.radiusKm, settings.minSegmentKm, settings.maxSegmentKm, settings.mode])

  const displayError = locError ?? error
  const isMapMode = tab === 'evictions' && viewMode === 'map'


  return (
    <div className="h-screen bg-gray-950 flex flex-col max-w-lg mx-auto">
      <header className="flex items-center justify-between px-4 pt-6 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Eviction Notice</h1>
          {coords && (
            <p className="text-xs text-gray-500 mt-0.5">
              {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)} · {formatRadius(settings.radiusKm, settings.unit)}
            </p>
          )}
          {locError && <p className="text-xs text-red-400 mt-0.5">{locError}</p>}
        </div>
        {tab === 'evictions' && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
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

      <main ref={mainRef} className={`flex-1 min-h-0 ${isMapMode ? 'overflow-hidden' : 'px-4 pb-28 overflow-y-auto no-scrollbar'}`}>
        {tab === 'evictions' ? (
          viewMode === 'list' ? (
            <>
              <div className="flex gap-1 mb-4">
                {(['hunt', 'harvest'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setSettings({ ...settings, mode: m })}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                      settings.mode === m ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {m === 'hunt' ? '🎯 Hunt' : '🌾 Harvest'}
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
              />
            </>
          ) : (
            <div className="h-full pb-14">
              {coords ? (
                <SegmentsMap
                  segments={segments}
                  userLat={coords.lat}
                  userLng={coords.lng}
                  onSegmentClick={(id) => navigate(`/segment/${id}`, { state: { segment: allSegments.find((s) => s.id === id), unit: settings.unit, userLat: coords?.lat, userLng: coords?.lng } })}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                  Waiting for location…
                </div>
              )}
            </div>
          )
        ) : tab === 'settings' ? (
          <SettingsPanel settings={settings} onChange={setSettings} />
        ) : (
          <ProfilePage stravaStatus={stravaStatus} unit={settings.unit} />
        )}
      </main>

      <button
        onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`fixed bottom-20 right-4 z-[1002] p-2.5 rounded-full bg-gray-800 border border-gray-700 text-white shadow-lg transition-opacity duration-300 ${showScrollTop && !isMapMode ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        aria-label="Back to top"
      >
        <ArrowUp size={18} />
      </button>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-gray-900 border-t border-gray-800 flex z-[1001]">
        <TabButton active={tab === 'evictions'} onClick={() => setTab('evictions')} icon="🎯" label="Evictions" />
        <TabButton active={tab === 'settings'} onClick={() => setTab('settings')} icon="⚙️" label="Settings" />
        <TabButton active={tab === 'profile'} onClick={() => setTab('profile')} icon="👤" label="Profile" />
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
        active ? 'text-orange-400' : 'text-gray-500 hover:text-gray-300'
      }`}
    >
      <span className="text-lg">{icon}</span>
      {label}
    </button>
  )
}
