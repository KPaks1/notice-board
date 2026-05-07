import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import type { ScoredSegment } from '../types'
import { formatDistance, formatPace, formatTime, type Unit } from '../format'
import SegmentMiniMap from './SegmentMiniMap'

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

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
}

export default function SegmentCard({ segment, unit, userLat, userLng }: Props) {
  const needTime = Math.max(0, segment.targetTime - 1)

  const distanceToStart = segment.startLatlng
    ? haversineKm(userLat, userLng, segment.startLatlng[0], segment.startLatlng[1])
    : null

  return (
    <Link
      to={`/segment/${segment.id}`}
      state={{ segment, unit, userLat, userLng }}
      className="block bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors"
    >
      {segment.polyline && (
        <div className="rounded-t-xl overflow-hidden">
          <SegmentMiniMap polyline={segment.polyline} />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-white font-medium text-sm leading-snug flex-1">{segment.name}</h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {segment.starred && <Star size={14} className="text-yellow-400 fill-yellow-400" />}
            <Badge score={segment.score} />
          </div>
        </div>

        <p className="text-xs text-gray-500 mb-3">
          {formatDistance(segment.distance, unit)}
          {segment.elevationGain > 0 && ` · ${Math.round(segment.elevationGain)}m climb`}
          {distanceToStart != null && ` · ${formatDistance(distanceToStart * 1000, unit)} away`}
          {segment.city && ` · ${segment.city}`}
        </p>

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
    </Link>
  )
}
