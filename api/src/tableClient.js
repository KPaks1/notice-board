import { TableClient } from '@azure/data-tables'
import { gzipSync, gunzipSync } from 'zlib'

function compress(obj) {
  return gzipSync(JSON.stringify(obj)).toString('base64')
}

function decompress(str) {
  try {
    return JSON.parse(gunzipSync(Buffer.from(str, 'base64')).toString())
  } catch {
    return JSON.parse(str) // legacy uncompressed data
  }
}

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

export async function listAthleteIds() {
  const client = getClient()
  const ids = []
  for await (const entity of client.listEntities({ queryOptions: { filter: "PartitionKey eq 'tokens'" } })) {
    ids.push(entity.rowKey)
  }
  return ids
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
      athletePhoto: entity.athletePhoto ?? null,
      bestEfforts: entity.bestEfforts ? JSON.parse(entity.bestEfforts) : null,
      bestEffortsUpdatedAt: entity.bestEffortsUpdatedAt || null,
      streamCache: entity.streamCache ? decompress(entity.streamCache) : null,
      primaryActivity: entity.primaryActivity || null,
    }
  } catch (err) {
    if (err.statusCode === 404) return null
    throw err
  }
}

export async function saveToken(userId, {
  accessToken, refreshToken, expiresAt, athleteId,
  athleteName, athleteSex, athletePhoto,
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
      athletePhoto: athletePhoto ?? '',
      bestEfforts: bestEfforts != null ? JSON.stringify(bestEfforts) : '',
      bestEffortsUpdatedAt: bestEffortsUpdatedAt ?? '',
      streamCache: streamCache != null ? compress(streamCache) : '',
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
    athletePhoto: token.athletePhoto,
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

const SEGMENT_CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export async function getSegmentCache(segId, athleteId) {
  const client = getClient()
  try {
    const entity = await client.getEntity('segCache', `${segId}:${athleteId}`)
    if (!entity.cachedAt) return null
    if (Date.now() - new Date(entity.cachedAt).getTime() > SEGMENT_CACHE_TTL_MS) return null
    return entity.data ? decompress(entity.data) : null
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
      data: compress(data),
      cachedAt: new Date().toISOString(),
    },
    'Replace',
  )
}

export async function getSegmentPool(athleteId, activityType) {
  const client = getClient()
  try {
    const entity = await client.getEntity('segPool', `${athleteId}:${activityType}`)
    const segments = entity.data ? decompress(entity.data) : []
    // Treat legacy pool entries (no updatedAt) as fresh so we don't re-tile immediately
    const updatedAt = entity.updatedAt
      ? new Date(entity.updatedAt).getTime()
      : segments.length > 0 ? Date.now() : 0
    return { segments, updatedAt }
  } catch (err) {
    if (err.statusCode === 404) return { segments: [], updatedAt: 0 }
    throw err
  }
}

export async function deleteSegmentPool(athleteId, activityType) {
  const client = getClient()
  await client.deleteEntity('segPool', `${athleteId}:${activityType}`).catch((err) => {
    if (err.statusCode !== 404) throw err
  })
}

export async function setSegmentPool(athleteId, activityType, segments) {
  const client = await getClientReady()
  await client.upsertEntity(
    {
      partitionKey: 'segPool',
      rowKey: `${athleteId}:${activityType}`,
      data: compress(segments),
      updatedAt: new Date().toISOString(),
    },
    'Replace',
  )
}
