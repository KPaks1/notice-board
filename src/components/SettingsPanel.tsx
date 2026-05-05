import type { Settings, ActivityType, TargetType } from '../types'

interface Props {
  settings: Settings
  onChange: (s: Settings) => void
}

const TARGET_OPTIONS: { value: TargetType; label: string }[] = [
  { value: 'kom', label: 'KOM / QOM' },
  { value: 'personal_best', label: 'Personal Best' },
]

const ACTIVITY_OPTIONS: { value: ActivityType; label: string }[] = [
  { value: 'running', label: 'Running' },
  { value: 'cycling', label: 'Cycling' },
]

export default function SettingsPanel({ settings, onChange }: Props) {
  return (
    <div className="space-y-8 py-2">
      <div>
        <label className="block text-sm font-semibold text-white mb-3">
          Search Radius
          <span className="ml-2 font-normal text-orange-400">{settings.radiusKm} km</span>
        </label>
        <input
          type="range"
          min={0.5}
          max={20}
          step={0.5}
          value={settings.radiusKm}
          onChange={(e) => onChange({ ...settings, radiusKm: Number(e.target.value) })}
          className="w-full accent-orange-500"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0.5 km</span>
          <span>20 km</span>
        </div>
      </div>

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
                className="accent-orange-500"
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
                className="accent-orange-500"
              />
              <span className="text-sm text-gray-300">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-gray-800">
        <p className="text-xs text-gray-500">
          Settings are saved locally and applied on the next search.
        </p>
      </div>
    </div>
  )
}
