import { app } from '@azure/functions'
import { getToken, getValidToken } from '../tableClient.js'
import { readSession } from '../session.js'
import { computeAndSaveBestEfforts } from './computeEfforts.js'
import { StravaError, stravaHttpStatus } from '../stravaError.js'

app.http('athleteEffortsGet', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'athlete-efforts',
  handler: async (request) => {
    const athleteId = readSession(request)
    if (!athleteId) return { status: 401, jsonBody: { error: 'Not authenticated' } }

    const token = await getToken(athleteId)
    if (!token) return { status: 403, jsonBody: { error: 'Strava not connected' } }

    if (!token.bestEfforts) return { jsonBody: { computed: false } }

    return { jsonBody: { computed: true, ...token.bestEfforts } }
  },
})

app.http('athleteEffortsRefresh', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'athlete-efforts/refresh',
  handler: async (request) => {
    const athleteId = readSession(request)
    if (!athleteId) return { status: 401, jsonBody: { error: 'Not authenticated' } }

    const tokenData = await getValidToken(athleteId)
    if (!tokenData) return { status: 403, jsonBody: { error: 'Strava not connected' } }

    try {
      const result = await computeAndSaveBestEfforts(athleteId, tokenData.accessToken)
      return { jsonBody: { computed: true, ...result } }
    } catch (err) {
      if (err instanceof StravaError) {
        return { status: stravaHttpStatus(err.status), jsonBody: { error: err.message } }
      }
      throw err
    }
  },
})
