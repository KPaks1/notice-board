import { useNavigate } from 'react-router-dom'
import { clearToken } from '../api'
import { useAthleteEfforts } from '../hooks/useAthleteEfforts'
import { formatPace } from '../format'
import type { Unit } from '../format'
import type { EffortEntry, StravaStatus } from '../types'

interface Props {
  stravaStatus: StravaStatus
  unit: Unit
}

function formatTime(secs: number | null): string {
  if (secs == null) return '—'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function EffortCard({ entry, unit }: { entry: EffortEntry; unit: Unit }) {
  return (
    <div className="bg-gray-800 rounded-xl p-3 text-center">
      <p className="text-xs text-gray-400 mb-1">{entry.label}</p>
      <p className="text-sm font-mono text-white">{formatTime(entry.estimatedSecs)}</p>
      <p className="text-xs font-mono text-gray-500 mt-0.5">
        {entry.estimatedSecs != null ? formatPace(entry.estimatedSecs, entry.distanceM, unit) : '—'}
      </p>
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

export default function ProfilePage({ stravaStatus, unit }: Props) {
  const navigate = useNavigate()
  const { efforts, loading: effortsLoading, error: effortsError, refresh: handleComputeEfforts } = useAthleteEfforts()

  function disconnect() {
    clearToken()
    navigate('/connect-strava', { replace: true })
  }

  const sexLabel =
    stravaStatus.athleteSex === 'M' ? 'Male' :
    stravaStatus.athleteSex === 'F' ? 'Female' :
    'Unknown'

  return (
    <div className="py-6 space-y-6">
      <div className="flex flex-col items-center gap-3">
        {stravaStatus.athletePhoto ? (
          <img
            src={stravaStatus.athletePhoto}
            alt={stravaStatus.athleteName ?? 'Athlete'}
            className="w-16 h-16 rounded-full object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center text-2xl font-bold text-white">
            {initials(stravaStatus.athleteName)}
          </div>
        )}
        <h2 className="text-lg font-semibold text-white">
          {stravaStatus.athleteName ?? 'Athlete'}
        </h2>
      </div>

      <div className="flex gap-2 justify-center">
        <span className="px-3 py-1 rounded-full bg-gray-800 text-sm text-gray-300">{sexLabel}</span>
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
          const list = stravaStatus.primaryActivity === 'cycling' ? efforts.ride : efforts.run
          return (
            <>
              <div className="grid grid-cols-3 gap-2">
                {list.map((e) => <EffortCard key={e.distanceM} entry={e} unit={unit} />)}
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
