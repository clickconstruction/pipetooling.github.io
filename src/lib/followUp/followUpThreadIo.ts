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
import type { OfficeHours } from '../messages/hasRule'
import { parsePushHours, type PushHoursByUser } from '../messages/pushHours'
import { writeHeardThrough, type HeardThroughInput } from '../messages/promiseWritesIo'

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
  /**
   * What each of their lines' days was said to be (punch list #421): every day row on their lines, offered, written or
   * just talk, any day, so a line already said draws its words in place of the choice. Plans questions are left out.
   */
  heard?: MessagePromiseRow[]
}

export interface FollowUpThreadIo extends Pick<FollowUpIo, 'takeIt' | 'handTo' | 'setState' | 'noReplyNeeded' | 'backDone' | 'markOwed' | 'callAdd' | 'setPrefers'> {
  loadThread(contactId: string, todayYmd: string): Promise<FollowUpThreadRows>
  loadTeam(): Promise<Teammate[]>
  /**
   * These people's Push me hours (v2.6060, punch list #141 PR 4), for the pill's off words; a person with no row, or
   * a row this viewer cannot read, is any time. Never rejects.
   */
  loadPushHours?(userIds: readonly string[]): Promise<PushHoursByUser>
  /**
   * The mark a payment word leaves on its line (v2.8271, punch list #129, `write_down_payment`): with a day, the
   * line's promise is a payment by that day; with none, a payment mark comes back off as just talk. Rejects with the
   * database's own words on a refusal. With a job (punch list #421 PR 5) the mark names it, so a customer's other job
   * does not read it as its own.
   */
  writeDownPayment?(messageId: string, ymd: string | null, jobId?: string | null): Promise<void>
  /**
   * A heard day said in one press (punch list #421, `write_down_heard`): the line's day written as a kind, or with no
   * kind as just talk. A double kind writes `writes`. Rejects with the database's own words on a refusal.
   */
  writeDownHeard?(messageId: string, kind: string | null, ymd: string, writes: string | null): Promise<void>
  /**
   * Where a written heard day also goes (punch list #421 PR 4, `messages/promiseWritesIo.ts`): the Board's ask, the
   * Board's promises, the bid's follow-up day or the flow's hold, and the words to say after. Never rejects.
   */
  writeHeardThrough?(input: HeardThroughInput): Promise<{ words: string; tone: 'success' | 'info' | 'error' }>
}

/** A promise's columns with its line inner-joined, so a filter on the line's person keeps only theirs. */
const THREAD_PROMISE_COLUMNS = 'id, message_id, kind, state, day, day_words, writes, job_id, decided_by, decided_at, message:messages!inner(contact_id, at)'

export function supabaseFollowUpThreadIo(client: unknown = supabase): FollowUpThreadIo {
  // The cut 1 and cut 2 tables join the generated types with the lead's types PR; until then the client is untyped.
  const db = client as SupabaseClient
  const presses = supabaseFollowUpIo(client)
  return {
    async loadThread(contactId, todayYmd) {
      const [contact, notes, holders, owed, promises, calls, heard] = await Promise.all([
        db.from('contacts').select('state, snoozed_until, has_user_id, has_since, has_how, prefers').eq('id', contactId).maybeSingle(),
        db.from('messages').select(MESSAGE_COLUMNS).eq('contact_id', contactId).eq('channel', 'note').or('back_on.not.is.null,back_words.not.is.null'),
        db.from('contacts').select('id, state, snoozed_until, has_user_id').not('has_user_id', 'is', null).neq('state', 'done'),
        db.from('contact_owed').select(OWED_COLUMNS).eq('contact_id', contactId).is('done_at', null),
        db.from('message_promises').select(THREAD_PROMISE_COLUMNS).eq('message.contact_id', contactId).eq('state', 'written').gte('day', todayYmd),
        loadOpenCallTasks(db, contactId),
        // A soft read: a line with no word on its day draws the choice, as before any was written.
        db.from('message_promises').select(THREAD_PROMISE_COLUMNS).eq('message.contact_id', contactId),
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
        heard: heard.error ? [] : ((heard.data ?? []) as unknown as MessagePromiseRow[]).filter((r) => r.kind !== 'question'),
      }
    },
    callAdd: (input) => supabaseCallTasksIo(db).add(input),
    async setPrefers(contactId, prefers) {
      const result = await db.rpc('contact_set_prefers', { p_contact: contactId, p_prefers: prefers })
      checkSupabaseError(result, 'set how they hear from us')
    },
    async writeDownPayment(messageId, ymd, jobId) {
      // No day is left off the call, and the function's own default (NULL) takes the mark off; a job only with a day.
      const result = await db.rpc('write_down_payment', ymd ? { p_message_id: messageId, p_day: ymd, ...(jobId ? { p_job_id: jobId } : {}) } : { p_message_id: messageId })
      checkSupabaseError(result, 'mark the line with their promise')
    },
    async writeDownHeard(messageId, kind, ymd, writes) {
      const result = await db.rpc('write_down_heard', { p_message_id: messageId, p_kind: kind, p_day: ymd, ...(writes ? { p_writes: writes } : {}) })
      checkSupabaseError(result, 'write down what the day is')
    },
    writeHeardThrough: (input) => writeHeardThrough(input, client),
    async loadTeam() {
      const result = await db.from('users').select('id, name, role').in('role', [...GC_OFFICE_TEAM]).is('archived_at', null).eq('is_digital_twin', false).eq('is_sample', false).eq('is_walk_tester', false)
      checkSupabaseError(result, 'load the office team')
      const rows = (result.data ?? []) as Array<{ id: string; name: string | null; role: string | null }>
      return followUpTeamOf(rows.map((r) => ({ id: r.id, name: r.name ?? '', role: r.role ?? '' })))
    },
    async loadPushHours(userIds) {
      const out = new Map<string, OfficeHours | null>()
      if (userIds.length === 0) return out
      const result = await db.from('user_push_hours').select('user_id, days, opens, closes').in('user_id', [...userIds])
      if (result.error) return out
      for (const row of (result.data ?? []) as Array<{ user_id: string; days: unknown; opens: unknown; closes: unknown }>) out.set(row.user_id, parsePushHours(row))
      return out
    },
    takeIt: presses.takeIt,
    handTo: presses.handTo,
    setState: presses.setState,
    noReplyNeeded: presses.noReplyNeeded,
    backDone: presses.backDone,
    markOwed: presses.markOwed,
  }
}
