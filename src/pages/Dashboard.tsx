import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useLocation } from '../hooks/useLocation'
import { fetchSegments } from '../api'
import type { ScoredSegment, Settings } from '../types'
import EvictionsList from '../components/EvictionsList'
import SettingsPanel from '../components/SettingsPanel'

const SETTINGS_KEY = 'eviction-notice-settings'
const DEFAULT_SETTINGS: Settings = {
  radiusKm: 5,
  activityType: 'running',
  targetType: 'kom',
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {}
  return DEFAULT_SETTINGS
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

type Tab = 'evictions' | 'settings'

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('evictions')
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [allSegments, setAllSegments] = useState<ScoredSegment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { coords, error: locError } = useLocation()

  // Only re-fetch when activityType or targetType change, not radius
  const fetchKey = `${settings.activityType}:${settings.targetType}`
  const prevFetchKey = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    if (!coords) return
    setLoading(true)
    setError(null)
    try {
      const results = await fetchSegments(
        coords.lat,
        coords.lng,
        settings.activityType,
        settings.targetType,
      )
      setAllSegments(results)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [coords, settings.activityType, settings.targetType])

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  // Fetch on first load, and when activityType/targetType change
  useEffect(() => {
    if (!coords) return
    if (prevFetchKey.current === fetchKey && allSegments.length > 0) return
    prevFetchKey.current = fetchKey
    refresh()
  }, [coords, fetchKey, refresh, allSegments.length])

  // Filter cached segments by radius client-side — no API call
  const segments = useMemo(() => {
    if (!coords) return []
    return allSegments.filter(
      (s) => haversineKm(coords.lat, coords.lng, s.midpointLat, s.midpointLng) <= settings.radiusKm,
    )
  }, [allSegments, coords, settings.radiusKm])

  const displayError = locError ?? error

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col max-w-lg mx-auto">
      <header className="flex items-center justify-between px-4 pt-6 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Eviction Notice</h1>
          {coords && (
            <p className="text-xs text-gray-500 mt-0.5">
              {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)} · {settings.radiusKm} km radius
            </p>
          )}
          {locError && <p className="text-xs text-red-400 mt-0.5">{locError}</p>}
        </div>
        {tab === 'evictions' && (
          <button
            onClick={refresh}
            disabled={loading || !coords}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        )}
      </header>

      <main className="flex-1 px-4 pb-28 overflow-y-auto">
        {tab === 'evictions' ? (
          <EvictionsList
            segments={segments}
            loading={loading || (!coords && !locError)}
            error={displayError}
            onRefresh={refresh}
          />
        ) : (
          <SettingsPanel settings={settings} onChange={setSettings} />
        )}
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-gray-900 border-t border-gray-800 flex">
        <TabButton active={tab === 'evictions'} onClick={() => setTab('evictions')} icon="🎯" label="Evictions" />
        <TabButton active={tab === 'settings'} onClick={() => setTab('settings')} icon="⚙️" label="Settings" />
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
