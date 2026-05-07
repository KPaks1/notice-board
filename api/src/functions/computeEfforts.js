import { getToken, saveToken } from '../tableClient.js'

const TARGETS = [
  { distanceM: 100,   label: '100m',   minM: 60,   maxM: 200   },
  { distanceM: 400,   label: '400m',   minM: 200,  maxM: 800   },
  { distanceM: 1000,  label: '1km',    minM: 800,  maxM: 1800  },
  { distanceM: 1600,  label: '1 mile', minM: 1800, maxM: 3500  },
  { distanceM: 5000,  label: '5km',    minM: 3500, maxM: 8000  },
  { distanceM: 10000, label: '10km',   minM: 8000, maxM: 16000 },
]

// Rolling window distances pulled from activity streams.
// searchM = actual metres searched; effortM = key in TARGETS (1 mile = 1609m actual).
const ROLLING_TARGETS = [
  { searchM: 100,  effortM: 100  },
  { searchM: 400,  effortM: 400  },
  { searchM: 1000, effortM: 1000 },
  { searchM: 1609, effortM: 1600 },
]
const ROLLING_EFFORT_DISTS = new Set(ROLLING_TARGETS.map((t) => t.effortM))
const STREAM_RUN_LIMIT = 50

const RUN_TYPES = new Set(['Run', 'VirtualRun'])
const RIDE_TYPES = new Set(['Ride', 'VirtualRide'])

// ── Riegel (aerobic, 1600m+) ─────────────────────────────────────────────────
function riegel(anchorSecs, anchorDist, targetDist) {
  return anchorSecs * Math.pow(targetDist / anchorDist, 1.06)
}

// ── Sprint decay (sub-aerobic cascade) ───────────────────────────────────────
// Applied at each cascade step: 1600m→1000m, 1000m→400m, 400m→100m.
// k=1.15: ~15% faster pace at 400m vs 1km, ~23% faster at 100m vs 400m.
// (k=1.10 predicted too slow; elite sprinters ~1.03, pure endurance ~1.20)
function sprintDecay(anchorSecs, anchorDist, targetDist, k = 1.15) {
  return Math.round(anchorSecs * Math.pow(targetDist / anchorDist, k))
}

// ── Monotonicity clamp ───────────────────────────────────────────────────────
// Physical law: shorter distances must have equal or faster pace than longer ones.
// Clamps any entry that violates this (prevents any model producing e.g. a 1km
// pace slower than the measured 5km pace).
function enforceMonotonicity(efforts) {
  const sorted = [...efforts].sort((a, b) => b.distanceM - a.distanceM)
  let floorSPM = Infinity
  const clamped = sorted.map((entry) => {
    if (entry.secsPerMeter == null) return entry
    if (entry.secsPerMeter > floorSPM) {
      const estimatedSecs = Math.round(floorSPM * entry.distanceM)
      return { ...entry, secsPerMeter: floorSPM, estimatedSecs }
    }
    floorSPM = entry.secsPerMeter
    return entry
  })
  return clamped.sort((a, b) => a.distanceM - b.distanceM)
}

// ── Rolling best from activity streams ───────────────────────────────────────
// Two-pointer sliding window: finds the minimum time to cover targetDist metres
// anywhere within a single activity's GPS stream.
function fastestSplitTime(distances, times, targetDist) {
  if (distances.length === 0) return null
  let best = null
  let left = 0
  for (let right = 0; right < distances.length; right++) {
    while (left + 1 < right && distances[right] - distances[left + 1] >= targetDist) {
      left++
    }
    if (distances[right] - distances[left] >= targetDist) {
      const elapsed = times[right] - times[left]
      if (best === null || elapsed < best) best = elapsed
    }
  }
  return best
}

// streamCache: { [activityId]: { 100: secs|null, 400: secs|null, ... } }
// Activity stream data is immutable once recorded, so cached values never expire.
// Returns { bests, updatedCache } — only activities not already in the cache are fetched.
async function fetchRollingBests(runs, accessToken, streamCache = {}) {
  const recent = runs.slice(0, STREAM_RUN_LIMIT)
  const bests = {}
  const updatedCache = { ...streamCache }

  await Promise.all(recent.map(async (activity) => {
    const id = String(activity.id)

    if (updatedCache[id]) {
      // Cache hit — contribute cached splits to bests without any API call
      for (const { effortM } of ROLLING_TARGETS) {
        const t = updatedCache[id][effortM]
        if (t != null && (bests[effortM] == null || t < bests[effortM])) {
          bests[effortM] = t
        }
      }
      return
    }

    // Cache miss — fetch stream and store result (even if null, so we don't retry)
    try {
      const res = await fetch(
        `https://www.strava.com/api/v3/activities/${activity.id}/streams?keys=distance,time&key_by_type=true`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
      if (!res.ok) return
      const data = await res.json()
      const distances = data.distance?.data ?? []
      const times    = data.time?.data    ?? []

      const activityBests = {}
      for (const { searchM, effortM } of ROLLING_TARGETS) {
        const t = distances.length > 0 ? fastestSplitTime(distances, times, searchM) : null
        activityBests[effortM] = t ?? null
        if (t != null && (bests[effortM] == null || t < bests[effortM])) {
          bests[effortM] = t
        }
      }
      updatedCache[id] = activityBests
    } catch {
      // skip — activity will be retried on next refresh
    }
  }))

  return { bests, updatedCache }
}

function resolve(entry, estimatedSecs) {
  return { ...entry, secsPerMeter: estimatedSecs / entry.distanceM, estimatedSecs }
}

function computeEfforts(activities, rollingBests = {}) {
  // Step 1: establish measured times — rolling stream best takes priority over
  // the band-based filter for the four stream-sourced distances.
  const efforts = TARGETS.map((target) => {
    if (ROLLING_EFFORT_DISTS.has(target.distanceM) && rollingBests[target.distanceM] != null) {
      const estimatedSecs = Math.round(rollingBests[target.distanceM])
      return {
        distanceM: target.distanceM,
        label: target.label,
        secsPerMeter: estimatedSecs / target.distanceM,
        estimatedSecs,
        source: 'measured',
      }
    }

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

  const measured = efforts.filter((e) => e.source === 'measured')
  if (measured.length === 0) return efforts

  // Build a mutable lookup so cascade steps can read each other's resolved values
  const byDist = Object.fromEntries(efforts.map((e) => [e.distanceM, { ...e }]))

  // Step 2: Riegel zone — fill 5km and 10km from the nearest aerobic anchor (≥1600m).
  for (const d of [5000, 10000]) {
    if (byDist[d].source === 'measured') continue
    const aerobicAnchors = measured.filter((e) => e.distanceM >= 1600)
    const pool = aerobicAnchors.length > 0 ? aerobicAnchors : measured
    const anchor = pool.reduce((a, b) =>
      Math.abs(a.distanceM - d) < Math.abs(b.distanceM - d) ? a : b,
    )
    byDist[d] = resolve(byDist[d], Math.round(riegel(anchor.estimatedSecs, anchor.distanceM, d)))
  }

  // Step 3: fill 1 mile (1600m) from aerobic data via Riegel if not measured.
  if (byDist[1600].source !== 'measured') {
    const aerobicAnchors = measured.filter((e) => e.distanceM > 1600)
    if (aerobicAnchors.length > 0) {
      const anchor = aerobicAnchors.reduce((a, b) =>
        Math.abs(a.distanceM - 1600) < Math.abs(b.distanceM - 1600) ? a : b,
      )
      byDist[1600] = resolve(byDist[1600], Math.round(riegel(anchor.estimatedSecs, anchor.distanceM, 1600)))
    }
  }

  // Step 4: cascade sprint decay — each distance anchors to the next longer one:
  //   1 mile → 1km → 400m → 100m
  for (const [fromDist, toDist] of [[1600, 1000], [1000, 400], [400, 100]]) {
    if (byDist[toDist].source === 'measured') continue
    const anchor = byDist[fromDist]
    if (!anchor?.estimatedSecs) continue
    byDist[toDist] = resolve(byDist[toDist], sprintDecay(anchor.estimatedSecs, fromDist, toDist))
  }

  // Step 5: enforce monotonicity — shorter distances must never be slower than longer ones
  const result = Object.values(byDist).sort((a, b) => a.distanceM - b.distanceM)
  return enforceMonotonicity(result)
}

// Given a stored effort list, estimate the athlete's time for an arbitrary distance.
// Uses Riegel (k=1.06) for aerobic distances, sprint decay (k=1.15) for sub-1600m.
export function estimateTimeForDistance(effortList, distanceM) {
  if (!effortList || effortList.length === 0) return null
  const valid = effortList.filter((e) => e.secsPerMeter != null && e.estimatedSecs != null)
  if (valid.length === 0) return null
  const anchor = valid.reduce((a, b) =>
    Math.abs(a.distanceM - distanceM) < Math.abs(b.distanceM - distanceM) ? a : b,
  )
  const k = distanceM >= 1600 ? 1.06 : 1.15
  return Math.round(anchor.estimatedSecs * Math.pow(distanceM / anchor.distanceM, k))
}

export async function computeAndSaveBestEfforts(athleteId, accessToken) {
  const res = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=200', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Strava activities fetch failed: ${res.status}`)

  const activities = await res.json()
  const runs  = activities.filter((a) => RUN_TYPES.has(a.sport_type))
  const rides = activities.filter((a) => RIDE_TYPES.has(a.sport_type))

  // Fetch rolling best splits for the 4 short distances from the 50 most recent runs.
  // Cached stream results (keyed by activity ID) avoid re-fetching immutable activity data.
  const token = await getToken(athleteId)
  const { bests: rollingBests, updatedCache } = await fetchRollingBests(runs, accessToken, token?.streamCache ?? {})

  const result = {
    run:  computeEfforts(runs,  rollingBests),
    ride: computeEfforts(rides),
    computedAt: new Date().toISOString(),
  }

  if (token) {
    await saveToken(athleteId, {
      ...token,
      bestEfforts: result,
      streamCache: updatedCache,
      bestEffortsUpdatedAt: result.computedAt,
    })
  }

  return result
}
