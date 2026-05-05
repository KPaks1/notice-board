import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearToken, fetchAthleteEfforts, refreshAthleteEfforts, updateUserSettings } from '../api'
import type { BestEffortsResponse, EffortEntry, StravaStatus } from '../types'

interface Props {
  stravaStatus: StravaStatus
  onPaceSaved?: (update: Pick<StravaStatus, 'runPaceSecsPerKm' | 'ridePaceSecsPerKm' | 'paceUnit'>) => void
}

function formatPaceDisplay(secsPerKm: number | null | undefined, unit: 'km' | 'mile'): string {
  if (!secsPerKm) return ''
  const secs = unit === 'mile' ? secsPerKm * 1.60934 : secsPerKm
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function parsePaceInput(input: string, unit: 'km' | 'mile'): number | null {
  const match = input.trim().match(/^(\d+):([0-5]\d)$/)
  if (!match) return null
  const secs = parseInt(match[1]) * 60 + parseInt(match[2])
  return unit === 'mile' ? secs / 1.60934 : secs
}

function formatTime(secs: number | null): string {
  if (secs == null) return '—'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function EffortCard({ entry }: { entry: EffortEntry }) {
  return (
    <div className="bg-gray-800 rounded-xl p-3 text-center">
      <p className="text-xs text-gray-400 mb-1">{entry.label}</p>
      <p className="text-sm font-mono text-white">{formatTime(entry.estimatedSecs)}</p>
      {entry.source === 'riegel' && <p className="text-xs text-gray-600 mt-0.5">est.</p>}
    </div>
  )
}

function initials(name?: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function ProfilePage({ stravaStatus, onPaceSaved }: Props) {
  const navigate = useNavigate()
  const [paceUnit, setPaceUnit] = useState<'km' | 'mile'>(stravaStatus.paceUnit ?? 'km')
  const [runPace, setRunPace] = useState(() =>
    formatPaceDisplay(stravaStatus.runPaceSecsPerKm, stravaStatus.paceUnit ?? 'km'),
  )
  const [ridePace, setRidePace] = useState(() =>
    formatPaceDisplay(stravaStatus.ridePaceSecsPerKm, stravaStatus.paceUnit ?? 'km'),
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [efforts, setEfforts] = useState<BestEffortsResponse | null>(null)
  const [effortsLoading, setEffortsLoading] = useState(false)
  const [effortsError, setEffortsError] = useState<string | null>(null)

  useEffect(() => {
    fetchAthleteEfforts().then(setEfforts).catch(() => setEfforts({ computed: false }))
  }, [])

  async function handleComputeEfforts() {
    setEffortsLoading(true)
    setEffortsError(null)
    try {
      setEfforts(await refreshAthleteEfforts())
    } catch (e) {
      setEffortsError(e instanceof Error ? e.message : 'Failed to compute')
    } finally {
      setEffortsLoading(false)
    }
  }

  function handleUnitToggle(newUnit: 'km' | 'mile') {
    if (newUnit === paceUnit) return
    setRunPace(formatPaceDisplay(parsePaceInput(runPace, paceUnit), newUnit))
    setRidePace(formatPaceDisplay(parsePaceInput(ridePace, paceUnit), newUnit))
    setPaceUnit(newUnit)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    try {
      const runPaceSecsPerKm = parsePaceInput(runPace, paceUnit)
      const ridePaceSecsPerKm = parsePaceInput(ridePace, paceUnit)
      await updateUserSettings({ runPaceSecsPerKm, ridePaceSecsPerKm, paceUnit })
      onPaceSaved?.({ runPaceSecsPerKm, ridePaceSecsPerKm, paceUnit })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function disconnect() {
    clearToken()
    navigate('/connect-strava', { replace: true })
  }

  const activityLabel =
    stravaStatus.athleteType === 0 ? 'Cyclist' :
    stravaStatus.athleteType === 1 ? 'Runner' :
    'Unknown'

  const sexLabel =
    stravaStatus.athleteSex === 'M' ? 'Male' :
    stravaStatus.athleteSex === 'F' ? 'Female' :
    'Unknown'

  return (
    <div className="py-6 space-y-6">
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center text-2xl font-bold text-white">
          {initials(stravaStatus.athleteName)}
        </div>
        <h2 className="text-lg font-semibold text-white">
          {stravaStatus.athleteName ?? 'Athlete'}
        </h2>
      </div>

      <div className="flex gap-2 justify-center">
        <span className="px-3 py-1 rounded-full bg-gray-800 text-sm text-gray-300">{activityLabel}</span>
        <span className="px-3 py-1 rounded-full bg-gray-800 text-sm text-gray-300">{sexLabel}</span>
      </div>

      <div className="space-y-4 pt-4 border-t border-gray-800">
        <h3 className="text-sm font-semibold text-gray-300">Pace Settings</h3>

        <div className="flex gap-1">
          {(['km', 'mile'] as const).map((u) => (
            <button
              key={u}
              onClick={() => handleUnitToggle(u)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                paceUnit === u ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              min/{u}
            </button>
          ))}
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Running pace (mm:ss)</label>
          <input
            type="text"
            value={runPace}
            onChange={(e) => setRunPace(e.target.value)}
            placeholder="5:30"
            className="w-full bg-gray-800 rounded-xl px-3 py-2.5 text-white text-sm font-mono placeholder-gray-600 border border-gray-700 focus:outline-none focus:border-orange-500"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Cycling pace (mm:ss)</label>
          <input
            type="text"
            value={ridePace}
            onChange={(e) => setRidePace(e.target.value)}
            placeholder="2:30"
            className="w-full bg-gray-800 rounded-xl px-3 py-2.5 text-white text-sm font-mono placeholder-gray-600 border border-gray-700 focus:outline-none focus:border-orange-500"
          />
        </div>

        {saveError && <p className="text-xs text-red-400">{saveError}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Pace Settings'}
        </button>
      </div>

      <div className="space-y-4 pt-4 border-t border-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-300">Estimated Times</h3>
          <button
            onClick={handleComputeEfforts}
            disabled={effortsLoading}
            className="text-xs text-orange-400 hover:text-orange-300 disabled:opacity-50"
          >
            {effortsLoading ? 'Computing…' : efforts?.computed ? 'Refresh' : 'Compute'}
          </button>
        </div>

        {effortsError && <p className="text-xs text-red-400">{effortsError}</p>}

        {effortsLoading && (
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-gray-800 rounded-xl h-16 animate-pulse" />
            ))}
          </div>
        )}

        {!effortsLoading && efforts?.computed && (() => {
          const list = stravaStatus.athleteType === 0 ? efforts.ride : efforts.run
          return (
            <>
              <div className="grid grid-cols-3 gap-2">
                {list.map((e) => <EffortCard key={e.distanceM} entry={e} />)}
              </div>
              <p className="text-xs text-gray-500">
                Based on last 200 activities · Updated {new Date(efforts.computedAt).toLocaleDateString()}
              </p>
            </>
          )
        })()}

        {!effortsLoading && efforts && !efforts.computed && (
          <p className="text-xs text-gray-500">
            No data yet. Tap Compute to estimate your times from recent activities.
          </p>
        )}
      </div>

      <div className="pt-4 border-t border-gray-800">
        <button
          onClick={disconnect}
          className="w-full py-3 rounded-xl bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
        >
          Disconnect Strava
        </button>
      </div>
    </div>
  )
}
