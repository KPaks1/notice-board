import { app } from '@azure/functions'
import { getToken, saveToken } from '../tableClient.js'
import { readSession } from '../session.js'

app.http('userSettings', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'user-settings',
  handler: async (request) => {
    const athleteId = readSession(request)
    if (!athleteId) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } }
    }

    const token = await getToken(athleteId)
    if (!token) {
      return { status: 403, jsonBody: { error: 'Strava not connected' } }
    }

    let body
    try {
      body = await request.json()
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid request body' } }
    }

    const runPaceSecsPerKm = body.runPaceSecsPerKm !== undefined ? body.runPaceSecsPerKm : token.runPaceSecsPerKm
    const ridePaceSecsPerKm = body.ridePaceSecsPerKm !== undefined ? body.ridePaceSecsPerKm : token.ridePaceSecsPerKm
    const paceUnit = body.paceUnit !== undefined ? body.paceUnit : token.paceUnit

    await saveToken(athleteId, {
      ...token,
      runPaceSecsPerKm,
      ridePaceSecsPerKm,
      paceUnit,
    })

    return { jsonBody: { runPaceSecsPerKm, ridePaceSecsPerKm, paceUnit } }
  },
})
