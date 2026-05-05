export type ActivityType = 'running' | 'cycling'
export type TargetType = 'kom' | 'personal_best'

export interface Settings {
  radiusKm: number
  activityType: ActivityType
  targetType: TargetType
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
}

export interface StravaStatus {
  connected: boolean
  athleteName?: string
}
