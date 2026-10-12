/**
 * Messages, cut 2's screens, PR C1: what Follow up reads and presses inside one person's thread (the thread window's
 * slots, `useFollowUpThreadSlots`). The read is the open person only: cut 2's columns on their contact, their team notes
 * that carry a day, what we owe them still open, their lines read as a promise or a plans question in every state, their
 * lines' highlights, the names of the GC projects those lines are on, and who holds each conversation that is not done,
 * for the picker's counts. *Ask the architect* writes GC mode's plan question (`gcIo`) as Follow up's tab does. The team is the GC office
 * team (`followUpTeamOf`). The presses are Follow up's own (`supabaseFollowUpIo`). One interface, so a smoke fakes it.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { checkSupabaseError } from '../../utils/errorHandling'
import { recordQuestion, sendQuestionToArchitect } from '../gc/gcIo'
import { jobKey } from '../messages/load'
import type { PlanQuestionIo } from './askArchitect'
import { GC_OFFICE_TEAM } from '../gc/access'
import { supabase } from '../supabase'
import { MESSAGE_COLUMNS, OWED_COLUMNS, supabaseFollowUpIo, type FollowUpIo } from './followUpIo'
import type { ContactFollowUpRow, ContactOwedRow, FollowUpMessageRow, HolderRow, MessageHighlightRow, MessagePromiseRow } from './followUpRows'
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
  /** Their lines read as a promise or a plans question, in every state. */
  heard: MessagePromiseRow[]
  /** Their lines' highlights. */
  highlights: MessageHighlightRow[]
  /** The GC projects their heard lines are on, by job key ("project:<uuid>"), for the words that name the job. */
  jobNames: Record<string, string>
}

export interface FollowUpThreadIo
  extends Pick<FollowUpIo, 'takeIt' | 'handTo' | 'setState' | 'backDone' | 'markOwed' | 'writeDown' | 'readQuestion' | 'highlight' | 'unhighlight'> {
  loadThread(contactId: string): Promise<FollowUpThreadRows>
  /** GC mode's plan question writes, for *Ask the architect* under a line. */
  planQuestions: PlanQuestionIo
  loadTeam(): Promise<Teammate[]>
}

/** A promise's columns with its line inner-joined, so a filter on the line's person keeps only theirs. */
const THREAD_PROMISE_COLUMNS = 'id, message_id, kind, state, day, day_words, writes, decided_by, decided_at, message:messages!inner(contact_id, at, project_id)'
/** A highlight's columns with its line inner-joined, the same way. */
const THREAD_HIGHLIGHT_COLUMNS = 'id, message_id, text, highlighted_by, highlighted_at, message:messages!inner(contact_id)'

export function supabaseFollowUpThreadIo(client: unknown = supabase): FollowUpThreadIo {
  // The cut 1 and cut 2 tables join the generated types with the lead's types PR; until then the client is untyped.
  const db = client as SupabaseClient
  const presses = supabaseFollowUpIo(client)
  return {
    async loadThread(contactId) {
      const [contact, notes, holders, owed, heard, highlights] = await Promise.all([
        db.from('contacts').select('state, snoozed_until, has_user_id, has_since, has_how').eq('id', contactId).maybeSingle(),
        db.from('messages').select(MESSAGE_COLUMNS).eq('contact_id', contactId).eq('channel', 'note').or('back_on.not.is.null,back_words.not.is.null'),
        db.from('contacts').select('id, state, snoozed_until, has_user_id').not('has_user_id', 'is', null).neq('state', 'done'),
        db.from('contact_owed').select(OWED_COLUMNS).eq('contact_id', contactId).is('done_at', null),
        db.from('message_promises').select(THREAD_PROMISE_COLUMNS).eq('message.contact_id', contactId),
        db.from('message_highlights').select(THREAD_HIGHLIGHT_COLUMNS).eq('message.contact_id', contactId),
      ])
      checkSupabaseError(contact, 'load who has the conversation')
      checkSupabaseError(notes, 'load the notes with a day')
      checkSupabaseError(holders, 'load what each teammate holds')
      checkSupabaseError(owed, 'load what we owe them')
      checkSupabaseError(heard, 'load the days and questions heard')
      checkSupabaseError(highlights, 'load the highlights')
      const heardRows = (heard.data ?? []) as unknown as Array<MessagePromiseRow & { message: { project_id?: string | null } | null }>
      const projectIds = [...new Set(heardRows.map((r) => r.message?.project_id).filter((id): id is string => Boolean(id)))]
      const jobNames: Record<string, string> = {}
      if (projectIds.length > 0) {
        const projects = await db.from('projects').select('id, name').in('id', projectIds)
        checkSupabaseError(projects, 'load the jobs’ names')
        for (const p of (projects.data ?? []) as Array<{ id: string; name: string | null }>) if (p.name?.trim()) jobNames[jobKey({ kind: 'project', id: p.id })] = p.name.trim()
      }
      return {
        contact: (contact.data ?? null) as ContactFollowUpRow | null,
        notes: (notes.data ?? []) as unknown as FollowUpMessageRow[],
        holders: (holders.data ?? []) as unknown as HolderRow[],
        owed: (owed.data ?? []) as unknown as ContactOwedRow[],
        heard: heardRows,
        highlights: (highlights.data ?? []) as unknown as MessageHighlightRow[],
        jobNames,
      }
    },
    async loadTeam() {
      const result = await db.from('users').select('id, name, role').in('role', [...GC_OFFICE_TEAM]).is('archived_at', null)
      checkSupabaseError(result, 'load the office team')
      const rows = (result.data ?? []) as Array<{ id: string; name: string | null; role: string | null }>
      return followUpTeamOf(rows.map((r) => ({ id: r.id, name: r.name ?? '', role: r.role ?? '' })))
    },
    takeIt: presses.takeIt,
    handTo: presses.handTo,
    setState: presses.setState,
    backDone: presses.backDone,
    markOwed: presses.markOwed,
    writeDown: presses.writeDown,
    readQuestion: presses.readQuestion,
    highlight: presses.highlight,
    unhighlight: presses.unhighlight,
    planQuestions: { record: recordQuestion, send: sendQuestionToArchitect },
  }
}
