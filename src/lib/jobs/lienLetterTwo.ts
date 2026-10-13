import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { daysBetweenYmd } from './billedExpectedPay'
import type { LienDeskItemRow } from './lienDesk'
import { parseLienNoticeSentFacts } from './lienNoticeDraft'

/**
 * Letter two (pure kernel, v2.3760 — punch list #33 PR 2, counsel's memo of
 * 2026-09-22): the second owner letter, 10–14 days after the first packet,
 * when the GC has neither paid nor authorized a direct payment. Two letters
 * to pick from — the *paid-out* letter (three questions and the 10 percent,
 * for an owner we believe has paid the GC out) and the *unresponsive* one —
 * on the same § 53.056 form, to the same two recipients, through the same
 * run. It is a second desk item on the job whose draft carries `letterTwo`;
 * the first packet's item keeps the GC's written okay (`gcAuthorizedDirectPay`).
 *
 * Day 0 (the Docsmit train, PR 1, D9): the day the run recorded the packet,
 * unless a mail piece on it knows better — then the later of the day USPS
 * accepted it and the day it was delivered, and the status says which. A
 * piece that came back or sat unclaimed keeps the mailing clock and says why.
 *
 * The clock is read from the job's desk items and its open balance: nothing
 * to send once the GC has paid, once the GC authorized the owner to pay us,
 * or once the owner called (PR 3's fact); *due* from day 10, *overdue* from
 * day 14; *in flight* while a letter-two draft is on the desk; *sent* once
 * the run recorded it.
 */

export const LETTER_TWO_FROM_DAY = 10
export const LETTER_TWO_BY_DAY = 14

export type LetterTwoKind = 'paid_out' | 'unresponsive'

export const LETTER_TWO_KINDS: ReadonlyArray<{ key: LetterTwoKind; label: string; hint: string }> = [
  { key: 'paid_out', label: 'We believe the owner paid the GC out', hint: 'three questions, the 10 percent, the affidavit date' },
  { key: 'unresponsive', label: 'The GC is not answering', hint: 'the unresponsive letter — stop the next payment, three ways to end it' },
]

export function letterTwoKindLabel(kind: LetterTwoKind): string {
  return kind === 'paid_out' ? 'paid-out' : 'unresponsive'
}

export type LetterTwoState = 'none' | 'waiting' | 'due' | 'overdue' | 'paid' | 'gc_authorized' | 'owner_called' | 'in_flight' | 'sent'

/** What the first packet's mail piece knows, when one carried it: the owner's copy, keyed by the first item's id. */
export type LetterTwoMailClock = { mailedAt: string | null; deliveredAt: string | null; status?: string | null }

/** Which day the clock counts from, and why, in words the row and the footer can show. */
export type LetterTwoClock = { kind: 'recorded' | 'mailed' | 'delivered'; at: string; why: string }

export type LetterTwoStatus = {
  state: LetterTwoState
  /** Whole days since day 0; null when nothing has gone out. */
  day: number | null
  /** Day 0 and its reason; null when nothing has gone out. */
  clock: LetterTwoClock | null
  /** The first packet's sent item (the latest sent notice that is not itself a letter two). */
  firstItemId: string | null
  firstSentAt: string | null
  /** The letter-two item on the job, live or sent, when there is one. */
  letterTwo: { itemId: string; kind: LetterTwoKind; status: string; sentAt: string | null } | null
  gcAuthorized: { at: string; name: string; note: string } | null
  /** One wording for the row chip and the footer. */
  words: string
}

/** What the item's draft the clock reads: the desk's full rows, or the portal's items shaped down to the sent-notice facts (#41 PR 1b). */
export type LetterTwoItemLike = Pick<LienDeskItemRow, 'id' | 'job_id' | 'kind' | 'status' | 'sent_at' | 'fields' | 'created_at' | 'voided_at'>

export const LETTER_TWO_NONE: LetterTwoStatus = { state: 'none', day: null, clock: null, firstItemId: null, firstSentAt: null, letterTwo: null, gcAuthorized: null, words: '' }

/**
 * Where letter two stands on one job. `items` is every notice item on the job
 * (any status); `openBalance` is the job's, not the desk row's — a sent-only
 * entry has no row and would read as paid.
 */
export function letterTwoClock(recordedAt: string, piece: LetterTwoMailClock | null | undefined, fmt: (ymd: string) => string): LetterTwoClock {
  const day = (iso: string) => fmt(calendarYmdInAppTzFromIso(iso))
  if (piece?.deliveredAt) {
    const at = piece.deliveredAt > recordedAt ? piece.deliveredAt : recordedAt
    return { kind: 'delivered', at, why: `from the day it was delivered, ${day(at)}` }
  }
  if (piece?.mailedAt) {
    const at = piece.mailedAt > recordedAt ? piece.mailedAt : recordedAt
    const status = (piece.status ?? '').toLowerCase()
    const tail = status === 'returned' ? '; the piece came back' : status === 'notice_left' ? '; nobody has claimed it yet' : ''
    return { kind: 'mailed', at, why: `from the day USPS accepted it, ${day(at)}${tail}` }
  }
  return { kind: 'recorded', at: recordedAt, why: `from the day the run recorded it, ${day(recordedAt)}` }
}

function clockTag(c: LetterTwoClock): string {
  if (c.kind === 'delivered') return ' · from delivery'
  if (c.kind === 'mailed') return c.why.includes('came back') ? ' · from the mailing, returned' : c.why.includes('claimed') ? ' · from the mailing, unclaimed' : ' · from the mailing'
  return ''
}

export function letterTwoStatus(input: { items: ReadonlyArray<LetterTwoItemLike>; openBalance: number; todayYmd: string; ownerCalledAt?: string | null; formatDay?: (ymd: string) => string; mailClocks?: Readonly<Record<string, LetterTwoMailClock>> }): LetterTwoStatus {
  const fmt = input.formatDay ?? ((d) => d)
  const mine = input.items.filter((i) => i.kind === 'notice_53_056' && !i.voided_at)
  const parsed = mine.map((i) => ({ item: i, draft: parseLienNoticeSentFacts(i.fields) }))
  const first = parsed
    .filter((p) => p.item.status === 'sent' && p.item.sent_at && !p.draft?.letterTwo)
    .sort((a, b) => ((a.item.sent_at ?? '') < (b.item.sent_at ?? '') ? 1 : -1))[0]
  if (!first) return LETTER_TWO_NONE
  const firstSentAt = first.item.sent_at as string
  const two = parsed
    .filter((p) => p.draft?.letterTwo && p.item.status !== 'missed' && p.item.created_at >= first.item.created_at)
    .sort((a, b) => (a.item.created_at < b.item.created_at ? 1 : -1))[0]
  const gcAuthorized = first.draft?.gcAuthorizedDirectPay ?? null
  // The owner's call (v2.3767) rides on the first packet too; a caller may still pass it.
  const ownerCalledAt = input.ownerCalledAt ?? first.draft?.ownerCall?.at ?? null
  const clock = letterTwoClock(firstSentAt, input.mailClocks?.[first.item.id], fmt)
  const day = daysBetweenYmd(calendarYmdInAppTzFromIso(clock.at), input.todayYmd) ?? 0
  const tag = clockTag(clock)
  const base = { day, clock, firstItemId: first.item.id, firstSentAt, gcAuthorized, letterTwo: two ? { itemId: two.item.id, kind: two.draft!.letterTwo!.kind, status: two.item.status, sentAt: two.item.sent_at } : null }
  if (two) {
    if (two.item.status === 'sent') return { ...base, state: 'sent', words: `letter two sent ${two.item.sent_at ? fmt(calendarYmdInAppTzFromIso(two.item.sent_at)) : ''} · ${letterTwoKindLabel(two.draft!.letterTwo!.kind)}` }
    return { ...base, state: 'in_flight', words: `letter two · ${letterTwoKindLabel(two.draft!.letterTwo!.kind)} · ${two.item.status === 'awaiting_approval' ? 'awaiting the leader' : two.item.status === 'approved' ? 'in the run' : two.item.status === 'held' ? 'held' : 'drafting'}` }
  }
  if (input.openBalance <= 0.005) return { ...base, state: 'paid', words: 'paid' }
  if (gcAuthorized) return { ...base, state: 'gc_authorized', words: `GC authorized direct pay ${fmt(calendarYmdInAppTzFromIso(gcAuthorized.at))}` }
  if (ownerCalledAt) return { ...base, state: 'owner_called', words: `owner called ${fmt(calendarYmdInAppTzFromIso(ownerCalledAt))}` }
  if (day >= LETTER_TWO_BY_DAY) return { ...base, state: 'overdue', words: `day ${day} · letter two overdue${tag}` }
  if (day >= LETTER_TWO_FROM_DAY) return { ...base, state: 'due', words: `day ${day} · letter two${tag}` }
  return { ...base, state: 'waiting', words: `day ${day}${tag}` }
}

/** The states the office acts on — the Needs-you count and the amber/red row chip. */
export function letterTwoIsDue(s: Pick<LetterTwoStatus, 'state'>): boolean {
  return s.state === 'due' || s.state === 'overdue'
}

export type LetterTwoNeedsYou = { due: number; overdue: number; jobIds: string[] }

export function summarizeLetterTwo(byJob: Readonly<Record<string, LetterTwoStatus>>): LetterTwoNeedsYou {
  const due = Object.entries(byJob).filter(([, s]) => letterTwoIsDue(s))
  return { due: due.length, overdue: due.filter(([, s]) => s.state === 'overdue').length, jobIds: due.map(([id]) => id) }
}

/** Every job's letter-two status from the desk's notice items and the jobs' balances — both hooks build it the same way. */
export function letterTwoByJobFrom(items: ReadonlyArray<LetterTwoItemLike>, openBalanceOf: (jobId: string) => number, todayYmd: string, formatDay?: (ymd: string) => string, mailClocks?: Readonly<Record<string, LetterTwoMailClock>>): Record<string, LetterTwoStatus> {
  const byJob = new Map<string, LetterTwoItemLike[]>()
  for (const it of items) {
    if (it.kind !== 'notice_53_056') continue
    const list = byJob.get(it.job_id) ?? []
    list.push(it)
    byJob.set(it.job_id, list)
  }
  const out: Record<string, LetterTwoStatus> = {}
  for (const [jobId, list] of byJob) {
    const s = letterTwoStatus({ items: list, openBalance: openBalanceOf(jobId), todayYmd, formatDay, mailClocks })
    if (s.state !== 'none') out[jobId] = s
  }
  return out
}
