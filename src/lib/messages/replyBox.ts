/**
 * Messages, cut 3's screens: the reply box's own small rules, which `ReplyBox` and the send window read. The words of
 * the box are `compose.ts`'s; these say which job a reply lands on and what the thread already says about a number.
 * Pure.
 */
import { letterheadFor, type MessagesEmailColumn } from '../../../supabase/functions/_shared/messagesEmail'
import { fromNumberFor, mailboxFor, NO_BOX_FALLBACK, type BoxSettings, type Mailbox } from './boxes'
import type { ComposeCompany } from './compose'
import type { JobTile } from './jobTiles'
import { jobRefOf } from './load'
import type { ThreadMessage } from './thread'

/**
 * A reply's tie as the person chose it: a job's key, or null for on the person with no job. Undefined until they
 * choose, so it follows the thread.
 */
export type ReplyTie = string | null | undefined

/**
 * The job a reply lands on: the one chosen, else the job the thread shows, else the person's star, else none. The
 * prototype started from the star alone, so a reply written in a thread narrowed to one job left that view the moment
 * it went; it starts on the job in view now, and the star covers the rest.
 */
export function replyJob(tie: ReplyTie, jobFilter: string | null, defaultJobId: string | null): string | null {
  if (tie !== undefined) return tie
  return jobFilter ?? defaultJobId
}

/** The tie as `messages-email` and `quo-send` take it: the job's id and the `messages` column it goes in. Null: on the person. */
export function tieOf(jobKey: string | null): { jobId: string; column: MessagesEmailColumn } | null {
  const ref = jobRefOf(jobKey)
  if (!ref) return null
  return { jobId: ref.id, column: ref.kind === 'bid' ? 'bid_id' : ref.kind === 'project' ? 'project_id' : 'jobs_ledger_id' }
}

/** Where a reply goes from (R6): the two boxes as Settings keeps them, who the person is, and the box they last wrote to. */
export interface ReplyFrom {
  settings: BoxSettings | null
  kind: string
  wroteTo: Mailbox | null
}

/**
 * Our company as the box and the send window name it for the job a reply is tied to: the letterhead `messages-email`
 * sends under (`letterheadFor`, one rule for both). With `from`, the number and the address are the chosen box's, the
 * one they wrote to on a reply and their kind's box otherwise (`mailboxFor`, `fromNumberFor`). Without it, or while
 * Settings leaves a field empty, both stay blank and the words leave them out. The reply box passes `from` only once the
 * sends go from the boxes (`SENDS_FROM_BOXES`): until then an email goes from the app's own sending address.
 */
export function replyCompany(jobKey: string | null, from: ReplyFrom | null = null): ComposeCompany {
  const name = letterheadFor(tieOf(jobKey)?.column ?? null)
  if (!from) return { name, phone: '', mailbox: '', address: '' }
  return {
    name,
    phone: fromNumberFor(from.kind, from.settings, NO_BOX_FALLBACK, from.wroteTo).phone,
    mailbox: mailboxFor(from.kind, from.settings, NO_BOX_FALLBACK, from.wroteTo),
    address: '',
  }
}

/** The *Tie to* press: the job in words, and why it is that job when nobody chose it. */
export interface TieWords {
  job: string
  aside: string | null
}

export function tieWords(tie: ReplyTie, jobFilter: string | null, defaultJobId: string | null, tiles: Readonly<Record<string, JobTile>>): TieWords {
  const key = replyJob(tie, jobFilter, defaultJobId)
  if (!key) return { job: tie === null ? 'no job' : 'the person alone', aside: null }
  const tile = tiles[key]
  const job = tile ? `${tile.num} ${tile.name}` : 'a job not loaded'
  if (tie !== undefined) return { job, aside: null }
  return { job, aside: key === jobFilter ? 'in view' : 'default' }
}

/** The hover card on *Tie to*, the prototype's words. */
export const TIE_TIP = {
  title: 'Tie to',
  does: 'Which job this message lands on.',
  changes: "The job's page shows only what is tied to it. The person's thread shows everything. New messages from them go to the ★ default.",
} as const

const timeOf = (m: Pick<ThreadMessage, 'at'>): number => {
  const t = Date.parse(m.at)
  return Number.isNaN(t) ? 0 : t
}

/**
 * When our last text to this number went, in milliseconds, or null when we never texted it. The opt-out rules read it
 * (`compose.optoutReason`), and so does `quo-send` on its side, by the same `contact_channels` row, so the window shows
 * the line the send will carry. A text held back without the line still counts: it was a text from us.
 */
export function lastOurTextAt(lines: readonly ThreadMessage[], channelId: string | null): number | null {
  if (!channelId) return null
  let last: number | null = null
  for (const m of lines) {
    if (m.channel !== 'text' || m.direction !== 'out' || m.channelId !== channelId) continue
    const t = Date.parse(m.at)
    if (!Number.isNaN(t) && (last === null || t > last)) last = t
  }
  return last
}

/** Their newest line to us, on any channel: the last message *Find a reply* puts on top. Null when they never wrote. */
export function lastFromThem(lines: readonly ThreadMessage[]): ThreadMessage | null {
  let last: ThreadMessage | null = null
  for (const m of lines) if (m.direction === 'in' && (!last || timeOf(m) > timeOf(last))) last = m
  return last
}

/** The texts already on their phone from this number, the last `count`, oldest first: the send window's phone draws them above the new one. */
export function priorTexts(lines: readonly ThreadMessage[], channelId: string | null, count = 2): ThreadMessage[] {
  if (!channelId || count <= 0) return []
  return lines
    .filter((m) => m.channel === 'text' && m.channelId === channelId && (m.direction === 'in' || m.direction === 'out'))
    .sort((a, b) => timeOf(a) - timeOf(b))
    .slice(-count)
}
