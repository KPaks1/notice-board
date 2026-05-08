import { Component, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { fetchStravaStatus, refreshAthleteEfforts, storeToken } from './api'
import type { StravaStatus } from './types'
import ConnectStrava from './pages/ConnectStrava'
import Dashboard from './pages/Dashboard'
import ErrorPage from './pages/ErrorPage'
import SegmentDetailPage from './pages/SegmentDetailPage'

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
  if (!status?.connected) return <Navigate to="/connect-strava" replace />
  return <>{children(status!)}</>
}

function LoadingScreen({ retrying = false }: { retrying?: boolean }) {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      {retrying && <p className="text-xs text-gray-500">Server starting up…</p>}
    </div>
  )
}

function SetupScreen() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-bold text-white tracking-tight">Eviction Notice</h1>
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      <div>
        <p className="text-white font-medium text-sm">Setting up your pace profile</p>
        <p className="text-gray-500 text-xs mt-1">Analysing your last 200 activities…</p>
      </div>
    </div>
  )
}

let sessionOnboardingDone = false

function OnboardingGate({ status }: { status: StravaStatus }) {
  const alreadyDone = sessionOnboardingDone || (status.bestEffortsComputed ?? false)
  const [ready, setReady] = useState(alreadyDone)

  useEffect(() => {
    if (ready) return
    refreshAthleteEfforts()
      .then(() => { sessionOnboardingDone = true; setReady(true) })
      .catch(() => { sessionOnboardingDone = true; setReady(true) })
  }, [])

  if (!ready) return <SetupScreen />
  return <Dashboard stravaStatus={status} />
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route path="/connect-strava" element={<ConnectStrava />} />
          <Route path="/" element={<StravaGuard>{(status) => <OnboardingGate status={status} />}</StravaGuard>} />
          <Route path="/segment/:id" element={<StravaGuard>{() => <SegmentDetailPage />}</StravaGuard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
