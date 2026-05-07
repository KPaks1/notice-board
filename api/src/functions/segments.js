import { app } from '@azure/functions'
import { getValidToken, getSegmentCache, setSegmentCache } from '../tableClient.js'
import { estimateTimeForDistance } from './computeEfforts.js'
import { readSession } from '../session.js'
import { cacheGet, cacheSet } from '../cache.js'
import { StravaError, stravaHttpStatus } from '../stravaError.js'
import { stravaGet } from '../stravaClient.js'
import { translateToEnglish } from '../translator.js'

const TTL_EXPLORE = 60 * 60       // segment list: 1 hour
const TTL_LEADERBOARD = 15 * 60   // leaderboard times: 15 min
const TTL_STATS = 60 * 60         // athlete stats: 1 hour

function boundingBox(lat, lng, radiusKm) {
  const latDelta = radiusKm / 111.32
  const lngDelta = latDelta / Math.cos((lat * Math.PI) / 180)
  return [lat - latDelta, lng - lngDelta, lat + latDelta, lng + lngDelta].join(',')
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

    if (isNaN(lat) || isNaN(lng)) {
      return { status: 400, jsonBody: { error: 'lat and lng are required' } }
    }

    // Always fetch at max radius — client filters by actual radius
    const bbox = boundingBox(lat, lng, 20)
    const stravaActivityType = activityType === 'cycling' ? 'riding' : 'running'

    const exploreKey = `explore:${bbox}:${activityType}`
    let exploreResults = cacheGet(exploreKey)
    if (!exploreResults) {
      try {
        const data = await stravaGet(
          `/segments/explore?bounds=${bbox}&activity_type=${stravaActivityType}`,
          accessToken,
        )
        exploreResults = data.segments ?? []
        cacheSet(exploreKey, exploreResults, TTL_EXPLORE)
      } catch (err) {
        context.error('Segment explore failed:', err.message)
        const status = err instanceof StravaError ? stravaHttpStatus(err.status) : 502
        return { status, jsonBody: { error: err.message } }
      }
    }

    if (exploreResults.length === 0) {
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

    const top10 = exploreResults.slice(0, 10)

    const scored = await Promise.all(
      top10.map(async (seg) => {
        try {
          const segKey = `seg:${seg.id}:${athleteId}`
          let segDetail = cacheGet(segKey)                         // L1: in-memory
          if (!segDetail) {
            segDetail = await getSegmentCache(seg.id, athleteId)   // L2: Azure Table
            if (segDetail) {
              cacheSet(segKey, segDetail, TTL_LEADERBOARD)          // warm L1 from L2
            } else {
              segDetail = await stravaGet(`/segments/${seg.id}`, accessToken)
              segDetail.translatedName = await translateToEnglish(segDetail.name)
              cacheSet(segKey, segDetail, TTL_LEADERBOARD)          // write L1
              setSegmentCache(seg.id, athleteId, segDetail)         // write L2 (background)
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

          const midpointLat = ((seg.start_latlng?.[0] ?? lat) + (seg.end_latlng?.[0] ?? lat)) / 2
          const midpointLng = ((seg.start_latlng?.[1] ?? lng) + (seg.end_latlng?.[1] ?? lng)) / 2

          const estimatedTime = estimateTimeForDistance(effortList, segDistance)

          return {
            id: seg.id,
            name: seg.name,
            translatedName: segDetail.translatedName ?? null,
            distance: segDistance,
            elevationGain: Math.max(0, (seg.elevation_high ?? 0) - (seg.elevation_low ?? 0)),
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
            startLatlng: segDetail.start_latlng ?? null,
            endLatlng: segDetail.end_latlng ?? null,
            starred: segDetail.starred ?? false,
          }
        } catch (err) {
          context.warn(`Failed to score segment ${seg.id}:`, err.message)
          return null
        }
      }),
    )

    const results = scored.filter(Boolean).sort((a, b) => b.score - a.score)
    return { jsonBody: results }
  },
})
