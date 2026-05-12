import { app } from '@azure/functions'
import { listAthleteIds, getToken, deleteToken } from '../tableClient.js'

app.http('adminListAthletes', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'mgmt/athletes',
  handler: async (request) => {
    if (!checkAdminSecret(request)) {
      return { status: 401, jsonBody: { error: 'Unauthorized' } }
    }

    const athleteIds = await listAthleteIds()
    const athletes = await Promise.all(
      athleteIds.map(async (athleteId) => {
        const token = await getToken(athleteId)
        return {
          athleteId,
          athleteName: token?.athleteName ?? null,
          athletePhoto: token?.athletePhoto ?? null,
        }
      }),
    )

    return { status: 200, jsonBody: athletes }
  },
})

async function deauthAthlete(athleteId) {
  const token = await getToken(athleteId)
  if (token?.accessToken) {
    await fetch('https://www.strava.com/oauth/deauthorize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token.accessToken}` },
    }).catch(() => {})
  }
  await deleteToken(athleteId)
}

function checkAdminSecret(request) {
  const secret = process.env.ADMIN_SECRET
  return secret && request.headers.get('x-admin-secret') === secret
}

app.http('adminForceDeauthAll', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'mgmt/force-deauth-all',
  handler: async (request) => {
    if (!checkAdminSecret(request)) {
      return { status: 401, jsonBody: { error: 'Unauthorized' } }
    }

    const athleteIds = await listAthleteIds()
    const results = { revoked: 0, errors: [] }

    await Promise.all(
      athleteIds.map(async (athleteId) => {
        try {
          await deauthAthlete(athleteId)
          results.revoked++
        } catch (err) {
          results.errors.push({ athleteId, error: err.message })
        }
      }),
    )

    return { status: 200, jsonBody: results }
  },
})

app.http('adminForceDeauthSome', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'mgmt/force-deauth',
  handler: async (request) => {
    if (!checkAdminSecret(request)) {
      return { status: 401, jsonBody: { error: 'Unauthorized' } }
    }

    const body = await request.json().catch(() => null)
    if (!Array.isArray(body?.athleteIds) || body.athleteIds.length === 0) {
      return { status: 400, jsonBody: { error: 'athleteIds array required' } }
    }

    const results = { revoked: 0, errors: [] }

    await Promise.all(
      body.athleteIds.map(async (athleteId) => {
        try {
          await deauthAthlete(String(athleteId))
          results.revoked++
        } catch (err) {
          results.errors.push({ athleteId, error: err.message })
        }
      }),
    )

    return { status: 200, jsonBody: results }
  },
})
