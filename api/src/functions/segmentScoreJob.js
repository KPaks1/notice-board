import { app } from '@azure/functions'
import {
  listAthleteIds, getValidToken,
  getSegmentPool, getSegmentCache, setSegmentCache,
} from '../tableClient.js'
import { stravaGet } from '../stravaClient.js'
import { translateToEnglish } from '../translator.js'

const DELAY_BETWEEN_FETCHES_MS = 600  // ~100 req/min, well under Strava's 100/15min limit

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
          const cached = await getSegmentCache(seg.id, athleteId)
          if (cached) { skipped++; continue }

          try {
            const detail = await stravaGet(`/segments/${seg.id}`, tokenData.accessToken)
            detail.translatedName = await translateToEnglish(detail.name)
            await setSegmentCache(seg.id, athleteId, detail)
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
