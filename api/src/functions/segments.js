import { app } from '@azure/functions'
import { getValidToken } from '../tableClient.js'
import { readSession } from '../session.js'
import { cacheGet, cacheSet } from '../cache.js'

const TTL_EXPLORE = 60 * 60       // segment list: 1 hour
const TTL_LEADERBOARD = 15 * 60   // leaderboard times: 15 min
const TTL_STATS = 60 * 60         // athlete stats: 1 hour

function boundingBox(lat, lng, radiusKm) {
  const latDelta = radiusKm / 111.32
  const lngDelta = latDelta / Math.cos((lat * Math.PI) / 180)
  return [lat - latDelta, lng - lngDelta, lat + latDelta, lng + lngDelta].join(',')
}

async function stravaGet(path, accessToken) {
  const res = await fetch(`https://www.strava.com/api/v3${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Strava API ${path} returned ${res.status}`)
  return res.json()
}

function targetLabel(targetType) {
  switch (targetType) {
    case 'gender': return 'Gender CR'
    case 'age_group': return 'Age CR'
    case 'personal_best': return 'Your Best'
    default: return 'KOM/QOM'
  }
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

    const accessToken = await getValidToken(athleteId)
    if (!accessToken) {
      return { status: 403, jsonBody: { error: 'Strava not connected' } }
    }

    const lat = parseFloat(request.query.get('lat') ?? '')
    const lng = parseFloat(request.query.get('lng') ?? '')
    const radiusKm = parseFloat(request.query.get('radius') ?? '5')
    const activityType = request.query.get('activityType') ?? 'running'
    const targetType = request.query.get('targetType') ?? 'kom'

    if (isNaN(lat) || isNaN(lng)) {
      return { status: 400, jsonBody: { error: 'lat and lng are required' } }
    }

    const bbox = boundingBox(lat, lng, radiusKm)
    const stravaActivityType = activityType === 'cycling' ? 'riding' : 'running'

    const exploreKey = `explore:${bbox}:${activityType}`
    let exploreResults = cacheGet(exploreKey)
    if (!exploreResults) {
      try {
        if (activityType === 'both') {
          const [run, ride] = await Promise.all([
            stravaGet(`/segments/explore?bounds=${bbox}&activity_type=running`, accessToken),
            stravaGet(`/segments/explore?bounds=${bbox}&activity_type=riding`, accessToken),
          ])
          exploreResults = [...(run.segments ?? []), ...(ride.segments ?? [])]
        } else {
          const data = await stravaGet(
            `/segments/explore?bounds=${bbox}&activity_type=${stravaActivityType}`,
            accessToken,
          )
          exploreResults = data.segments ?? []
        }
        cacheSet(exploreKey, exploreResults, TTL_EXPLORE)
      } catch (err) {
        context.error('Segment explore failed:', err.message)
        return { status: 502, jsonBody: { error: 'Failed to fetch segments from Strava' } }
      }
    }

    if (exploreResults.length === 0) {
      return { jsonBody: [] }
    }

    const statsKey = `stats:${athleteId}:${activityType}`
    let userPaceSecsPerMeter = cacheGet(statsKey)
    if (userPaceSecsPerMeter === null) {
      try {
        const stats = await stravaGet(`/athletes/${athleteId}/stats`, accessToken)
        const totals = activityType === 'cycling'
          ? stats.recent_ride_totals
          : stats.recent_run_totals
        if (totals?.moving_time && totals?.distance && totals.distance > 0) {
          userPaceSecsPerMeter = totals.moving_time / totals.distance
          cacheSet(statsKey, userPaceSecsPerMeter, TTL_STATS)
        }
      } catch (err) {
        context.warn('Could not fetch athlete stats:', err.message)
      }
    }

    const top10 = exploreResults.slice(0, 10)

    const scored = await Promise.all(
      top10.map(async (seg) => {
        try {
          const leaderQuery = targetType === 'age_group'
            ? '?per_page=1&age_group=true'
            : '?per_page=1'
          const leaderKey = `leader:${seg.id}:${targetType}`
          const prKey = `pr:${seg.id}:${athleteId}`

          let board = cacheGet(leaderKey)
          if (!board) {
            board = await stravaGet(`/segments/${seg.id}/leaderboard${leaderQuery}`, accessToken)
            cacheSet(leaderKey, board, TTL_LEADERBOARD)
          }

          let prBoard = cacheGet(prKey)
          if (prBoard === null && targetType !== 'personal_best') {
            prBoard = await stravaGet(`/segments/${seg.id}/leaderboard?per_page=1&athlete_id=${athleteId}`, accessToken).catch(() => null)
            cacheSet(prKey, prBoard, TTL_LEADERBOARD)
          }

          const topEntry = board.entries?.[0]
          if (!topEntry) return null

          const targetTime = topEntry.elapsed_time
          if (!targetTime) return null

          const userPR = targetType === 'personal_best'
            ? targetTime
            : prBoard?.entries?.[0]?.elapsed_time ?? null

          const segDistance = seg.distance
          const requiredPaceSecsPerMeter = (targetTime - 1) / segDistance

          let score = -1
          if (userPaceSecsPerMeter !== null) {
            score = (requiredPaceSecsPerMeter - userPaceSecsPerMeter) / requiredPaceSecsPerMeter
          } else if (userPR) {
            const userPRPace = userPR / segDistance
            score = (requiredPaceSecsPerMeter - userPRPace) / requiredPaceSecsPerMeter
          }

          return {
            id: seg.id,
            name: seg.name,
            distance: segDistance,
            elevationGain: Math.max(0, (seg.elevation_high ?? 0) - (seg.elevation_low ?? 0)),
            activityType: seg.activity_type,
            score,
            targetTime,
            userPR,
            targetLabel: targetLabel(targetType),
            city: seg.city ?? null,
            state: seg.state ?? null,
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
