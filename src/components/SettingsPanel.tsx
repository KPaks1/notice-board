import type { Settings } from '../types'
import { formatRadius, formatKm, formatElevation } from '../format'
import RangeSlider, { SingleSlider } from './RangeSlider'

interface Props {
  settings: Settings
  onChange: (s: Settings) => void
  segmentDistanceRange: { min: number; max: number } | null
  segmentElevationRange: { min: number; max: number } | null
  segmentCounts: { hunt: number; harvest: number }
}

export default function SettingsPanel({ settings, onChange, segmentDistanceRange, segmentElevationRange, segmentCounts }: Props) {
  const distMin = segmentDistanceRange?.min ?? 0
  const distMax = segmentDistanceRange?.max ?? 50
  const elevMin = 0
  const elevMax = segmentElevationRange?.max ?? 25
  const u = settings.unit

  return (
    <div className="space-y-8 py-2">
      <div className="md:hidden space-y-8">
        <div>
          <label className="block text-sm font-semibold text-white mb-3">
            Search Radius
            <span className="ml-2 font-normal text-strava">{formatRadius(settings.radiusKm, u)}</span>
          </label>
          <SingleSlider
            min={0.5}
            max={20}
            step={0.5}
            value={settings.radiusKm}
            onChange={(v) => onChange({ ...settings, radiusKm: v })}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{formatRadius(0.5, u)}</span>
            <span>{formatRadius(20, u)}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-white mb-3">
            Segment Distance
            <span className="ml-2 font-normal text-strava">
              {settings.minSegmentKm <= distMin ? 'Any' : formatKm(settings.minSegmentKm, u)}
              {' — '}
              {formatKm(settings.maxSegmentKm, u)}
            </span>
          </label>
          <RangeSlider
            min={distMin}
            max={distMax}
            step={0.5}
            valueMin={Math.max(settings.minSegmentKm, distMin)}
            valueMax={Math.min(settings.maxSegmentKm, distMax)}
            onChange={(lo, hi) => onChange({ ...settings, minSegmentKm: lo, maxSegmentKm: hi })}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{formatKm(distMin, u)}</span>
            <span>{formatKm(distMax, u)}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-white mb-3">
            Elevation Change
            <span className="ml-2 font-normal text-strava">
              {settings.minElevationChange <= elevMin ? 'Any' : formatElevation(settings.minElevationChange, u)}
              {' — '}
              {formatElevation(Math.min(settings.maxElevationChange, elevMax), u)}
            </span>
          </label>
          <RangeSlider
            min={elevMin}
            max={elevMax}
            step={5}
            valueMin={Math.max(settings.minElevationChange, elevMin)}
            valueMax={Math.min(settings.maxElevationChange, elevMax)}
            onChange={(lo, hi) => onChange({ ...settings, minElevationChange: lo, maxElevationChange: hi })}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{formatElevation(elevMin, u)}</span>
            <span>{formatElevation(elevMax, u)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-semibold text-white mb-3">Beat Target</p>
            <div className="space-y-2">
              {(['kom', 'personal_best'] as const).map((value) => (
                <label key={value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="targetType"
                    value={value}
                    checked={settings.targetType === value}
                    onChange={() => onChange({ ...settings, targetType: value })}
                    className="accent-strava"
                  />
                  <span className="text-sm text-gray-300">
                    {value === 'kom' ? 'Course Record' : 'Personal Best'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-white mb-3">Units</p>
            <div className="space-y-2">
              {([{ value: 'km', label: 'Kilometres' }, { value: 'mile', label: 'Miles' }] as const).map(({ value, label }) => (
                <label key={value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="unit"
                    value={value}
                    checked={settings.unit === value}
                    onChange={() => onChange({ ...settings, unit: value })}
                    className="accent-strava"
                  />
                  <span className="text-sm text-gray-300">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="text-sm text-gray-400">
          Hunt <span className="text-white font-medium">{segmentCounts.hunt}</span>
          <span className="mx-2 text-gray-600">/</span>
          Harvest <span className="text-white font-medium">{segmentCounts.harvest}</span>
        </div>
      </div>
    </div>
  )
}
