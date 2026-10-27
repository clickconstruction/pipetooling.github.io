/**
 * Billed Awaiting Payment reads the lean (punch list #180, PR 2). The station listed every open bill
 * by customer with the days since it was billed, 50 to 78 of them, never zero, and asked on its banner
 * whether anyone had leaned on them this week; no row said, so the person held that in their head.
 * The lean is the Payment Chase touch the app already keeps (`list_payment_chase_touches`: a call, a
 * note, a resend, a promise, a could-not-reach) and the promised pay dates. This kernel sorts the
 * customer groups the station already builds into three folds: **needs a lean** (a bill past due with
 * no touch in the owner's days and no live promise), **waiting** (leaned on inside those days, or a
 * promise standing) and **not yet past due**. The count is the customers needing a lean, the Next
 * line names the first, the since-last-look line says what moved, and the Mark's note is written
 * from the rows. Pure: the section loads, this shapes.
 */
import type { BilledBreakdownCustomerGroup } from '../jobs/billedByCustomerBreakdown'
import { BROKEN_PROMISE_GRACE_DAYS, type ChaseTouch } from '../jobs/paymentChase'
import { daysBetweenYmd, type PromisedPayDate } from '../jobs/billedExpectedPay'
import { arLastTouchLine } from '../arCustomerChase'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

/** A bill is past due this many days after it was billed: the station's own amber chip. */
export const LEAN_PAST_DUE_DAYS = 30
/** A customer past due with no touch in this many days needs a lean. The owner's number; `app_settings` key below. */
export const LEAN_DAYS_DEFAULT = 7
export const LEAN_DAYS_SETTING_KEY = 'quickfill_lean_days_v1'
export const LEAN_DAYS_MIN = 1
export const LEAN_DAYS_MAX = 60

/** The owner's number from its setting row, or the default when unset or unreadable. */
export function parseLeanDays(valueNum: number | null | undefined, valueText?: string | null): number {
  const n = typeof valueNum === 'number' ? valueNum : valueText != null && valueText !== '' ? Number(valueText) : NaN
  if (!Number.isFinite(n)) return LEAN_DAYS_DEFAULT
  const whole = Math.round(n)
  if (whole < LEAN_DAYS_MIN || whole > LEAN_DAYS_MAX) return LEAN_DAYS_DEFAULT
  return whole
}

export type LeanState = 'needs' | 'waiting' | 'current'

export type LeanRow = {
  group: BilledBreakdownCustomerGroup
  customerId: string | null
  state: LeanState
  /** The newest touch on the customer, any outcome; null with none on record (the RPC keeps 180 days). */
  lastTouch: ChaseTouch | null
  /** Whole days since the newest touch; null with none. */
  lastTouchDays: number | null
  /** "couldn't reach · Oct 14 (12d ago) · Marisol", or null. */
  lastTouchLine: string | null
  /** A promise standing on one of the group's jobs, the latest date; null with none or when every one is broken. */
  promisedYmd: string | null
  /** The newest promise date past its grace, still unpaid; null with none. */
  brokenYmd: string | null
  /** Why the row sits where it sits, in a few words for the Last lean column. */
  why: string
}

export type LeanInput = {
  groups: ReadonlyArray<BilledBreakdownCustomerGroup>
  touches: ReadonlyArray<ChaseTouch> | null
  promises: Readonly<Record<string, PromisedPayDate>> | null
  todayYmd: string
  leanDays: number
}

/**
 * The touch's day on the office's calendar (Chicago), the same calendar `todayYmd` is on. Until v2.5940 this read the
 * UTC date off the timestamp, so from 7 PM Chicago a lean logged that evening was a day ahead of today and read
 * *leaned on -1d ago*, and every other lean's age read one day short.
 */
function touchYmd(t: ChaseTouch): string | null {
  return calendarYmdInAppTzFromIso(t.createdAt) || null
}

function newestTouch(touches: ReadonlyArray<ChaseTouch> | null, customerId: string | null): ChaseTouch | null {
  if (!customerId || !touches) return null
  let best: ChaseTouch | null = null
  for (const t of touches) {
    if (t.customerId !== customerId) continue
    if (!best || t.createdAt > best.createdAt) best = t
  }
  return best
}

/** The rows, needs first (oldest bill first), then waiting, then not yet past due; ties to the most owed. */
export function leanRows(input: LeanInput): LeanRow[] {
  const rows = input.groups.map((group): LeanRow => {
    const customerId = group.bills.find((b) => b.customerId)?.customerId ?? null
    const lastTouch = newestTouch(input.touches, customerId)
    const ymd = lastTouch ? touchYmd(lastTouch) : null
    const lastTouchDays = ymd ? daysBetweenYmd(ymd, input.todayYmd) : null
    const lastTouchLine = arLastTouchLine(input.touches ? [...input.touches] : null, customerId, input.todayYmd)
    const promiseYmds = group.bills.map((b) => input.promises?.[b.jobId]?.promisedYmd).filter((y): y is string => y != null)
    const standing = promiseYmds.filter((y) => (daysBetweenYmd(y, input.todayYmd) ?? 0) < BROKEN_PROMISE_GRACE_DAYS).sort()
    const broken = promiseYmds.filter((y) => (daysBetweenYmd(y, input.todayYmd) ?? 0) >= BROKEN_PROMISE_GRACE_DAYS).sort()
    const promisedYmd = standing.length ? standing[standing.length - 1]! : null
    const brokenYmd = broken.length ? broken[broken.length - 1]! : null
    const pastDue = group.worstAgeDays != null && group.worstAgeDays >= LEAN_PAST_DUE_DAYS
    let state: LeanState
    let why: string
    if (!pastDue) {
      state = 'current'
      why = group.worstAgeDays == null ? 'no bill date' : `${LEAN_PAST_DUE_DAYS - group.worstAgeDays} days until past due`
    } else if (promisedYmd) {
      state = 'waiting'
      why = 'promise standing'
    } else if (lastTouchDays != null && lastTouchDays < input.leanDays) {
      state = 'waiting'
      why = lastTouchDays === 0 ? 'leaned on today' : `leaned on ${lastTouchDays}d ago`
    } else {
      state = 'needs'
      why = brokenYmd ? 'promise broken' : lastTouchDays == null ? 'never leaned on' : `no lean in ${lastTouchDays}d`
    }
    return { group, customerId, state, lastTouch, lastTouchDays, lastTouchLine, promisedYmd, brokenYmd, why }
  })
  const order: Record<LeanState, number> = { needs: 0, waiting: 1, current: 2 }
  return rows.sort((a, b) => order[a.state] - order[b.state] || (b.group.worstAgeDays ?? -1) - (a.group.worstAgeDays ?? -1) || b.group.total - a.group.total)
}

export type LeanCounts = { needs: number; waiting: number; current: number; past60: number; bills: number; total: number }

export function leanCounts(rows: ReadonlyArray<LeanRow>): LeanCounts {
  const out: LeanCounts = { needs: 0, waiting: 0, current: 0, past60: 0, bills: 0, total: 0 }
  for (const r of rows) {
    out[r.state]++
    if (r.state !== 'current' && (r.group.worstAgeDays ?? 0) >= 60) out.past60++
    out.bills += r.group.count
    out.total += r.group.total
  }
  return out
}

function money(n: number): string {
  return `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`
}

function dayWords(n: number): string {
  return n === 1 ? '1 day' : `${n} days`
}

/** The first customer needing a lean and the verb, under the station's question. Null when nobody does. */
export function leanNextLine(rows: ReadonlyArray<LeanRow>): string | null {
  const r = rows.find((x) => x.state === 'needs')
  if (!r) return null
  const name = r.group.customerName.trim() || 'the customer'
  const age = r.group.worstAgeDays != null ? ` · ${dayWords(r.group.worstAgeDays)}` : ''
  return `Lean on ${name} · ${money(r.group.total)}${age} · ${r.why}`
}

export type LeanSince = { newPastDue: number; leanedSince: number; words: string }

/**
 * What moved since the last look: customers whose oldest bill crossed past due since then, and customers
 * leaned on since then. Null without a last look.
 */
export function leanSince(rows: ReadonlyArray<LeanRow>, sinceIso: string | null, todayYmd: string, ymdOf: (iso: string) => string, whenWords: (iso: string) => string): LeanSince | null {
  if (!sinceIso) return null
  const sinceYmd = ymdOf(sinceIso)
  const daysSince = daysBetweenYmd(sinceYmd, todayYmd) ?? 0
  let newPastDue = 0
  let leanedSince = 0
  for (const r of rows) {
    const age = r.group.worstAgeDays
    if (age != null && age >= LEAN_PAST_DUE_DAYS && age - daysSince < LEAN_PAST_DUE_DAYS) newPastDue++
    if (r.lastTouch && r.lastTouch.createdAt > sinceIso) leanedSince++
  }
  return { newPastDue, leanedSince, words: `Since the last look, ${whenWords(sinceIso)}` }
}

/** What the Mark saves when nobody typed: the counts, the oldest, the moved line. Null with no rows. */
export function leanMarkNote(rows: ReadonlyArray<LeanRow>, leanDays: number, since: LeanSince | null): string | null {
  if (rows.length === 0) return null
  const c = leanCounts(rows)
  const parts: string[] = [`${c.needs} need a lean (no lean in ${leanDays} days)`]
  const first = rows.find((r) => r.state === 'needs')
  if (first) {
    const name = first.group.customerName.trim() || 'the customer'
    parts.push(`oldest ${first.group.worstAgeDays ?? '?'}d (${name}, ${first.why})`)
  }
  parts.push(`${c.waiting} leaned on or promised`, `${c.current} not yet past due`, `${c.bills} bills · ${money(c.total)} open`)
  if (since) parts.push(`+${since.newPastDue} new past due, ${since.leanedSince} leaned since the last look`)
  return parts.join(' · ')
}
