/**
 * "Their Word" — customer payment promises and whether they were kept.
 *
 * A promise is an event: "<customer> said <job>'s bill will be paid by
 * <date>". The app never stores an outcome; this kernel derives one from
 * the payments ledger every time it's read, under ONE rule:
 *
 *   kept    — the money billed on the job when the promise was made reached
 *             zero balance by the promised date plus KEPT_GRACE_BUSINESS_DAYS
 *             (mail time; weekends skipped).
 *   late    — paid off, but after that. `daysLate` (paid-off day minus the
 *             promised day) is the number worth keeping: the customer's usual
 *             slip.
 *   broken  — not paid off, and either a later promise was made on the same
 *             job (re-promised) or the promised date is BROKEN_AFTER_DAYS
 *             behind today (the chase loop's existing grace).
 *   open    — not paid off, still inside the grace.
 *
 * Partial payment on a promise is late (or broken), never kept. Payments
 * that landed before the promise was made count toward the balance — the
 * promise is about what was still owed when it was made.
 *
 * Pure: no React, no supabase. Inputs come from list_job_payment_promises /
 * list_payment_promise_records (parsers below).
 */

import { BROKEN_PROMISE_GRACE_DAYS } from './paymentChase'
import { daysBetweenYmd } from './billedExpectedPay'

/** Business days after the promised date before an unpaid promise stops counting as kept (cheque in the mail). */
export const KEPT_GRACE_BUSINESS_DAYS = 3
/** Calendar days past the promised date, still unpaid, before a promise is broken (mirrors the chase loop). */
export const BROKEN_AFTER_DAYS = BROKEN_PROMISE_GRACE_DAYS
/** Balances under this are "paid off" (cents rounding, small write-downs). */
export const PAID_OFF_TOLERANCE_USD = 1

export type PromiseChannel = 'phone' | 'text' | 'email' | 'in_person' | 'portal' | 'backfill'
export type PromiseSource = 'office' | 'customer'

export type PaymentPromise = {
  id: string
  jobId: string
  customerId: string | null
  promisedYmd: string
  saidBy: string | null
  /** Who on our side recorded it; null when the customer named the date themselves. */
  heardByName: string | null
  channel: PromiseChannel | null
  source: PromiseSource
  note: string | null
  createdAt: string
}

export type PromiseRecordInput = {
  id: string
  jobId: string
  customerId: string | null
  promisedYmd: string
  createdAt: string
  source: PromiseSource
  /** $ billed on the job (billed + paid invoices) as of the promise. */
  billedTotal: number
  /** Every dated payment on the job, oldest first. */
  payments: Array<{ paidOn: string; amount: number }>
}

export type PromiseState = 'open' | 'kept' | 'late' | 'broken'

export type PromiseOutcome = {
  id: string
  jobId: string
  customerId: string | null
  promisedYmd: string
  createdAt: string
  source: PromiseSource
  state: PromiseState
  /** promisedYmd + KEPT_GRACE_BUSINESS_DAYS. */
  deadlineYmd: string
  /** The day the promised money reached zero balance, when it did. */
  paidOffYmd: string | null
  /** Calendar days from the promised date to the paid-off day (negative = early); null while unpaid. */
  daysLate: number | null
  /** Broken because a newer promise replaced it on the same job. */
  rePromised: boolean
  /** How many promises had already been made on this job before this one (0 = first). */
  promiseIndexOnJob: number
}

const CHANNELS: ReadonlySet<string> = new Set(['phone', 'text', 'email', 'in_person', 'portal', 'backfill'])
const YMD = /^\d{4}-\d{2}-\d{2}$/

/** ymd + n business days (Saturday/Sunday skipped; holidays not modeled). */
export function addBusinessDaysYmd(ymd: string, days: number): string {
  const m = YMD.exec(ymd)
  if (!m) return ymd
  const d = new Date(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)), 12))
  let left = days
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1)
    const dow = d.getUTCDay()
    if (dow !== 0 && dow !== 6) left--
  }
  return d.toISOString().slice(0, 10)
}

/** The last day a payment can land and the promise still counts as kept. */
export function promiseDeadlineYmd(promisedYmd: string): string {
  return addBusinessDaysYmd(promisedYmd, KEPT_GRACE_BUSINESS_DAYS)
}

/** Defensive parse of list_job_payment_promises (null on gate-refused / malformed). */
export function parsePaymentPromisesRpc(raw: unknown): PaymentPromise[] | null {
  if (!Array.isArray(raw)) return null
  const out: PaymentPromise[] = []
  for (const v of raw) {
    if (v == null || typeof v !== 'object') continue
    const r = v as Record<string, unknown>
    if (typeof r.id !== 'string' || typeof r.jobId !== 'string') continue
    if (typeof r.promisedYmd !== 'string' || !YMD.test(r.promisedYmd)) continue
    if (typeof r.createdAt !== 'string') continue
    out.push({
      id: r.id,
      jobId: r.jobId,
      customerId: typeof r.customerId === 'string' ? r.customerId : null,
      promisedYmd: r.promisedYmd,
      saidBy: typeof r.saidBy === 'string' && r.saidBy.trim() ? r.saidBy.trim() : null,
      heardByName: typeof r.heardByName === 'string' && r.heardByName.trim() ? r.heardByName.trim() : null,
      channel: typeof r.channel === 'string' && CHANNELS.has(r.channel) ? (r.channel as PromiseChannel) : null,
      source: r.source === 'customer' ? 'customer' : 'office',
      note: typeof r.note === 'string' && r.note.trim() ? r.note.trim() : null,
      createdAt: r.createdAt,
    })
  }
  return out
}

/** Defensive parse of list_payment_promise_records (null on gate-refused / malformed). */
export function parsePromiseRecordsRpc(raw: unknown): PromiseRecordInput[] | null {
  if (!Array.isArray(raw)) return null
  const out: PromiseRecordInput[] = []
  for (const v of raw) {
    if (v == null || typeof v !== 'object') continue
    const r = v as Record<string, unknown>
    if (typeof r.id !== 'string' || typeof r.jobId !== 'string') continue
    if (typeof r.promisedYmd !== 'string' || !YMD.test(r.promisedYmd)) continue
    if (typeof r.createdAt !== 'string') continue
    const billed = typeof r.billedTotal === 'number' ? r.billedTotal : Number(r.billedTotal)
    const payments: PromiseRecordInput['payments'] = []
    if (Array.isArray(r.payments)) {
      for (const p of r.payments) {
        if (p == null || typeof p !== 'object') continue
        const pp = p as Record<string, unknown>
        const amount = typeof pp.amount === 'number' ? pp.amount : Number(pp.amount)
        if (typeof pp.paidOn !== 'string' || !YMD.test(pp.paidOn) || !Number.isFinite(amount)) continue
        payments.push({ paidOn: pp.paidOn, amount })
      }
    }
    payments.sort((a, b) => (a.paidOn < b.paidOn ? -1 : a.paidOn > b.paidOn ? 1 : 0))
    out.push({
      id: r.id,
      jobId: r.jobId,
      customerId: typeof r.customerId === 'string' ? r.customerId : null,
      promisedYmd: r.promisedYmd,
      createdAt: r.createdAt,
      source: r.source === 'customer' ? 'customer' : 'office',
      billedTotal: Number.isFinite(billed) ? billed : 0,
      payments,
    })
  }
  return out
}

/**
 * The day the job's cumulative payments first covered `billedTotal` (within
 * tolerance). Payments before the promise count too. Null while still short.
 */
export function paidOffYmd(billedTotal: number, payments: ReadonlyArray<{ paidOn: string; amount: number }>): string | null {
  if (!(billedTotal > PAID_OFF_TOLERANCE_USD)) return payments.length ? payments[0]!.paidOn : null
  let sum = 0
  for (const p of payments) {
    sum += p.amount
    if (sum >= billedTotal - PAID_OFF_TOLERANCE_USD) return p.paidOn
  }
  return null
}

/**
 * Classify every live promise. `todayYmd` decides open vs broken for unpaid
 * promises; a later promise on the same job breaks the earlier one regardless.
 */
export function classifyPromises(records: ReadonlyArray<PromiseRecordInput>, todayYmd: string): PromiseOutcome[] {
  const byJob = new Map<string, PromiseRecordInput[]>()
  for (const r of records) {
    const list = byJob.get(r.jobId) ?? []
    list.push(r)
    byJob.set(r.jobId, list)
  }
  const out: PromiseOutcome[] = []
  for (const list of byJob.values()) {
    list.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
    list.forEach((r, idx) => {
      const deadline = promiseDeadlineYmd(r.promisedYmd)
      const paidOff = paidOffYmd(r.billedTotal, r.payments)
      const rePromised = idx < list.length - 1
      let state: PromiseState
      let daysLate: number | null = null
      if (paidOff) {
        daysLate = daysBetweenYmd(r.promisedYmd, paidOff) ?? 0
        state = paidOff <= deadline ? 'kept' : 'late'
      } else if (rePromised) {
        state = 'broken'
      } else {
        const past = daysBetweenYmd(r.promisedYmd, todayYmd) ?? 0
        state = past >= BROKEN_AFTER_DAYS ? 'broken' : 'open'
      }
      out.push({
        id: r.id,
        jobId: r.jobId,
        customerId: r.customerId,
        promisedYmd: r.promisedYmd,
        createdAt: r.createdAt,
        source: r.source,
        state,
        deadlineYmd: deadline,
        paidOffYmd: paidOff,
        daysLate,
        rePromised,
        promiseIndexOnJob: idx,
      })
    })
  }
  return out
}

export type CustomerPromiseRecord = {
  customerId: string
  /** Live promises with a settled or broken outcome (open ones excluded). */
  decided: number
  kept: number
  late: number
  broken: number
  open: number
  /** kept ÷ decided, null with nothing decided. */
  keptRate: number | null
  /** Median days past the promised date across paid-off promises (kept + late), null with none. */
  usualSlipDays: number | null
  /** Promises broken by a newer promise on the same job. */
  rePromised: number
  /** Promises currently broken with money still open. */
  openBroken: number
  lastPromisedYmd: string | null
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

/** Per-customer roll-up of classified promises. */
export function buildCustomerPromiseRecords(outcomes: ReadonlyArray<PromiseOutcome>): Map<string, CustomerPromiseRecord> {
  const acc = new Map<string, { rec: CustomerPromiseRecord; slips: number[] }>()
  for (const o of outcomes) {
    if (!o.customerId) continue
    let entry = acc.get(o.customerId)
    if (!entry) {
      entry = {
        rec: { customerId: o.customerId, decided: 0, kept: 0, late: 0, broken: 0, open: 0, keptRate: null, usualSlipDays: null, rePromised: 0, openBroken: 0, lastPromisedYmd: null },
        slips: [],
      }
      acc.set(o.customerId, entry)
    }
    const r = entry.rec
    if (o.state === 'open') r.open++
    else {
      r.decided++
      if (o.state === 'kept') r.kept++
      else if (o.state === 'late') r.late++
      else {
        r.broken++
        if (o.rePromised) r.rePromised++
        else r.openBroken++
      }
    }
    if (o.daysLate != null) entry.slips.push(Math.max(0, o.daysLate))
    if (!r.lastPromisedYmd || o.promisedYmd > r.lastPromisedYmd) r.lastPromisedYmd = o.promisedYmd
  }
  const out = new Map<string, CustomerPromiseRecord>()
  for (const [id, { rec, slips }] of acc) {
    rec.keptRate = rec.decided > 0 ? rec.kept / rec.decided : null
    rec.usualSlipDays = median(slips)
    out.set(id, rec)
  }
  return out
}

/** "keeps 3 of 7" · "kept 6 of 6" · null with nothing decided. */
export function formatKeptRecord(rec: Pick<CustomerPromiseRecord, 'kept' | 'decided'>): string | null {
  if (rec.decided <= 0) return null
  return `${rec.kept === rec.decided ? 'kept' : 'keeps'} ${rec.kept} of ${rec.decided}`
}

/** "slips ~9d" · null when there's no paid-off promise or the slip is zero. */
export function formatUsualSlip(rec: Pick<CustomerPromiseRecord, 'usualSlipDays'>): string | null {
  if (rec.usualSlipDays == null || rec.usualSlipDays < 1) return null
  return `slips ~${Math.round(rec.usualSlipDays)}d`
}
