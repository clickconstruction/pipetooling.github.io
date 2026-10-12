/**
 * Messages, cut 10: a call, a text or an email as a line in a Pipeline job's Job activity (Jobs → Pipeline, the row's
 * activity and its full-screen window). Pure. The read hands each message with who it is with, and
 * `buildJobActivityLines` numbers them with the notes, reports and events, so a line's number never moves when the
 * reader changes buckets.
 *
 * The colors are `customer-messages-prototype.html` v0.3 (the owner, 2026-10-12): orange is the customer's. A line the
 * job's customer sent or got is the customer's side, with a deeper bar when it came from her. A team note written in
 * her thread stays plain, since in this feed a note is the usual thing. A line with anyone else tied to the job, a
 * supplier or a trade, reads plain and shows under All only.
 */
import { firstName, type ContactKind } from '../contacts/kernel'
import { messagesThreadHref } from '../gc/links'
import { threadMessageFromRow, type MessageRow } from '../messages/load'
import { callLength, type MessageChannel, type MessageDirection } from '../messages/thread'
import type { JobActivityDetailLine } from './jobActivityLine'

/** A message as Job activity reads it: the row, with who it is with. */
export interface JobActivityMessage {
  id: string
  contactId: string
  /** Who the line is with: their name, the name they go by, and what they are to us. */
  contact: { name: string; goesBy?: string | null; kind: ContactKind }
  channel: MessageChannel
  direction: MessageDirection
  at: string
  /** Who of ours sent it or wrote the note: the row's words or the user's name. '' when the app sent it. */
  who: string
  subject?: string | null
  body: string
  /** Cut 5's: a call's or a voicemail's length in seconds. */
  durationSeconds?: number | null
  /** Cut 5's: Quo's summary of a call. */
  summary?: string | null
  /** Cut 5's: a call's transcript, or a voicemail's words. */
  transcript?: string | null
  /** Tied to this job. False: a line of a person on the job, tied to no job yet. */
  tied: boolean
}

/** How a message line reads. `customerIn` came from the customer and takes the deeper bar. */
export type JobActivityMessageTone = 'customerIn' | 'customerOut' | 'plain' | 'teamNote' | 'event'

/** What a message line carries beyond the plain line, for the feed to draw. */
export interface JobActivityMessageFacts {
  id: string
  contactId: string
  tone: JobActivityMessageTone
  /** The small word after the name: "text", "email", "call · 3:12", "missed call", "note in Messages". '' on an event. */
  channelWord: string
  /** An email's subject, set in bold before its words. */
  subject: string | null
  /** A line of a person on the job, tied to no job yet. The tie is made in the thread. */
  notTiedYet: boolean
  /** The person's thread in Messages, opened at this line. */
  threadHref: string
  /** Who the thread is with, as the link names them: "Dana". */
  withName: string
}

/** The longest a line's words run before the rest folds into what opens. */
export const MESSAGE_LINE_MAX = 200

const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim()

/** The words a line shows, clipped at a word, and whether the rest folded away. */
function clipped(text: string): { shown: string; folded: boolean } {
  const flat = oneLine(text)
  if (flat.length <= MESSAGE_LINE_MAX) return { shown: flat, folded: false }
  const cut = flat.slice(0, MESSAGE_LINE_MAX)
  const atWord = cut.lastIndexOf(' ')
  return { shown: `${(atWord > MESSAGE_LINE_MAX / 2 ? cut.slice(0, atWord) : cut).trimEnd()}…`, folded: true }
}

/** Orange is the customer's: her lines in and ours to her. A team note, an event and anyone else's line are not. */
export function messageTone(m: Pick<JobActivityMessage, 'channel' | 'direction' | 'contact'>): JobActivityMessageTone {
  if (m.channel === 'note') return 'teamNote'
  if (m.channel === 'event') return 'event'
  if (m.contact.kind !== 'customer') return 'plain'
  return m.direction === 'in' ? 'customerIn' : 'customerOut'
}

/** The customer's side: what the Customer filter shows and counts. */
export function isCustomerSide(tone: JobActivityMessageTone): boolean {
  return tone === 'customerIn' || tone === 'customerOut'
}

/** The small word after the name, with a call's or a voicemail's length when Quo gave one. */
export function messageChannelWord(m: Pick<JobActivityMessage, 'channel' | 'durationSeconds'>): string {
  const length = m.durationSeconds != null && m.durationSeconds > 0 ? ` · ${callLength(m.durationSeconds)}` : ''
  switch (m.channel) {
    case 'call':
      return `call${length}`
    case 'voicemail':
      return `voicemail${length}`
    case 'missed':
      return 'missed call'
    case 'note':
      return 'note in Messages'
    case 'event':
      return ''
    default:
      return m.channel
  }
}

/** The name column: the person on a line from them, ours on a line we sent, the app on one it sent by itself. */
export function messageWho(m: Pick<JobActivityMessage, 'direction' | 'who' | 'contact'>): string {
  if (m.direction === 'in') return firstName(m.contact) || m.contact.name.trim() || 'They'
  if (m.direction === 'out') return m.who.trim() || 'the app'
  return m.who.trim() || 'Unknown'
}

/** The words a line shows, and what opens under it. */
function wordsOf(m: JobActivityMessage): { body: string; detail: JobActivityDetailLine[] } {
  const summary = m.summary?.trim() ?? ''
  const transcript = m.transcript?.trim() ?? ''
  if (m.channel === 'missed') return { body: 'No voicemail.', detail: [] }
  if (m.channel === 'call') {
    const lead = clipped(summary || m.body)
    const detail: JobActivityDetailLine[] = []
    if (summary && (lead.folded || summary.includes('\n'))) detail.push({ label: 'Summary', value: summary })
    else if (!summary && lead.folded) detail.push({ value: m.body.trim() })
    if (transcript) detail.push({ label: 'Transcript', value: transcript })
    return { body: lead.shown, detail }
  }
  if (m.channel === 'voicemail') {
    if (!transcript) return { body: oneLine(m.body) || 'Left a voicemail.', detail: [] }
    const lead = clipped(transcript)
    return { body: lead.shown, detail: lead.folded ? [{ label: 'Their words', value: transcript }] : [] }
  }
  const lead = clipped(m.body)
  return { body: lead.shown, detail: lead.folded ? [{ value: m.body.trim() }] : [] }
}

/** A message's who, words, opened detail and facts. `buildJobActivityLines` adds the number and the time. */
export function messageLineParts(m: JobActivityMessage): { who: string; body: string; detail: JobActivityDetailLine[]; message: JobActivityMessageFacts } {
  const { body, detail } = wordsOf(m)
  return {
    who: messageWho(m),
    body,
    detail,
    message: {
      id: m.id,
      contactId: m.contactId,
      tone: messageTone(m),
      channelWord: messageChannelWord(m),
      subject: m.channel === 'email' ? m.subject?.trim() || null : null,
      notTiedYet: !m.tied,
      threadHref: messagesThreadHref(m.contactId, m.id),
      withName: firstName(m.contact) || m.contact.name.trim() || 'them',
    },
  }
}

// ---------- the read's rows (J2) ----------

/** A `messages` row as Job activity reads it: the spine's columns, and cut 5's call columns. */
export type JobMessageRow = MessageRow & { summary?: string | null; transcript?: string | null }

/** The person a line is with, as the read hands them over. */
export interface JobMessageContact {
  id: string
  name: string
  goesBy?: string | null
  kind: ContactKind
}

/** A job takes the customer's lines tied to no job yet while it is open: until it is paid. */
export function jobTakesUntiedLines(status: string | null | undefined): boolean {
  return status !== 'paid'
}

/**
 * The lines Job activity shows for one Pipeline job: every line tied to it, and the lines tied to no job yet of the
 * customer's people put on it, since the job began. A trade's or a supplier's untied line stays with them, and a team
 * note tied to nothing is about the person, not the job. A row whose person the read did not bring, or whose channel
 * this build does not know, is left out. Oldest first.
 */
export function jobActivityMessagesFromRows(
  rows: readonly JobMessageRow[],
  contacts: readonly JobMessageContact[],
  userNames: Readonly<Record<string, string>>,
  job: { id: string; since: string | null },
): JobActivityMessage[] {
  const byId = new Map(contacts.map((c) => [c.id, c]))
  const since = job.since ? Date.parse(job.since) : Number.NaN
  const seen = new Set<string>()
  const out: JobActivityMessage[] = []
  for (const row of rows) {
    const contact = byId.get(row.contact_id)
    if (!contact || seen.has(row.id)) continue
    const tied = row.jobs_ledger_id === job.id
    if (!tied) {
      const onNoJob = !row.bid_id && !row.project_id && !row.jobs_ledger_id
      const afterStart = Number.isNaN(since) || Date.parse(row.at) >= since
      if (!onNoJob || contact.kind !== 'customer' || row.direction === 'team' || !afterStart) continue
    }
    const m = threadMessageFromRow(row, { userNames, contacts: [{ ...contact, goesBy: contact.goesBy ?? null }] })
    if (!m) continue
    seen.add(row.id)
    out.push({
      id: m.id,
      contactId: m.contactId,
      contact: { name: contact.name, goesBy: contact.goesBy ?? null, kind: contact.kind },
      channel: m.channel,
      direction: m.direction,
      at: m.at,
      who: m.who,
      subject: m.subject ?? null,
      body: m.body,
      durationSeconds: m.durationSeconds ?? null,
      summary: row.summary ?? null,
      transcript: row.transcript ?? null,
      tied,
    })
  }
  return out.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
}
