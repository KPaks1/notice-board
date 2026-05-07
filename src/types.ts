export type ActivityType = 'running' | 'cycling'
export type TargetType = 'kom' | 'personal_best'
export type SegmentMode = 'hunt' | 'harvest'

export interface Settings {
  radiusKm: number
  activityType: ActivityType
  targetType: TargetType
  minSegmentKm: number
  maxSegmentKm: number
  mode: SegmentMode
  unit: 'km' | 'mile'
}

export interface ScoredSegment {
  id: number
  name: string
  translatedName: string | null
  distance: number
  elevationGain: number
  activityType: string
  score: number
  targetTime: number
  userPR: number | null
  estimatedTime: number | null
  targetLabel: string
  city: string | null
  state: string | null
  midpointLat: number
  midpointLng: number
  polyline: string | null
  startLatlng: [number, number] | null
  endLatlng: [number, number] | null
  starred: boolean
}

export interface StravaStatus {
  connected: boolean
  athleteId?: string
  athleteName?: string | null
  athleteSex?: 'M' | 'F' | null
  athletePhoto?: string | null
  primaryActivity?: 'running' | 'cycling' | null
  bestEffortsComputed?: boolean
}

export interface EffortEntry {
  distanceM: number
  label: string
  secsPerMeter: number | null
  estimatedSecs: number | null
  source: 'measured' | 'riegel' | 'cs' | 'sprint'
}

export interface BestEfforts {
  computed: true
  run: EffortEntry[]
  ride: EffortEntry[]
  computedAt: string
}

export type BestEffortsResponse = BestEfforts | { computed: false }
