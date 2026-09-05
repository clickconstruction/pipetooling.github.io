/**
 * Personal statement rounds kernel (v2.2072). Each cert week, every GC over
 * the outstanding threshold becomes a personal-email to-do for its assigned
 * sender, released only once the GC is certified. Pure derivation over the
 * GC Review rollup + certifications + round marks — the app plans and tracks,
 * a person sends. IO lives in gcStatementRoundMarks.ts; UI in GC Review and
 * the Stages money-opportunity cards.
 */

import type { GcReviewGroup } from '../gcReviewRollup'
import { gcGroupCertStatus, type GcReviewCertRow } from './gcReviewCertification'

/** Outstanding (non-collections) threshold for joining the weekly round. */
export const GC_ROUND_THRESHOLD = 10000

/** How a statement went out (v2.2761). Rows from before the column read as email. */
export type StatementSendChannel = 'email' | 'text' | 'call' | 'in_person' | 'other'

export const STATEMENT_SEND_CHANNELS: ReadonlyArray<{ value: StatementSendChannel; label: string }> = [
  { value: 'email', label: 'Email' },
  { value: 'text', label: 'Text' },
  { value: 'call', label: 'Call' },
  { value: 'in_person', label: 'In person' },
  { value: 'other', label: 'Other' },
]

export function isStatementSendChannel(v: unknown): v is StatementSendChannel {
  return typeof v === 'string' && STATEMENT_SEND_CHANNELS.some((c) => c.value === v)
}

/** Display label for a stored channel; null/unknown (pre-v2.2761 rows) read as Email. */
export function sendChannelLabel(channel: string | null | undefined): string {
  return STATEMENT_SEND_CHANNELS.find((c) => c.value === channel)?.label ?? 'Email'
}

/**
 * The account man's read of a GC after a contact (v2.2813): hot = pay date in
 * hand, warm = fine with no date, cool = dodging the date, cold = disputing or
 * upset. Required on a contacted mark, optional on a send.
 */
export type Temperature = 'hot' | 'warm' | 'cool' | 'cold'

export const TEMPERATURES: ReadonlyArray<{ value: Temperature; label: string; hint: string }> = [
  { value: 'hot', label: 'Hot', hint: 'pay date in hand' },
  { value: 'warm', label: 'Warm', hint: 'fine, no date' },
  { value: 'cool', label: 'Cool', hint: 'dodging the date' },
  { value: 'cold', label: 'Cold', hint: 'disputing or upset' },
]

export function isTemperature(v: unknown): v is Temperature {
  return typeof v === 'string' && TEMPERATURES.some((t) => t.value === v)
}

/** Cold first — the review order everywhere temperatures are listed. */
export function temperatureRank(t: Temperature | null | undefined): number {
  return t === 'cold' ? 0 : t === 'cool' ? 1 : t === 'warm' ? 2 : t === 'hot' ? 3 : 4
}

export type RoundMarkAction = 'sent' | 'skipped' | 'contacted'

export type RoundMarkRow = {
  gc_customer_id: string
  week_start: string
  /** contacted (v2.2813) = spoke with the GC, no statement — never counts as sent. */
  action: RoundMarkAction
  acted_by: string | null
  acted_by_name: string
  acted_at: string
  /** v2.2761 — null on rows written before the column existed (those were emails). */
  channel: string | null
  /** v2.2761 — optional free text from whoever marked it sent; on a contacted mark, the answer to "what's their temperature?". */
  note: string | null
  /** v2.2813 — the temperature read; required on contacted. */
  temperature: string | null
  /** v2.2813 — when they said they'd pay, YYYY-MM-DD, if they said. */
  expected_pay_by: string | null
}

/**
 * Tooltip for a sent mark: who, when, how, and the note if any. Dates are
 * formatted by the caller so the kernel stays timezone-free.
 */
export function describeRoundMark(
  mark: Pick<RoundMarkRow, 'acted_by_name' | 'channel' | 'note'> & Partial<Pick<RoundMarkRow, 'action' | 'temperature' | 'expected_pay_by'>>,
  whenLabel: string,
): string {
  const contacted = mark.action === 'contacted'
  const head = `${contacted ? 'Spoke with them' : 'Marked sent'} by ${mark.acted_by_name || '—'} · ${whenLabel} · ${sendChannelLabel(mark.channel).toLowerCase()}${
    mark.temperature ? ` · ${mark.temperature}` : ''
  }${contacted ? ' · no statement' : ''}`
  const note = mark.note?.trim()
  const pay = mark.expected_pay_by ? `\nThey said they'd pay by ${mark.expected_pay_by}` : ''
  return (note ? `${head}\n${contacted ? 'Temperature' : 'Note'}: ${note}` : head) + pay
}

export type StatementRoundState = 'needs_certify' | 'needs_sender' | 'ready' | 'sent' | 'skipped' | 'contacted'

export type StatementRoundItem = {
  gcId: string
  gcName: string
  amount: number
  jobCount: number
  /** standing assignment, falling back to the GC's Account Man; null = nobody */
  senderUserId: string | null
  state: StatementRoundState
  mark: RoundMarkRow | null
  group: GcReviewGroup
}

/**
 * Most-common Account Man per GC from the billed rows — the assignment
 * fallback when no standing sender is set on the customer.
 */
export function deriveGcAccountMen(
  rows: readonly { job: { gc_customer_id?: string | null; account_manager_user_id?: string | null } }[],
): Map<string, string> {
  const tallies = new Map<string, Map<string, number>>()
  for (const r of rows) {
    const gc = r.job.gc_customer_id
    const am = r.job.account_manager_user_id
    if (!gc || !am) continue
    const t = tallies.get(gc) ?? new Map<string, number>()
    t.set(am, (t.get(am) ?? 0) + 1)
    tallies.set(gc, t)
  }
  const out = new Map<string, string>()
  for (const [gc, t] of tallies) {
    let best: string | null = null
    let bestN = 0
    for (const [am, n] of t) {
      if (n > bestN) {
        best = am
        bestN = n
      }
    }
    if (best) out.set(gc, best)
  }
  return out
}

/**
 * Build the week's round: qualifying GC groups (real GCs only, subtotal ≥
 * threshold) with their release state. Mark wins over everything (a sent stays
 * sent even if the group later changes); an uncertified or changed-since
 * group is held; then a missing sender blocks; else it's ready to send.
 */
export function buildStatementRound(input: {
  groups: readonly GcReviewGroup[]
  certsByGc: Map<string, GcReviewCertRow>
  marks: readonly RoundMarkRow[]
  senders: ReadonlyMap<string, string>
  accountMen: ReadonlyMap<string, string>
  threshold?: number
}): StatementRoundItem[] {
  const threshold = input.threshold ?? GC_ROUND_THRESHOLD
  const markByGc = new Map(input.marks.map((m) => [m.gc_customer_id, m]))
  const items: StatementRoundItem[] = []
  for (const g of input.groups) {
    if (g.isNoGc || !g.gcId) continue
    if (g.subtotal < threshold) continue
    const senderUserId = input.senders.get(g.gcId) ?? input.accountMen.get(g.gcId) ?? null
    const mark = markByGc.get(g.gcId) ?? null
    let state: StatementRoundState
    if (mark) {
      state = mark.action
    } else if (gcGroupCertStatus(g, input.certsByGc.get(g.gcId)).state !== 'certified') {
      state = 'needs_certify'
    } else if (!senderUserId) {
      state = 'needs_sender'
    } else {
      state = 'ready'
    }
    items.push({ gcId: g.gcId, gcName: g.gcName, amount: g.subtotal, jobCount: g.jobCount, senderUserId, state, mark, group: g })
  }
  return items.sort((a, b) => b.amount - a.amount)
}

export type StatementRoundSummary = {
  /** GCs waiting on certification (the manager's card) */
  held: { count: number; total: number }
  /** the current user's certified, unsent queue (the sender's card) */
  readyForUser: StatementRoundItem[]
  /** per-sender sent/contacted/assigned counts for the panel header, assigned-only */
  senderProgress: Map<string, { sent: number; contacted: number; total: number }>
}

export function summarizeStatementRound(items: readonly StatementRoundItem[], currentUserId: string | null): StatementRoundSummary {
  let heldCount = 0
  let heldTotal = 0
  const readyForUser: StatementRoundItem[] = []
  const senderProgress = new Map<string, { sent: number; contacted: number; total: number }>()
  for (const it of items) {
    if (it.state === 'needs_certify') {
      heldCount += 1
      heldTotal += it.amount
    }
    if (it.state === 'ready' && currentUserId != null && it.senderUserId === currentUserId) readyForUser.push(it)
    if (it.senderUserId) {
      const p = senderProgress.get(it.senderUserId) ?? { sent: 0, contacted: 0, total: 0 }
      p.total += 1
      if (it.state === 'sent') p.sent += 1
      if (it.state === 'contacted') p.contacted += 1
      senderProgress.set(it.senderUserId, p)
    }
  }
  return { held: { count: heldCount, total: heldTotal }, readyForUser, senderProgress }
}

/**
 * Last-sent map with personal round marks merged in: a "Sent it" mark counts
 * exactly like an app-sent email for the pills, this-week checks, and week
 * progress. Later timestamp wins.
 */
export function mergeMarksIntoLastSent(lastSentByGcId: Record<string, string>, marks: readonly RoundMarkRow[]): Record<string, string> {
  const out = { ...lastSentByGcId }
  for (const m of marks) {
    if (m.action !== 'sent') continue
    const prev = out[m.gc_customer_id]
    if (!prev || m.acted_at > prev) out[m.gc_customer_id] = m.acted_at
  }
  return out
}

/**
 * One sender's round as their Start round walks it (v2.2792, the sender
 * card): ready first (largest amount first — the overlay's order), then held
 * (certify / sender gaps), then this week's sent and skipped marks. `sent` /
 * `assigned` feed the "0 of 2 sent" tally, assigned-only like senderProgress.
 */
export function senderRoundQueue(items: readonly StatementRoundItem[], senderUserId: string): { queue: StatementRoundItem[]; sent: number; assigned: number } {
  const mine = items.filter((it) => it.senderUserId === senderUserId)
  const rank = (s: StatementRoundState) => (s === 'ready' ? 0 : s === 'needs_certify' ? 1 : s === 'needs_sender' ? 2 : s === 'sent' ? 3 : s === 'contacted' ? 4 : 5)
  const queue = [...mine].sort((a, b) => rank(a.state) - rank(b.state) || b.amount - a.amount)
  return { queue, sent: mine.filter((it) => it.state === 'sent').length, assigned: mine.length }
}
