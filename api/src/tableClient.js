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
      bestEfforts: entity.bestEfforts ? JSON.parse(entity.bestEfforts) : null,
      bestEffortsUpdatedAt: entity.bestEffortsUpdatedAt || null,
      streamCache: entity.streamCache ? JSON.parse(entity.streamCache) : null,
      primaryActivity: entity.primaryActivity || null,
    }
  } catch (err) {
    if (err.statusCode === 404) return null
    throw err
  }
}

export async function saveToken(userId, {
  accessToken, refreshToken, expiresAt, athleteId,
  athleteName, athleteSex,
  bestEfforts, bestEffortsUpdatedAt, streamCache, primaryActivity,
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
      bestEfforts: bestEfforts != null ? JSON.stringify(bestEfforts) : '',
      bestEffortsUpdatedAt: bestEffortsUpdatedAt ?? '',
      streamCache: streamCache != null ? JSON.stringify(streamCache) : '',
      primaryActivity: primaryActivity ?? '',
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
      bestEfforts: token.bestEfforts,
      primaryActivity: token.primaryActivity,
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
    bestEfforts: token.bestEfforts,
    bestEffortsUpdatedAt: token.bestEffortsUpdatedAt,
    streamCache: token.streamCache,
    primaryActivity: token.primaryActivity,
  })

  return {
    accessToken: data.access_token,
    athleteSex: token.athleteSex,
    bestEfforts: token.bestEfforts,
    primaryActivity: token.primaryActivity,
  }
}

const SEGMENT_CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

export async function getSegmentCache(segId, athleteId) {
  const client = getClient()
  try {
    const entity = await client.getEntity('segCache', `${segId}:${athleteId}`)
    if (!entity.cachedAt) return null
    if (Date.now() - new Date(entity.cachedAt).getTime() > SEGMENT_CACHE_TTL_MS) return null
    return entity.data ? JSON.parse(entity.data) : null
  } catch (err) {
    if (err.statusCode === 404) return null
    throw err
  }
}

export async function setSegmentCache(segId, athleteId, data) {
  const client = await getClientReady()
  await client.upsertEntity(
    {
      partitionKey: 'segCache',
      rowKey: `${segId}:${athleteId}`,
      data: JSON.stringify(data),
      cachedAt: new Date().toISOString(),
    },
    'Replace',
  )
}
