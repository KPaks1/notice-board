import { app } from '@azure/functions'
import { getValidToken, getSegmentCache, setSegmentCache, getSegmentPool, setSegmentPool } from '../tableClient.js'
import { estimateTimeForDistance } from './computeEfforts.js'
import { readSession } from '../session.js'
import { cacheGet, cacheSet } from '../cache.js'
import { StravaError, stravaHttpStatus } from '../stravaError.js'
import { stravaGet } from '../stravaClient.js'
import { translateToEnglish } from '../translator.js'

const TTL_EXPLORE = 4 * 60 * 60   // segment list: 4 hours
const TTL_LEADERBOARD = 4 * 60 * 60  // segment details/KOM: 4 hours
const TTL_STATS = 60 * 60         // athlete stats: 1 hour

const SNAP = 0.01 // ~1km grid — keeps tile cache keys stable across minor GPS jitter
const snapCoord = (v) => Math.round(v / SNAP) * SNAP

function generateTiles(lat, lng, radiusKm, cols = 5, rows = 4) {
  const latDelta = radiusKm / 111.32
  const lngDelta = latDelta / Math.cos((lat * Math.PI) / 180)
  const tileH = (latDelta * 2) / rows
  const tileW = (lngDelta * 2) / cols
  const tiles = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const s = lat - latDelta + r * tileH
      const w = lng - lngDelta + c * tileW
      tiles.push(`${s},${w},${s + tileH},${w + tileW}`)
    }
  }
  return tiles
}


// xoms times can be formatted strings ("1:02") or integers (seconds)
function parseXomTime(xom) {
  if (!xom || xom === 'Not Specified') return null
  if (typeof xom === 'number') return xom
  const parts = String(xom).split(':').map(Number)
  if (parts.some(isNaN) || parts.length < 2 || parts.length > 3) return null
  return parts.length === 3
    ? parts[0] * 3600 + parts[1] * 60 + parts[2]
    : parts[0] * 60 + parts[1]
}

function bestEffortPaceForDistance(efforts, distanceM) {
  if (!efforts || efforts.length === 0) return null
  const valid = efforts.filter((e) => e.secsPerMeter != null)
  if (valid.length === 0) return null
  return valid.reduce((a, b) =>
    Math.abs(a.distanceM - distanceM) < Math.abs(b.distanceM - distanceM) ? a : b
  ).secsPerMeter
}

function targetLabel(targetType) {
  return targetType === 'personal_best' ? 'Your Best' : 'CR'
}

async function mapWithConcurrency(arr, limit, fn) {
  const results = new Array(arr.length)
  let next = 0
  async function worker() {
    while (next < arr.length) {
      const i = next++
      results[i] = await fn(arr[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, arr.length) }, worker))
  return results
}

app.http('segments', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'segments',
  handler: async (request, context) => {
    const athleteId = readSession(request)
    if (!athleteId) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } }
    }

    const tokenData = await getValidToken(athleteId)
    if (!tokenData) {
      return { status: 403, jsonBody: { error: 'Strava not connected' } }
    }
    const { accessToken, athleteSex, bestEfforts } = tokenData

    const lat = parseFloat(request.query.get('lat') ?? '')
    const lng = parseFloat(request.query.get('lng') ?? '')
    const activityType = request.query.get('activityType') ?? 'running'
    const targetType = request.query.get('targetType') ?? 'kom'

    const radiusKm = Math.min(parseFloat(request.query.get('radiusKm') ?? '5'), 20)

    if (isNaN(lat) || isNaN(lng)) {
      return { status: 400, jsonBody: { error: 'lat and lng are required' } }
    }

    const stravaActivityType = activityType === 'cycling' ? 'riding' : 'running'

    const trimSeg = (s) => ({
      id: s.id,
      name: s.name,
      distance: s.distance,
      activity_type: s.activity_type,
      start_latlng: s.start_latlng,
      end_latlng: s.end_latlng,
      elevation_high: s.elevation_high,
      elevation_low: s.elevation_low,
      city: s.city ?? null,
      state: s.state ?? null,
    })

    // Load pool from L1 (warm) or L2 (cold start)
    const poolL1Key = `pool:${athleteId}:${activityType}`
    let poolData = cacheGet(poolL1Key)
    if (!poolData) {
      try {
        poolData = await getSegmentPool(athleteId, activityType)
        cacheSet(poolL1Key, poolData, TTL_EXPLORE)
      } catch (err) {
        context.warn('Could not load segment pool:', err.message)
        poolData = { segments: [], updatedAt: 0 }
      }
    }

    const poolById = new Map(poolData.segments.map((s) => [s.id, s]))
    const poolAgeMs = Date.now() - poolData.updatedAt

    // Only run tile queries when the pool is stale — skips 20 Strava calls on cold starts
    if (poolAgeMs > TTL_EXPLORE * 1000) {
      const tiles = generateTiles(snapCoord(lat), snapCoord(lng), radiusKm)
      let tileRateLimitErr = null
      const tileResults = await Promise.all(
        tiles.map(async (bbox) => {
          const tileKey = `explore:${bbox}:${activityType}`
          let segs = cacheGet(tileKey)
          if (!segs) {
            try {
              const data = await stravaGet(
                `/segments/explore?bounds=${bbox}&activity_type=${stravaActivityType}`,
                accessToken,
              )
              segs = data.segments ?? []
              cacheSet(tileKey, segs, TTL_EXPLORE)
            } catch (err) {
              if (err instanceof StravaError && err.status === 429) {
                tileRateLimitErr = err
              } else {
                context.warn(`Tile explore failed for ${bbox}:`, err.message)
              }
              segs = []
            }
          }
          return segs
        }),
      )

      if (tileRateLimitErr && poolById.size === 0) {
        return {
          status: 429,
          headers: { 'Retry-After': String(tileRateLimitErr.retryAfter ?? 60) },
          jsonBody: { error: tileRateLimitErr.message },
        }
      }

      let poolUpdated = false
      for (const seg of tileResults.flat()) {
        if (!poolById.has(seg.id)) {
          poolById.set(seg.id, trimSeg(seg))
          poolUpdated = true
        }
      }
      if (poolUpdated) {
        const updated = [...poolById.values()]
        setSegmentPool(athleteId, activityType, updated)  // background write
        cacheSet(poolL1Key, { segments: updated, updatedAt: Date.now() }, TTL_EXPLORE)
      } else {
        // Pool unchanged but still refresh the updatedAt so we don't re-tile next time
        setSegmentPool(athleteId, activityType, poolData.segments)
        cacheSet(poolL1Key, { segments: poolData.segments, updatedAt: Date.now() }, TTL_EXPLORE)
      }
    }

    const allSegments = [...poolById.values()]
    if (allSegments.length === 0) {
      return { jsonBody: [] }
    }

    // Fall back to Strava recent stats if best efforts not yet computed
    const statsKey = `stats:${athleteId}:${activityType}`
    let statsUserPace = cacheGet(statsKey)
    if (statsUserPace === null) {
      try {
        const stats = await stravaGet(`/athletes/${athleteId}/stats`, accessToken)
        const totals = activityType === 'cycling'
          ? stats.recent_ride_totals
          : stats.recent_run_totals
        if (totals?.moving_time && totals?.distance && totals.distance > 0) {
          statsUserPace = totals.moving_time / totals.distance
          cacheSet(statsKey, statsUserPace, TTL_STATS)
        }
      } catch (err) {
        context.warn('Could not fetch athlete stats:', err.message)
      }
    }
    const effortList = activityType === 'cycling' ? bestEfforts?.ride : bestEfforts?.run

    // Limit live Strava fetches per request — uncached segments are skipped and filled in
    // on subsequent requests as L2 warms up, preventing rate limit bursts on cold starts
    let stravaDetailFetches = 0
    const MAX_DETAIL_FETCHES = 10

    const scored = await mapWithConcurrency(allSegments, 5, async (seg) => {
        try {
          const segKey = `seg:${seg.id}:${athleteId}`
          const failKey = `seg:${seg.id}:${athleteId}:fail`
          if (cacheGet(failKey)) return null                        // failed recently, don't retry yet

          let segDetail = cacheGet(segKey)                         // L1: in-memory
          if (!segDetail) {
            segDetail = await getSegmentCache(seg.id, athleteId)   // L2: Azure Table
            if (segDetail) {
              cacheSet(segKey, segDetail, TTL_LEADERBOARD)          // warm L1 from L2
            } else if (stravaDetailFetches < MAX_DETAIL_FETCHES) {
              stravaDetailFetches++
              try {
                segDetail = await stravaGet(`/segments/${seg.id}`, accessToken)
                segDetail.translatedName = await translateToEnglish(segDetail.name)
                cacheSet(segKey, segDetail, TTL_LEADERBOARD)        // write L1
                setSegmentCache(seg.id, athleteId, segDetail)       // write L2 (background)
              } catch (fetchErr) {
                cacheSet(failKey, true, 5 * 60)                    // cooldown: skip for 5 min
                context.warn(`Failed to score segment ${seg.id}:`, fetchErr.message)
                return null
              }
            } else {
              return null                                           // cap reached — try next request
            }
          }

          const athletePR = segDetail.athlete_segment_stats?.pr_elapsed_time ?? null

          let targetTime, userPR
          if (targetType === 'personal_best') {
            if (!athletePR) return null
            targetTime = athletePR
            userPR = athletePR
          } else {
            const komTime = parseXomTime(athleteSex === 'F' ? segDetail.xoms?.qom : segDetail.xoms?.kom)
            if (!komTime) return null
            targetTime = komTime
            userPR = athletePR
          }

          const segDistance = seg.distance
          const requiredPaceSecsPerMeter = (targetTime - 1) / segDistance
          const userPaceSecsPerMeter = bestEffortPaceForDistance(effortList, segDistance) ?? statsUserPace

          let score = -1
          if (userPaceSecsPerMeter !== null) {
            score = (requiredPaceSecsPerMeter - userPaceSecsPerMeter) / requiredPaceSecsPerMeter
          } else if (userPR) {
            const userPRPace = userPR / segDistance
            score = (requiredPaceSecsPerMeter - userPRPace) / requiredPaceSecsPerMeter
          }

          const startLat = segDetail.start_latlng?.[0] ?? seg.start_latlng?.[0] ?? null
          const startLng = segDetail.start_latlng?.[1] ?? seg.start_latlng?.[1] ?? null
          const endLat = segDetail.end_latlng?.[0] ?? seg.end_latlng?.[0] ?? null
          const endLng = segDetail.end_latlng?.[1] ?? seg.end_latlng?.[1] ?? null
          const midpointLat = startLat != null ? (startLat + (endLat ?? startLat)) / 2 : 0
          const midpointLng = startLng != null ? (startLng + (endLng ?? startLng)) / 2 : 0

          const estimatedTime = estimateTimeForDistance(effortList, segDistance)

          // Only check L1 — L2 reads per-segment would add too much latency to the bulk endpoint.
          // Elevation loss becomes accurate once the user visits a segment detail page (L1 warms from segmentElevation endpoint).
          const eleCache = cacheGet(`elevation:${seg.id}`)
          const elevationGain = segDetail.total_elevation_gain ?? Math.max(0, (seg.elevation_high ?? 0) - (seg.elevation_low ?? 0))
          const elevationLoss = eleCache?.loss ?? 0

          return {
            id: seg.id,
            name: seg.name,
            translatedName: segDetail.translatedName ?? null,
            distance: segDistance,
            elevationGain,
            elevationLoss,
            activityType: seg.activity_type,
            score,
            targetTime,
            userPR,
            estimatedTime,
            targetLabel: targetLabel(targetType),
            city: seg.city ?? null,
            state: seg.state ?? null,
            midpointLat,
            midpointLng,
            polyline: segDetail.map?.polyline ?? null,
            startLatlng: startLat != null && startLng != null ? [startLat, startLng] : null,
            endLatlng: endLat != null && endLng != null ? [endLat, endLng] : null,
            starred: segDetail.starred ?? false,
          }
        } catch (err) {
          context.warn(`Failed to score segment ${seg.id}:`, err.message)
          return null
        }
      })

    const results = scored.filter(Boolean).sort((a, b) => b.score - a.score)
    return { jsonBody: results }
  },
})
