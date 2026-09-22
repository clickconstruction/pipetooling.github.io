import { useMemo } from 'react'
import { clearDraft, readDraft, writeDraft } from '../lib/reloadDraft'

export type ReloadDraft<T> = {
  /** The draft for this key, or null. Call once the editor's own load is done, so the draft wins. */
  read: () => T | null
  write: (value: T) => void
  clear: () => void
}

function sessionStorageOrNull(): Storage | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null
  } catch {
    return null
  }
}

/**
 * A per-tab draft an inline editor keeps while dirty (v2.3742), so the auto-reload can land
 * over it: `write` on every change while dirty, `read` after the editor's load, `clear` after
 * a save. A null key (nothing to key on yet) makes all three no-ops.
 */
export function useReloadDraft<T>(key: string | null): ReloadDraft<T> {
  return useMemo<ReloadDraft<T>>(
    () => ({
      read: () => (key ? readDraft<T>(sessionStorageOrNull(), key, Date.now()) : null),
      write: (value) => {
        if (key) writeDraft(sessionStorageOrNull(), key, value, Date.now())
      },
      clear: () => {
        if (key) clearDraft(sessionStorageOrNull(), key)
      },
    }),
    [key],
  )
}
