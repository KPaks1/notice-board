export type ActivityType = 'running' | 'cycling' | 'both'
export type TargetType = 'kom' | 'gender' | 'age_group' | 'personal_best'

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
}

export interface StravaStatus {
  connected: boolean
  athleteName?: string
}
