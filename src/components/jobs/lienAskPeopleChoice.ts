import { useCallback, useEffect, useState } from 'react'
import { fetchActiveUsers } from '../../lib/people/fetchActiveUsers'
import { lienAskFor, type LienAskUser } from '../../lib/jobs/lienAskPeople'

let loaded: Promise<LienAskUser[]> | null = null

/** The people a help sheet can name, read once for the visit: every active teammate and the dev. A failed read names nobody. */
function loadAskUsers(): Promise<LienAskUser[]> {
  if (!loaded) {
    loaded = fetchActiveUsers<LienAskUser>('id, name, phone, role', { includeDev: true })
      .then((r) => r.data)
      .catch(() => [])
  }
  return loaded
}

/**
 * Who a lien help sheet says to ask for a job (punch list #314, change 9): the job's lien leader, or the dev.
 * Returns '' until the people load, and for a job the app knows nobody for; the sheet then prints no name.
 */
export function useLienAskPeople(): (masterUserId: string | null | undefined) => string {
  const [users, setUsers] = useState<LienAskUser[]>([])
  useEffect(() => {
    let live = true
    void loadAskUsers().then((u) => {
      if (live) setUsers(u)
    })
    return () => {
      live = false
    }
  }, [])
  return useCallback((masterUserId: string | null | undefined) => lienAskFor(users, masterUserId), [users])
}
