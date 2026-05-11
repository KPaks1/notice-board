import type { SegmentMode, ScoredSegment } from '../types'
import type { Unit } from '../format'
import SegmentCard from './SegmentCard'

function Skeleton() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse">
      <div className="flex justify-between mb-2">
        <div className="h-4 bg-gray-700 rounded w-2/3" />
        <div className="h-5 bg-gray-700 rounded-full w-16" />
      </div>
      <div className="h-3 bg-gray-800 rounded w-1/3 mb-3" />
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-gray-800 rounded-lg h-12" />
        ))}
      </div>
    </div>
  )
}

interface Props {
  segments: ScoredSegment[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  mode: SegmentMode
  unit: Unit
  userLat: number
  userLng: number
  roadDistances: Record<number, number>
}

export default function EvictionsList({ segments, loading, error, onRefresh, mode, unit, userLat, userLng, roadDistances }: Props) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} />)}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 text-sm mb-4">{error}</p>
        <button
          onClick={onRefresh}
          className="text-sm text-strava hover:text-strava-light underline"
        >
          Try again
        </button>
      </div>
    )
  }

  if (segments.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-4">🏳️</p>
        <p className="text-white font-medium mb-1">No segments found</p>
        <p className="text-gray-400 text-sm">
          {mode === 'hunt'
            ? 'No segments within 35% of your pace nearby. Try a wider radius.'
            : 'No beatable segments nearby. Try Hunt mode to find segments within reach.'}
        </p>
      </div>
    )
  }

  const label = mode === 'hunt' ? '🎯 In Range' : '🌾 Easy Wins'

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
        {label} ({segments.length})
      </p>
      {segments.map((s) => <SegmentCard key={s.id} segment={s} unit={unit} userLat={userLat} userLng={userLng} roadDistance={roadDistances[s.id]} />)}
    </div>
  )
}
