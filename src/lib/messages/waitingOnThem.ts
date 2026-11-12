/**
 * Waiting on them (v2.5704, punch list #139 PR 12, the second of the six additions): the lane on `/messages` for the
 * people who went quiet after our send — every thread where our line is the last word, `WAIT_DAYS` or more ago,
 * longest quiet first. Needs a reply is who waits on us; the thread's header already says *Their move · 10 h* per
 * person; nothing listed them. Each row offers the nudge and the call. Since punch list #140 PR 4 the nudge opens the
 * thread with the step's reminder written and the send window open (`nudgeDraft.ts`), and a last text Quo could not
 * deliver draws the row red with the call and the same words as an email, since they never read it.
 *
 * Their word is more than a line in (v2.6500, Taunya's report of 2026-11-03: Evan accepted his estimate and his row
 * stayed; she confirmed Heron's by text from her own phone and had no press): the thread's event line for an estimate
 * accepted or declined through our link (`estimate:<id>:accepted|declined`, `_shared/estimateEventLine.ts`; an open
 * is not an answer), a call the office logged with what they said (`log_call`'s line, `callLog.ts`), and the row's
 * **Heard back ▾**, a gray line in the app's own words (`heardBackBody`, read back by `heardBackOf`) through the same
 * `follow_up_event` the thread's menu writes the customer's say with. Pure; the read and the write are
 * `waitingOnThemIo.ts`, the section `components/messages/WaitingOnThem.tsx`.
 */
import type { ContactKind } from '../contacts/kernel'
import { unnamedOnLine } from '../contacts/names'
import { clockDay } from '../tellCustomer/tellCustomer'
import { isLoggedCall } from './callLog'
import { inPill, type KindPill } from './kindPills'
import { deliveryMark, type DeliveryMark, type MessageChannel, type QuoDeliveryWord } from './thread'

/** How long our last word stands unanswered before the person is waiting on us to notice. */
export const WAIT_DAYS = 2
const DAY_MS = 86_400_000

/**
 * One line as the io reads it: a text, an email or a call, theirs or ours — or, since v2.6500, one of the thread's
 * event lines (`direction 'event'`), which counts only when it is their answer (`theirWord`).
 */
export interface WaitLine {
  id: string
  contactId: string
  name: string | null
  customerName?: string | null
  kind: ContactKind | null
  direction: 'in' | 'out' | 'event'
  body: string
  atMs: number
  /** The number our line went to, for the call. */
  number?: string | null
  /** How the line went (#140 PR 4): a text of ours carries Quo's delivery answer. */
  channel?: MessageChannel | null
  delivery?: QuoDeliveryWord | null
  /** An event line's key (`messages.quo_id`): the estimate's `estimate:<id>:opened|accepted|declined`. */
  key?: string | null
  /**
   * The mail was filed for the record (`messages.history`, v2.7027). A filed mail of ours makes nobody quiet, so the
   * lane skips it. A filed mail of theirs is still their answer to what we wrote before it.
   */
  history?: boolean
}

export interface WaitingRow {
  contactId: string
  name: string
  /** Whole days since our last word. */
  days: number
  /** "Their move · 6 d" */
  chip: string
  /** Our last line's first words. */
  words: string
  /** The day our last word went: "Mon, Oct 19". */
  when: string
  /** The number our line went to, for the call; null for none. */
  number: string | null
  kind: ContactKind | null
  atMs: number
  /** Our last text did not reach them (#140 PR 4): the row says so and offers the call and the email in the nudge's place. */
  mark: DeliveryMark | null
}

const WORDS_MAX = 110

/** The estimate's answer an event line's key names: accepted or declined through our link. An open is no answer. */
export function estimateAnswerOf(key: string | null | undefined): 'accepted' | 'declined' | null {
  const m = /^estimate:[^:]+:(accepted|declined)$/.exec(key ?? '')
  return m ? (m[1] as 'accepted' | 'declined') : null
}

/**
 * Whether a line is their word: a line in; the estimate accepted or declined through our link; a call the office
 * logged with what they said; the office's Heard back. Null for a line that is neither theirs nor ours (an estimate
 * opened, any other event), which the lane does not count.
 */
export function theirWord(line: Pick<WaitLine, 'direction' | 'channel' | 'body' | 'key'>): boolean | null {
  if (line.direction === 'in') return true
  if (line.direction === 'event') return estimateAnswerOf(line.key) !== null || heardBackOf(line.body) !== null ? true : null
  return line.channel === 'call' && isLoggedCall(line.body)
}

/** The rows under a pill, longest quiet first: each person whose newest line is ours and `WAIT_DAYS` old or more. */
export function waitingOnThem(lines: readonly WaitLine[], pill: KindPill, now: Date = new Date()): WaitingRow[] {
  const newest = new Map<string, { line: WaitLine; theirs: boolean }>()
  for (const l of lines) {
    if (l.history && l.direction === 'out') continue
    const theirs = theirWord(l)
    if (theirs === null) continue
    const have = newest.get(l.contactId)
    if (!have || l.atMs > have.line.atMs) newest.set(l.contactId, { line: l, theirs })
  }
  const cutoff = now.getTime() - WAIT_DAYS * DAY_MS
  const rows: WaitingRow[] = []
  for (const { line: l, theirs } of newest.values()) {
    if (theirs || l.atMs > cutoff) continue
    if (!(pill === 'all' || (l.kind !== null && inPill(l.kind, pill)))) continue
    const days = Math.floor((now.getTime() - l.atMs) / DAY_MS)
    const firstLine = l.body.split('\n')[0]?.trim() ?? ''
    rows.push({
      contactId: l.contactId,
      name: l.name?.trim() || l.customerName?.trim() || unnamedOnLine(l.channel),
      days,
      chip: `Their move · ${days} d`,
      words: firstLine.length > WORDS_MAX ? `${firstLine.slice(0, WORDS_MAX).trimEnd()}…` : firstLine,
      when: clockDay(l.atMs),
      number: l.number?.trim() || null,
      kind: l.kind ?? null,
      atMs: l.atMs,
      mark: l.channel === 'text' ? deliveryMark({ direction: 'out', channel: 'text', delivery: l.delivery ?? null }) : null,
    })
  }
  return rows.sort((a, b) => a.atMs - b.atMs)
}

// ---------- Heard back (v2.6500) ----------

/** How the office heard back outside the app, or that no answer is needed. */
export type HeardHow = 'phone' | 'text' | 'person' | 'none'

/** The menu's rows, in order. */
export const HEARD_ROWS: ReadonlyArray<{ how: HeardHow; label: string }> = [
  { how: 'phone', label: 'By phone' },
  { how: 'text', label: 'By text from my phone' },
  { how: 'person', label: 'In person' },
  { how: 'none', label: 'No answer needed' },
]

const HEARD_WAY: Record<Exclude<HeardHow, 'none'>, string> = { phone: 'by phone', text: 'by text on their own phone', person: 'in person' }

/** The gray line's words: "Taunya heard back by phone on Nov 3." or "Taunya said on Nov 3 that no answer is needed." */
export function heardBackBody(name: string, how: HeardHow, dayWords: string): string {
  const who = name.trim() || 'Someone'
  return how === 'none' ? `${who} said on ${dayWords} that no answer is needed.` : `${who} heard back ${HEARD_WAY[how]} on ${dayWords}.`
}

const HEARD_LINE = /^.+ heard back (by phone|by text on their own phone|in person) on .+\.$/
const NONE_LINE = /^.+ said on .+ that no answer is needed\.$/

/** The way a Heard back line names, or null for any other line. */
export function heardBackOf(body: string): HeardHow | null {
  const m = HEARD_LINE.exec(body.trim())
  if (m) return m[1] === 'by phone' ? 'phone' : m[1] === 'in person' ? 'person' : 'text'
  return NONE_LINE.test(body.trim()) ? 'none' : null
}

/** The time the row stays undoable before the line is written. */
export const HEARD_UNDO_MS = 10_000

export const HEARD_WORDS = {
  press: 'Heard back',
  tip: 'They answered another way. Say how, and the row clears.',
  /** The toast with Undo, while the ten seconds run. */
  toast: (how: HeardHow, name: string) =>
    how === 'none' ? `No answer needed from ${name}. The line lands on the thread in ten seconds.` : `Heard back from ${name} ${HEARD_WAY[how]}. The line lands on the thread in ten seconds.`,
  undo: 'Undo',
  undone: (name: string) => `Undone. ${name} is back in Waiting on them.`,
}

export const WAITING_WORDS = {
  title: (n: number) => `Waiting on them (${n})`,
  note: `Our line is the last word, ${WAIT_DAYS} days or more. Longest quiet first. A reply from them clears the row. So does their answer on an estimate, a logged call with their words, or Heard back.`,
  empty: 'Nobody has gone quiet on us.',
  problem: 'Who went quiet could not be read.',
  nudge: 'Nudge',
  nudgeTip: 'Opens the thread with the reminder for their step written and the send window open.',
  call: 'Call',
  /** A failed text's row (#140 PR 4): the call first, then the same words as an email. */
  callThem: 'Call them',
  asEmail: 'Send it as an email',
  asEmailTip: 'Opens the thread with the same reminder written as an email and the send window open.',
}
