import { app } from '@azure/functions'
import { getValidToken } from '../tableClient.js'
import { readSession } from '../session.js'
import { cacheGet, cacheSet } from '../cache.js'
import { stravaGet } from '../stravaClient.js'

const TTL = 12 * 60 * 60 // 12 h — elevation never changes

app.http('segmentElevation', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'segment-elevation',
  handler: async (request, context) => {
    const athleteId = readSession(request)
    if (!athleteId) return { status: 401, jsonBody: { error: 'Not authenticated' } }

    const tokenData = await getValidToken(athleteId)
    if (!tokenData) return { status: 403, jsonBody: { error: 'Strava not connected' } }

    const id = request.query.get('id')
    if (!id) return { status: 400, jsonBody: { error: 'id is required' } }

    const key = `elevation:${id}`
    const cached = cacheGet(key)
    if (cached) return { jsonBody: cached }

    try {
      const streams = await stravaGet(
        `/segments/${id}/streams?keys=altitude,distance&series_type=distance`,
        tokenData.accessToken,
      )
      const altitude = streams.find((s) => s.type === 'altitude')?.data ?? []
      const distance = streams.find((s) => s.type === 'distance')?.data ?? []
      const result = { altitude, distance }
      cacheSet(key, result, TTL)
      return { jsonBody: result }
    } catch (err) {
      context.warn(`Failed to fetch elevation for segment ${id}:`, err.message)
      return { status: 502, jsonBody: { error: 'Failed to fetch elevation data' } }
    }
  },
})
