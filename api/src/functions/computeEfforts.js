import { getToken, saveToken } from '../tableClient.js'

const TARGETS = [
  { distanceM: 100,   label: '100m',   minM: 60,   maxM: 200   },
  { distanceM: 400,   label: '400m',   minM: 200,  maxM: 800   },
  { distanceM: 1000,  label: '1km',    minM: 800,  maxM: 1800  },
  { distanceM: 1600,  label: '1 mile', minM: 1800, maxM: 3500  },
  { distanceM: 5000,  label: '5km',    minM: 3500, maxM: 8000  },
  { distanceM: 10000, label: '10km',   minM: 8000, maxM: 16000 },
]

const RUN_TYPES = new Set(['Run', 'VirtualRun'])
const RIDE_TYPES = new Set(['Ride', 'VirtualRide'])

function riegel(anchorSecs, anchorDist, targetDist) {
  return anchorSecs * Math.pow(targetDist / anchorDist, 1.06)
}

function computeEfforts(activities) {
  const efforts = TARGETS.map((target) => {
    const candidates = activities.filter(
      (a) => a.distance >= target.minM && a.distance <= target.maxM && a.moving_time > 0,
    )
    if (candidates.length === 0) {
      return { distanceM: target.distanceM, label: target.label, secsPerMeter: null, estimatedSecs: null, source: 'riegel' }
    }
    const best = candidates.reduce((a, b) =>
      a.moving_time / a.distance < b.moving_time / b.distance ? a : b,
    )
    const secsPerMeter = best.moving_time / best.distance
    return {
      distanceM: target.distanceM,
      label: target.label,
      secsPerMeter,
      estimatedSecs: Math.round(secsPerMeter * target.distanceM),
      source: 'measured',
    }
  })

  // Fill Riegel gaps using nearest measured anchor
  const measured = efforts.filter((e) => e.source === 'measured')
  if (measured.length === 0) return efforts

  return efforts.map((entry) => {
    if (entry.source === 'measured') return entry
    const anchor = measured.reduce((a, b) =>
      Math.abs(a.distanceM - entry.distanceM) < Math.abs(b.distanceM - entry.distanceM) ? a : b,
    )
    const estimatedSecs = Math.round(riegel(anchor.estimatedSecs, anchor.distanceM, entry.distanceM))
    const secsPerMeter = estimatedSecs / entry.distanceM
    return { ...entry, secsPerMeter, estimatedSecs }
  })
}

export async function computeAndSaveBestEfforts(athleteId, accessToken) {
  const res = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=200', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Strava activities fetch failed: ${res.status}`)

  const activities = await res.json()
  const runs = activities.filter((a) => RUN_TYPES.has(a.sport_type))
  const rides = activities.filter((a) => RIDE_TYPES.has(a.sport_type))

  const result = {
    run: computeEfforts(runs),
    ride: computeEfforts(rides),
    computedAt: new Date().toISOString(),
  }

  const token = await getToken(athleteId)
  if (token) {
    await saveToken(athleteId, { ...token, bestEfforts: result, bestEffortsUpdatedAt: result.computedAt })
  }

  return result
}
