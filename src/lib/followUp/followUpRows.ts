/**
 * Messages, cut 2: Follow up's rows as the screens load them. Pure mappers from what cut 2's migration
 * (`20261012160000_messages_follow_up.sql`) keeps (the contacts' state and who has it, a note's day in words and Done
 * with it, `contact_owed`, `message_promises`, `message_highlights`) to the kernels' inputs (`followUp/queue.ts`,
 * `messages/owed.ts`, `messages/promises.ts`). No client here: `followUpIo.ts` fetches. The row types are written out
 * until the generated types carry the tables; the lead's one types PR swaps them for `Tables<'…'>`.
 */
import type { Contact } from '../contacts/kernel'
import { contactsFromRows, type ContactChannelRow, type ContactJobRow, type ContactRecordRows, type ContactRow } from '../contacts/load'
import { threadMessageFromRow, type MessageLoadContext, type MessageRow } from '../messages/load'
import type { ThreadMessage } from '../messages/thread'
import type { Owed } from '../messages/owed'
import type { HeardLine, HeardPromiseKind, HeardPromiseState, QuestionState } from '../messages/promises'
import type { PromiseKind } from '../gc/types'
import { newLane, type NewLaneMessage, type NewLaneRow } from './newLane'
import { activeJobKeys, laneFacts, type LaneJobRows } from './newLaneRows'
import type { ContactState, FollowUpInput, HasHow, OwedRecord, QueueContact, QueueMessage } from './queue'
import type { ContactFollowUpRow } from './followUpTypes'

/** The conversation's state and who has it: cut 2's columns on a `contacts` row, kept in `followUpTypes.ts` for the edge. */
export type { ContactFollowUpRow }

/** A `contacts` row as Follow up reads it: cut 1's columns and cut 2's. */
export type FollowUpContactRow = ContactRow & ContactFollowUpRow

/**
 * A `messages` row as Follow up reads it: cut 1's columns, a note's day in words and Done with it, and the box it came
 * through and who tied it (R6's `mailbox`, R7's `tied_by`, for the New lane; not in the generated types yet).
 */
export type FollowUpMessageRow = MessageRow & {
  back_words: string | null
  back_done_at: string | null
  mailbox?: string | null
  tied_by?: string | null
}

/** A `contact_owed` row. */
export interface ContactOwedRow {
  id: string
  contact_id: string
  what: string
  by_day: string | null
  by_words: string | null
  marked_by: string | null
  marked_at: string
  done_at: string | null
  done_how: string | null
  done_note_message_id: string | null
}

/** A `message_promises` row, with its line's person and time. */
export interface MessagePromiseRow {
  id: string
  message_id: string
  kind: string | null
  state: string
  day: string | null
  day_words: string | null
  writes: string | null
  decided_by: string | null
  decided_at: string | null
  message: { contact_id: string; at: string } | null
}

/** A `message_highlights` row. */
export interface MessageHighlightRow {
  id: string
  message_id: string
  text: string
  highlighted_by: string | null
  highlighted_at: string
}

/** A person as Follow up draws them: the queue's reading, their trade, who has it in full, and their jobs (the New lane's). */
export type FollowUpContact = QueueContact & {
  trade?: string
  hasUserId: string | null
  hasSince: string | null
  hasHow: HasHow | null
  /** Their jobs, by key, in the rail's order, and the starred one. Empty when the read loaded none. */
  jobIds?: string[]
  defaultJobId?: string | null
}

/** A highlight as the thread draws it. */
export interface MessageHighlight {
  id: string
  messageId: string
  text: string
  /** By name. */
  by: string
  at: string
}

/** What Follow up loads in one go. */
export interface FollowUpRows {
  contacts: readonly FollowUpContactRow[]
  channels: readonly ContactChannelRow[]
  records: ContactRecordRows
  /** Their lines in, for whoever is open or snoozed, and every note with a day. */
  messages: readonly FollowUpMessageRow[]
  heard: readonly MessagePromiseRow[]
  owed: readonly ContactOwedRow[]
  /** The open people's jobs, and those jobs' states, for the New lane's *Which job?* (R7). */
  jobs?: readonly ContactJobRow[]
  jobStates?: LaneJobRows
}

const STATES: ReadonlySet<string> = new Set<ContactState>(['waiting', 'snoozed', 'done'])
const HOWS: ReadonlySet<string> = new Set<HasHow>(['took', 'rule', 'handed'])
const PROMISE_KINDS: ReadonlySet<string> = new Set<HeardPromiseKind>(['quote', 'start', 'papers', 'payment', 'decision', 'access', 'answer', 'cert'])
const PROMISE_STATES: ReadonlySet<string> = new Set<HeardPromiseState>(['offered', 'written', 'no'])
const QUESTION_STATES: ReadonlySet<string> = new Set<QuestionState>(['offered', 'asked', 'answered'])
const WRITES: ReadonlySet<string> = new Set(['start', 'delivery', 'insurance', 'w9'])

const nameOf = (userNames: Readonly<Record<string, string>>, id: string | null) => (id ? userNames[id] || 'Someone' : null)

/**
 * The people as Follow up reads them: the spine's contact (its name, kind, company and trade) with cut 2's state and who
 * has it, by name. A state this build does not know reads as done, so a newer row never puts someone in the queue.
 */
export function followUpContactsFromRows(rows: FollowUpRows, userNames: Readonly<Record<string, string>>): FollowUpContact[] {
  const byId = new Map(rows.contacts.map((r) => [r.id, r]))
  return contactsFromRows(rows.contacts, rows.channels, rows.jobs ?? [], rows.records).map((c: Contact) => followUpContactOf(c, byId.get(c.id), userNames))
}

/**
 * One person as Follow up reads them: the spine's contact (as the thread window holds it) with cut 2's columns. No row,
 * or a state this build does not know, reads as done with nobody.
 */
export function followUpContactOf(
  c: Pick<Contact, 'id' | 'kind' | 'name' | 'goesBy' | 'company' | 'trade'> & Partial<Pick<Contact, 'jobIds' | 'defaultJobId'>>,
  row: ContactFollowUpRow | null | undefined,
  userNames: Readonly<Record<string, string>>,
): FollowUpContact {
  const state = row && STATES.has(row.state) ? (row.state as ContactState) : 'done'
  const hasUserId = row?.has_user_id ?? null
  return {
    id: c.id,
    kind: c.kind,
    name: c.name,
    goesBy: c.goesBy,
    company: c.company,
    ...(c.trade ? { trade: c.trade } : {}),
    state,
    snoozedUntil: state === 'snoozed' ? (row?.snoozed_until ?? null) : null,
    has: nameOf(userNames, hasUserId),
    hasUserId,
    hasSince: hasUserId ? (row?.has_since ?? null) : null,
    hasHow: hasUserId && row?.has_how && HOWS.has(row.has_how) ? (row.has_how as HasHow) : null,
    ...(c.jobIds ? { jobIds: c.jobIds, defaultJobId: c.defaultJobId ?? null } : {}),
  }
}

/** Someone holding a conversation that is not done: what the picker counts for each teammate. */
export interface HolderRow {
  id: string
  state: string
  snoozed_until: string | null
  has_user_id: string
}

/** The holders as `holdCount` reads them: who has each, by name, and its state. Their names do not matter here. */
export function holdersFromRows(rows: readonly HolderRow[], userNames: Readonly<Record<string, string>>): QueueContact[] {
  return rows.map((r) => {
    const state = STATES.has(r.state) ? (r.state as ContactState) : 'done'
    return { id: r.id, kind: 'unknown', name: '', state, snoozedUntil: state === 'snoozed' ? r.snoozed_until : null, has: nameOf(userNames, r.has_user_id) }
  })
}

/**
 * A line as Follow up reads it: the queue's fields, what a row's snippet shows (an email's subject, who wrote it), its
 * job, and the box it came through and whether a person tied it (the New lane's).
 */
export type FollowUpLine = QueueMessage & Pick<ThreadMessage, 'subject' | 'who' | 'jobId'> & Pick<NewLaneMessage, 'mailbox' | 'tiedByHand'>

/** The lines as Follow up reads them, with a note's day in words and when it was dealt with. */
export function followUpMessagesFromRows(rows: readonly FollowUpMessageRow[], ctx: MessageLoadContext = {}): FollowUpLine[] {
  const out: FollowUpLine[] = []
  for (const row of rows) {
    const m = threadMessageFromRow(row, ctx)
    if (m) out.push({ ...m, backWords: row.back_words, backDoneAt: row.back_done_at, ...laneFacts(row) })
  }
  return out
}

/**
 * The New lane for the people Needs a reply holds (`FollowUpPassThrough.newLane`): their newest line in, its box and
 * whether a person tied it, and their jobs still under way. Follow up reads only their lines in, since an open
 * conversation has no reply of ours after its newest line.
 */
export function followUpNewLane(
  input: { contacts: readonly FollowUpContact[]; messages: readonly FollowUpLine[] },
  jobStates: LaneJobRows,
  nowIso: string,
): (people: ReadonlySet<string>) => NewLaneRow[] {
  const active = activeJobKeys(jobStates)
  return (people) =>
    newLane(
      input.contacts
        .filter((c) => people.has(c.id))
        .map((c) => ({
          id: c.id,
          kind: c.kind,
          name: c.name,
          goesBy: c.goesBy ?? null,
          company: c.company ?? '',
          jobIds: c.jobIds ?? [],
          defaultJobId: c.defaultJobId ?? null,
          has: c.has ?? null,
        })),
      input.messages.filter((m) => people.has(m.contactId)),
      active,
      nowIso,
    )
}

/**
 * What each line was read as. A row this build does not know (a kind, a state, a pairing the migration's checks
 * refuse) is left out rather than drawn wrong.
 */
export function heardLinesFromRows(rows: readonly MessagePromiseRow[]): HeardLine[] {
  const out: HeardLine[] = []
  for (const r of rows) {
    if (!r.message) continue
    const base = { messageId: r.message_id, contactId: r.message.contact_id, at: r.message.at }
    if (r.kind === 'question') {
      if (QUESTION_STATES.has(r.state)) out.push({ ...base, kind: 'question', state: r.state as QuestionState })
      continue
    }
    if (r.kind !== null && !PROMISE_KINDS.has(r.kind)) continue
    if (!PROMISE_STATES.has(r.state)) continue
    out.push({
      ...base,
      kind: r.kind as HeardPromiseKind | null,
      state: r.state as HeardPromiseState,
      dayYmd: r.day,
      dayWords: r.day_words,
      writes: r.writes && WRITES.has(r.writes) ? (r.writes as Extract<PromiseKind, 'start' | 'delivery' | 'insurance' | 'w9'>) : null,
    })
  }
  return out
}

/** What we owe, with who marked it by name. */
export function owedRecordsFromRows(rows: readonly ContactOwedRow[], userNames: Readonly<Record<string, string>>): OwedRecord[] {
  return rows.map((r) => {
    const owed: Owed = { what: r.what, byYmd: r.by_day, byWords: r.by_words, markedBy: nameOf(userNames, r.marked_by) ?? 'Someone', markedAt: r.marked_at }
    return { ...owed, contactId: r.contact_id, doneAt: r.done_at }
  })
}

/** Each line's highlights, oldest first, with who highlighted them by name. */
export function highlightsFromRows(rows: readonly MessageHighlightRow[], userNames: Readonly<Record<string, string>>): Map<string, MessageHighlight[]> {
  const out = new Map<string, MessageHighlight[]>()
  for (const r of [...rows].sort((a, b) => Date.parse(a.highlighted_at) - Date.parse(b.highlighted_at))) {
    const list = out.get(r.message_id) ?? []
    list.push({ id: r.id, messageId: r.message_id, text: r.text, by: nameOf(userNames, r.highlighted_by) ?? 'Someone', at: r.highlighted_at })
    out.set(r.message_id, list)
  }
  return out
}

/** Everything the queue reads, from the rows Follow up loaded. The portal's papers come with their own loader. */
export function followUpInputFromRows(
  rows: FollowUpRows,
  todayYmd: string,
  userNames: Readonly<Record<string, string>>,
): Omit<FollowUpInput, 'contacts' | 'messages'> & { contacts: FollowUpContact[]; messages: FollowUpLine[] } {
  const contacts = followUpContactsFromRows(rows, userNames)
  const named = contacts.map((c) => ({ id: c.id, name: c.name, goesBy: c.goesBy ?? null, kind: c.kind }))
  return {
    contacts,
    messages: followUpMessagesFromRows(rows.messages, { userNames, contacts: named }),
    heard: heardLinesFromRows(rows.heard),
    owed: owedRecordsFromRows(rows.owed, userNames),
    todayYmd,
  }
}
