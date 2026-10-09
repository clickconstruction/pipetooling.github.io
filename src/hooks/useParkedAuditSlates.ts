import { useCallback, useState } from 'react'

const STORAGE_KEY = 'bid_audit_parked_slates_v1'

function storageKey(userId: string | null | undefined): string {
  return `${STORAGE_KEY}:${userId ?? 'anon'}`
}

function readParked(userId: string | null | undefined): Set<string> {
  try {
    if (typeof localStorage === 'undefined') return new Set()
    const raw = localStorage.getItem(storageKey(userId))
    const list: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(list) ? list.filter((k): k is string => typeof k === 'string') : [])
  } catch {
    return new Set()
  }
}

function writeParked(userId: string | null | undefined, parked: ReadonlySet<string>): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(storageKey(userId), JSON.stringify([...parked]))
  } catch {
    // Private window or blocked storage: the slate stays parked until the page reloads.
  }
}

/**
 * The slates parked on the Audits lens (v2.5016, the owner's call of 2026-10-09): Skip this slate
 * sets one aside, Bring it back returns it. Remembered on this device for the signed-in person, as
 * Past values is: a parked slate is a "not now" in one person's queue, not a change to the audits.
 */
export function useParkedAuditSlates(userId: string | null | undefined): {
  parked: ReadonlySet<string>
  park: (key: string) => void
  bringBack: (key: string) => void
} {
  const [state, setState] = useState(() => ({ userId, parked: readParked(userId) as ReadonlySet<string> }))
  // The person signed in after the first render, or another signed in: read theirs, once.
  if (state.userId !== userId) setState({ userId, parked: readParked(userId) })
  const update = useCallback(
    (change: (prev: Set<string>) => void) => {
      setState((prev) => {
        const next = new Set(prev.userId === userId ? prev.parked : readParked(userId))
        change(next)
        writeParked(userId, next)
        return { userId, parked: next }
      })
    },
    [userId],
  )
  const parked = state.parked
  const park = useCallback((key: string) => update((s) => void s.add(key)), [update])
  const bringBack = useCallback((key: string) => update((s) => void s.delete(key)), [update])
  return { parked, park, bringBack }
}
