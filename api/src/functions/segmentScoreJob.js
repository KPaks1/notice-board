import { app } from '@azure/functions'
import {
  listAthleteIds, getValidToken, getSegmentPool,
  getSharedSegmentCache, setSharedSegmentCache,
  getUserPRCache, setUserPRCache,
} from '../tableClient.js'
import { stravaGet } from '../stravaClient.js'
import { extractCoreFields } from '../segmentHelpers.js'

const DELAY_BETWEEN_FETCHES_MS = 300  // ~200 req/min burst pace, within Strava's 200/15min limit

app.timer('segmentScoreJob', {
  schedule: '0 0 */3 * * *',  // every 3 hours
  handler: async (_timer, context) => {
    const athleteIds = await listAthleteIds()
    context.log(`Segment score job: ${athleteIds.length} athlete(s)`)

    for (const athleteId of athleteIds) {
      const tokenData = await getValidToken(athleteId)
      if (!tokenData) continue

      for (const activityType of ['running', 'cycling']) {
        let poolData
        try {
          poolData = await getSegmentPool(athleteId, activityType)
        } catch {
          continue
        }
        if (poolData.segments.length === 0) continue

        let fetched = 0
        let skipped = 0

        for (const seg of poolData.segments) {
          const coreExists = await getSharedSegmentCache(seg.id)
          const prExists   = await getUserPRCache(seg.id, athleteId)
          if (coreExists && prExists) { skipped++; continue }

          try {
            const detail = await stravaGet(`/segments/${seg.id}`, tokenData.accessToken)
            if (!coreExists) {
              await setSharedSegmentCache(seg.id, extractCoreFields(detail))
            }
            if (!prExists) {
              await setUserPRCache(seg.id, athleteId, {
                prElapsedTime: detail.athlete_segment_stats?.pr_elapsed_time ?? null,
              })
            }
            fetched++
            await new Promise((r) => setTimeout(r, DELAY_BETWEEN_FETCHES_MS))
          } catch (err) {
            context.warn(`Job: failed segment ${seg.id}:`, err.message)
            if (err.message?.includes('rate limit')) {
              context.warn('Job: rate limited, stopping early')
              break
            }
          }
        }

        context.log(`Job: athlete ${athleteId} (${activityType}) — ${fetched} fetched, ${skipped} from cache`)
      }
    }
  },
})
