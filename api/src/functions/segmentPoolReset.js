import { app } from '@azure/functions'
import { getValidToken, deleteSegmentPool } from '../tableClient.js'
import { readSession } from '../session.js'
import { cacheDelete } from '../cache.js'

app.http('segmentPoolReset', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'segment-pool',
  handler: async (request, context) => {
    const athleteId = readSession(request)
    if (!athleteId) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } }
    }

    const tokenData = await getValidToken(athleteId)
    if (!tokenData) {
      return { status: 403, jsonBody: { error: 'Strava not connected' } }
    }

    const activityType = request.query.get('activityType') ?? 'running'

    try {
      await deleteSegmentPool(athleteId, activityType)
      cacheDelete(`pool:${athleteId}:${activityType}`)
      context.log(`Segment pool reset for athlete ${athleteId} (${activityType})`)
    } catch (err) {
      context.error('Failed to reset segment pool:', err.message)
      return { status: 500, jsonBody: { error: 'Failed to reset segment pool' } }
    }

    return { status: 200, jsonBody: { ok: true } }
  },
})
