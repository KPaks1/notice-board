import { createHmac, timingSafeEqual } from 'crypto'

const secret = () => process.env.SESSION_SECRET ?? 'dev-secret-change-in-production'

function sign(value) {
  return createHmac('sha256', secret()).update(String(value)).digest('base64url')
}

export function createToken(athleteId) {
  const sig = sign(athleteId)
  return `${athleteId}.${sig}`
}

export function verifyToken(token) {
  if (!token) return null
  const lastDot = token.lastIndexOf('.')
  if (lastDot === -1) return null

  const athleteId = token.slice(0, lastDot)
  const sig = token.slice(lastDot + 1)
  if (!athleteId || !sig) return null

  const expected = sign(athleteId)
  try {
    if (!timingSafeEqual(Buffer.from(sig, 'base64url'), Buffer.from(expected, 'base64url'))) return null
  } catch {
    return null
  }

  return athleteId
}

export function readSession(request) {
  const auth = request.headers.get('authorization') ?? ''
  if (auth.startsWith('Bearer ')) {
    return verifyToken(auth.slice(7))
  }
  return null
}
