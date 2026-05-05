import { app } from '@azure/functions'
import { saveToken } from '../tableClient.js'
import { createToken } from '../session.js'

app.http('stravaCallback', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'strava-callback',
  handler: async (request) => {
    const code = request.query.get('code')
    const error = request.query.get('error')

    if (error || !code) {
      return { status: 302, headers: { Location: '/connect-strava?error=denied' } }
    }

    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      return { status: 302, headers: { Location: '/connect-strava?error=token-exchange' } }
    }

    const tokenData = await tokenRes.json()
    const athleteId = String(tokenData.athlete?.id)

    await saveToken(athleteId, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_at,
      athleteId,
      athleteName: `${tokenData.athlete?.firstname ?? ''} ${tokenData.athlete?.lastname ?? ''}`.trim(),
      athleteSex: tokenData.athlete?.sex ?? null,
      athleteType: tokenData.athlete?.athlete_type ?? null,
    })

    const sessionToken = createToken(athleteId)
    return {
      status: 302,
      headers: { Location: `/?token=${encodeURIComponent(sessionToken)}` },
    }
  },
})
