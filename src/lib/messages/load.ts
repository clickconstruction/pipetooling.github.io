/**
 * Messages, cut 1 (the spine): the thread as the screens load it. Pure mappers from the rows `messages` holds
 * (migration 20261012010000_messages_spine.sql) to `ThreadMessage`, and the one key a line, a rail and a star name a job
 * by. No client here: the hooks that fetch the rows come with the screens (wave 2). The row types are written out until
 * the generated types carry the tables; then they become `Tables<'messages'>`.
 */
import type { Tables } from '../../types/database'
import { firstName, type Contact } from '../contacts/kernel'
import type { MessageChannel, MessageDirection, ThreadMessage } from './thread'
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
  }
}

/** The rows as the thread reads them, oldest first; a row this build does not know is left out. */
export function threadMessagesFromRows(rows: readonly MessageRow[], ctx: MessageLoadContext = {}): ThreadMessage[] {
  return rows
    .map((r) => threadMessageFromRow(r, ctx))
    .filter((m): m is ThreadMessage => m !== null)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
}
