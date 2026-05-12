import { app } from '@azure/functions'
import { getValidToken, deleteToken } from '../tableClient.js'
import { computeAndSaveBestEfforts } from './computeEfforts.js'

app.http('stravaWebhookValidate', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'strava-webhook',
  handler: async (request) => {
    const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN
    if (!verifyToken) return { status: 500, jsonBody: { error: 'Webhook not configured' } }

    const hubChallenge = request.query.get('hub.challenge')
    const hubVerifyToken = request.query.get('hub.verify_token')

    if (hubVerifyToken !== verifyToken) return { status: 403, jsonBody: { error: 'Invalid verify token' } }

    return { jsonBody: { 'hub.challenge': hubChallenge } }
  },
})

app.http('stravaWebhookEvent', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'strava-webhook',
  handler: async (request, context) => {
    let body
    try { body = await request.json() } catch { return { status: 200 } }

    const athleteId = String(body.owner_id)

    if (body.object_type === 'athlete' && body.updates?.authorized === 'false') {
      await deleteToken(athleteId).catch(() => {})
      return { status: 200 }
    }

    if (body.object_type !== 'activity' || body.aspect_type !== 'create') return { status: 200 }

    const tokenData = await getValidToken(athleteId)
    if (!tokenData) {
      context.warn(`Webhook: no token for athlete ${athleteId}`)
      return { status: 200 }
    }

    try {
      await computeAndSaveBestEfforts(athleteId, tokenData.accessToken)
    } catch (err) {
      context.error(`Webhook compute failed for athlete ${athleteId}: ${err.message}`)
    }

    return { status: 200 }
  },
})
