import { useState } from 'react'
import { adminDeauthAll, adminDeauthSome, fetchAdminAthletes } from '../api'
import type { AdminAthlete } from '../api'

export default function AdminPage() {
  const [secret, setSecret] = useState('')
  const [athletes, setAthletes] = useState<AdminAthlete[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      setAthletes(await fetchAdminAthletes(secret))
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function deauthOne(athleteId: string) {
    setError(null)
    try {
      await adminDeauthSome(secret, [athleteId])
      setAthletes((prev) => prev?.filter((a) => a.athleteId !== athleteId) ?? null)
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }

  async function deauthAll() {
    if (!confirm('Deauth all connected athletes?')) return
    setLoading(true)
    setError(null)
    try {
      const result = await adminDeauthAll(secret)
      setMessage(`Revoked ${result.revoked} connection${result.revoked !== 1 ? 's' : ''}`)
      setAthletes([])
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-8 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-6">Admin</h1>

      <div className="flex gap-2 mb-6">
        <input
          type="password"
          placeholder="Admin secret"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-600"
        />
        <button
          onClick={load}
          disabled={!secret || loading}
          className="px-4 py-2 bg-strava hover:bg-strava-light active:bg-strava-dark text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-30"
        >
          Load
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
      {message && <p className="text-green-400 text-sm mb-4">{message}</p>}

      {athletes !== null && (
        <>
          {athletes.length === 0 ? (
            <p className="text-gray-500 text-sm">No connected athletes.</p>
          ) : (
            <ul className="space-y-2 mb-6">
              {athletes.map((a) => (
                <li key={a.athleteId} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                  {a.athletePhoto && (
                    <img src={a.athletePhoto} className="w-8 h-8 rounded-full" alt="" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.athleteName ?? a.athleteId}</p>
                    <p className="text-xs text-gray-500">{a.athleteId}</p>
                  </div>
                  <button
                    onClick={() => deauthOne(a.athleteId)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors shrink-0"
                  >
                    Deauth
                  </button>
                </li>
              ))}
            </ul>
          )}

          {athletes.length > 0 && (
            <button
              onClick={deauthAll}
              disabled={loading}
              className="w-full py-2.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-30"
            >
              Deauth All ({athletes.length})
            </button>
          )}
        </>
      )}
    </div>
  )
}
