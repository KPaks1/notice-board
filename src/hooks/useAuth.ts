import { useEffect, useState } from 'react'
import type { AuthUser } from '../types'

const DEV_USER: AuthUser = {
  userId: 'dev-user-local',
  userDetails: 'dev@localhost',
  identityProvider: 'google',
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (import.meta.env.DEV) {
      setUser(DEV_USER)
      setLoading(false)
      return
    }

    fetch('/.auth/me')
      .then((r) => r.json())
      .then((data) => {
        const principal = data?.clientPrincipal
        if (principal) {
          setUser({
            userId: principal.userId,
            userDetails: principal.userDetails,
            identityProvider: principal.identityProvider,
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return { user, loading }
}
