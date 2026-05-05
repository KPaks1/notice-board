export default function ConnectStrava() {
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
        <a
          href="/api/strava-auth"
          className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl bg-orange-500 text-white font-medium hover:bg-orange-400 transition-colors"
        >
          <StravaIcon />
          Connect with Strava
        </a>
      </div>
    </div>
  )
}

function StravaIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
    </svg>
  )
}
