/**
 * Messages, cut 2's screens, PR C2: what we owe the open thread's person, shared between cut 2's pieces in the thread
 * window and cut 3's reply box (agreed with helper 3, 2026-10-12), with no second read:
 * - `open`: what cut 2's thread hook last read for the open person (`useThreadOwed` reads it for the box's send window).
 * - the settle: *Mark it done, with a team note*, started by the owed strip and written by the box (`useOwedSettling`).
 *   One person at a time: opening another thread, or closing the window, ends it, so nothing half-settled comes back.
 * - `version`: moves when the box writes what we owe (a settle landed, a mark after a send), so cut 2's rows read again.
 * - `takers`: the boxes mounted that take a settle, so the strip offers it only when one is there to take it.
 */
import type { Owed } from '../messages/owed'

export interface OwedSnapshot {
  /** The person whose owed row a team note is marking done, or null. */
  contactId: string | null
  owed: Owed | null
  /** What cut 2's thread hook last read for the open person: what we owe them, or null for nothing. */
  open: { contactId: string; owed: Owed | null } | null
  /** Moves each time the box writes what we owe. */
  version: number
  /** The reply boxes mounted that take a settle (`useOwedSettling`). */
  takers: number
}

let snapshot: OwedSnapshot = { contactId: null, owed: null, open: null, version: 0, takers: 0 }
const listeners = new Set<() => void>()

function set(next: OwedSnapshot) {
  snapshot = next
  for (const listener of listeners) listener()
}

export const owedStore = {
  get: (): OwedSnapshot => snapshot,
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  /** Cut 2's thread hook, after each read of the open thread. */
  publish(contactId: string, owed: Owed | null) {
    if (snapshot.open?.contactId === contactId && snapshot.open.owed === owed) return
    set({ ...snapshot, open: { contactId, owed } })
  },
  /** The thread closed or moved on: its owed is no longer known. */
  unpublish(contactId: string | null) {
    if (snapshot.open !== null && snapshot.open.contactId === contactId) set({ ...snapshot, open: null })
  },
  /** *Mark it done, with a team note*: the box turns to a team note that marks it done. */
  start(contactId: string, owed: Owed) {
    set({ ...snapshot, contactId, owed })
  },
  /** *Not done yet*, or leaving the thread: the box goes back to what it was. Only that person's settle ends. */
  cancel(contactId: string | null) {
    if (snapshot.contactId !== null && snapshot.contactId === contactId) set({ ...snapshot, contactId: null, owed: null })
  },
  /** The note went and marked it done. */
  landed() {
    set({ ...snapshot, contactId: null, owed: null, version: snapshot.version + 1 })
  },
  /** The box wrote what we owe some other way (a mark after a send, a send that got it done): cut 2 reads again. */
  changed() {
    set({ ...snapshot, version: snapshot.version + 1 })
  },
  /** A box that takes a settle is mounted; the return takes it away again. */
  addTaker(): () => void {
    set({ ...snapshot, takers: snapshot.takers + 1 })
    let gone = false
    return () => {
      if (gone) return
      gone = true
      set({ ...snapshot, takers: Math.max(0, snapshot.takers - 1) })
    }
  },
}
