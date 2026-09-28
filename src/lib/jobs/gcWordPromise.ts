/**
 * The pay date on a GC's word, filed where the board reads it. GC Review's
 * mark form and call sheet take "they expect to pay by" for the whole GC;
 * Jobs Stages keeps a promise per job ("They said…"). This kernel is the
 * bridge: the GC's bills with the date each one carries, the dates one tap
 * away, and what a save will file. Pure — the form owns the picks, GC Review
 * owns the writes.
 */
import { addDaysYmd, dowForYmd } from '../emailSchedule/emailScheduleWeek'
import type { GcReviewRow } from '../gcReviewRollup'
import { daysBetweenYmd, formatYmdMonthDay, type PromisedPayDate } from './billedExpectedPay'
import type { StatementSendChannel } from './gcStatementRounds'
import type { PromiseChannel } from './paymentPromises'

/** One job the GC owes on: its open balance and the date it was last promised. */
export type GcWordBill = {
  jobId: string
  label: string
  amount: number
  promisedYmd: string | null
}

const YMD = /^\d{4}-\d{2}-\d{2}$/

/** A GC's review rows as bills: one per job (a job can carry several invoice rows), largest first. */
export function gcWordBills(
  rows: ReadonlyArray<Pick<GcReviewRow, 'jobId' | 'hcp' | 'jobName' | 'jobAddress' | 'remaining'>>,
  promises: Readonly<Record<string, Pick<PromisedPayDate, 'promisedYmd'>>> | null | undefined,
): GcWordBill[] {
  const byJob = new Map<string, GcWordBill>()
  for (const r of rows) {
    const hit = byJob.get(r.jobId)
    if (hit) {
      hit.amount += r.remaining
      continue
    }
    const place = r.jobAddress || r.jobName
    const label = [r.hcp && r.hcp !== '—' ? r.hcp : '', place].filter(Boolean).join(' · ') || 'Job'
    const promised = promises?.[r.jobId]?.promisedYmd ?? null
    byJob.set(r.jobId, { jobId: r.jobId, label, amount: r.remaining, promisedYmd: promised && YMD.test(promised) ? promised : null })
  }
  return [...byJob.values()].sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label))
}

/** The date still ahead that the GC last gave — the latest one when bills differ. */
export function standingPromiseYmd(bills: ReadonlyArray<Pick<GcWordBill, 'promisedYmd'>>, todayYmd: string): string | null {
  let best: string | null = null
  for (const b of bills) {
    if (b.promisedYmd && b.promisedYmd >= todayYmd && (best == null || b.promisedYmd > best)) best = b.promisedYmd
  }
  return best
}

export type WordPromiseHeadline = { tone: 'late' | 'standing'; text: string }

/**
 * What they said last time, above the form: the oldest date that has passed
 * with its bill still open, else the date still ahead.
 */
export function wordPromiseHeadline(bills: ReadonlyArray<GcWordBill>, todayYmd: string): WordPromiseHeadline | null {
  const of = (n: number) => (bills.length > 1 ? ` · ${n} of ${bills.length} bills` : '')
  const late = bills.filter((b) => b.promisedYmd != null && b.promisedYmd < todayYmd && Math.round(b.amount * 100) > 0)
  if (late.length > 0) {
    const oldest = late.reduce((a, b) => (b.promisedYmd! < a.promisedYmd! ? b : a)).promisedYmd!
    const days = daysBetweenYmd(oldest, todayYmd) ?? 0
    return { tone: 'late', text: `They said ${formatYmdMonthDay(oldest)} · ${days} day${days === 1 ? '' : 's'} late${of(late.length)}` }
  }
  const standing = standingPromiseYmd(bills, todayYmd)
  if (!standing) return null
  return { tone: 'standing', text: `They said ${formatYmdMonthDay(standing)}${of(bills.filter((b) => b.promisedYmd === standing).length)}` }
}

export type PayDateShortcut = { key: 'standing' | 'this_friday' | 'next_friday' | 'month_end'; label: string; ymd: string }

const MONTH_END_MIN_DAYS = 7

function monthEndYmd(ymd: string, monthsAhead: number): string {
  const [y, m] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) + monthsAhead, 0)).toISOString().slice(0, 10)
}

/**
 * The answers a GC gives without a calendar: the date they already gave,
 * this Friday, next Friday, the end of the month. A month end under a week
 * away is this Friday's neighbor, so the chip reads the month after.
 */
export function payDateShortcuts(todayYmd: string, standingYmd?: string | null): PayDateShortcut[] {
  if (!YMD.test(todayYmd)) return []
  const out: PayDateShortcut[] = []
  if (standingYmd && YMD.test(standingYmd) && standingYmd >= todayYmd) {
    out.push({ key: 'standing', label: `Still ${formatYmdMonthDay(standingYmd)}`, ymd: standingYmd })
  }
  const thisFriday = addDaysYmd(todayYmd, (5 - dowForYmd(todayYmd) + 7) % 7)
  const nextFriday = addDaysYmd(thisFriday, 7)
  const nearEnd = monthEndYmd(todayYmd, 0)
  const monthEnd = (daysBetweenYmd(todayYmd, nearEnd) ?? 0) < MONTH_END_MIN_DAYS ? monthEndYmd(todayYmd, 1) : nearEnd
  const rest: PayDateShortcut[] = [
    { key: 'this_friday', label: `This Fri · ${formatYmdMonthDay(thisFriday)}`, ymd: thisFriday },
    { key: 'next_friday', label: `Next Fri · ${formatYmdMonthDay(nextFriday)}`, ymd: nextFriday },
    { key: 'month_end', label: `End of ${formatYmdMonthDay(monthEnd).split(' ')[0]}`, ymd: monthEnd },
  ]
  for (const s of rest) if (!out.some((o) => o.ymd === s.ymd)) out.push(s)
  return out
}

export type WordPromisePlan = {
  /** Picked bills that do not carry this date yet — the ones a save writes. */
  file: GcWordBill[]
  pickedCount: number
  /** Picked bills already on this date: left alone, so a re-save never re-promises. */
  same: number
  /** Picked bills on another date: the new one replaces it and the earlier promise reads broken. */
  moves: number
  total: number
}

export function planWordPromise(input: { bills: ReadonlyArray<GcWordBill>; picked: ReadonlySet<string>; ymd: string | null | undefined }): WordPromisePlan {
  const ymd = (input.ymd ?? '').slice(0, 10)
  const picked = YMD.test(ymd) ? input.bills.filter((b) => input.picked.has(b.jobId)) : []
  return {
    file: picked.filter((b) => b.promisedYmd !== ymd),
    pickedCount: picked.length,
    same: picked.filter((b) => b.promisedYmd === ymd).length,
    moves: picked.filter((b) => b.promisedYmd != null && b.promisedYmd !== ymd).length,
    total: picked.reduce((t, b) => t + b.amount, 0),
  }
}

const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

/** The line under the date — which bills it goes on — and what the user should know before saving. */
export function wordPromiseSummary(plan: WordPromisePlan, bills: ReadonlyArray<GcWordBill>, ymd: string): { line: string; notes: string[] } {
  if (plan.pickedCount === 0) return { line: 'No bills picked — the date stays with the word only', notes: [] }
  const only = bills.length === 1 ? bills[0] : null
  const which = only ? `Goes on ${only.label}` : plan.pickedCount === bills.length ? `Goes on all ${bills.length} bills` : `Goes on ${plan.pickedCount} of ${bills.length} bills`
  const notes: string[] = []
  if (plan.moves > 0) notes.push(`${plan.moves} bill${plan.moves === 1 ? '' : 's'} had a different date — that promise goes on record as broken`)
  if (plan.same > 0) notes.push(`${plan.same} already say${plan.same === 1 ? 's' : ''} ${formatYmdMonthDay(ymd)}`)
  return { line: `${which} · ${money(plan.total)}`, notes }
}

/** How the word arrived, in the promise record's terms; "other" and the ask-by-link page have no match there. */
export function promiseChannelForWord(channel: StatementSendChannel | 'link' | null | undefined): PromiseChannel | null {
  if (channel === 'call') return 'phone'
  if (channel === 'text' || channel === 'email' || channel === 'in_person') return channel
  return null
}

const PROMISE_NOTE_MAX = 500

/** The promise's note: the word it came with, and whose word it was when someone else typed it. */
export function wordPromiseNote(input: { note: string; wordFromName?: string | null; enteredByName?: string | null }): string {
  const from = (input.wordFromName ?? '').trim()
  const by = (input.enteredByName ?? '').trim()
  const lead = from && by && from !== by ? `GC Review — ${from}’s word, entered by ${by}` : 'GC Review'
  const said = input.note.trim()
  const full = said ? `${lead}: ${said}` : lead
  return full.length > PROMISE_NOTE_MAX ? `${full.slice(0, PROMISE_NOTE_MAX - 1)}…` : full
}

/** What the toast says once the word and its date are in. */
export function wordPromiseSavedMessage(input: { ymd: string; saved: number; failed: number }): { text: string; tone: 'success' | 'warning' } {
  const day = formatYmdMonthDay(input.ymd)
  const bills = (n: number) => `${n} bill${n === 1 ? '' : 's'}`
  if (input.failed > 0) {
    return {
      text: `The word is in. ${day} did not reach ${bills(input.failed)}${input.saved > 0 ? ` (${input.saved} saved)` : ''} — set ${input.failed === 1 ? 'it' : 'them'} from the Stages board.`,
      tone: 'warning',
    }
  }
  return { text: `${day} is on ${bills(input.saved)} — the Stages board and the forecast read it.`, tone: 'success' }
}
