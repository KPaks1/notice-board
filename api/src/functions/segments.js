import { app } from '@azure/functions'
import { getValidToken, getSegmentCache, getSharedSegmentCache, setSharedSegmentCache, getUserPRCache, setUserPRCache, getSegmentPool, setSegmentPool } from '../tableClient.js'
import { estimateTimeForDistance } from './computeEfforts.js'
import { readSession } from '../session.js'
import { cacheGet, cacheSet } from '../cache.js'
import { StravaError, stravaHttpStatus } from '../stravaError.js'
import { stravaGet } from '../stravaClient.js'
import { extractCoreFields } from '../segmentHelpers.js'

const TTL_EXPLORE = 4 * 60 * 60   // segment list: 4 hours
const TTL_LEADERBOARD = 4 * 60 * 60  // segment details/KOM: 4 hours
const TTL_STATS = 60 * 60         // athlete stats: 1 hour

const SNAP = 0.01 // ~1km grid — keeps tile cache keys stable across minor GPS jitter
const snapCoord = (v) => Math.round(v / SNAP) * SNAP

const MAX_POOL_DISTANCE_KM = 100

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

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

    const lat = parseFloat(request.query.get('lat') ?? '')
    const lng = parseFloat(request.query.get('lng') ?? '')
    const activityType = request.query.get('activityType') ?? 'running'
    const targetType = request.query.get('targetType') ?? 'kom'
    const sortBy = request.query.get('sortBy') ?? 'score'
    const radiusKm = Math.min(parseFloat(request.query.get('radiusKm') ?? '5'), 20)
    const cacheOnly = request.query.get('cacheOnly') === 'true'

    if (isNaN(lat) || isNaN(lng)) {
      return { status: 400, jsonBody: { error: 'lat and lng are required' } }
    }

    // Token validation and pool load are independent — run in parallel
    const poolL1Key = `pool:${athleteId}:${activityType}`
    const poolL1 = cacheGet(poolL1Key)
    let tokenResult
    const [tokenData, poolDataRaw] = await Promise.all([
      getValidToken(athleteId).then((t) => { tokenResult = 'ok'; return t }, (err) => { tokenResult = err; return null }),
      poolL1 ? Promise.resolve(poolL1) : getSegmentPool(athleteId, activityType).catch((err) => {
        context.warn('Could not load segment pool:', err.message)
        return { segments: [], updatedAt: 0, coveredTiles: [] }
      }),
    ])

    if (tokenResult instanceof Error) {
      context.error('Token lookup failed:', tokenResult.message)
      return { status: 503, jsonBody: { error: 'Service temporarily unavailable. Please try again.' } }
    }
    if (!tokenData) {
      return { status: 403, jsonBody: { error: 'Strava not connected' } }
    }
    const { accessToken, athleteSex, bestEfforts } = tokenData

    let poolData = poolL1 ?? poolDataRaw
    if (!poolL1) cacheSet(poolL1Key, poolData, TTL_EXPLORE)

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

    const poolById = new Map(poolData.segments.map((s) => [s.id, s]))
    const poolAgeMs = Date.now() - poolData.updatedAt

    const tiles = generateTiles(snapCoord(lat), snapCoord(lng), radiusKm)
    const coveredTiles = new Set(poolData.coveredTiles ?? [])
    const poolExpired = poolAgeMs > TTL_EXPLORE * 1000
    // Re-fetch all tiles when pool has expired; otherwise only fetch tiles not yet covered
    const tilesToFetch = poolExpired ? tiles : tiles.filter((bbox) => !coveredTiles.has(bbox))

    if (tilesToFetch.length > 0) {
      let tileRateLimitErr = null
      const rateLimitedBboxes = new Set()
      const tileResults = await Promise.all(
        tilesToFetch.map(async (bbox) => {
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
                rateLimitedBboxes.add(bbox)
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

      for (const seg of tileResults.flat()) {
        if (!poolById.has(seg.id)) {
          poolById.set(seg.id, trimSeg(seg))
        }
      }

      const newlyCovered = tilesToFetch.filter((bbox) => !rateLimitedBboxes.has(bbox))
      const newCoveredTiles = poolExpired
        ? newlyCovered
        : [...coveredTiles, ...newlyCovered]

      const updated = [...poolById.values()]
      setSegmentPool(athleteId, activityType, updated, newCoveredTiles)  // background write
        .catch((err) => context.warn('Failed to save segment pool:', err.message))
      cacheSet(poolL1Key, { segments: updated, updatedAt: Date.now(), coveredTiles: newCoveredTiles }, TTL_EXPLORE)
    }

    const allSegments = [...poolById.values()].filter((s) => {
      const sLat = s.start_latlng?.[0]
      const sLng = s.start_latlng?.[1]
      if (sLat == null || sLng == null) return true
      return haversineKm(lat, lng, sLat, sLng) <= MAX_POOL_DISTANCE_KM
    })
    if (allSegments.length === 0) {
      return { body: new ReadableStream({ start(c) { c.close() } }), headers: { 'Content-Type': 'application/x-ndjson' } }
    }

    // Pre-sort pool in scoring priority order so cold-start Strava fetch slots go to the most relevant segments
    if (sortBy === 'length') {
      allSegments.sort((a, b) => a.distance - b.distance)
    } else {
      // nearest and score: use haversine distance as priority proxy
      allSegments.sort((a, b) => {
        const aLat = a.start_latlng?.[0] ?? 0, aLng = a.start_latlng?.[1] ?? 0
        const bLat = b.start_latlng?.[0] ?? 0, bLng = b.start_latlng?.[1] ?? 0
        return haversineKm(lat, lng, aLat, aLng) - haversineKm(lat, lng, bLat, bLng)
      })
    }

    const effortList = activityType === 'cycling' ? bestEfforts?.ride : bestEfforts?.run

    // Only fetch Strava stats when we have no effort data to score with
    const statsKey = `stats:${athleteId}:${activityType}`
    let statsUserPace = cacheGet(statsKey)
    if (statsUserPace === null && (!effortList || effortList.length === 0)) {
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

    const MAX_DETAIL_FETCHES = 50
    const encoder = new TextEncoder()

    const buildResult = (seg, coreData, prData) => {
      const athletePR = prData.prElapsedTime
      let targetTime, userPR
      if (targetType === 'personal_best') {
        if (!athletePR) return null
        targetTime = athletePR
        userPR = athletePR
      } else {
        const komTime = athleteSex === 'F' ? coreData.qomTime : coreData.komTime
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
      const startLat = seg.start_latlng?.[0] ?? null
      const startLng = seg.start_latlng?.[1] ?? null
      const endLat   = seg.end_latlng?.[0] ?? null
      const endLng   = seg.end_latlng?.[1] ?? null
      const eleCache = cacheGet(`elevation:${seg.id}`)
      return {
        id: seg.id,
        name: seg.name,
        distance: segDistance,
        elevationGain: coreData.elevationGain ?? Math.max(0, (seg.elevation_high ?? 0) - (seg.elevation_low ?? 0)),
        elevationLoss: eleCache?.loss ?? 0,
        activityType: seg.activity_type,
        score,
        targetTime,
        userPR,
        estimatedTime: estimateTimeForDistance(effortList, segDistance),
        targetLabel: targetLabel(targetType),
        city: seg.city ?? null,
        state: seg.state ?? null,
        midpointLat: startLat != null ? (startLat + (endLat ?? startLat)) / 2 : 0,
        midpointLng: startLng != null ? (startLng + (endLng ?? startLng)) / 2 : 0,
        polyline: coreData.polyline,
        startLatlng: startLat != null && startLng != null ? [startLat, startLng] : null,
        endLatlng: endLat != null && endLng != null ? [endLat, endLng] : null,
        starred: false,
      }
    }

    const body = new ReadableStream({
      async start(controller) {
        const enqueue = (result) => {
          try { controller.enqueue(encoder.encode(JSON.stringify(result) + '\n')) } catch {}
        }

        // Phase 0: L1 (in-memory) — synchronous, zero async wait, streams before any I/O
        const needsL2 = []
        for (const seg of allSegments) {
          if (cacheGet(`seg:${seg.id}:${athleteId}:fail`)) continue
          const coreData = cacheGet(`segCore:${seg.id}`)
          const prData   = cacheGet(`segPr:${seg.id}:${athleteId}`)
          if (coreData && prData !== null) {
            const result = buildResult(seg, coreData, prData)
            if (result) enqueue(result)
          } else {
            needsL2.push(seg)
          }
        }

        if (needsL2.length === 0) { controller.close(); return }

        // Phase 1: each segment fires its two L2 reads concurrently and streams the moment both resolve
        const needsFetch = []
        await Promise.all(needsL2.map(async (seg) => {
          const coreL1Key = `segCore:${seg.id}`
          const prL1Key   = `segPr:${seg.id}:${athleteId}`
          try {
            let [coreData, prData] = await Promise.all([
              getSharedSegmentCache(seg.id),
              getUserPRCache(seg.id, athleteId),
            ])

            if (coreData) cacheSet(coreL1Key, coreData, TTL_LEADERBOARD)
            if (prData !== null) cacheSet(prL1Key, prData, TTL_LEADERBOARD)

            // Legacy promotion: migrate old segCache format to new partitions
            if (!coreData || prData === null) {
              const legacy = await getSegmentCache(seg.id, athleteId)
              if (legacy) {
                if (!coreData) {
                  coreData = extractCoreFields(legacy)
                  cacheSet(coreL1Key, coreData, TTL_LEADERBOARD)
                  setSharedSegmentCache(seg.id, coreData)
                }
                if (prData === null) {
                  prData = { prElapsedTime: legacy.athlete_segment_stats?.pr_elapsed_time ?? null }
                  cacheSet(prL1Key, prData, TTL_LEADERBOARD)
                  setUserPRCache(seg.id, athleteId, prData)
                }
              }
            }

            if (!coreData) { needsFetch.push(seg); return }
            if (prData === null) prData = { prElapsedTime: null }

            const result = buildResult(seg, coreData, prData)
            if (result) enqueue(result)
          } catch (err) {
            context.warn(`Failed to score segment ${seg.id}:`, err.message)
          }
        }))

        if (needsFetch.length === 0 || cacheOnly) { controller.close(); return }

        // Phase 2: Strava fetches for uncached segments, throttled, stop on rate limit
        let fetches = 0
        for (const seg of needsFetch) {
          if (fetches >= MAX_DETAIL_FETCHES) break
          if (cacheGet(`seg:${seg.id}:${athleteId}:fail`)) continue
          fetches++
          try {
            const detail = await stravaGet(`/segments/${seg.id}`, accessToken)
            const coreData = extractCoreFields(detail)
            const prData   = { prElapsedTime: detail.athlete_segment_stats?.pr_elapsed_time ?? null }
            cacheSet(`segCore:${seg.id}`, coreData, TTL_LEADERBOARD)
            cacheSet(`segPr:${seg.id}:${athleteId}`, prData, TTL_LEADERBOARD)
            setSharedSegmentCache(seg.id, coreData)
              .catch((err) => context.warn(`Failed to save core cache ${seg.id}:`, err.message))
            setUserPRCache(seg.id, athleteId, prData)
              .catch((err) => context.warn(`Failed to save PR cache ${seg.id}:`, err.message))
            const result = buildResult(seg, coreData, prData)
            if (result) enqueue(result)
            await new Promise((r) => setTimeout(r, 100))
          } catch (err) {
            if (err instanceof StravaError && err.status === 429) break
            cacheSet(`seg:${seg.id}:${athleteId}:fail`, true, 5 * 60)
            context.warn(`Failed to score segment ${seg.id}:`, err.message)
          }
        }

        controller.close()
      },
    })

    return { body, headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' } }
  },
})
