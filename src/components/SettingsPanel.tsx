import { useState } from 'react'
import type { Settings, ActivityType, TargetType } from '../types'
import { formatRadius, formatKm, formatElevation } from '../format'
import RangeSlider from './RangeSlider'

interface Props {
  settings: Settings
  onChange: (s: Settings) => void
  onResetPool: () => Promise<void>
  segmentDistanceRange: { min: number; max: number } | null
  segmentElevationRange: { min: number; max: number } | null
  segmentCounts: { hunt: number; harvest: number }
}

const TARGET_OPTIONS: { value: TargetType; label: string }[] = [
  { value: 'kom', label: 'Course Record' },
  { value: 'personal_best', label: 'Personal Best' },
]

const ACTIVITY_OPTIONS: { value: ActivityType; label: string }[] = [
  { value: 'running', label: 'Running' },
  { value: 'cycling', label: 'Cycling' },
]

export default function SettingsPanel({ settings, onChange, onResetPool, segmentDistanceRange, segmentElevationRange, segmentCounts }: Props) {
  const distMin = segmentDistanceRange?.min ?? 0
  const distMax = segmentDistanceRange?.max ?? 50
  const elevMin = 0
  const elevMax = segmentElevationRange?.max ?? 25
  const u = settings.unit
  const [resetting, setResetting] = useState(false)
  const [resetDone, setResetDone] = useState(false)

  async function handleReset() {
    setResetting(true)
    setResetDone(false)
    try {
      await onResetPool()
      setResetDone(true)
      setTimeout(() => setResetDone(false), 3000)
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="space-y-8 py-2">
      <div>
        <p className="text-sm font-semibold text-white mb-3">Units</p>
        <div className="flex gap-1">
          {(['km', 'mile'] as const).map((unit) => (
            <button
              key={unit}
              onClick={() => onChange({ ...settings, unit })}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                u === unit ? 'bg-strava text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {unit === 'km' ? 'Kilometres' : 'Miles'}
            </button>
          ))}
        </div>
      </div>

      <div className="md:hidden space-y-8">
      <div>
        <label className="block text-sm font-semibold text-white mb-3">
          Search Radius
          <span className="ml-2 font-normal text-strava">{formatRadius(settings.radiusKm, u)}</span>
        </label>
        <input
          type="range"
          min={0.5}
          max={20}
          step={0.5}
          value={settings.radiusKm}
          onChange={(e) => onChange({ ...settings, radiusKm: Number(e.target.value) })}
          className="w-full accent-strava"
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
          Elevation Gain
          <span className="ml-2 font-normal text-strava">
            {settings.minElevationGain <= elevMin ? 'Any' : formatElevation(settings.minElevationGain, u)}
            {' — '}
            {formatElevation(Math.min(settings.maxElevationGain, elevMax), u)}
          </span>
        </label>
        <RangeSlider
          min={elevMin}
          max={elevMax}
          step={5}
          valueMin={Math.max(settings.minElevationGain, elevMin)}
          valueMax={Math.min(settings.maxElevationGain, elevMax)}
          onChange={(lo, hi) => onChange({ ...settings, minElevationGain: lo, maxElevationGain: hi })}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{formatElevation(elevMin, u)}</span>
          <span>{formatElevation(elevMax, u)}</span>
        </div>
      </div>
      </div>{/* end md:hidden */}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-semibold text-white mb-3">Activity Type</p>
          <div className="space-y-2">
            {ACTIVITY_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="activityType"
                  value={opt.value}
                  checked={settings.activityType === opt.value}
                  onChange={() => onChange({ ...settings, activityType: opt.value })}
                  className="accent-strava"
                />
                <span className="text-sm text-gray-300">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-white mb-3">Beat Target</p>
          <div className="space-y-2">
            {TARGET_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="targetType"
                  value={opt.value}
                  checked={settings.targetType === opt.value}
                  onChange={() => onChange({ ...settings, targetType: opt.value })}
                  className="accent-strava"
                />
                <span className="text-sm text-gray-300">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="md:hidden text-sm text-gray-400">
        Hunt <span className="text-white font-medium">{segmentCounts.hunt}</span>
        <span className="mx-2 text-gray-600">/</span>
        Harvest <span className="text-white font-medium">{segmentCounts.harvest}</span>
      </div>

      <div className="pt-2 border-t border-gray-800 space-y-3">
        <p className="text-xs text-gray-500">
          Settings are saved locally and applied on the next search.
        </p>
        <button
          onClick={handleReset}
          disabled={resetting}
          className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors"
        >
          {resetting ? 'Resetting…' : resetDone ? 'Done — segments will refresh' : 'Reset segment pool'}
        </button>
      </div>
    </div>
  )
}
