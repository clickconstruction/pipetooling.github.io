/**
 * Messages, cut 1 (the spine): the thread as the screens load it. Pure mappers from the rows `messages` holds
 * (migration 20261012010000_messages_spine.sql) to `ThreadMessage`, and the one key a line, a rail and a star name a job
 * by. No client here: the hooks that fetch the rows come with the screens (wave 2). The row types are written out until
 * the generated types carry the tables; then they become `Tables<'messages'>`.
 */
import type { Tables } from '../../types/database'
import { firstName, type Contact } from '../contacts/kernel'
import { deliveryOf, type MessageChannel, type MessageDirection, type ThreadMessage } from './thread'
import { jobKeyOfRow } from './jobKeys'

// ---------- a job, as one key ----------

// The key lives in `jobKeys.ts`, light enough for the edge copy (R5's push). It is this file's too.
export { jobKey, jobKeyOfRow, jobRefOf, type JobKind, type JobRef } from './jobKeys'

// ---------- a line ----------

/** A `messages` row as the client reads it. */
export type MessageRow = Pick<
  Tables<'messages'>,
  | 'id'
  | 'contact_id'
  | 'channel_id'
  | 'bid_id'
  | 'project_id'
  | 'jobs_ledger_id'
  | 'channel'
  | 'direction'
  | 'who_user_id'
  | 'who_text'
  | 'at'
  | 'subject'
  | 'body'
  | 'optout_line'
  | 'back_on'
  | 'back_by'
> & {
  /** Cut 5's column (Quo's length of a call). Absent until its migration. */
  duration_seconds?: number | null
  /** R6's column: the box the line came in on or went out from. Optional until the types regenerate. */
  mailbox?: string | null
  /** Quo's delivery answer on a text of ours (v2.5703). Optional: a read that leaves it out draws no mark. */
  delivery?: string | null
  /** The app's own line (v2.6012, the text back after a missed call). Optional until the types regenerate; absent reads false. */
  auto?: boolean | null
  /** What the reader read from an invitation to bid (v2.6222), for the email viewer's row (v2.6509). Optional: a read may leave it out. */
  invitation?: unknown
  /** The teammate this text introduced (v2.5590, the bio after a first On my way). Optional: a read may leave it out. */
  introduces_user_id?: string | null
  /** Where the reader kept the email's HTML part (v2.6675, punch list #259). Optional until the types regenerate; a read may leave it out. */
  body_html_path?: string | null
  /** The app placed the line from a person's Sent (v2.6751, punch list #263). Optional until the types regenerate; absent reads false. */
  placed_by_app?: boolean | null
  /** Whose own box a tagged line came from (v2.6266). Optional: a read may leave it out. */
  mail_user_id?: string | null
  /** Gmail's id of the line's conversation. Optional: a read may leave it out. */
  gmail_thread_id?: string | null
  /** The mail was filed for the record (v2.7027, punch list #324). Optional until the types regenerate; absent reads false. */
  history?: boolean | null
  /** When the line landed, for the filed mark's day. Optional: a read may leave it out. */
  created_at?: string | null
}

export interface MessageLoadContext {
  /** Users' names by id, for a line's who and a note's back_by. */
  userNames?: Readonly<Record<string, string>>
  /** The contacts, so a line from them with no who of its own reads their name. */
  contacts?: readonly Pick<Contact, 'id' | 'name' | 'goesBy' | 'kind'>[]
}

const CHANNELS: ReadonlySet<string> = new Set<MessageChannel>(['call', 'voicemail', 'missed', 'text', 'email', 'note', 'event', 'portal'])
const DIRECTIONS: ReadonlySet<string> = new Set<MessageDirection>(['in', 'out', 'team'])
const OPTOUT_LINES: ReadonlySet<string> = new Set(['first', 'silence', 'held'])
const MAILBOXES: ReadonlySet<string> = new Set(['team', 'bids'])

/**
 * A row as the thread reads it. Its who is the row's own words, else the user's name, else, on a line from them, what we
 * call them (an unknown number's number). Null for a channel or a direction this build does not know, so a newer row
 * never draws wrong.
 */
export function threadMessageFromRow(row: MessageRow, ctx: MessageLoadContext = {}): ThreadMessage | null {
  if (!CHANNELS.has(row.channel) || !DIRECTIONS.has(row.direction)) return null
  const userName = (id: string | null) => (id ? (ctx.userNames?.[id] ?? '') : '')
  let who = row.who_text.trim() || userName(row.who_user_id)
  if (!who && row.direction === 'in') {
    const c = ctx.contacts?.find((x) => x.id === row.contact_id)
    who = c ? firstName(c) || c.name : ''
  }
  return {
    id: row.id,
    contactId: row.contact_id,
    jobId: jobKeyOfRow(row),
    channel: row.channel as MessageChannel,
    direction: row.direction as MessageDirection,
    at: row.at,
    who,
    subject: row.subject,
    body: row.body,
    channelId: row.channel_id,
    durationSeconds: row.duration_seconds ?? null,
    optoutLine: row.optout_line && OPTOUT_LINES.has(row.optout_line) ? (row.optout_line as ThreadMessage['optoutLine']) : null,
    backOn: row.back_on,
    backBy: row.back_by ? userName(row.back_by) || null : null,
    mailbox: row.mailbox && MAILBOXES.has(row.mailbox) ? (row.mailbox as ThreadMessage['mailbox']) : null,
    delivery: deliveryOf(row.delivery),
    auto: row.auto === true,
    invitation: row.invitation ?? null,
    introducesUserId: row.introduces_user_id ?? null,
    bodyHtmlPath: row.body_html_path ?? null,
    placedByApp: row.placed_by_app === true,
    mailUserId: row.mail_user_id ?? null,
    gmailThreadId: row.gmail_thread_id ?? null,
    history: row.history === true,
    landedAt: row.created_at ?? null,
  }
}

/** The rows as the thread reads them, oldest first; a row this build does not know is left out. */
export function threadMessagesFromRows(rows: readonly MessageRow[], ctx: MessageLoadContext = {}): ThreadMessage[] {
  return rows
    .map((r) => threadMessageFromRow(r, ctx))
    .filter((m): m is ThreadMessage => m !== null)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
}
