import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import RangeSlider from './RangeSlider'
import type { Settings } from '../types'
import { formatRadius, formatKm, formatElevation } from '../format'

interface Props {
  settings: Settings
  onChange: (s: Settings) => void
  segmentDistanceRange: { min: number; max: number } | null
  segmentElevationRange: { min: number; max: number } | null
  segmentCount: number
}

export default function MapFilterOverlay({ settings, onChange, segmentDistanceRange, segmentElevationRange, segmentCount }: Props) {
  const [open, setOpen] = useState(false)
  const u = settings.unit
  const distMin = segmentDistanceRange?.min ?? 0
  const distMax = segmentDistanceRange?.max ?? 50
  const elevMax = segmentElevationRange?.max ?? 25

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[1002]"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="absolute bottom-4 right-4 z-[1003] flex flex-col items-end gap-2">
        {open && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 w-72 shadow-xl space-y-5">

            <div>
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-xs font-semibold text-white">Search Radius</span>
                <span className="text-xs text-strava">{formatRadius(settings.radiusKm, u)}</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={20}
                step={0.5}
                value={settings.radiusKm}
                onChange={(e) => onChange({ ...settings, radiusKm: Number(e.target.value) })}
                className="w-full accent-strava"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>{formatRadius(0.5, u)}</span>
                <span>{formatRadius(20, u)}</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-xs font-semibold text-white">Segment Distance</span>
                <span className="text-xs text-strava">
                  {settings.minSegmentKm <= distMin ? 'Any' : formatKm(settings.minSegmentKm, u)}
                  {' — '}
                  {formatKm(Math.min(settings.maxSegmentKm, distMax), u)}
                </span>
              </div>
              <RangeSlider
                min={distMin}
                max={distMax}
                step={0.5}
                valueMin={Math.max(settings.minSegmentKm, distMin)}
                valueMax={Math.min(settings.maxSegmentKm, distMax)}
                onChange={(lo, hi) => onChange({ ...settings, minSegmentKm: lo, maxSegmentKm: hi })}
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>{formatKm(distMin, u)}</span>
                <span>{formatKm(distMax, u)}</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-xs font-semibold text-white">Elevation Gain</span>
                <span className="text-xs text-strava">
                  {settings.minElevationGain <= 0 ? 'Any' : formatElevation(settings.minElevationGain, u)}
                  {' — '}
                  {formatElevation(Math.min(settings.maxElevationGain, elevMax), u)}
                </span>
              </div>
              <RangeSlider
                min={0}
                max={elevMax}
                step={5}
                valueMin={Math.max(settings.minElevationGain, 0)}
                valueMax={Math.min(settings.maxElevationGain, elevMax)}
                onChange={(lo, hi) => onChange({ ...settings, minElevationGain: lo, maxElevationGain: hi })}
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>0m</span>
                <span>{formatElevation(elevMax, u)}</span>
              </div>
            </div>

          </div>
        )}

        <button
          onClick={() => setOpen(!open)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl shadow-lg transition-colors ${
            open
              ? 'bg-strava text-white'
              : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          <SlidersHorizontal size={15} />
          <span className="text-xs font-medium tabular-nums">{segmentCount}</span>
        </button>
      </div>
    </>
  )
}
