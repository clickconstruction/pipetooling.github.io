/**
 * Messages: what a press on a contact point in an email's words reads and writes (v2.6513, `bodyContacts.ts`). Three
 * reads and writes, one interface so a smoke hands in a fake:
 *
 * - `whoseChannel`: whose number or address it is, as the spine answers (`contact_for_channel`, a read: a window that
 *   only looks makes nothing).
 * - `makeThread`: a thread for a person nobody has yet, made by the press and never by a read: `contact_make_for_channel`
 *   (migration `20261104214829`, the office team's own placer, since a signed-in client has no INSERT on `contacts`)
 *   answers whose it is or makes the contact as the edge makes one for a sender nobody knows (kind `unknown`, named by
 *   the address or the number, the one channel); the client then names it through `name_contact` as a new person at
 *   the same customer or trade partner the email's thread is on, the address or the number as their name until someone
 *   gives a better one. A thread on a lead, a supply house, a candidate, a teammate or an unnamed sender gets no
 *   record: the new thread's sort card asks *Who is this?*.
 * - `writeLine`: the gray line on the thread the press was made in, through `follow_up_event`, the thread menu's
 *   writer for the customer's say (v2.5597), as Heard back writes its line (v2.6500).
 *
 * `deferLine` holds a line for ten seconds with Undo, as Heard back does: a signed-in client may insert a note or an
 * event and delete nothing, so the write waits rather than being undone. The pending lines live here, outside any
 * component, so a press that opens another thread keeps its Undo on the toast; `pagehide` writes what is still held.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChannelKind, Contact } from '../contacts/kernel'
import { checkSupabaseError } from '../../utils/errorHandling'
import { supabase } from '../supabase'
import { PRESS_UNDO_MS } from './bodyContacts'
import { nameContact } from './messagesIo'

export interface BodyContactsIo {
  whoseChannel(kind: ChannelKind, value: string): Promise<string | null>
  makeThread(kind: ChannelKind, value: string, at: Pick<Contact, 'kind' | 'customerId' | 'gcCompanyId'>): Promise<string>
  writeLine(contactId: string, body: string): Promise<void>
  /** The signed-in person's name, as the thread's lines name them. */
  myName(): Promise<string>
}

type Rpc = SupabaseClient['rpc']

export function supabaseBodyContactsIo(client: unknown = supabase): BodyContactsIo {
  const db = client as SupabaseClient
  const rpc = db.rpc.bind(db) as Rpc
  return {
    async whoseChannel(kind, value) {
      const result = await rpc('contact_for_channel', { p_kind: kind, p_value: value })
      checkSupabaseError(result, 'find whose it is')
      const id = result.data as unknown
      return typeof id === 'string' && id ? id : null
    },
    async makeThread(kind, value, at) {
      const made = await db.rpc('contact_make_for_channel' as never, { p_kind: kind, p_value: value } as never)
      checkSupabaseError(made, 'make their thread')
      const id = made.data as unknown
      if (typeof id !== 'string' || !id) throw new Error('Their thread could not be made.')
      if (at.customerId) {
        return nameContact(id, { record: { table: 'customers', id: at.customerId }, kind: 'customer', name: value })
      }
      if (at.gcCompanyId) {
        return nameContact(id, { record: { table: 'gc_companies', id: at.gcCompanyId }, kind: at.kind === 'arch' ? 'arch' : 'trade', name: value })
      }
      return id
    },
    async writeLine(contactId, body) {
      const result = await rpc('follow_up_event', { p_contact_id: contactId, p_body: body })
      checkSupabaseError(result, 'write the line on the thread')
    },
    async myName() {
      const { data: auth } = await db.auth.getUser()
      const me = auth.user?.id ?? null
      if (!me) return ''
      const named = await rpc('follow_up_user_name', { p_user_id: me })
      return typeof named.data === 'string' ? named.data : ''
    },
  }
}

// ---------- the lines held for Undo ----------

interface Held {
  write: () => Promise<void>
  timer: ReturnType<typeof setTimeout>
}

const held = new Map<string, Held>()
let seq = 0

/** Writes every line still held: leaving the page never loses a press. */
export function flushDeferredLines(): void {
  for (const [key, h] of held) {
    clearTimeout(h.timer)
    held.delete(key)
    void h.write()
  }
}

if (typeof window !== 'undefined') window.addEventListener('pagehide', flushDeferredLines)

/**
 * Holds a line for `ms`, then writes it; `undo` drops it unwritten while it is held. The writer's refusal reaches
 * `onProblem`, never a throw, since the press that made the line is long over.
 */
export function deferLine(write: () => Promise<void>, onProblem: (e: unknown) => void, ms: number = PRESS_UNDO_MS): { undo: () => boolean } {
  const key = `line:${++seq}`
  const land = async () => {
    held.delete(key)
    try {
      await write()
    } catch (e) {
      onProblem(e)
    }
  }
  const timer = setTimeout(() => void land(), ms)
  held.set(key, { write: land, timer })
  return {
    undo: () => {
      const h = held.get(key)
      if (!h) return false
      clearTimeout(h.timer)
      held.delete(key)
      return true
    },
  }
}

/** How many lines are held right now; a test's window on the store. */
export function deferredLineCount(): number {
  return held.size
}
