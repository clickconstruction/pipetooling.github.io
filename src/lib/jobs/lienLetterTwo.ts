import { daysBetweenYmd } from './billedExpectedPay'
import type { LienDeskItemRow } from './lienDesk'
import { parseLienDeskDraftFields } from './lienNoticeDraft'

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

export type LetterTwoStatus = {
  state: LetterTwoState
  /** Whole days since the first packet went out; null when nothing has. */
  day: number | null
  /** The first packet's sent item (the latest sent notice that is not itself a letter two). */
  firstItemId: string | null
  firstSentAt: string | null
  /** The letter-two item on the job, live or sent, when there is one. */
  letterTwo: { itemId: string; kind: LetterTwoKind; status: string; sentAt: string | null } | null
  gcAuthorized: { at: string; name: string; note: string } | null
  /** One wording for the row chip and the footer. */
  words: string
}

const NONE: LetterTwoStatus = { state: 'none', day: null, firstItemId: null, firstSentAt: null, letterTwo: null, gcAuthorized: null, words: '' }

/**
 * Where letter two stands on one job. `items` is every notice item on the job
 * (any status); `openBalance` is the job's, not the desk row's — a sent-only
 * entry has no row and would read as paid.
 */
export function letterTwoStatus(input: { items: ReadonlyArray<LienDeskItemRow>; openBalance: number; todayYmd: string; ownerCalledAt?: string | null; formatDay?: (ymd: string) => string }): LetterTwoStatus {
  const fmt = input.formatDay ?? ((d) => d)
  const mine = input.items.filter((i) => i.kind === 'notice_53_056' && !i.voided_at)
  const parsed = mine.map((i) => ({ item: i, draft: parseLienDeskDraftFields(i.fields) }))
  const first = parsed
    .filter((p) => p.item.status === 'sent' && p.item.sent_at && !p.draft?.letterTwo)
    .sort((a, b) => ((a.item.sent_at ?? '') < (b.item.sent_at ?? '') ? 1 : -1))[0]
  if (!first) return NONE
  const firstSentAt = first.item.sent_at as string
  const two = parsed
    .filter((p) => p.draft?.letterTwo && p.item.status !== 'missed' && p.item.created_at >= first.item.created_at)
    .sort((a, b) => (a.item.created_at < b.item.created_at ? 1 : -1))[0]
  const gcAuthorized = first.draft?.gcAuthorizedDirectPay ?? null
  const day = daysBetweenYmd(firstSentAt.slice(0, 10), input.todayYmd) ?? 0
  const base = { day, firstItemId: first.item.id, firstSentAt, gcAuthorized, letterTwo: two ? { itemId: two.item.id, kind: two.draft!.letterTwo!.kind, status: two.item.status, sentAt: two.item.sent_at } : null }
  if (two) {
    if (two.item.status === 'sent') return { ...base, state: 'sent', words: `letter two sent ${two.item.sent_at ? fmt(two.item.sent_at.slice(0, 10)) : ''} · ${letterTwoKindLabel(two.draft!.letterTwo!.kind)}` }
    return { ...base, state: 'in_flight', words: `letter two · ${letterTwoKindLabel(two.draft!.letterTwo!.kind)} · ${two.item.status === 'awaiting_approval' ? 'awaiting the leader' : two.item.status === 'approved' ? 'in the run' : two.item.status === 'held' ? 'held' : 'drafting'}` }
  }
  if (input.openBalance <= 0.005) return { ...base, state: 'paid', words: 'paid' }
  if (gcAuthorized) return { ...base, state: 'gc_authorized', words: `GC authorized direct pay ${fmt(gcAuthorized.at.slice(0, 10))}` }
  if (input.ownerCalledAt) return { ...base, state: 'owner_called', words: `owner called ${fmt(input.ownerCalledAt.slice(0, 10))}` }
  if (day >= LETTER_TWO_BY_DAY) return { ...base, state: 'overdue', words: `day ${day} · letter two overdue` }
  if (day >= LETTER_TWO_FROM_DAY) return { ...base, state: 'due', words: `day ${day} · letter two` }
  return { ...base, state: 'waiting', words: `day ${day}` }
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
export function letterTwoByJobFrom(items: ReadonlyArray<LienDeskItemRow>, openBalanceOf: (jobId: string) => number, todayYmd: string, formatDay?: (ymd: string) => string): Record<string, LetterTwoStatus> {
  const byJob = new Map<string, LienDeskItemRow[]>()
  for (const it of items) {
    if (it.kind !== 'notice_53_056') continue
    const list = byJob.get(it.job_id) ?? []
    list.push(it)
    byJob.set(it.job_id, list)
  }
  const out: Record<string, LetterTwoStatus> = {}
  for (const [jobId, list] of byJob) {
    const s = letterTwoStatus({ items: list, openBalance: openBalanceOf(jobId), todayYmd, formatDay })
    if (s.state !== 'none') out[jobId] = s
  }
  return out
}
