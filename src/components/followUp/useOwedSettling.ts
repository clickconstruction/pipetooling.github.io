/**
 * Messages, cut 2's screens, PR C2: *Mark it done, with a team note*, as cut 3's reply box reads it (agreed with helper
 * 3, 2026-10-12). The owed strip starts it (`owedStore.start`); while `active`, the box shows `SettlingNote`, holds a
 * team note, and sends with `done(note, jobId)`, which runs `owed_done` and lets cut 2's rows read again. The box owns
 * the toast (`OWED_DONE_TOAST`) and the window's read again; `done` never toasts, and rejects with the write's refusal.
 */
import { useEffect, useSyncExternalStore } from 'react'
import { supabaseFollowUpIo, type FollowUpIo } from '../../lib/followUp/followUpIo'
import { owedStore } from '../../lib/followUp/owedStore'
import { jobRefOf } from '../../lib/messages/load'
import { OWED_DONE_NEEDS_A_NOTE, type Owed } from '../../lib/messages/owed'

const DEFAULT_IO = supabaseFollowUpIo()

export interface OwedSettling {
  /** A team note is marking what we owe this person done. */
  active: boolean
  owed: Owed | null
  /** *Not done yet*: the box goes back to what it was. */
  cancel: () => void
  /** The note goes and marks it done. `jobId` is the line's job key, as `ThreadMessage['jobId']` holds it. */
  done: (note: string, jobId: string | null) => Promise<void>
}

export function useOwedSettling(contactId: string | null, io: Pick<FollowUpIo, 'owedDone'> = DEFAULT_IO): OwedSettling {
  const snap = useSyncExternalStore(owedStore.subscribe, owedStore.get, owedStore.get)
  // While a box holding this hook is mounted, the owed strip offers *Mark it done, with a team note*.
  useEffect(() => owedStore.addTaker(), [])
  const active = contactId !== null && snap.contactId === contactId
  return {
    active,
    owed: active ? snap.owed : null,
    cancel: () => owedStore.cancel(contactId),
    done: async (note, jobId) => {
      if (!contactId || !active) throw new Error('Nothing we owe is being marked done here.')
      const words = note.trim()
      if (!words) throw new Error(OWED_DONE_NEEDS_A_NOTE)
      await io.owedDone(contactId, words, jobRefOf(jobId))
      owedStore.landed()
    },
  }
}
