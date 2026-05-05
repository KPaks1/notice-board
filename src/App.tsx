import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { fetchStravaStatus, refreshAthleteEfforts, storeToken } from './api'
import type { StravaStatus } from './types'
import ConnectStrava from './pages/ConnectStrava'
import Dashboard from './pages/Dashboard'
import SegmentDetailPage from './pages/SegmentDetailPage'

function TokenHandler() {
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (token) {
      storeToken(token)
      navigate('/', { replace: true })
    }
  }, [navigate])

  return null
}

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

function OnboardingGate({ status }: { status: StravaStatus }) {
  const [ready, setReady] = useState(status.bestEffortsComputed ?? false)

  useEffect(() => {
    if (ready) return
    refreshAthleteEfforts()
      .then(() => setReady(true))
      .catch(() => setReady(true))
  }, [])

  if (!ready) return <SetupScreen />
  return <Dashboard stravaStatus={status} />
}

export default function App() {
  return (
    <BrowserRouter>
      <TokenHandler />
      <Routes>
        <Route path="/connect-strava" element={<ConnectStrava />} />
        <Route path="/" element={<StravaGuard>{(status) => <OnboardingGate status={status} />}</StravaGuard>} />
        <Route path="/segment/:id" element={<StravaGuard>{() => <SegmentDetailPage />}</StravaGuard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
