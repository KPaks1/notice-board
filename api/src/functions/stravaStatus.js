import { app } from '@azure/functions'
import { getToken } from '../tableClient.js'
import { readSession } from '../session.js'

app.http('stravaStatus', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'strava-status',
  handler: async (request) => {
    const athleteId = readSession(request)
    if (!athleteId) {
      return { jsonBody: { connected: false } }
    }

    const token = await getToken(athleteId)
    if (!token) {
      return { jsonBody: { connected: false } }
    }

    return {
      jsonBody: {
        connected: true,
        athleteId,
        athleteName: token.athleteName ?? null,
        athleteSex: token.athleteSex ?? null,
        athleteType: token.athleteType ?? null,
        bestEffortsComputed: !!token.bestEfforts,
      },
    }
  },
})
