import { useState } from 'react'
import { formatDistance, type Unit } from '../format'

interface Props {
  distanceM: number
  isByPlane: boolean
  unit: Unit
}

export default function DistanceToStart({ distanceM, isByPlane, unit }: Props) {
  const [showInfo, setShowInfo] = useState(false)

  return (
    <span className="relative">
      {formatDistance(distanceM, unit)} {isByPlane ? 'by plane' : 'by road'}
      {isByPlane && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowInfo((v) => !v) }}
          className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-700 text-gray-400 hover:bg-gray-600 text-[9px] font-bold ml-1 align-middle"
        >
          ?
        </button>
      )}
      {showInfo && (
        <span className="absolute left-0 top-5 z-10 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-300 text-xs shadow-lg w-56 block">
          Road distance is temporarily unavailable — showing straight-line distance instead.
        </span>
      )}
    </span>
  )
}
