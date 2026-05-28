import { app } from '@azure/functions'
import { getValidToken, getSegmentCache, getSharedSegmentCache, setSharedSegmentCache, getUserPRCache, setUserPRCache, getSegmentPool, setSegmentPool } from '../tableClient.js'
import { estimateTimeForDistance } from './computeEfforts.js'
import { readSession } from '../session.js'
import { cacheGet, cacheSet } from '../cache.js'
import { StravaError, stravaHttpStatus } from '../stravaError.js'
import { stravaGet } from '../stravaClient.js'
import { translateToEnglish } from '../translator.js'
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
    const sortBy = request.query.get('sortBy') ?? 'score'

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
        poolData = { segments: [], updatedAt: 0, coveredTiles: [] }
      }
    }

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
      cacheSet(poolL1Key, { segments: updated, updatedAt: Date.now(), coveredTiles: newCoveredTiles }, TTL_EXPLORE)
    }

    const allSegments = [...poolById.values()].filter((s) => {
      const sLat = s.start_latlng?.[0]
      const sLng = s.start_latlng?.[1]
      if (sLat == null || sLng == null) return true
      return haversineKm(lat, lng, sLat, sLng) <= MAX_POOL_DISTANCE_KM
    })
    if (allSegments.length === 0) {
      return { jsonBody: [] }
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
          const coreL1Key = `segCore:${seg.id}`
          const prL1Key   = `segPr:${seg.id}:${athleteId}`
          const failKey   = `seg:${seg.id}:${athleteId}:fail`
          if (cacheGet(failKey)) return null

          // Shared core: L1 → L2
          let coreData = cacheGet(coreL1Key)
          if (!coreData) {
            coreData = await getSharedSegmentCache(seg.id)
            if (coreData) cacheSet(coreL1Key, coreData, TTL_LEADERBOARD)
          }

          // User PR: L1 → L2 (null = cache miss, object = hit even if prElapsedTime is null)
          let prData = cacheGet(prL1Key)
          if (prData === null) {
            prData = await getUserPRCache(seg.id, athleteId)
            if (prData !== null) cacheSet(prL1Key, prData, TTL_LEADERBOARD)
          }

          // Legacy per-user segCache: promote to new partitions on first read, avoids re-fetch during warm-up
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

          // Live Strava fetch: only needed when coreData is missing — PR is captured opportunistically
          if (!coreData) {
            if (stravaDetailFetches >= MAX_DETAIL_FETCHES) return null
            stravaDetailFetches++
            try {
              const detail = await stravaGet(`/segments/${seg.id}`, accessToken)
              detail.translatedName = await translateToEnglish(detail.name)
              coreData = extractCoreFields(detail)
              prData   = { prElapsedTime: detail.athlete_segment_stats?.pr_elapsed_time ?? null }
              cacheSet(coreL1Key, coreData, TTL_LEADERBOARD)
              cacheSet(prL1Key,   prData,   TTL_LEADERBOARD)
              setSharedSegmentCache(seg.id, coreData)
              setUserPRCache(seg.id, athleteId, prData)
            } catch (fetchErr) {
              cacheSet(failKey, true, 5 * 60)
              context.warn(`Failed to score segment ${seg.id}:`, fetchErr.message)
              return null
            }
          } else if (prData === null) {
            prData = { prElapsedTime: null }
          }

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
          const endLat = seg.end_latlng?.[0] ?? null
          const endLng = seg.end_latlng?.[1] ?? null
          const midpointLat = startLat != null ? (startLat + (endLat ?? startLat)) / 2 : 0
          const midpointLng = startLng != null ? (startLng + (endLng ?? startLng)) / 2 : 0

          const estimatedTime = estimateTimeForDistance(effortList, segDistance)

          // Only check L1 — L2 reads per-segment would add too much latency to the bulk endpoint.
          // Elevation loss becomes accurate once the user visits a segment detail page (L1 warms from segmentElevation endpoint).
          const eleCache = cacheGet(`elevation:${seg.id}`)
          const elevationGain = coreData.elevationGain ?? Math.max(0, (seg.elevation_high ?? 0) - (seg.elevation_low ?? 0))
          const elevationLoss = eleCache?.loss ?? 0

          return {
            id: seg.id,
            name: seg.name,
            translatedName: coreData.translatedName,
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
            polyline: coreData.polyline,
            startLatlng: startLat != null && startLng != null ? [startLat, startLng] : null,
            endLatlng: endLat != null && endLng != null ? [endLat, endLng] : null,
            starred: false,
          }
        } catch (err) {
          context.warn(`Failed to score segment ${seg.id}:`, err.message)
          return null
        }
      })

    const results = scored.filter(Boolean).sort((a, b) => b.score - a.score)

    // Fire-and-forget: warm coreData for segments that didn't get a slot this request
    const uncached = allSegments.filter((s) => !cacheGet(`segCore:${s.id}`))
    if (uncached.length > 0) {
      ;(async () => {
        for (const seg of uncached) {
          if (cacheGet(`segCore:${seg.id}`)) continue
          try {
            const detail = await stravaGet(`/segments/${seg.id}`, accessToken)
            detail.translatedName = await translateToEnglish(detail.name)
            const core = extractCoreFields(detail)
            const pr   = { prElapsedTime: detail.athlete_segment_stats?.pr_elapsed_time ?? null }
            cacheSet(`segCore:${seg.id}`, core, TTL_LEADERBOARD)
            cacheSet(`segPr:${seg.id}:${athleteId}`, pr, TTL_LEADERBOARD)
            setSharedSegmentCache(seg.id, core)
            setUserPRCache(seg.id, athleteId, pr)
            await new Promise((r) => setTimeout(r, 600))
          } catch {
            break
          }
        }
      })()
    }

    return { jsonBody: results }
  },
})
