import { Component, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { fetchStravaStatus, refreshAthleteEfforts, storeToken } from './api'
import { APP_NAME } from './constants'
import type { StravaStatus } from './types'
import ConnectStrava from './pages/ConnectStrava'
import Dashboard from './pages/Dashboard'
import ErrorPage from './pages/ErrorPage'
import PrivacyPage from './pages/PrivacyPage'
import SegmentDetailPage from './pages/SegmentDetailPage'
import WelcomePage from './pages/WelcomePage'

class ErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false }
  static getDerivedStateFromError() { return { crashed: true } }
  componentDidCatch(err: unknown) { console.error('Uncaught render error:', err) }
  render() {
    if (this.state.crashed) return <ErrorPage />
    return this.props.children
  }
}

// Handle token from OAuth redirect synchronously before React renders,
// so fetchStravaStatus() always finds the token already in sessionStorage.
;(() => {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token')
  if (token) {
    storeToken(token)
    window.history.replaceState({}, '', window.location.pathname)
  }
})()

function StravaGuard({ children }: { children: (status: StravaStatus) => React.ReactNode }) {
  const [status, setStatus] = useState<StravaStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)

  function attempt() {
    setLoading(true)
    setRetrying(false)
    fetchStravaStatus()
      .then((s) => { setStatus(s); setLoading(false) })
      .catch(() => { setLoading(false); setRetrying(true) })
  }

  useEffect(attempt, [])

  useEffect(() => {
    if (!retrying) return
    const t = setTimeout(attempt, 3000)
    return () => clearTimeout(t)
  }, [retrying])

  if (loading || retrying) return <LoadingScreen retrying={retrying} />
  if (!status?.connected) return <ConnectStrava />
  return <>{children(status!)}</>
}

function LoadingScreen({ retrying = false }: { retrying?: boolean }) {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 border-2 border-strava border-t-transparent rounded-full animate-spin" />
      {retrying && <p className="text-xs text-gray-500">Server starting up…</p>}
    </div>
  )
}


let sessionOnboardingDone = false

const EFFORT_TIMEOUT_MS = 5 * 60 * 1000  // give up after 5 minutes

function OnboardingGate({ status }: { status: StravaStatus }) {
  const alreadyDone = sessionOnboardingDone || (status.bestEffortsComputed ?? false)
  const [started, setStarted] = useState(alreadyDone)
  const [ready, setReady] = useState(alreadyDone)
  const [timedOut, setTimedOut] = useState(false)

  // Kick off effort computation immediately — retry until success or timeout
  useEffect(() => {
    if (alreadyDone) return
    let cancelled = false
    const deadline = Date.now() + EFFORT_TIMEOUT_MS

    async function run() {
      while (!cancelled) {
        try {
          await refreshAthleteEfforts()
          if (!cancelled) { sessionOnboardingDone = true; setReady(true) }
          return
        } catch (err: unknown) {
          if (Date.now() >= deadline) {
            if (!cancelled) setTimedOut(true)
            return
          }
          const isRateLimit = (err as { status?: number })?.status === 429
          if (!cancelled) await new Promise((r) => setTimeout(r, isRateLimit ? 60_000 : 5_000))
        }
      }
    }
    run()
    return () => { cancelled = true }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  if (timedOut) return <EffortErrorScreen />
  if (!started) return <WelcomePage onStart={() => setStarted(true)} />
  if (!ready) return <SetupScreen />
  return <Dashboard stravaStatus={status} />
}

function EffortErrorScreen() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-bold text-white tracking-tight">Something's not right</h1>
      <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
        We weren't able to set up your pace profile. This is usually a temporary issue — come back in a few minutes and try again.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-2 px-5 py-2.5 bg-strava hover:bg-strava-light active:bg-strava-dark text-white text-sm font-semibold rounded-lg transition-colors"
      >
        Try again
      </button>
    </div>
  )
}

function SetupScreen() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-bold text-white tracking-tight">{APP_NAME}</h1>
      <div className="w-8 h-8 border-2 border-strava border-t-transparent rounded-full animate-spin" />
      <div>
        <p className="text-white font-medium text-sm">Setting up your pace profile</p>
        <p className="text-gray-500 text-xs mt-1">Analysing your last 200 activities…</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/connect-strava" element={<ConnectStrava />} />
          <Route path="*" element={
            <StravaGuard>
              {(status) => (
                <Routes>
                  <Route path="/" element={<OnboardingGate status={status} />} />
                  <Route path="/segment/:id" element={<SegmentDetailPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              )}
            </StravaGuard>
          } />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
