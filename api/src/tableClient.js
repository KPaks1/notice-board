import { TableClient } from '@azure/data-tables'

const TABLE_NAME = 'StravaTokens'

function getClient() {
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING
  if (!conn) throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set')
  return TableClient.fromConnectionString(conn, TABLE_NAME)
}

async function getClientReady() {
  const client = getClient()
  await client.createTable().catch((err) => {
    if (err.statusCode !== 409) throw err // 409 = already exists, fine
  })
  return client
}

export async function getToken(userId) {
  const client = getClient()
  try {
    const entity = await client.getEntity('tokens', userId)
    return {
      accessToken: entity.accessToken,
      refreshToken: entity.refreshToken,
      expiresAt: Number(entity.expiresAt),
      athleteId: entity.athleteId,
      athleteName: entity.athleteName ?? null,
      athleteSex: entity.athleteSex ?? null,
      athleteType: entity.athleteType != null ? Number(entity.athleteType) : null,
      runPaceSecsPerKm: entity.runPaceSecsPerKm ? Number(entity.runPaceSecsPerKm) : null,
      ridePaceSecsPerKm: entity.ridePaceSecsPerKm ? Number(entity.ridePaceSecsPerKm) : null,
      paceUnit: entity.paceUnit || 'km',
    }
  } catch (err) {
    if (err.statusCode === 404) return null
    throw err
  }
}

export async function saveToken(userId, {
  accessToken, refreshToken, expiresAt, athleteId,
  athleteName, athleteSex, athleteType,
  runPaceSecsPerKm, ridePaceSecsPerKm, paceUnit,
}) {
  const client = await getClientReady()
  await client.upsertEntity(
    {
      partitionKey: 'tokens',
      rowKey: userId,
      accessToken,
      refreshToken,
      expiresAt: String(expiresAt),
      athleteId: String(athleteId),
      athleteName: athleteName ?? '',
      athleteSex: athleteSex ?? '',
      athleteType: athleteType != null ? String(athleteType) : '',
      runPaceSecsPerKm: runPaceSecsPerKm != null ? String(runPaceSecsPerKm) : '',
      ridePaceSecsPerKm: ridePaceSecsPerKm != null ? String(ridePaceSecsPerKm) : '',
      paceUnit: paceUnit ?? 'km',
    },
    'Replace',
  )
}

export async function getValidToken(userId) {
  const token = await getToken(userId)
  if (!token) return null

  if (Date.now() / 1000 < token.expiresAt - 300) {
    return {
      accessToken: token.accessToken,
      athleteSex: token.athleteSex,
      athleteType: token.athleteType,
      runPaceSecsPerKm: token.runPaceSecsPerKm,
      ridePaceSecsPerKm: token.ridePaceSecsPerKm,
    }
  }

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken,
    }),
  })

  if (!res.ok) return null

  const data = await res.json()
  await saveToken(userId, {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
    athleteId: token.athleteId,
    athleteName: token.athleteName,
    athleteSex: token.athleteSex,
    athleteType: token.athleteType,
    runPaceSecsPerKm: token.runPaceSecsPerKm,
    ridePaceSecsPerKm: token.ridePaceSecsPerKm,
    paceUnit: token.paceUnit,
  })

  return {
    accessToken: data.access_token,
    athleteSex: token.athleteSex,
    athleteType: token.athleteType,
    runPaceSecsPerKm: token.runPaceSecsPerKm,
    ridePaceSecsPerKm: token.ridePaceSecsPerKm,
  }
}
