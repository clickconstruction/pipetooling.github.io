/**
 * Payment chase queue (owner-approved "Payment Chase Loop" mockup, v2.2025):
 * who owes us a phone call about money, derived — never stored.
 *
 * Inputs are things the Pipeline already loads (billed rows, pay speeds,
 * promises) plus the chase-touch call log (list_payment_chase_touches). The
 * loop: a bill past its expected date with no promise owes an "ask when"
 * call; a promise unpaid BROKEN_PROMISE_GRACE_DAYS past its date owes a
 * chase call; a can't-reach touch snoozes the customer, then they return;
 * any touch quiets the customer TOUCH_QUIET_DAYS so yesterday's voicemail
 * doesn't re-nag today; an unresolved dispute holds its bill out of the ask
 * queue (calling again won't fix a dispute). A paid bill falls out on its
 * own — there is no cleanup state.
 */
import type { StageRow } from '../jobsStagesBoard'
import { effectiveInvoiceEstBillDate, stageRowBilledRemainingAmount } from './invoiceBilling'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import {
  billedExpectedPayModel,
  daysBetweenYmd,
  type CustomerSegment,
  type ExpectedPayModel,
  type PaySpeedData,
  type PromisedPayDate,
} from './billedExpectedPay'

/** A promise this many days past its date, still unpaid, re-enters the queue. */
export const BROKEN_PROMISE_GRACE_DAYS = 7
/** Any touch keeps the customer out of the queue this long — no re-nagging tomorrow. */
export const TOUCH_QUIET_DAYS = 3
/** Default can't-reach snooze when the caller doesn't pick one. */
export const DEFAULT_SNOOZE_DAYS = 7
/** This many broken-promise touches → the flow suggests Collections. */
export const CHASE_COLLECTIONS_SUGGESTION_THRESHOLD = 2

export type ChaseTouchOutcome = 'promised' | 'cant_reach' | 'resend' | 'dispute' | 'note'

export type ChaseTouch = {
  id: string
  customerId: string
  jobId: string | null
  outcome: ChaseTouchOutcome
  note: string | null
  promisedYmd: string | null
  snoozeDays: number | null
  resolvedAt: string | null
  createdAt: string
  createdByName: string
}

const OUTCOMES: ReadonlySet<string> = new Set(['promised', 'cant_reach', 'resend', 'dispute', 'note'])

/** Defensive parse of list_payment_chase_touches (null on gate-refused / malformed). */
export function parseChaseTouchesRpc(raw: unknown): ChaseTouch[] | null {
  if (!Array.isArray(raw)) return null
  const out: ChaseTouch[] = []
  for (const v of raw) {
    if (v == null || typeof v !== 'object') continue
    const r = v as Record<string, unknown>
    if (typeof r.id !== 'string' || typeof r.customerId !== 'string') continue
    if (typeof r.outcome !== 'string' || !OUTCOMES.has(r.outcome)) continue
    if (typeof r.createdAt !== 'string') continue
    out.push({
      id: r.id,
      customerId: r.customerId,
      jobId: typeof r.jobId === 'string' ? r.jobId : null,
      outcome: r.outcome as ChaseTouchOutcome,
      note: typeof r.note === 'string' && r.note.trim() ? r.note : null,
      promisedYmd: typeof r.promisedYmd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.promisedYmd) ? r.promisedYmd : null,
      snoozeDays: typeof r.snoozeDays === 'number' && Number.isFinite(r.snoozeDays) ? Math.round(r.snoozeDays) : null,
      resolvedAt: typeof r.resolvedAt === 'string' ? r.resolvedAt : null,
      createdAt: r.createdAt,
      createdByName: typeof r.createdByName === 'string' && r.createdByName.trim() ? r.createdByName : 'office',
    })
  }
  return out
}

export type ChaseBill = {
  invoiceId: string
  jobId: string
  /** "964 · Pondhill demo" (falls back to the bare number on lean rows). */
  label: string
  open: number
  /** Full line amount, for "partial paid" evidence (null when unknown). */
  amount: number | null
  /** The reference date the aging clock runs on (billed_at day, else est date). */
  billedYmd: string | null
  /** Send evidence for the call card (absent on lean rows — the card never shows bills). */
  sentChannel: string | null
  sentAtIso: string | null
  stripeInvoiceId: string | null
  stripePaid: boolean
  model: ExpectedPayModel
}

export type ChaseWaitReason =
  | { kind: 'snoozed'; untilYmd: string | null; touch: ChaseTouch }
  | { kind: 'quiet'; touch: ChaseTouch }

export type ChaseCustomer = {
  customerId: string
  name: string
  segment: CustomerSegment | null
  /** 'broken' when any bill is BROKEN_PROMISE_GRACE_DAYS past its promise. */
  state: 'ask' | 'broken'
  /** The bills the call is about (late unpromised + broken promises), oldest-late first. */
  bills: ChaseBill[]
  /** Open bills NOT in the queue (not late yet, or inside a promise) — cover them while you have the customer. */
  notLate: ChaseBill[]
  openLate: number
  /** Promised touches whose date passed while money is still open — the escalation counter. */
  brokenPromiseTouches: number
  waitReason: ChaseWaitReason | null
  /** Coldest GC temperature read across this customer's late jobs (v2.2813) — cold sorts first. */
  temperature: 'hot' | 'warm' | 'cool' | 'cold' | null
}

export type ChaseDispute = {
  touch: ChaseTouch
  customerName: string
  bill: ChaseBill | null
}

export type PaymentChaseQueue = {
  /** Customers who owe a call today, biggest late dollars first. */
  due: ChaseCustomer[]
  /** Customers held out by a snooze or the quiet period. */
  waiting: ChaseCustomer[]
  /** Unresolved dispute touches whose bill still has open money. */
  disputes: ChaseDispute[]
  dueDollars: number
  askCount: number
  brokenCount: number
}

function ymdFromIso(iso: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso)
  return m?.[1] ?? null
}

export function buildPaymentChaseQueue(
  rows: StageRow[],
  paySpeeds: PaySpeedData | null,
  promises: Record<string, PromisedPayDate> | null,
  touches: ChaseTouch[] | null,
  todayYmd: string,
  /** Newest temperature read per GC customer id (v2.2813); a cold GC's bills move to the front of the call list. */
  temperatureByGcId?: ReadonlyMap<string, { temperature: 'hot' | 'warm' | 'cool' | 'cold' }> | null,
): PaymentChaseQueue {
  const tempRank = (t: string | null | undefined) => (t === 'cold' ? 0 : t === 'cool' ? 1 : t === 'warm' ? 2 : t === 'hot' ? 3 : 4)
  const touchesByCustomer = new Map<string, ChaseTouch[]>()
  for (const t of touches ?? []) {
    const list = touchesByCustomer.get(t.customerId)
    if (list) list.push(t)
    else touchesByCustomer.set(t.customerId, [t])
  }
  // Unresolved disputes hold their job's bills out of the ask queue.
  const disputedJobIds = new Set<string>()
  const openDisputes: ChaseTouch[] = []
  for (const t of touches ?? []) {
    if (t.outcome === 'dispute' && !t.resolvedAt && t.jobId) {
      disputedJobIds.add(t.jobId)
      openDisputes.push(t)
    }
  }

  type Bucket = {
    customerId: string
    name: string
    segment: CustomerSegment | null
    bills: ChaseBill[]
    notLate: ChaseBill[]
    disputed: ChaseBill[]
    broken: boolean
    temperature: 'hot' | 'warm' | 'cool' | 'cold' | null
  }
  const byCustomer = new Map<string, Bucket>()

  for (const r of rows) {
    if (r.kind === 'job') continue
    const open = stageRowBilledRemainingAmount(r)
    if (open <= 0) continue
    const job = r.job
    const customerId = job.customer_id
    if (!customerId) continue
    const model = billedExpectedPayModel(
      {
        billedAtIso: r.inv.billed_at,
        estBillYmd: effectiveInvoiceEstBillDate(r.inv),
        customerId,
      },
      paySpeeds,
      todayYmd,
      promises?.[job.id] ?? null,
    )
    if (!model) continue // no clock to be late against — the forecast's 'unknown' bucket
    const number = effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—'
    const name = (job.job_name ?? '').trim()
    const inv = r.inv as typeof r.inv & {
      external_send_channel?: string | null
      sent_to_customer_at?: string | null
      stripe_invoice_id?: string | null
      stripe_invoice_status?: string | null
    }
    const bill: ChaseBill = {
      invoiceId: r.inv.id,
      jobId: job.id,
      label: name ? `${number} · ${name}` : number,
      open,
      amount: typeof r.inv.amount === 'number' ? r.inv.amount : null,
      billedYmd: r.inv.billed_at ? ymdFromIso(r.inv.billed_at) : (effectiveInvoiceEstBillDate(r.inv) ?? null),
      sentChannel: inv.external_send_channel ?? null,
      sentAtIso: inv.sent_to_customer_at ?? null,
      stripeInvoiceId: inv.stripe_invoice_id ?? null,
      stripePaid: String(inv.stripe_invoice_status ?? '').toLowerCase() === 'paid',
      model,
    }
    let bucket = byCustomer.get(customerId)
    if (!bucket) {
      bucket = {
        customerId,
        name: (job.customer_name ?? '').trim() || '—',
        segment: paySpeeds?.customerTypes[customerId] ?? null,
        bills: [],
        notLate: [],
        disputed: [],
        broken: false,
        temperature: null,
      }
      byCustomer.set(customerId, bucket)
    }
    const gcTemp = (job as { gc_customer_id?: string | null }).gc_customer_id ? temperatureByGcId?.get((job as { gc_customer_id?: string | null }).gc_customer_id!)?.temperature ?? null : null
    if (gcTemp && tempRank(gcTemp) < tempRank(bucket.temperature)) bucket.temperature = gcTemp
    if (disputedJobIds.has(job.id)) {
      bucket.disputed.push(bill)
      continue
    }
    const brokenPromise = model.source === 'promised' && model.daysLate >= BROKEN_PROMISE_GRACE_DAYS
    const lateUnpromised = model.source !== 'promised' && model.state === 'late'
    if (brokenPromise) {
      bucket.broken = true
      bucket.bills.push(bill)
    } else if (lateUnpromised) {
      bucket.bills.push(bill)
    } else {
      bucket.notLate.push(bill)
    }
  }

  const due: ChaseCustomer[] = []
  const waiting: ChaseCustomer[] = []
  for (const b of byCustomer.values()) {
    if (b.bills.length === 0) continue
    const custTouches = touchesByCustomer.get(b.customerId) ?? []
    let waitReason: ChaseWaitReason | null = null
    // Newest first (the RPC orders DESC; keep it defensive).
    const sorted = custTouches.slice().sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1))
    const latest = sorted[0]
    if (latest) {
      const touchYmd = ymdFromIso(latest.createdAt)
      const sinceTouch = touchYmd ? daysBetweenYmd(touchYmd, todayYmd) : null
      if (latest.outcome === 'cant_reach' && sinceTouch != null) {
        const snooze = latest.snoozeDays ?? DEFAULT_SNOOZE_DAYS
        if (sinceTouch < snooze) {
          const until = touchYmd ? addDays(touchYmd, snooze) : null
          waitReason = { kind: 'snoozed', untilYmd: until, touch: latest }
        }
      }
      if (!waitReason && sinceTouch != null && sinceTouch < TOUCH_QUIET_DAYS) {
        waitReason = { kind: 'quiet', touch: latest }
      }
    }
    const brokenPromiseTouches = sorted.filter(
      (t) => t.outcome === 'promised' && t.promisedYmd != null && (daysBetweenYmd(t.promisedYmd, todayYmd) ?? 0) > 0,
    ).length
    const customer: ChaseCustomer = {
      customerId: b.customerId,
      name: b.name,
      segment: b.segment,
      state: b.broken ? 'broken' : 'ask',
      bills: b.bills.slice().sort((x, y) => y.model.daysLate - x.model.daysLate || y.open - x.open),
      notLate: b.notLate.slice().sort((x, y) => y.open - x.open),
      openLate: b.bills.reduce((s, x) => s + x.open, 0),
      brokenPromiseTouches,
      waitReason,
      temperature: b.temperature,
    }
    if (waitReason) waiting.push(customer)
    else due.push(customer)
  }
  // Cold first (v2.2813), then biggest late dollars — a bad temperature read belongs on the call list.
  due.sort((a, z) => tempRank(a.temperature) - tempRank(z.temperature) || z.openLate - a.openLate)
  waiting.sort((a, z) => z.openLate - a.openLate)

  const billByJob = new Map<string, ChaseBill>()
  const nameByCustomer = new Map<string, string>()
  for (const b of byCustomer.values()) {
    nameByCustomer.set(b.customerId, b.name)
    for (const bill of [...b.disputed, ...b.bills, ...b.notLate]) {
      if (!billByJob.has(bill.jobId)) billByJob.set(bill.jobId, bill)
    }
  }
  const disputes: ChaseDispute[] = openDisputes
    .filter((t) => t.jobId && billByJob.has(t.jobId)) // paid disputes drop silently
    .map((t) => ({
      touch: t,
      customerName: nameByCustomer.get(t.customerId) ?? '—',
      bill: t.jobId ? (billByJob.get(t.jobId) ?? null) : null,
    }))

  return {
    due,
    waiting,
    disputes,
    dueDollars: due.reduce((s, c) => s + c.openLate, 0),
    askCount: due.filter((c) => c.state === 'ask').length,
    brokenCount: due.filter((c) => c.state === 'broken').length,
  }
}

function addDays(ymd: string, days: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12))
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Promise builder (owner-approved "Promise Date Builder" mockup, v2.2044):
 * resolve the date(s) a promise lands on, three ways —
 *   'date'   → the exact date the customer named, same for every bill;
 *   'today'  → today + N days ("give us two weeks");
 *   'billed' → each bill's OWN bill date + N days ("we pay net 45") — dates
 *              diverge per bill, honestly. A bill with no bill date falls
 *              back to today + N rather than silently dropping.
 * The store keeps ONE promise per job, so when two bills on the same job
 * resolve differently the job takes the EARLIEST date (first money landing
 * is when the job stops being late — the conservative read).
 */
export type PromiseDateMode = 'date' | 'today' | 'billed'

export type ResolvedPromiseDates = {
  /** invoiceId → resolved ymd (what the bill rows preview). */
  byInvoice: Map<string, string>
  /** jobId → the ymd actually written (earliest of the job's bills). */
  byJob: Map<string, string>
  /** Distinct resolved ymds, ascending — one entry = every bill agrees. */
  uniqueYmds: string[]
}

export function resolvePromiseDates(args: {
  mode: PromiseDateMode
  /** mode 'date': the picked YYYY-MM-DD. */
  ymd?: string | null
  /** modes 'today' / 'billed': the day count (positive integer). */
  days?: number | null
  bills: Array<Pick<ChaseBill, 'invoiceId' | 'jobId' | 'billedYmd'>>
  todayYmd: string
}): ResolvedPromiseDates | null {
  const { mode, bills, todayYmd } = args
  if (bills.length === 0) return null
  const byInvoice = new Map<string, string>()
  if (mode === 'date') {
    const ymd = (args.ymd ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
    for (const b of bills) byInvoice.set(b.invoiceId, ymd)
  } else {
    const days = args.days
    if (days == null || !Number.isFinite(days) || days <= 0) return null
    const n = Math.round(days)
    for (const b of bills) {
      const base = mode === 'billed' && b.billedYmd ? b.billedYmd : todayYmd
      const resolved = addDays(base, n)
      if (!resolved) return null
      byInvoice.set(b.invoiceId, resolved)
    }
  }
  const byJob = new Map<string, string>()
  for (const b of bills) {
    const ymd = byInvoice.get(b.invoiceId)
    if (!ymd) continue
    const prev = byJob.get(b.jobId)
    if (!prev || ymd < prev) byJob.set(b.jobId, ymd)
  }
  const uniqueYmds = [...new Set(byInvoice.values())].sort()
  return { byInvoice, byJob, uniqueYmds }
}

/** Quick-pick day counts: plain waits for 'today', net terms for 'billed'. */
export const PROMISE_DAY_CHIPS: Record<'today' | 'billed', readonly number[]> = {
  today: [7, 14, 21, 30],
  billed: [15, 30, 45, 60],
}

export type PaymentChaseSummary = {
  dueCustomers: number
  dueDollars: number
  askCount: number
  brokenCount: number
  waitingCount: number
  disputeCount: number
}

/** The Money Opportunities card's numbers; null = nothing to show (card hides). */
export function summarizePaymentChase(queue: PaymentChaseQueue | null): PaymentChaseSummary | null {
  if (!queue) return null
  if (queue.due.length === 0 && queue.waiting.length === 0 && queue.disputes.length === 0) return null
  return {
    dueCustomers: queue.due.length,
    dueDollars: queue.dueDollars,
    askCount: queue.askCount,
    brokenCount: queue.brokenCount,
    waitingCount: queue.waiting.length,
    disputeCount: queue.disputes.length,
  }
}
