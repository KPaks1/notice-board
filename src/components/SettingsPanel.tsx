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

function PillToggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex bg-gray-800/50 rounded-lg p-0.5 gap-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
            value === o.value ? 'bg-strava text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function SettingsPanel({ settings, onChange, segmentDistanceRange, segmentElevationRange, segmentCounts }: Props) {
  const distMin = segmentDistanceRange?.min ?? 0
  const distMax = segmentDistanceRange?.max ?? 50
  const elevMin = 0
  const elevMax = segmentElevationRange?.max ?? 25
  const u = settings.unit

  return (
    <div className="py-2">
      <div className="md:hidden space-y-4">
        <div>
          <label className="flex justify-between text-xs mb-3">
            <span className="font-medium text-white">Search Radius</span>
            <span className="text-strava">{formatRadius(settings.radiusKm, u)}</span>
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
          <label className="flex justify-between text-xs mb-3">
            <span className="font-medium text-white">Segment Distance</span>
            <span className="text-strava">
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
          <label className="flex justify-between text-xs mb-3">
            <span className="font-medium text-white">Elevation Change</span>
            <span className="text-strava">
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

        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-white mb-2">Beat Target</p>
            <PillToggle
              value={settings.targetType}
              options={[
                { value: 'kom', label: 'Course Record' },
                { value: 'personal_best', label: 'Personal Best' },
              ]}
              onChange={(v) => onChange({ ...settings, targetType: v })}
            />
          </div>
          <div>
            <p className="text-xs font-medium text-white mb-2">Units</p>
            <PillToggle
              value={settings.unit}
              options={[
                { value: 'km', label: 'Kilometres' },
                { value: 'mile', label: 'Miles' },
              ]}
              onChange={(v) => onChange({ ...settings, unit: v })}
            />
          </div>
        </div>

        <div className="bg-gray-900 rounded-2xl p-4 flex justify-around">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{segmentCounts.hunt}</p>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 mt-0.5">Hunt</p>
          </div>
          <div className="w-px bg-gray-800" />
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{segmentCounts.harvest}</p>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 mt-0.5">Harvest</p>
          </div>
        </div>
      </div>
    </div>
  )
}
