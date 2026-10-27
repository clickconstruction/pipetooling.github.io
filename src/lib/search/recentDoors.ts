/**
 * Recent doors (punch list #181, PR 2): the last few doors a person opened from the go-anywhere box, kept on this
 * browser the way Messages keeps its Show lens (`messages/showLens.ts`), and drawn when the box opens with nothing
 * typed. Per person, per device, nothing on the server. A door the person can no longer open, or one the index
 * dropped, is left out when the list is read back against the viewer's doors.
 */
import type { Door } from './doors'

export const RECENT_DOORS_MAX = 8

const PREFIX = 'go_anywhere_recent'

export function recentDoorsKey(userId: string): string {
  return `${PREFIX}_${userId}`
}

type Store = Pick<Storage, 'getItem' | 'setItem'>

const browserStore = (): Store | null => (typeof localStorage === 'undefined' ? null : localStorage)

/** The ids kept, newest first; empty when the browser keeps nothing or the value does not parse. */
export function readRecentDoorIds(userId: string | null | undefined, storage: Store | null = browserStore()): string[] {
  if (!userId || !storage) return []
  try {
    const raw = storage.getItem(recentDoorsKey(userId))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string').slice(0, RECENT_DOORS_MAX)
  } catch {
    return []
  }
}

/** Put `id` first, once, and keep at most `RECENT_DOORS_MAX`. Returns the list as kept. */
export function rememberDoor(userId: string | null | undefined, id: string, storage: Store | null = browserStore()): string[] {
  const next = [id, ...readRecentDoorIds(userId, storage).filter((x) => x !== id)].slice(0, RECENT_DOORS_MAX)
  if (!userId || !storage) return next
  try {
    storage.setItem(recentDoorsKey(userId), JSON.stringify(next))
  } catch {
    // the browser keeps nothing; the list still comes back for this open
  }
  return next
}

/** The kept ids as doors, in recency order, only the ones among `doors` (the viewer's, so a closed door never draws). */
export function recentDoorsFor(ids: readonly string[], doors: readonly Door[]): Door[] {
  const byId = new Map(doors.map((d) => [d.id, d]))
  const out: Door[] = []
  for (const id of ids) {
    const d = byId.get(id)
    if (d) out.push(d)
  }
  return out
}
