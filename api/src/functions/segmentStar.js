import { app } from '@azure/functions'
import { getValidToken } from '../tableClient.js'
import { readSession } from '../session.js'
import { StravaError, stravaHttpStatus } from '../stravaError.js'
import { stravaPut } from '../stravaClient.js'

app.http('segmentStar', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'segment-star',
  handler: async (request, context) => {
    const athleteId = readSession(request)
    if (!athleteId) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } }
    }

    const tokenData = await getValidToken(athleteId)
    if (!tokenData) {
      return { status: 403, jsonBody: { error: 'Strava not connected' } }
    }

    const id = request.query.get('id')
    if (!id) {
      return { status: 400, jsonBody: { error: 'id is required' } }
    }

    let body
    try {
      body = await request.json()
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid request body' } }
    }

    const starred = Boolean(body?.starred)

    try {
      await stravaPut(`/segments/${id}/starred`, tokenData.accessToken, { starred })
    } catch (err) {
      if (err instanceof StravaError && (err.status === 401 || err.status === 403)) {
        return { status: 403, jsonBody: { error: 'scope_required' } }
      }
      context.error(`Strava star endpoint failed for segment ${id}:`, err.message)
      return { status: err instanceof StravaError ? stravaHttpStatus(err.status) : 502, jsonBody: { error: err.message } }
    }

    return { jsonBody: { id: Number(id), starred } }
  },
})
