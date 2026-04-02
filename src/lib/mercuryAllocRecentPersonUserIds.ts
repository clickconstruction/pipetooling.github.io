/** Max auth users to remember for Person quick-picks in Link to person and jobs. */
export const RECENT_PERSON_MAX = 5

const LS_PREFIX = 'mercury.alloc.recentPersonUserIds.'

function lsKey(operatorAuthUserId: string): string {
  return LS_PREFIX + operatorAuthUserId
}

/** Read recent attributed user ids for this logged-in operator. */
export function readRecentPersonUserIds(operatorAuthUserId: string): string[] {
  try {
    const raw = localStorage.getItem(lsKey(operatorAuthUserId))
    if (raw == null || raw === '') return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: string[] = []
    for (const x of parsed) {
      if (typeof x === 'string' && x.trim() !== '') out.push(x.trim())
      if (out.length >= RECENT_PERSON_MAX) break
    }
    return out.slice(0, RECENT_PERSON_MAX)
  } catch {
    return []
  }
}

/**
 * Record an attributed auth user after a successful save (most recent first, deduped, capped).
 * Returns the new list (best effort if storage fails).
 */
export function pushRecentPersonUserId(operatorAuthUserId: string, attributedUserId: string): string[] {
  const tid = attributedUserId.trim()
  if (tid === '') return readRecentPersonUserIds(operatorAuthUserId)
  try {
    const prev = readRecentPersonUserIds(operatorAuthUserId).filter((id) => id !== tid)
    const next = [tid, ...prev].slice(0, RECENT_PERSON_MAX)
    localStorage.setItem(lsKey(operatorAuthUserId), JSON.stringify(next))
    return next
  } catch {
    return readRecentPersonUserIds(operatorAuthUserId)
  }
}
