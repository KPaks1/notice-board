import { app } from '@azure/functions'
import { getToken } from '../tableClient.js'
import { createToken } from '../session.js'

app.http('publicSession', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'public-session',
  handler: async () => {
    const athleteId = process.env.PUBLIC_ATHLETE_ID
    if (!athleteId) {
      return { status: 404, jsonBody: { error: 'No public athlete configured' } }
    }

    const stored = await getToken(athleteId)
    if (!stored) {
      return { status: 503, jsonBody: { error: 'Public athlete not connected', debug_id: athleteId, debug_len: athleteId.length } }
    }

    const token = createToken(athleteId)
    return { jsonBody: { token } }
  },
})
