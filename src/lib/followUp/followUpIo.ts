/**
 * Messages, cut 2: what Follow up reads and presses, over cut 2's migration (`20261012160000_messages_follow_up.sql`)
 * and the spine's (`20261012010000_messages_spine.sql`). One interface, so a screen's smoke hands it a fake; one
 * implementation on the app's client. The tables are not in the generated types until the lead's types PR, so the
 * client is read untyped here and every row is mapped through `followUpRows.ts`.
 *
 * What it loads is what the queue needs, not every line: the people with their records, their lines in while they are
 * open or snoozed, every note with a day, the days heard still offered or written ahead, and what we owe still open.
 * A thread's highlights load with the thread.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContactChannelRow, ContactJobRow, ContactRecordRows } from '../contacts/load'
import type { JobRef } from '../messages/load'
import type { DayKept } from '../messages/owed'
import type { HeardPromiseKind } from '../messages/promises'
import { supabase } from '../supabase'
import { checkSupabaseError, DatabaseError, formatErrorMessage } from '../../utils/errorHandling'
import type { ContactOwedRow, FollowUpContactRow, FollowUpMessageRow, FollowUpRows, MessageHighlightRow, MessagePromiseRow } from './followUpRows'
import type { ContactState } from './queue'
import { courtFactsFromRows, type CourtFacts } from './courtFacts'
import type { LaneJobRows } from './newLaneRows'

/** What Follow up reads and presses. Each press resolves when its write has landed, and rejects with its refusal. */
export interface FollowUpIo {
  loadQueue(todayYmd: string): Promise<FollowUpRows>
  loadHighlights(messageIds: readonly string[]): Promise<MessageHighlightRow[]>
  /** The badge: `follow_up_count()`, each person once. */
  count(): Promise<number>
  takeIt(contactId: string): Promise<void>
  /** Null puts it back for whoever answers first. */
  handTo(contactId: string, userId: string | null): Promise<void>
  /** Returns the snooze's day for `snoozed`. */
  setState(contactId: string, state: ContactState): Promise<string | null>
  markOwed(contactId: string, what: string, day: DayKept): Promise<string>
  /** Returns the note that marked it done. */
  owedDone(contactId: string, note: string, job: JobRef | null): Promise<string>
  /** A message we sent them got what we owe done (`owed_sent_done`, cut 2's addendum): marks it, and writes the gray line. */
  owedSentDone(contactId: string, messageId: string): Promise<void>
  /** Null is just talk. */
  writeDown(messageId: string, kind: HeardPromiseKind | null, writes?: 'start' | 'delivery' | 'insurance' | 'w9'): Promise<void>
  readQuestion(messageId: string, state: 'asked' | 'answered'): Promise<void>
  /** A team note with its day to come back, in one write. Returns the note. */
  addNote(contactId: string, body: string, job: JobRef | null, back: DayKept | null): Promise<string>
  /** Null clears the day. */
  setBackDay(noteId: string, back: DayKept | null): Promise<void>
  backDone(noteId: string): Promise<void>
  /** Returns the highlight (the same one for the same words). */
  highlight(messageId: string, text: string): Promise<string>
  unhighlight(highlightId: string): Promise<void>
}

const CONTACT_COLUMNS = [
  'id, kind, customer_id, customer_contact_person_id, gc_company_id, gc_company_person_id, person_id, name, goes_by',
  'off_since, off_why, off_by, state, snoozed_until, has_user_id, has_since, has_how',
  // R0's four kinds (`20261013180000`). Follow up never holds a supply house or a candidate (`OFF_FOLLOW_UP`), so of
  // their records only a lead's prospect is embedded below.
  'prospect_id, supply_house_id, supply_house_contact_id, team_prospect_id',
  // The records a name, a company and a trade come from (contactsFromRows).
  'customer:customers(id, name)',
  'person:customer_contact_persons(id, customer_id, name, customer:customers(id, name))',
  'company:gc_companies(id, name, contact_name, trades)',
  'gc_person:gc_company_people(id, company_id, name, company:gc_companies(id, name, contact_name, trades))',
  'roster:people(id, name)',
  'prospect:prospects(id, contact_name, company_name)',
].join(', ')
const CHANNEL_COLUMNS = 'id, contact_id, kind, value, opted_out_at, created_at'
/**
 * A line's columns as Follow up reads them, the thread's read too (`followUpThreadIo.ts`). The box it came through and
 * who tied it are the New lane's (R6's `mailbox`, R7's `tied_by`).
 */
export const MESSAGE_COLUMNS =
  'id, contact_id, channel_id, bid_id, project_id, jobs_ledger_id, channel, direction, who_user_id, who_text, at, subject, body, optout_line, back_on, back_by, back_words, back_done_at, mailbox, tied_by'
/** The open people's jobs, for the New lane's *Which job?*. */
const JOB_COLUMNS = 'contact_id, bid_id, project_id, jobs_ledger_id, is_default, created_at, contact:contacts!inner(state)'
export const OWED_COLUMNS = 'id, contact_id, what, by_day, by_words, marked_by, marked_at, done_at, done_how, done_note_message_id'
export const PROMISE_COLUMNS = 'id, message_id, kind, state, day, day_words, writes, decided_by, decided_at, message:messages(contact_id, at)'
const HIGHLIGHT_COLUMNS = 'id, message_id, text, highlighted_by, highlighted_at'

type Named = { id: string; name: string | null }
type EmbeddedContact = FollowUpContactRow & {
  customer: Named | null
  person: (Named & { customer_id: string; customer: Named | null }) | null
  company: (Named & { contact_name: string | null; trades: string[] | null }) | null
  gc_person: (Named & { company_id: string; company: (Named & { contact_name: string | null; trades: string[] | null }) | null }) | null
  roster: Named | null
  /** A lead's row on Prospects. Null when there is none, or when the signed-in person may not read Prospects. */
  prospect?: { id: string; contact_name: string | null; company_name: string | null } | null
}

/** The records the contacts' embedded rows name, as `contactsFromRows` takes them. */
export function recordsOfContacts(rows: readonly EmbeddedContact[]): ContactRecordRows {
  const customers = new Map<string, { id: string; name: string }>()
  const persons = new Map<string, { id: string; customer_id: string; name: string }>()
  const companies = new Map<string, { id: string; name: string; contact_name: string; trades: string[] }>()
  const companyPeople = new Map<string, { id: string; company_id: string; name: string }>()
  const people = new Map<string, { id: string; name: string }>()
  const prospects = new Map<string, { id: string; contact_name: string | null; company_name: string | null }>()
  const company = (c: (Named & { contact_name: string | null; trades: string[] | null }) | null) => {
    if (c) companies.set(c.id, { id: c.id, name: c.name ?? '', contact_name: c.contact_name ?? '', trades: c.trades ?? [] })
  }
  for (const r of rows) {
    if (r.customer) customers.set(r.customer.id, { id: r.customer.id, name: r.customer.name ?? '' })
    if (r.person) {
      persons.set(r.person.id, { id: r.person.id, customer_id: r.person.customer_id, name: r.person.name ?? '' })
      if (r.person.customer) customers.set(r.person.customer.id, { id: r.person.customer.id, name: r.person.customer.name ?? '' })
    }
    company(r.company)
    if (r.gc_person) {
      companyPeople.set(r.gc_person.id, { id: r.gc_person.id, company_id: r.gc_person.company_id, name: r.gc_person.name ?? '' })
      company(r.gc_person.company)
    }
    if (r.roster) people.set(r.roster.id, { id: r.roster.id, name: r.roster.name ?? '' })
    if (r.prospect) prospects.set(r.prospect.id, r.prospect)
  }
  return {
    customers: [...customers.values()],
    customerContactPersons: [...persons.values()],
    gcCompanies: [...companies.values()],
    gcCompanyPeople: [...companyPeople.values()],
    people: [...people.values()],
    prospects: [...prospects.values()],
  }
}

/** A day as the presses take it: a date, or the words typed, or neither. */
function dayArgs(day: DayKept | null, on: string, words: string): Record<string, string | null> {
  return { [on]: day?.ymd ?? null, [words]: day?.ymd ? null : (day?.words ?? null) }
}

/** The job as the presses take it: its kind and id, or neither. */
function jobArgs(job: JobRef | null): { p_job_kind: string | null; p_job_id: string | null } {
  return { p_job_kind: job?.kind ?? null, p_job_id: job?.id ?? null }
}

/** The states of the open people's jobs: a bid's outcome, a GC project's stage, a Pipeline job's status. */
async function loadJobStates(db: SupabaseClient, jobs: readonly ContactJobRow[]): Promise<LaneJobRows> {
  const ids = (pick: (j: ContactJobRow) => string | null) => [...new Set(jobs.map(pick).filter((id): id is string => Boolean(id)))]
  const bidIds = ids((j) => j.bid_id)
  const projectIds = ids((j) => j.project_id)
  const pipelineIds = ids((j) => j.jobs_ledger_id)
  const none = { data: [], error: null }
  const [bids, projects, pipeline] = await Promise.all([
    bidIds.length ? db.from('bids').select('id, outcome').in('id', bidIds) : none,
    projectIds.length ? db.from('gc_projects').select('project_id, stage, lost_on').in('project_id', projectIds) : none,
    pipelineIds.length ? db.from('jobs_ledger').select('id, status').in('id', pipelineIds) : none,
  ])
  checkSupabaseError(bids, 'load the bids of the people waiting on us')
  checkSupabaseError(projects, 'load the GC projects of the people waiting on us')
  checkSupabaseError(pipeline, 'load the Pipeline jobs of the people waiting on us')
  return {
    bids: (bids.data ?? []) as LaneJobRows['bids'],
    projects: (projects.data ?? []) as LaneJobRows['projects'],
    pipeline: (pipeline.data ?? []) as LaneJobRows['pipeline'],
  }
}

/** Follow up's reads and presses on a client: the app's own unless a test hands it another. */
export function supabaseFollowUpIo(client: unknown = supabase): FollowUpIo {
  // The cut 1 and cut 2 tables join the generated types with the lead's types PR; until then the client is untyped.
  const db = client as SupabaseClient
  const call = async <T>(fn: string, args: Record<string, unknown>, doing: string): Promise<T> => {
    const result = await db.rpc(fn, args)
    checkSupabaseError(result, doing)
    return result.data as T
  }
  return {
    async loadQueue(todayYmd) {
      const [contacts, channels, inbound, notes, heard, owed, jobs] = await Promise.all([
        db.from('contacts').select(CONTACT_COLUMNS),
        db.from('contact_channels').select(CHANNEL_COLUMNS),
        // Their lines in while the conversation is open or snoozed: the queue reads each person's newest.
        db.from('messages').select(`${MESSAGE_COLUMNS}, contact:contacts!inner(state)`).eq('direction', 'in').in('contact.state', ['waiting', 'snoozed']),
        db.from('messages').select(MESSAGE_COLUMNS).eq('channel', 'note').or('back_on.not.is.null,back_words.not.is.null'),
        db.from('message_promises').select(PROMISE_COLUMNS).or(`state.eq.offered,and(state.eq.written,day.gte.${todayYmd})`),
        db.from('contact_owed').select(OWED_COLUMNS).is('done_at', null),
        db.from('contact_jobs').select(JOB_COLUMNS).in('contact.state', ['waiting', 'snoozed']),
      ])
      checkSupabaseError(contacts, 'load the people Follow up reads')
      checkSupabaseError(channels, 'load their numbers and addresses')
      checkSupabaseError(inbound, 'load the lines waiting on us')
      checkSupabaseError(notes, 'load the notes with a day')
      checkSupabaseError(heard, 'load the days heard')
      checkSupabaseError(owed, 'load what we owe')
      checkSupabaseError(jobs, 'load the jobs of the people waiting on us')
      const jobRows = (jobs.data ?? []) as unknown as ContactJobRow[]
      const people = (contacts.data ?? []) as unknown as EmbeddedContact[]
      const lines = [...((inbound.data ?? []) as unknown as FollowUpMessageRow[]), ...((notes.data ?? []) as unknown as FollowUpMessageRow[])]
      return {
        contacts: people,
        channels: (channels.data ?? []) as unknown as ContactChannelRow[],
        records: recordsOfContacts(people),
        // A line can be both (never in practice: a note is not theirs); keep each once.
        messages: [...new Map(lines.map((m) => [m.id, m])).values()],
        heard: (heard.data ?? []) as unknown as MessagePromiseRow[],
        owed: (owed.data ?? []) as unknown as ContactOwedRow[],
        jobs: jobRows,
        jobStates: await loadJobStates(db, jobRows),
      }
    },
    async loadHighlights(messageIds) {
      if (messageIds.length === 0) return []
      const result = await db.from('message_highlights').select(HIGHLIGHT_COLUMNS).in('message_id', [...messageIds])
      checkSupabaseError(result, 'load the highlights')
      return (result.data ?? []) as unknown as MessageHighlightRow[]
    },
    async count() {
      return Number((await call<number | null>('follow_up_count', {}, 'count who is waiting')) ?? 0)
    },
    async takeIt(contactId) {
      await call('take_it', { p_contact_id: contactId }, 'take a conversation')
    },
    async handTo(contactId, userId) {
      await call('hand_to', { p_contact_id: contactId, p_user_id: userId }, 'hand a conversation on')
    },
    async setState(contactId, state) {
      return (await call<string | null>('set_state', { p_contact_id: contactId, p_state: state }, 'change a conversation')) ?? null
    },
    async markOwed(contactId, what, day) {
      return call<string>('mark_owed', { p_contact_id: contactId, p_what: what, ...dayArgs(day, 'p_by_day', 'p_by_words') }, 'mark what we owe')
    },
    async owedSentDone(contactId, messageId) {
      await call('owed_sent_done', { p_contact_id: contactId, p_message_id: messageId }, 'mark what we owe done by a message')
    },
    async owedDone(contactId, note, job) {
      return call<string>('owed_done', { p_contact_id: contactId, p_note: note, ...jobArgs(job) }, 'mark what we owe done')
    },
    async writeDown(messageId, kind, writes) {
      await call('write_down', { p_message_id: messageId, p_kind: kind, p_writes: writes ?? null }, 'write down a promise')
    },
    async readQuestion(messageId, state) {
      await call('read_question', { p_message_id: messageId, p_state: state }, 'answer a plans question')
    },
    async addNote(contactId, body, job, back) {
      return call<string>(
        'add_note',
        { p_contact_id: contactId, p_body: body, ...jobArgs(job), ...dayArgs(back, 'p_back_on', 'p_back_words') },
        'write a team note',
      )
    },
    async setBackDay(noteId, back) {
      await call('set_back_day', { p_note_id: noteId, ...dayArgs(back, 'p_on', 'p_words') }, 'bring a note back')
    },
    async backDone(noteId) {
      await call('back_done', { p_note_id: noteId }, 'clear a note’s day')
    },
    async highlight(messageId, text) {
      return call<string>('highlight', { p_message_id: messageId, p_text: text }, 'highlight a message')
    },
    async unhighlight(highlightId) {
      await call('unhighlight', { p_highlight_id: highlightId }, 'remove a highlight')
    },
  }
}

/** The presses' own refusals start with these; a policy's 42501 does not, and reads as the house's sentence. */
const PRESS_REFUSALS = /^(Sign in to |A training account cannot |A digital twin cannot |Only the office (team )?can )/

/**
 * What the office reads when a press fails. A press refuses in plain words (`P0001`, or `42501` for who may not press),
 * and those words are the screen's. Anything else (offline, a policy, a timeout) reads as the house says it.
 */
/**
 * What cut 2 tells every person's move line in the Messages list, in one read (C2, the lead's ruling): the open
 * `contact_owed` rows and the written promises whose day has not passed, by person (`courtFactsFromRows`). The thread
 * window reads the same facts for the open person, so the list and the window say one thing.
 */
export async function loadCourtFacts(todayYmd: string, client: unknown = supabase): Promise<Map<string, CourtFacts>> {
  const db = client as SupabaseClient
  const [owed, promises] = await Promise.all([
    db.from('contact_owed').select(OWED_COLUMNS).is('done_at', null),
    db.from('message_promises').select(PROMISE_COLUMNS).eq('state', 'written').gte('day', todayYmd),
  ])
  checkSupabaseError(owed, 'load what we owe')
  checkSupabaseError(promises, 'load the days promised')
  return courtFactsFromRows((owed.data ?? []) as unknown as ContactOwedRow[], (promises.data ?? []) as unknown as MessagePromiseRow[], todayYmd)
}

export function pressProblem(error: unknown): string {
  if (error instanceof DatabaseError && error.serverMessage) {
    if (error.code === 'P0001' || (error.code === '42501' && PRESS_REFUSALS.test(error.serverMessage))) return error.serverMessage
  }
  return formatErrorMessage(error)
}
