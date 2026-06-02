import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Crown } from 'lucide-react'
import stravaBtn from '../assets/strava/connect-with/btn_strava_connect_with_orange_x2.svg'
import PolicyModal from '../components/PolicyModal'
import { APP_NAME } from '../constants'

const CONSENT_KEY = 'en_consent'

const ERROR_MESSAGES: Record<string, string> = {
  denied: 'Strava authorisation was denied or failed. Please try again.',
  'token-exchange': 'Could not exchange the Strava code for a token. Check your app credentials.',
}

export default function ConnectStrava() {
  const [searchParams] = useSearchParams()
  const errorCode = searchParams.get('error')
  const errorMessage = errorCode ? (ERROR_MESSAGES[errorCode] ?? 'Something went wrong. Please try again.') : null

  const [agreed, setAgreed] = useState(() => localStorage.getItem(CONSENT_KEY) === '1')
  const [modal, setModal] = useState<'privacy' | 'tos' | null>(null)

  function handleAgree(checked: boolean) {
    setAgreed(checked)
    if (checked) localStorage.setItem(CONSENT_KEY, '1')
    else localStorage.removeItem(CONSENT_KEY)
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-950">
      {modal && <PolicyModal type={modal} onClose={() => setModal(null)} />}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 w-full max-w-sm text-center shadow-xl">
        <div className="mb-6">
          <div className="flex justify-center">
            <Crown size={48} className="text-orange-500" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-white tracking-tight">{APP_NAME}</h1>
          <p className="mt-3 text-gray-400 text-sm leading-relaxed">
            {APP_NAME} analyses your activity history to find nearby segments you can beat.
          </p>
        </div>
        <ul className="text-left text-sm text-gray-400 mb-6 space-y-2">
          <li className="flex gap-2"><span className="text-green-400">✓</span> View your recent activity paces</li>
          <li className="flex gap-2"><span className="text-green-400">✓</span> Read nearby segment leaderboards</li>
          <li className="flex gap-2"><span className="text-green-400">✓</span> Check your personal records on segments</li>
        </ul>
        <label className="flex items-start gap-3 text-left text-xs text-gray-400 mb-6 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => handleAgree(e.target.checked)}
            className="mt-0.5 shrink-0 accent-orange-500"
          />
          <span>
            I have read and agree to the{' '}
            <button
              type="button"
              onClick={() => setModal('privacy')}
              className="text-orange-400 underline hover:text-white transition-colors"
            >
              Privacy Policy
            </button>
            {' '}and{' '}
            <button
              type="button"
              onClick={() => setModal('tos')}
              className="text-orange-400 underline hover:text-white transition-colors"
            >
              Terms of Service
            </button>
          </span>
        </label>
        {agreed ? (
          <a href="/api/strava-auth">
            <img src={stravaBtn} alt="Connect with Strava" className="w-full" />
          </a>
        ) : (
          <img src={stravaBtn} alt="Connect with Strava" className="w-full opacity-40 cursor-not-allowed" />
        )}
        {errorMessage && (
          <p className="mt-4 text-xs text-red-400">{errorMessage}</p>
        )}
      </div>
    </div>
  )
}
