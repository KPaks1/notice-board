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
      return { jsonBody: { connected: false, debug: 'session_invalid' } }
    }

    const token = await getToken(athleteId)
    if (!token) {
      return { jsonBody: { connected: false, debug: 'no_token', athleteId } }
    }

    return {
      jsonBody: {
        connected: true,
        athleteId,
        athleteName: token.athleteName ?? null,
        athleteSex: token.athleteSex ?? null,
        athletePhoto: token.athletePhoto ?? null,
        primaryActivity: token.primaryActivity ?? null,
        bestEffortsComputed: !!token.bestEfforts,
        isPublic: athleteId === process.env.PUBLIC_ATHLETE_ID,
      },
    }
  },
})
