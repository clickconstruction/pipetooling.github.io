/**
 * Reload-safe drafts (v2.3742), PR 3 of the auto-reload train. An inline editor with unsaved
 * edits used to hold the auto-reload off (v2.3741's `useHoldsUnsavedWork`) — so a tab left on
 * the Form Studio or a settings block never took an update. Now the editor keeps its unsaved
 * values in sessionStorage while dirty, lifts the hold, and on the next mount reads the draft
 * back: the reload lands, the edits come back, a toast says so. sessionStorage is per tab, so a
 * draft never leaks into another tab or another person's session, and it dies with the tab.
 */
export const DRAFT_PREFIX = 'pipetooling-draft:'
/** A draft older than this is stale — the reload it was written for happened long ago. */
export const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000
export const DRAFT_RESTORED_TOAST = 'Your unsaved edits from before the app updated are back — save when ready.'

export function draftStorageKey(scope: string, id: string): string {
  return `${DRAFT_PREFIX}${scope}:${id}`
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type Envelope<T> = { savedAt: number; value: T }

/** Write the draft; false when storage refused (quota, private mode). */
export function writeDraft<T>(storage: StorageLike | null | undefined, key: string, value: T, now: number): boolean {
  if (!storage) return false
  try {
    const env: Envelope<T> = { savedAt: now, value }
    storage.setItem(key, JSON.stringify(env))
    return true
  } catch {
    return false
  }
}

/** Read the draft, or null when there is none, it is malformed, or it is older than `maxAgeMs` (then it is cleared). */
export function readDraft<T>(storage: StorageLike | null | undefined, key: string, now: number, maxAgeMs = DRAFT_MAX_AGE_MS): T | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    const env = JSON.parse(raw) as Partial<Envelope<T>>
    if (typeof env !== 'object' || env == null || typeof env.savedAt !== 'number' || !('value' in env)) {
      storage.removeItem(key)
      return null
    }
    if (now - env.savedAt > maxAgeMs) {
      storage.removeItem(key)
      return null
    }
    return env.value as T
  } catch {
    return null
  }
}

export function clearDraft(storage: StorageLike | null | undefined, key: string): void {
  try {
    storage?.removeItem(key)
  } catch {
    // nothing to clear, or storage refused
  }
}
