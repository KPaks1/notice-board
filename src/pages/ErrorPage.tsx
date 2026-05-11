import { useEffect, useState } from 'react'

function goHome() {
  window.location.replace('/')
}

export default function ErrorPage() {
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    if (countdown <= 0) {
      goHome()
      return
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-bold text-white tracking-tight">Eviction Notice</h1>
      <p className="text-white font-medium text-sm">Oops, something went wrong</p>
      <p className="text-gray-500 text-xs">Heading back home in {countdown}…</p>
      <button
        onClick={goHome}
        className="mt-2 px-4 py-2 text-xs font-medium text-white bg-strava rounded-lg"
      >
        Go now
      </button>
    </div>
  )
}
