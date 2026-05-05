import { useNavigate } from 'react-router-dom'
import { clearToken } from '../api'
import type { StravaStatus } from '../types'

interface Props {
  stravaStatus: StravaStatus
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

export default function ProfilePage({ stravaStatus }: Props) {
  const navigate = useNavigate()

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
