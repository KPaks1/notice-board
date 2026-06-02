import { APP_NAME } from '../constants'

export default function WelcomePage({ onStart }: { onStart: () => void }) {
  return (
    <div className="h-dvh overflow-hidden bg-gray-950 flex flex-col px-6 py-6 sm:py-12 max-w-lg mx-auto sm:rounded-2xl sm:shadow-2xl sm:shadow-black/60 sm:ring-1 sm:ring-white/10">
      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col justify-center gap-6 sm:gap-10">

        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">{APP_NAME}</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            Find Strava segments near you that you can actually beat — or are close enough to chase.
          </p>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <div className="flex gap-4">
            <span className="text-2xl mt-0.5">🎯</span>
            <div>
              <p className="text-white font-medium text-sm mb-1">Hunt mode</p>
              <p className="text-gray-400 text-sm leading-relaxed">
                Shows segments within 35% of your pace — hard enough to be a real challenge, close enough to be achievable. Sorted by beatability by default.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <span className="text-2xl mt-0.5">🌾</span>
            <div>
              <p className="text-white font-medium text-sm mb-1">Harvest mode</p>
              <p className="text-gray-400 text-sm leading-relaxed">
                Shows segments where your estimated pace is already fast enough to take the course record. Go collect them.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <span className="text-2xl mt-0.5">📍</span>
            <div>
              <p className="text-white font-medium text-sm mb-1">Location-based</p>
              <p className="text-gray-400 text-sm leading-relaxed">
                Segments are discovered within your search radius and saved — the pool grows as you explore new areas.
              </p>
            </div>
          </div>
        </div>

      </div>

      <div className="pt-4 sm:pt-8 border-t border-gray-800 shrink-0">
        <button
          onClick={onStart}
          className="w-full bg-strava hover:bg-strava-light active:bg-strava-dark text-white font-semibold text-sm py-3 rounded-lg transition-colors"
        >
          Get Started
        </button>
      </div>
    </div>
  )
}
