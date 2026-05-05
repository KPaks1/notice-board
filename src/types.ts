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
}

export interface ScoredSegment {
  id: number
  name: string
  distance: number
  elevationGain: number
  activityType: string
  score: number
  targetTime: number
  userPR: number | null
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
  athleteType?: 0 | 1 | null
  runPaceSecsPerKm?: number | null
  ridePaceSecsPerKm?: number | null
  paceUnit?: 'km' | 'mile'
}
