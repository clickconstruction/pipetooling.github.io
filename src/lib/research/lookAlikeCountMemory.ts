/**
 * Looks like a customer (punch list #307): the counts this browser remembers, so the Dashboard's
 * Needs you line does not read every city's Builders on every open. Saving an answer on a name
 * forgets them all, so the line counts again after a sitting on the worklist. The rules of what
 * is fresh are `lookAlikeWorklist.ts`. No Supabase.
 */
import { parseLookAlikeCounts, withLookAlikeCount, type LookAlikeCountMemory } from './lookAlikeWorklist'

const KEY = 'permits.lookAlikeCounts'

/** Every city's remembered count. Empty in a browser that keeps nothing. */
export function readLookAlikeCounts(): LookAlikeCountMemory {
  try {
    return parseLookAlikeCounts(window.localStorage.getItem(KEY))
  } catch {
    return {}
  }
}

/** One city counted now. */
export function rememberLookAlikeCount(city: string, count: number, nowMs: number = Date.now()): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(withLookAlikeCount(readLookAlikeCounts(), city, count, nowMs)))
  } catch {
    // A browser that keeps nothing reads the cities again on the next open.
  }
}

/** An answer was saved: every count may have moved, so each city is counted again when next asked. */
export function forgetLookAlikeCounts(): void {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // Nothing was kept.
  }
}
