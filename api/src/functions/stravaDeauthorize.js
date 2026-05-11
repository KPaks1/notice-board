import { app } from '@azure/functions'
import { getToken, deleteToken } from '../tableClient.js'
import { readSession } from '../session.js'

app.http('stravaDeauthorize', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'strava-deauthorize',
  handler: async (request) => {
    const athleteId = readSession(request)
    if (!athleteId) {
      return { status: 401, jsonBody: { error: 'Unauthorized' } }
    }

    const token = await getToken(athleteId)
    if (token?.accessToken) {
      await fetch('https://www.strava.com/oauth/deauthorize', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token.accessToken}` },
      }).catch(() => {})
    }

    await deleteToken(athleteId)

    return { status: 200, jsonBody: { ok: true } }
  },
})
