import { app } from '@azure/functions'
import { readSession } from '../session.js'

const OSRM_BASE = 'https://router.project-osrm.org'

function osrmProfile(activityType) {
  return activityType?.toLowerCase().includes('ride') ? 'bike' : 'foot'
}

app.http('roadDistance', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'road-distance',
  handler: async (request, context) => {
    if (!readSession(request)) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } }
    }

    let body
    try { body = await request.json() } catch {
      return { status: 400, jsonBody: { error: 'Invalid request body' } }
    }

    const { userLat, userLng, destinations, activityType } = body ?? {}
    if (typeof userLat !== 'number' || typeof userLng !== 'number' || !Array.isArray(destinations) || destinations.length === 0) {
      return { status: 400, jsonBody: { error: 'userLat, userLng and destinations are required' } }
    }

    const profile = osrmProfile(activityType)

    try {
      if (destinations.length === 1) {
        const { id, lat, lng } = destinations[0]
        const url = `${OSRM_BASE}/route/v1/${profile}/${userLng},${userLat};${lng},${lat}?overview=false`
        const res = await fetch(url)
        if (!res.ok) return { status: 502, jsonBody: { error: 'Routing service unavailable' } }
        const data = await res.json()
        const distance = data?.routes?.[0]?.distance
        return { jsonBody: { [id]: typeof distance === 'number' ? distance : null } }
      }

      const coordStr = [`${userLng},${userLat}`, ...destinations.map((d) => `${d.lng},${d.lat}`)].join(';')
      const dest = destinations.map((_, i) => i + 1).join(';')
      const url = `${OSRM_BASE}/table/v1/${profile}/${coordStr}?sources=0&destinations=${dest}&annotations=distance`
      const res = await fetch(url)
      if (!res.ok) return { status: 502, jsonBody: { error: 'Routing service unavailable' } }
      const data = await res.json()
      const distances = data?.distances?.[0]
      if (!Array.isArray(distances)) return { status: 502, jsonBody: { error: 'Unexpected response from routing service' } }

      const result = {}
      destinations.forEach((d, i) => { if (typeof distances[i] === 'number') result[d.id] = distances[i] })
      return { jsonBody: result }
    } catch (err) {
      context.error('Road distance proxy failed:', err.message)
      return { status: 502, jsonBody: { error: 'Routing service unavailable' } }
    }
  },
})
