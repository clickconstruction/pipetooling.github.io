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
import { BROKEN_PROMISE_GRACE_DAYS, TOUCH_QUIET_DAYS, type ChaseTouch } from './paymentChaseTouches'

// The touches' rules, type and parse live in `paymentChaseTouches.ts` (v2.5881), re-exported here for their readers.
export { BROKEN_PROMISE_GRACE_DAYS, TOUCH_QUIET_DAYS, parseChaseTouchesRpc, type ChaseTouch, type ChaseTouchOutcome } from './paymentChaseTouches'
import { effectiveInvoiceEstBillDate, stageRowBilledRemainingAmount } from './invoiceBilling'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import { listPayer, paySpeedPayer } from './billToParty'
import { paceInputFor, sentFromHereOf, type PaceContext } from './payPace'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { batchOutcomeWords, type BatchOutcome } from '../batchWords'
import {
  billedExpectedPayModel,
  billedReferenceYmd,
  daysBetweenYmd,
  type CustomerSegment,
  type ExpectedPayModel,
  type PaySpeedData,
  type PromisedPayDate,
} from './billedExpectedPay'

/** Default can't-reach snooze when the caller doesn't pick one. */
export const DEFAULT_SNOOZE_DAYS = 7
/** This many broken-promise touches → the flow suggests Collections. */
export const CHASE_COLLECTIONS_SUGGESTION_THRESHOLD = 2

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

export function buildPaymentChaseQueue(
  rows: StageRow[],
  paySpeeds: PaySpeedData | null,
  promises: Record<string, PromisedPayDate> | null,
  touches: ChaseTouch[] | null,
  todayYmd: string,
  /** Newest temperature read per GC customer id (v2.2813); a cold GC's bills move to the front of the call list. */
  temperatureByGcId?: ReadonlyMap<string, { temperature: 'hot' | 'warm' | 'cool' | 'cold' }> | null,
  /** The GC facts and the GC pace here (v2.6034): a first-job GC is late against the GC pace, not the company's. */
  pace?: PaceContext | null,
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
    // v2.4367: the call goes to whoever the bill went to (the builder on a GC-billed bill),
    // judged late against that payer's own pace (v2.4365).
    const payer = listPayer(job, r.inv)
    const customerId = payer.id
    if (!customerId) continue
    const pace_ = paySpeedPayer(job, r.inv)
    const model = billedExpectedPayModel(
      {
        billedAtIso: r.inv.billed_at,
        estBillYmd: effectiveInvoiceEstBillDate(r.inv),
        customerId: pace_.id,
        payerName: pace_.name,
      },
      paySpeeds,
      todayYmd,
      promises?.[job.id] ?? null,
      paceInputFor(pace ?? null, { payerId: pace_.id, jobId: job.id, sentFromHere: sentFromHereOf(r.inv) }, paySpeeds),
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
      billedYmd: billedReferenceYmd({ billedAtIso: r.inv.billed_at, estBillYmd: effectiveInvoiceEstBillDate(r.inv) }),
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
        name: payer.name || '—',
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
    // A touch logged under this payer, plus one logged on any of their jobs under another id
    // (a GC-billed job's calls were filed under the homeowner before v2.4367).
    const bucketJobIds = new Set([...b.bills, ...b.notLate, ...b.disputed].map((x) => x.jobId))
    const custTouches = [
      ...(touchesByCustomer.get(b.customerId) ?? []),
      ...(touches ?? []).filter((t) => t.customerId !== b.customerId && t.jobId != null && bucketJobIds.has(t.jobId)),
    ]
    let waitReason: ChaseWaitReason | null = null
    // Newest first (the RPC orders DESC; keep it defensive).
    const sorted = custTouches.slice().sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1))
    const latest = sorted[0]
    if (latest) {
      const touchYmd = calendarYmdInAppTzFromIso(latest.createdAt) || null
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
  const nameByJob = new Map<string, string>()
  for (const b of byCustomer.values()) {
    nameByCustomer.set(b.customerId, b.name)
    for (const bill of [...b.disputed, ...b.bills, ...b.notLate]) {
      if (!billByJob.has(bill.jobId)) billByJob.set(bill.jobId, bill)
      if (!nameByJob.has(bill.jobId)) nameByJob.set(bill.jobId, b.name)
    }
  }
  const disputes: ChaseDispute[] = openDisputes
    .filter((t) => t.jobId && billByJob.has(t.jobId)) // paid disputes drop silently
    .map((t) => ({
      touch: t,
      customerName: (t.jobId ? nameByJob.get(t.jobId) : undefined) ?? nameByCustomer.get(t.customerId) ?? '—',
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

/**
 * After *They promised* wrote the date job by job (punch list #184, sweep A, PR 2): the bills
 * whose job took the promise, and the bills whose job did not, each with the reason. A job that
 * failed fails every bill on it.
 */
export function promiseBillOutcome<B extends Pick<ChaseBill, 'invoiceId' | 'jobId'>>(bills: ReadonlyArray<B>, failed: ReadonlyArray<{ jobId: string; why: string }>): { took: B[]; missed: Array<{ bill: B; why: string }> } {
  const whyByJob = new Map(failed.map((f) => [f.jobId, f.why]))
  const took: B[] = []
  const missed: Array<{ bill: B; why: string }> = []
  for (const b of bills) {
    const why = whyByJob.get(b.jobId)
    if (why == null) took.push(b)
    else missed.push({ bill: b, why })
  }
  return { took, missed }
}

/** The toast and the head over the bills that did not take: *Promised on 3 bills. 1 did not take.* */
export function promiseOutcomeWords(took: number, missed: number): BatchOutcome {
  const w = batchOutcomeWords({ verb: 'take', past: 'promised on', done: took, failed: missed, noun: 'bill' })
  if (took > 0 || missed <= 0) return w
  return { ...w, line: missed === 1 ? 'The promise did not take on the bill.' : `The promise did not take on ${missed} bills.` }
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

/**
 * Call-mode phone display (B6 / J4-6): the customer record stores whatever
 * was typed — usually ten raw digits. Ten digits (or eleven with a leading 1)
 * render as (555) 123-4567; anything else is shown as stored, trimmed. The
 * `tel:` href keeps the raw value — dialers want digits, not punctuation.
 */
export function formatChasePhone(raw: string | null | undefined): string {
  const s = (raw ?? '').trim()
  if (!s) return ''
  const digits = s.replace(/\D/g, '')
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (ten.length !== 10) return s
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`
}

/**
 * Whether the customer has ever been emailed one of these bills (B6 / J4-6):
 * a Stripe channel (Stripe emails on send) or a stamped `sent_to_customer_at`
 * (the physical PDF path). HouseCall Pro records email nobody, so a call is
 * the only door there — no mailto is offered.
 */
export function chaseBillsWereEmailed(bills: readonly Pick<ChaseBill, 'sentChannel' | 'sentAtIso'>[]): boolean {
  return bills.some((b) => b.sentChannel === 'stripe' || (b.sentAtIso != null && b.sentAtIso.trim() !== ''))
}

/**
 * mailto for the call card, only when there is an address AND a bill actually
 * went out by email — otherwise null and the card offers the phone alone.
 * Subject names the bills so the reply threads back to the right money.
 */
export function chaseEmailHref(
  email: string | null | undefined,
  bills: readonly Pick<ChaseBill, 'label' | 'sentChannel' | 'sentAtIso'>[],
): string | null {
  const to = (email ?? '').trim()
  if (!to || !to.includes('@')) return null
  if (!chaseBillsWereEmailed(bills)) return null
  const labels = bills.map((b) => b.label.trim()).filter(Boolean)
  const subject = labels.length === 1 ? `Following up on ${labels[0]}` : `Following up on your open bills`
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}`
}

/**
 * Jobs a call-mode "Move to Collections…" can flag (B6 / J4-7): one entry per
 * distinct job among the customer's late bills, labelled by the first bill on
 * that job. The board's typed confirm still owns the write.
 */
export function collectionsCandidatesForChase(
  bills: readonly Pick<ChaseBill, 'jobId' | 'label'>[],
): Array<{ jobId: string; label: string }> {
  const seen = new Set<string>()
  const out: Array<{ jobId: string; label: string }> = []
  for (const b of bills) {
    if (!b.jobId || seen.has(b.jobId)) continue
    seen.add(b.jobId)
    out.push({ jobId: b.jobId, label: b.label })
  }
  return out
}
