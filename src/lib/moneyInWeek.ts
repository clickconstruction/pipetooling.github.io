/**
 * Money in: this week, and what last week still owes (punch list #191, v2.5926).
 * The week line under the Dashboard's Financials cards: what landed this week,
 * what is still on its way with a day on each chip, and what last week expected
 * that never came. Pure — the loader beside it (PR 2) does the reads; this file
 * only sorts rows onto days. One chip per job on the expected side, surest kind
 * first: at the bank > in the drawer > they say it's sent > their word > pace.
 * The Stripe payout is drawn on the day it lands but never summed — it is
 * landed card money reaching the bank.
 */
import { isCheckPayment } from './jobs/checkClearing'
import { claimOpen, type PaidClaim } from './jobs/paidClaims'
import { arRowInvoiceId } from './bridge/collect/collectBills'
import { MAILED_CHECK_DAYS, mailedCheckYmd } from './bridge/collect/collectOutcome'
import type { CollectBillRead } from './bridge/collect/collectPile'
import { formatMercuryKind } from './mercuryKindLabels'
import { ymdAddDays } from '../utils/dateUtils'

/** Days a pending Mercury deposit usually takes to post. */
export const PENDING_POSTS_DAYS = 2
/** Days a claimed online/bank payment takes to land, when it was not a mailed check. */
export const CLAIM_OTHER_ARRIVES_DAYS = 2

export type MoneyInRowKind = 'landed' | 'drawer' | 'bank' | 'returned' | 'sent-claim' | 'word' | 'pace' | 'stripe-open' | 'stripe-payout'
export type MoneyInDoorKind = 'deposits' | 'job' | 'banking' | 'return-case'

export type MoneyInRow = {
  key: string
  kind: MoneyInRowKind
  payerName: string
  usd: number
  /** True when usd is the open money a word or claim covers, not a stated figure. */
  coversOpen: boolean
  /** The day column the chip sits on; null = the drawer shelf. */
  dayYmd: string | null
  /** The day the chip was really expected, when it slid forward to today (or into the carry). */
  wasYmd: string | null
  /** One plain line under the name: "check #4471 · recorded Fri". */
  sub: string
  jobId: string | null
  /** For a 'returned' or 'bank' row, the Mercury transaction behind it. */
  mercuryTransactionId: string | null
  door: MoneyInDoorKind
  /** False on the payout chip and returned chips: drawn, never summed. */
  counted: boolean
}

export type MoneyInDay = { ymd: string; isToday: boolean; usd: number; rows: MoneyInRow[] }

export type MoneyInWeekView = {
  weekMondayYmd: string
  todayYmd: string
  cameIn: { usd: number; count: number }
  expected: { usd: number; count: number }
  carried: { expectedUsd: number; landedUsd: number; stillOutUsd: number; count: number; returnedCount: number; rows: MoneyInRow[] }
  drawer: { usd: number; count: number; rows: MoneyInRow[] }
  /** Monday through Sunday, every day present even when empty. */
  days: MoneyInDay[]
}

export type MoneyInPayment = {
  paymentId: string
  jobId: string | null
  usd: number
  paidOnYmd: string | null
  paymentType: string | null
  note: string | null
  referenceNumber: string | null
  payerName: string
}

export type MoneyInUnlinkedCheck = {
  paymentId: string
  jobId: string | null
  usd: number
  paidOnYmd: string | null
  paymentType: string | null
  referenceNumber: string | null
  payerName: string
}

export type MoneyInMercury = {
  mercuryTransactionId: string
  usd: number
  kind: string | null
  status: string | null
  createdYmd: string | null
  postedYmd: string | null
  counterpartyName: string | null
  failedReason: string | null
  failedYmd: string | null
}

export type MoneyInStripePayout = { usd: number; arrivalYmd: string | null }

export type MoneyInWeekInput = {
  /** Every payment with paid_on since last week's Monday. */
  payments: ReadonlyArray<MoneyInPayment>
  /** The AR window's unlinked recorded payments (any age). */
  unlinkedChecks: ReadonlyArray<MoneyInUnlinkedCheck>
  /** Pending Mercury rows, plus failed ones from the two weeks. */
  mercury: ReadonlyArray<MoneyInMercury>
  /** Every open bill read against its payer's pace (buildCollectPile). */
  pile: ReadonlyArray<CollectBillRead>
  claims: ReadonlyArray<PaidClaim> | null
  /** Invoice ids whose bill is a live hosted Stripe invoice. */
  stripeOpenInvoiceIds: ReadonlySet<string>
  payout: MoneyInStripePayout | null
  todayYmd: string
}

/** The Monday of the week holding this day (the company's weeks run Mon–Sun). */
export function weekMondayContaining(ymd: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return null
  const day = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()
  return ymdAddDays(ymd, -((day + 6) % 7))
}

const DAY_WORDS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTH_WORDS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** "today", a weekday word inside this week and last, else "Oct 12". */
export function dayWord(ymd: string, todayYmd: string): string {
  if (ymd === todayYmd) return 'today'
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return ymd
  const monday = weekMondayContaining(todayYmd)
  if (monday && ymd >= ymdAddDays(monday, -7) && ymd <= ymdAddDays(monday, 6)) {
    return DAY_WORDS[new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()]!
  }
  return `${MONTH_WORDS[Number(m[2]) - 1]} ${Number(m[3])}`
}

/** A recorded Stripe payment: the webhook writes the row with this note. */
export function isStripePayment(p: { note?: string | null }): boolean {
  return (p.note ?? '').trim().toLowerCase() === 'stripe'
}

const KIND_ORDER: Record<MoneyInRowKind, number> = {
  returned: 0,
  landed: 1,
  bank: 2,
  drawer: 3,
  'sent-claim': 4,
  word: 5,
  'stripe-open': 6,
  pace: 7,
  'stripe-payout': 8,
}

export function buildMoneyInWeek(input: MoneyInWeekInput): MoneyInWeekView {
  const todayYmd = input.todayYmd
  const weekMonday = weekMondayContaining(todayYmd) ?? todayYmd
  const weekSunday = ymdAddDays(weekMonday, 6)
  const lastMonday = ymdAddDays(weekMonday, -7)
  const lastSunday = ymdAddDays(weekMonday, -1)
  const inThisWeek = (ymd: string | null): ymd is string => ymd != null && ymd >= weekMonday && ymd <= weekSunday
  const inLastWeek = (ymd: string | null): ymd is string => ymd != null && ymd >= lastMonday && ymd <= lastSunday
  const day = (ymd: string): string => (ymd < todayYmd ? todayYmd : ymd)
  const word = (ymd: string): string => dayWord(ymd, todayYmd)

  const dayRows = new Map<string, MoneyInRow[]>()
  for (let i = 0; i < 7; i++) dayRows.set(ymdAddDays(weekMonday, i), [])
  const put = (row: MoneyInRow): void => {
    if (row.dayYmd) dayRows.get(row.dayYmd)?.push(row)
  }

  // ── Landed: payments with paid_on this week ─────────────────────────────
  let cameInUsd = 0
  let cameInCount = 0
  for (const p of input.payments) {
    if (!(p.usd > 0) || !inThisWeek(p.paidOnYmd) || p.paidOnYmd > todayYmd) continue
    const how = isStripePayment(p)
      ? `Stripe · paid ${word(p.paidOnYmd)}`
      : isCheckPayment({ payment_type: p.paymentType })
        ? `check${p.referenceNumber ? ` #${p.referenceNumber}` : ''} · ${word(p.paidOnYmd)}`
        : `${(p.paymentType ?? 'payment').toLowerCase()} · ${word(p.paidOnYmd)}`
    cameInUsd += p.usd
    cameInCount += 1
    put({
      key: `landed:${p.paymentId}`,
      kind: 'landed',
      payerName: p.payerName,
      usd: p.usd,
      coversOpen: false,
      dayYmd: p.paidOnYmd,
      wasYmd: null,
      sub: how,
      jobId: p.jobId,
      mercuryTransactionId: null,
      door: 'job',
      counted: true,
    })
  }

  // ── The drawer: checks recorded, not yet deposited ──────────────────────
  // A pending check deposit within a dollar of a drawer check is that check at
  // the bank already — the drawer row drops so the money is not counted twice.
  const pending = input.mercury.filter((t) => (t.status ?? '') === 'pending' && t.usd > 0)
  const pendingMatched = new Set<string>()
  const drawerRows: MoneyInRow[] = []
  for (const c of input.unlinkedChecks) {
    if (!(c.usd > 0) || !isCheckPayment({ payment_type: c.paymentType })) continue
    const match = pending.find((t) => !pendingMatched.has(t.mercuryTransactionId) && (t.kind ?? '') === 'checkDeposit' && Math.abs(t.usd - c.usd) <= 1)
    if (match) {
      pendingMatched.add(match.mercuryTransactionId)
      continue
    }
    drawerRows.push({
      key: `drawer:${c.paymentId}`,
      kind: 'drawer',
      payerName: c.payerName,
      usd: c.usd,
      coversOpen: false,
      dayYmd: null,
      wasYmd: null,
      sub: `check${c.referenceNumber ? ` #${c.referenceNumber}` : ''}${c.paidOnYmd ? ` · recorded ${word(c.paidOnYmd)}` : ''}`,
      jobId: c.jobId,
      mercuryTransactionId: null,
      door: 'deposits',
      counted: true,
    })
  }

  // ── At the bank: pending deposits, on the day they should post ──────────
  const carriedRows: MoneyInRow[] = []
  let carriedReturned = 0
  for (const t of pending) {
    const basis = t.createdYmd ?? todayYmd
    const posts = day(ymdAddDays(basis, PENDING_POSTS_DAYS))
    if (posts > weekSunday) continue
    put({
      key: `bank:${t.mercuryTransactionId}`,
      kind: 'bank',
      payerName: (t.counterpartyName ?? '').trim() || formatMercuryKind(t.kind ?? ''),
      usd: t.usd,
      coversOpen: false,
      dayYmd: posts,
      wasYmd: null,
      sub: `${formatMercuryKind(t.kind ?? '')} · deposited ${word(basis)} · posts ~${word(posts)}`,
      jobId: null,
      mercuryTransactionId: t.mercuryTransactionId,
      door: 'deposits',
      counted: true,
    })
  }

  // ── Came back: failed money in, red on its day (or in the carry) ────────
  for (const t of input.mercury) {
    if ((t.status ?? '') !== 'failed' || !(t.usd > 0)) continue
    const when = t.failedYmd ?? t.createdYmd
    const row: MoneyInRow = {
      key: `returned:${t.mercuryTransactionId}`,
      kind: 'returned',
      payerName: (t.counterpartyName ?? '').trim() || formatMercuryKind(t.kind ?? ''),
      usd: t.usd,
      coversOpen: false,
      dayYmd: inThisWeek(when) ? when : null,
      wasYmd: null,
      sub: `${formatMercuryKind(t.kind ?? '')} came back${t.failedReason ? ` — ${t.failedReason}` : ''}${when ? ` · ${word(when)}` : ''}`,
      jobId: null,
      mercuryTransactionId: t.mercuryTransactionId,
      door: 'return-case',
      counted: false,
    }
    if (inThisWeek(when)) put(row)
    else if (inLastWeek(when)) {
      carriedRows.push(row)
      carriedReturned += 1
    }
  }

  // ── They say it's sent: open claims, on the day the money should land ───
  const pileByJob = new Map<string, CollectBillRead[]>()
  for (const b of input.pile) {
    if (!b.jobId) continue
    const list = pileByJob.get(b.jobId) ?? []
    list.push(b)
    pileByJob.set(b.jobId, list)
  }
  const suppressedJobs = new Set<string>()
  for (const r of drawerRows) if (r.jobId) suppressedJobs.add(r.jobId)
  let carriedExpectedUsd = 0
  let carriedLandedUsd = 0
  const landedOnJobSince = (jobId: string | null, sinceYmd: string): number => {
    if (!jobId) return 0
    let sum = 0
    for (const p of input.payments) if (p.jobId === jobId && (p.paidOnYmd ?? '') >= sinceYmd && p.usd > 0) sum += p.usd
    return sum
  }
  for (const c of input.claims ?? []) {
    if (!claimOpen(c)) continue
    const arrives = c.method === 'check_mailed' ? mailedCheckYmd(c.paidYmd, MAILED_CHECK_DAYS) : ymdAddDays(c.paidYmd, CLAIM_OTHER_ARRIVES_DAYS)
    if (arrives < lastMonday || arrives > weekSunday) continue
    const open = (pileByJob.get(c.jobId) ?? []).reduce((s, b) => s + b.usd, 0)
    const usd = c.amount ?? open
    if (!(usd > 0)) continue
    suppressedJobs.add(c.jobId)
    const row: MoneyInRow = {
      key: `claim:${c.id}`,
      kind: 'sent-claim',
      payerName: (c.customerName ?? '').trim() || c.jobName,
      usd,
      coversOpen: c.amount == null,
      dayYmd: inThisWeek(arrives) ? day(arrives) : null,
      wasYmd: inThisWeek(arrives) && day(arrives) !== arrives ? arrives : inLastWeek(arrives) ? arrives : null,
      sub: `"${c.method === 'check_mailed' ? 'check mailed' : 'paid'} ${word(c.paidYmd)}"${c.heardByName ? ` · heard by ${c.heardByName}` : ''}`,
      jobId: c.jobId,
      mercuryTransactionId: null,
      door: 'job',
      counted: true,
    }
    if (inThisWeek(arrives)) put(row)
    else {
      carriedExpectedUsd += usd
      carriedRows.push(row)
    }
  }

  // ── Their word, their pace, open Stripe bills: the pile on its days ─────
  for (const b of input.pile) {
    if (!b.expectedYmd || b.state === 'collections' || !(b.usd > 0)) continue
    if (b.jobId && suppressedJobs.has(b.jobId)) continue
    const invoiceId = arRowInvoiceId(b.key)
    const stripeOpen = invoiceId != null && input.stripeOpenInvoiceIds.has(invoiceId)
    const kind: MoneyInRowKind = stripeOpen ? 'stripe-open' : b.promise ? 'word' : 'pace'
    const base: Omit<MoneyInRow, 'dayYmd' | 'wasYmd'> = {
      key: `pile:${b.key}`,
      kind,
      payerName: b.payerName,
      usd: b.usd,
      coversOpen: kind === 'word',
      sub:
        kind === 'word'
          ? `promised by ${word(b.promise!.promisedYmd)}${b.promise!.markedByName ? ` · marked by ${b.promise!.markedByName}` : ''}`
          : kind === 'stripe-open'
            ? `Stripe invoice open${b.billedYmd ? ` · sent ${word(b.billedYmd)}` : ''}`
            : `by their pace${b.paceDays != null ? ` (${b.paceDays}d)` : ''}`,
      jobId: b.jobId,
      mercuryTransactionId: null,
      door: kind === 'stripe-open' ? 'banking' : 'job',
      counted: true,
    }
    if (inThisWeek(b.expectedYmd)) {
      const d = day(b.expectedYmd)
      put({ ...base, dayYmd: d, wasYmd: d !== b.expectedYmd ? b.expectedYmd : null })
    } else if (inLastWeek(b.expectedYmd)) {
      carriedExpectedUsd += b.usd
      const landed = landedOnJobSince(b.jobId, b.expectedYmd)
      if (landed > 0) {
        carriedLandedUsd += Math.min(landed, b.usd)
        continue
      }
      carriedRows.push({
        ...base,
        sub:
          kind === 'word'
            ? `promised ${word(b.promise!.promisedYmd)}, ${Math.max(0, b.daysPastExpected ?? 0)} days past`
            : `expected ${word(b.expectedYmd)}${kind === 'pace' ? ', by their pace' : ''}`,
        dayYmd: null,
        wasYmd: b.expectedYmd,
      })
    }
  }

  // ── The payout: drawn on the day it lands, never summed ─────────────────
  if (input.payout && input.payout.usd > 0 && inThisWeek(input.payout.arrivalYmd)) {
    put({
      key: 'stripe-payout',
      kind: 'stripe-payout',
      payerName: 'Stripe payout',
      usd: input.payout.usd,
      coversOpen: false,
      dayYmd: day(input.payout.arrivalYmd),
      wasYmd: null,
      sub: 'card money reaching the bank — not re-counted',
      jobId: null,
      mercuryTransactionId: null,
      door: 'banking',
      counted: false,
    })
  }

  // ── Assemble ────────────────────────────────────────────────────────────
  const days: MoneyInDay[] = []
  let expectedUsd = 0
  let expectedCount = 0
  for (let i = 0; i < 7; i++) {
    const ymd = ymdAddDays(weekMonday, i)
    const rows = (dayRows.get(ymd) ?? []).sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.usd - a.usd)
    let usd = 0
    for (const r of rows) {
      if (!r.counted) continue
      usd += r.usd
      if (r.kind !== 'landed') {
        expectedUsd += r.usd
        expectedCount += 1
      }
    }
    days.push({ ymd, isToday: ymd === todayYmd, usd, rows })
  }
  const drawerUsd = drawerRows.reduce((s, r) => s + r.usd, 0)
  expectedUsd += drawerUsd
  expectedCount += drawerRows.length
  const carriedStillOut = carriedRows.reduce((s, r) => s + r.usd, 0)
  carriedRows.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.usd - a.usd)

  return {
    weekMondayYmd: weekMonday,
    todayYmd,
    cameIn: { usd: cameInUsd, count: cameInCount },
    expected: { usd: expectedUsd, count: expectedCount },
    carried: {
      expectedUsd: carriedExpectedUsd,
      landedUsd: carriedLandedUsd,
      stillOutUsd: carriedStillOut,
      count: carriedRows.length,
      returnedCount: carriedReturned,
      rows: carriedRows,
    },
    drawer: { usd: drawerUsd, count: drawerRows.length, rows: drawerRows },
    days,
  }
}
