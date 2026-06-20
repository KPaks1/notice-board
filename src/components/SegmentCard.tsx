import { Link } from 'react-router-dom'
import type { ScoredSegment } from '../types'
import { formatDistance, formatPace, formatTime, type Unit } from '../format'
import { haversineKm } from '../geo'
import DistanceToStart from './DistanceToStart'
import SegmentMiniMap from './SegmentMiniMap'

function Badge({ score }: { score: number }) {
  if (score > 0)
    return <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-500/20 text-green-400">BEATABLE</span>
  if (score > -0.05)
    return <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-500/20 text-amber-400">CLOSE</span>
  return <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-700 text-gray-400">TOUGH</span>
}

interface Props {
  segment: ScoredSegment
  unit: Unit
  userLat: number
  userLng: number
  roadDistance?: number
  onHover?: (id: number | null) => void
  onSelect?: (segment: ScoredSegment) => void
  isSelected?: boolean
}

export default function SegmentCard({ segment, unit, userLat, userLng, roadDistance, onHover, onSelect, isSelected }: Props) {
  const needTime = Math.max(0, segment.targetTime - 1)

  const haversineM = segment.startLatlng
    ? haversineKm(userLat, userLng, segment.startLatlng[0], segment.startLatlng[1]) * 1000
    : null
  const distanceM = roadDistance ?? haversineM
  const isByPlane = roadDistance == null && distanceM != null

  const borderClass = isSelected
    ? 'border-strava'
    : 'border-gray-800 hover:border-gray-700'

  const content = (
    <>
      {segment.polyline && (
        <div className="rounded-t-xl overflow-hidden">
          <SegmentMiniMap polyline={segment.polyline} />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-medium text-sm leading-snug">{segment.name}</h3>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge score={segment.score} />
          </div>
        </div>

        <div className="text-xs text-gray-500 mb-3">
          {formatDistance(segment.distance, unit)}
          {segment.elevationGain > 0 && ` · ↑${Math.round(segment.elevationGain)}m ↓${Math.round(segment.elevationLoss)}m`}
          {distanceM != null && <> · <DistanceToStart distanceM={distanceM} isByPlane={isByPlane} unit={unit} /></>}
          {segment.city && ` · ${segment.city}`}
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-gray-800 rounded-lg p-2 text-center">
            <div className="text-gray-400 mb-0.5">{segment.targetLabel}</div>
            <div className="text-white font-mono font-medium">{formatTime(segment.targetTime)}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-2 text-center">
            <div className="text-gray-400 mb-0.5">Your PR</div>
            <div className="text-white font-mono font-medium">
              {segment.userPR ? formatTime(segment.userPR) : '—'}
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-2 text-center">
            <div className="text-gray-400 mb-0.5">Pace</div>
            <div className={`font-mono font-medium ${segment.score > 0 ? 'text-green-400' : 'text-white'}`}>
              {formatPace(needTime, segment.distance, unit)}
            </div>
          </div>
        </div>
      </div>
    </>
  )

  if (onSelect) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(segment)}
        onKeyDown={(e) => e.key === 'Enter' && onSelect(segment)}
        onMouseEnter={() => onHover?.(segment.id)}
        onMouseLeave={() => onHover?.(null)}
        className={`block bg-gray-900 border rounded-xl overflow-hidden cursor-pointer transition-colors ${borderClass}`}
      >
        {content}
      </div>
    )
  }

  return (
    <Link
      to={`/segment/${segment.id}`}
      state={{ segment, unit, userLat, userLng }}
      className={`block bg-gray-900 border rounded-xl overflow-hidden transition-colors ${borderClass}`}
      onMouseEnter={() => onHover?.(segment.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      {content}
    </Link>
  )
}
