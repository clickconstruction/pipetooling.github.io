/**
 * AR Customers view — call-sheet kernel (v2.2572, mockup Variant B).
 * Derives each customer row's chase pill, last-touch line, call opener, and
 * copy-summary text from the shipped Payment Chase inputs (touches, per-job
 * promises) — read-only mirrors of the queue's semantics in paymentChase.ts;
 * writes go through paymentChaseIo.ts.
 */
import {
  BROKEN_PROMISE_GRACE_DAYS,
  TOUCH_QUIET_DAYS,
  type ChaseTouch,
  type ChaseTouchOutcome,
} from './jobs/paymentChase'
import { daysBetweenYmd, formatYmdMonthDay, type PromisedPayDate } from './jobs/billedExpectedPay'
import type { ArCustomerRow } from './arCustomerRollup'
import type { ArLineItem } from './arModalLineItems'

export type ArChasePillKind = 'dispute' | 'broken' | 'promised' | 'snoozed' | 'quiet' | 'ask'
export type ArChasePill = { kind: ArChasePillKind; label: string }

function touchYmd(t: ChaseTouch): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(t.createdAt)
  return m?.[1] ?? null
}

/** Newest first by createdAt. */
function customerTouches(touches: ChaseTouch[] | null, customerId: string): ChaseTouch[] {
  return (touches ?? [])
    .filter((t) => t.customerId === customerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/**
 * The row's chase state, most-urgent-first: unresolved dispute on one of its
 * jobs → broken promise (past date + grace, money still open) → live promise →
 * can't-reach snooze still running → quiet window after any touch → past-pace
 * with none of the above owes a call. Null = nothing to say (on pace, untouched).
 */
export function arCustomerChasePill(args: {
  customerId: string | null
  jobIds: ReadonlyArray<string>
  pastPace: boolean
  touches: ChaseTouch[] | null
  promises: Record<string, PromisedPayDate> | null
  todayYmd: string
}): ArChasePill | null {
  const { customerId, jobIds, pastPace, promises, todayYmd } = args
  if (!customerId) return null
  const mine = customerTouches(args.touches, customerId)
  const jobIdSet = new Set(jobIds)

  if (mine.some((t) => t.outcome === 'dispute' && !t.resolvedAt && t.jobId != null && jobIdSet.has(t.jobId))) {
    return { kind: 'dispute', label: 'Dispute open' }
  }

  const promiseYmds = jobIds
    .map((id) => promises?.[id]?.promisedYmd)
    .filter((ymd): ymd is string => ymd != null)
  if (promiseYmds.length > 0) {
    const broken = promiseYmds.filter((ymd) => (daysBetweenYmd(ymd, todayYmd) ?? 0) >= BROKEN_PROMISE_GRACE_DAYS)
    if (broken.length > 0) {
      const oldest = [...broken].sort()[0]!
      return { kind: 'broken', label: `Promise broken ${formatYmdMonthDay(oldest)}` }
    }
    const latest = [...promiseYmds].sort().pop()!
    return { kind: 'promised', label: `Promised ${formatYmdMonthDay(latest)}` }
  }

  const snooze = mine.find((t) => {
    if (t.outcome !== 'cant_reach' || t.snoozeDays == null) return false
    const ymd = touchYmd(t)
    const since = ymd ? daysBetweenYmd(ymd, todayYmd) : null
    return since != null && since < t.snoozeDays
  })
  if (snooze) {
    const ymd = touchYmd(snooze)
    const since = ymd ? daysBetweenYmd(ymd, todayYmd) ?? 0 : 0
    const left = (snooze.snoozeDays ?? 0) - since
    return { kind: 'snoozed', label: `Can't reach — back in ${left}d` }
  }

  const latestTouch = mine[0]
  if (latestTouch) {
    const ymd = touchYmd(latestTouch)
    const since = ymd ? daysBetweenYmd(ymd, todayYmd) : null
    if (since != null && since < TOUCH_QUIET_DAYS) {
      return { kind: 'quiet', label: `Touched ${ymd ? formatYmdMonthDay(ymd) : ''}`.trim() }
    }
  }

  return pastPace ? { kind: 'ask', label: 'Owes a call' } : null
}

const TOUCH_OUTCOME_WORD: Record<ChaseTouchOutcome, string> = {
  promised: 'promise',
  cant_reach: "couldn't reach",
  resend: 'resent the bill',
  dispute: 'dispute',
  note: 'note',
}

/** "couldn't reach · Aug 27 (5d ago) · Taunya" — null when the customer has no touches. */
export function arLastTouchLine(touches: ChaseTouch[] | null, customerId: string | null, todayYmd: string): string | null {
  if (!customerId) return null
  const latest = customerTouches(touches, customerId)[0]
  if (!latest) return null
  const ymd = touchYmd(latest)
  const since = ymd ? daysBetweenYmd(ymd, todayYmd) : null
  const when = ymd ? `${formatYmdMonthDay(ymd)}${since != null && since >= 0 ? ` (${since === 0 ? 'today' : `${since}d ago`})` : ''}` : ''
  return [TOUCH_OUTCOME_WORD[latest.outcome], when, latest.createdByName].filter(Boolean).join(' · ')
}

/**
 * The call opener: what to say first. "3 bills past their ~35d — oldest 169d:
 * 273 · Dudley (Lennox), $13,420. $56,021 open on 14 bills."
 */
export function arCallOpener(row: ArCustomerRow): string {
  const money = (n: number) =>
    `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  const total = `${money(row.open)} open on ${row.bills.length} ${row.bills.length === 1 ? 'bill' : 'bills'}.`
  if (row.baselineDays == null) return total
  const late = row.bills.filter((b) => b.tone === 'warn' || b.tone === 'late')
  if (late.length === 0) return `All within their ~${row.baselineDays}d pace. ${total}`
  const oldest = late[0]!
  const pace = row.ownMedianDays != null ? `their ~${row.ownMedianDays}d` : `the company ~${row.baselineDays}d`
  return (
    `${late.length} bill${late.length === 1 ? '' : 's'} past ${pace} — oldest ${oldest.waitDays}d: ` +
    `${oldest.item.label}, ${money(oldest.item.amount)}. ${total}`
  )
}

/**
 * Plain-text call summary for the clipboard — line items up front under each
 * bill, so a paste into a text or email says exactly what the money is for.
 */
export function buildArCallSummary(row: ArCustomerRow, linesByJob: Map<string, ArLineItem[]> | null): string {
  const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const out: string[] = [`${row.name} — ${money(row.open)} open on ${row.bills.length} bill${row.bills.length === 1 ? '' : 's'}`]
  if (row.ownMedianDays != null) out.push(`Usually pays in ~${row.ownMedianDays}d.`)
  out.push('')
  for (const b of row.bills) {
    const wait = b.waitDays != null ? `${b.waitDays}d waiting` : 'no bill date'
    out.push(`• ${b.item.label} — ${money(b.item.amount)} (${wait})`)
    if (b.item.address) out.push(`  ${b.item.address}`)
    const lines = b.item.jobId ? linesByJob?.get(b.item.jobId) ?? [] : []
    for (const l of lines) out.push(`  - ${l.label}: ${money(l.amount)}`)
  }
  return out.join('\n')
}
