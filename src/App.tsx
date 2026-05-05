import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { fetchStravaStatus, storeToken } from './api'
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

  useEffect(() => {
    fetchStravaStatus()
      .then(setStatus)
      .catch(() => setStatus({ connected: false }))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingScreen />
  if (!status?.connected) return <Navigate to="/connect-strava" replace />
  return <>{children(status!)}</>
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <TokenHandler />
      <Routes>
        <Route path="/connect-strava" element={<ConnectStrava />} />
        <Route path="/" element={<StravaGuard>{(status) => <Dashboard stravaStatus={status} />}</StravaGuard>} />
        <Route path="/segment/:id" element={<StravaGuard>{() => <SegmentDetailPage />}</StravaGuard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
