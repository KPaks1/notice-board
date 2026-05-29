import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import SegmentDetailPanel from '../components/SegmentDetailPanel'
import type { ScoredSegment } from '../types'
import type { Unit } from '../format'

export default function SegmentDetailPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const segment: ScoredSegment | null = state?.segment ?? (state as ScoredSegment | null)
  const unit: Unit = state?.unit ?? 'km'
  const userLat: number | null = state?.userLat ?? null
  const userLng: number | null = state?.userLng ?? null

  if (!segment) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-gray-400 text-sm text-center">Open a segment from the list to see its details.</p>
        <button onClick={() => navigate('/')} className="flex items-center gap-1 text-strava text-sm">
          <ChevronLeft size={16} /> Back to list
        </button>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-950 flex flex-col max-w-lg mx-auto sm:rounded-2xl sm:overflow-hidden sm:shadow-2xl sm:shadow-black/60 sm:ring-1 sm:ring-white/10 md:max-w-none md:rounded-none md:shadow-none md:ring-0 overflow-hidden">
      <SegmentDetailPanel
        segment={segment}
        unit={unit}
        userLat={userLat}
        userLng={userLng}
        onClose={() => navigate(-1)}
      />
    </div>
  )
}
