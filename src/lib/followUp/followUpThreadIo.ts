/**
 * Messages, cut 2's screens, PR C1: what Follow up reads and presses inside one person's thread (the thread window's
 * slots, `useFollowUpThreadSlots`). The read is the open person only: cut 2's columns on their contact, their team notes
 * that carry a day, what we owe them still open, the written promises still running, and who holds each conversation
 * that is not done, for the picker's counts. The team is the GC office
 * team (`followUpTeamOf`). The presses are Follow up's own (`supabaseFollowUpIo`). One interface, so a smoke fakes it.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadOpenCallTasks, supabaseCallTasksIo, type CallTaskDbRow } from '../calls/callTasksIo'
import { checkSupabaseError } from '../../utils/errorHandling'
import { GC_OFFICE_TEAM } from '../gc/access'
import { supabase } from '../supabase'
import { MESSAGE_COLUMNS, OWED_COLUMNS, supabaseFollowUpIo, type FollowUpIo } from './followUpIo'
import type { ContactFollowUpRow, ContactOwedRow, FollowUpMessageRow, HolderRow, MessagePromiseRow } from './followUpRows'
import { followUpTeamOf, type Teammate } from './team'

/** The open person's rows. */
export interface FollowUpThreadRows {
  /** Cut 2's columns on their contact; null once the row is gone (folded into someone else). */
  contact: ContactFollowUpRow | null
  /** Their team notes that carry a day, the standing one among them. */
  notes: FollowUpMessageRow[]
  /** Who holds each conversation that is not done. */
  holders: HolderRow[]
  /** What we owe them, still open: one row, or none. */
  owed: ContactOwedRow[]
  /** Their written promises whose day has not passed, for the move line. */
  promises: MessagePromiseRow[]
  /** Their open calls to make (v2.5596); none before the push. */
  calls?: CallTaskDbRow[]
}

export interface FollowUpThreadIo extends Pick<FollowUpIo, 'takeIt' | 'handTo' | 'setState' | 'backDone' | 'markOwed' | 'callAdd' | 'setPrefers'> {
  loadThread(contactId: string, todayYmd: string): Promise<FollowUpThreadRows>
  loadTeam(): Promise<Teammate[]>
}

/** A promise's columns with its line inner-joined, so a filter on the line's person keeps only theirs. */
const THREAD_PROMISE_COLUMNS = 'id, message_id, kind, state, day, day_words, writes, decided_by, decided_at, message:messages!inner(contact_id, at)'

export function supabaseFollowUpThreadIo(client: unknown = supabase): FollowUpThreadIo {
  // The cut 1 and cut 2 tables join the generated types with the lead's types PR; until then the client is untyped.
  const db = client as SupabaseClient
  const presses = supabaseFollowUpIo(client)
  return {
    async loadThread(contactId, todayYmd) {
      const [contact, notes, holders, owed, promises, calls] = await Promise.all([
        db.from('contacts').select('state, snoozed_until, has_user_id, has_since, has_how, prefers').eq('id', contactId).maybeSingle(),
        db.from('messages').select(MESSAGE_COLUMNS).eq('contact_id', contactId).eq('channel', 'note').or('back_on.not.is.null,back_words.not.is.null'),
        db.from('contacts').select('id, state, snoozed_until, has_user_id').not('has_user_id', 'is', null).neq('state', 'done'),
        db.from('contact_owed').select(OWED_COLUMNS).eq('contact_id', contactId).is('done_at', null),
        db.from('message_promises').select(THREAD_PROMISE_COLUMNS).eq('message.contact_id', contactId).eq('state', 'written').gte('day', todayYmd),
        loadOpenCallTasks(db, contactId),
      ])
      checkSupabaseError(contact, 'load who has the conversation')
      checkSupabaseError(notes, 'load the notes with a day')
      checkSupabaseError(holders, 'load what each teammate holds')
      checkSupabaseError(owed, 'load what we owe them')
      checkSupabaseError(promises, 'load the days they promised')
      return {
        contact: (contact.data ?? null) as ContactFollowUpRow | null,
        notes: (notes.data ?? []) as unknown as FollowUpMessageRow[],
        holders: (holders.data ?? []) as unknown as HolderRow[],
        owed: (owed.data ?? []) as unknown as ContactOwedRow[],
        promises: (promises.data ?? []) as unknown as MessagePromiseRow[],
        calls,
      }
    },
    callAdd: (input) => supabaseCallTasksIo(db).add(input),
    async setPrefers(contactId, prefers) {
      const result = await db.rpc('contact_set_prefers', { p_contact: contactId, p_prefers: prefers })
      checkSupabaseError(result, 'set how they hear from us')
    },
    async loadTeam() {
      const result = await db.from('users').select('id, name, role').in('role', [...GC_OFFICE_TEAM]).is('archived_at', null).eq('is_digital_twin', false).eq('is_sample', false)
      checkSupabaseError(result, 'load the office team')
      const rows = (result.data ?? []) as Array<{ id: string; name: string | null; role: string | null }>
      return followUpTeamOf(rows.map((r) => ({ id: r.id, name: r.name ?? '', role: r.role ?? '' })))
    },
    takeIt: presses.takeIt,
    handTo: presses.handTo,
    setState: presses.setState,
    backDone: presses.backDone,
    markOwed: presses.markOwed,
  }
}
