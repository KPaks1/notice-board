import { app } from '@azure/functions'
import { saveToken } from '../tableClient.js'
import { createToken } from '../session.js'
import { stravaGet } from '../stravaClient.js'

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

    // Fetch the full athlete profile to get the current primary sport preference
    let athleteProfile
    try {
      athleteProfile = await stravaGet('/athlete', tokenData.access_token)
    } catch {
      athleteProfile = tokenData.athlete
    }

    const athleteType = athleteProfile?.athlete_type ?? null
    const primaryActivity = athleteType === 0 ? 'cycling' : athleteType === 1 ? 'running' : null

    await saveToken(athleteId, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_at,
      athleteId,
      athleteName: `${athleteProfile?.firstname ?? ''} ${athleteProfile?.lastname ?? ''}`.trim(),
      athleteSex: athleteProfile?.sex ?? null,
      athletePhoto: athleteProfile?.profile_medium ?? null,
      primaryActivity,
    })

    const sessionToken = createToken(athleteId)
    return {
      status: 302,
      headers: { Location: `/?token=${encodeURIComponent(sessionToken)}` },
    }
  },
})
