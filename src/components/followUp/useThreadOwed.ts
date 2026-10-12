/**
 * Messages, cut 2's screens, PR C2: what we owe the open thread's person, as cut 3's send window reads and writes it
 * (agreed with helper 3, 2026-10-12). `useThreadOwed` reads what cut 2's thread hook last read (`owedStore.open`), so
 * the box makes no second read. `useOwedAfterSend` is the send window's *After this sends* row: `mark` (We still owe
 * [what] by [when], through `mark_owed`) and `sentDone` (this message got it done, through `owed_sent_done`, which
 * writes *Rosa sent the start date. It is done.*). Each writes, lets cut 2's rows read again, never toasts, and rejects
 * with the write's refusal; the box owns the toast and the window's read again.
 */
import { useSyncExternalStore } from 'react'
import { supabaseFollowUpIo, type FollowUpIo } from '../../lib/followUp/followUpIo'
import { owedStore } from '../../lib/followUp/owedStore'
import type { DayKept, Owed } from '../../lib/messages/owed'

const DEFAULT_IO = supabaseFollowUpIo()

/** What we owe the open person: null for nothing, and `loaded` once cut 2's read of their thread has landed. */
export function useThreadOwed(contactId: string | null): { owed: Owed | null; loaded: boolean } {
  const open = useSyncExternalStore(owedStore.subscribe, () => owedStore.get().open, () => owedStore.get().open)
  const loaded = contactId !== null && open?.contactId === contactId
  return { owed: loaded ? open.owed : null, loaded }
}

export interface OwedAfterSend {
  /** We still owe them something after this send: what, and by when (optional). */
  mark: (what: string, day: DayKept) => Promise<void>
  /** This message got what we owe done. `messageId` is the line the send wrote. */
  sentDone: (messageId: string) => Promise<void>
}

export function useOwedAfterSend(contactId: string | null, io: Pick<FollowUpIo, 'markOwed' | 'owedSentDone'> = DEFAULT_IO): OwedAfterSend {
  const person = () => {
    if (!contactId) throw new Error('No thread is open.')
    return contactId
  }
  return {
    mark: async (what, day) => {
      const words = what.trim()
      if (!words) throw new Error('Say what we still owe them.')
      await io.markOwed(person(), words, day)
      owedStore.changed()
    },
    sentDone: async (messageId) => {
      await io.owedSentDone(person(), messageId)
      owedStore.changed()
    },
  }
}
