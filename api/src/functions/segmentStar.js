import { app } from '@azure/functions'
import { getValidToken } from '../tableClient.js'
import { readSession } from '../session.js'

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

    const res = await fetch(`https://www.strava.com/api/v3/segments/${id}/starred`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${tokenData.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ starred }),
    })

    if (res.status === 401 || res.status === 403) {
      return { status: 403, jsonBody: { error: 'scope_required' } }
    }

    if (!res.ok) {
      context.error(`Strava star endpoint returned ${res.status} for segment ${id}`)
      return { status: 502, jsonBody: { error: 'Failed to update star on Strava' } }
    }

    return { jsonBody: { id: Number(id), starred } }
  },
})
