import { useSearchParams } from 'react-router-dom'
import stravaBtn from '../assets/strava/connect-with/btn_strava_connect_with_orange_x2.svg'

const ERROR_MESSAGES: Record<string, string> = {
  denied: 'Strava authorisation was denied or failed. Please try again.',
  'token-exchange': 'Could not exchange the Strava code for a token. Check your app credentials.',
}

export default function ConnectStrava() {
  const [searchParams] = useSearchParams()
  const errorCode = searchParams.get('error')
  const errorMessage = errorCode ? (ERROR_MESSAGES[errorCode] ?? 'Something went wrong. Please try again.') : null

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 w-full max-w-sm text-center shadow-xl">
        <div className="mb-6">
          <span className="text-5xl">🔗</span>
          <h1 className="mt-4 text-2xl font-bold text-white tracking-tight">Connect Strava</h1>
          <p className="mt-3 text-gray-400 text-sm leading-relaxed">
            Eviction Notice reads your activity stats and segment leaderboards to find segments you can beat. Your data is never stored beyond your session token.
          </p>
        </div>
        <ul className="text-left text-sm text-gray-400 mb-8 space-y-2">
          <li className="flex gap-2"><span className="text-green-400">✓</span> View your recent activity paces</li>
          <li className="flex gap-2"><span className="text-green-400">✓</span> Read nearby segment leaderboards</li>
          <li className="flex gap-2"><span className="text-green-400">✓</span> Check your personal records on segments</li>
        </ul>
        <a href="/api/strava-auth">
          <img src={stravaBtn} alt="Connect with Strava" className="w-full" />
        </a>
        {errorMessage && (
          <p className="mt-4 text-xs text-red-400">{errorMessage}</p>
        )}
      </div>
    </div>
  )
}

