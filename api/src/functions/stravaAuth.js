import { app } from '@azure/functions'

app.http('stravaAuth', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'strava-auth',
  handler: async () => {
    const clientId = process.env.STRAVA_CLIENT_ID
    const redirectUri = process.env.STRAVA_REDIRECT_URI

    if (!clientId || !redirectUri) {
      return { status: 500, jsonBody: { error: 'Strava not configured' } }
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      approval_prompt: 'auto',
      scope: 'read,activity:read_all',
    })

    return {
      status: 302,
      headers: { Location: `https://www.strava.com/oauth/authorize?${params}` },
    }
  },
})
