/**
 * HCP reconcile → Apply, the press (punch list #184, sweep A, PR 2). The plan in `hcpReconcile.ts`
 * says what each lane would write; this runs it row by row through the writes the section hands
 * in, keeps going past a row that fails, and returns what did not apply with the reason and the
 * plan of exactly those rows, so the button reads their count and one more press tries them
 * again. Before this the first bad row threw and the rest never ran.
 *
 * A row that half-applied comes back as only its missing half: an invoice that was made but whose
 * payments did not link comes back as those links, and a split whose new payments went in but
 * whose rollup was not removed comes back as the removal alone. A retry never writes a row twice.
 */
import { batchOutcomeWords, pluralNoun, type BatchOutcome } from '../batchWords'
import { formatErrorMessage } from '../../utils/errorHandling'
import type {
  InvoicePlanCreate,
  InvoicePlanLink,
  InvoicePlanStamp,
  InvoiceReconcilePlan,
  PaymentPlanCorrection,
  PaymentPlanSplit,
  PaymentReconcilePlan,
} from './hcpReconcile'

/** A row that did not apply: what it was, and why. */
export type ReconcileFailure = { key: string; what: string; why: string }

/** The count, then what it is made of, zero parts left out: *Apply 12 · 3 invoices, 5 dates, 4 links*; one kind reads *Apply 4 links*. */
function applyLabel(parts: ReadonlyArray<readonly [count: number, noun: string]>): string {
  const live = parts.filter(([n]) => n > 0)
  const total = live.reduce((s, [n]) => s + n, 0)
  const words = live.map(([n, noun]) => `${n} ${pluralNoun(noun, n)}`)
  if (words.length === 0) return 'Apply'
  if (words.length === 1) return `Apply ${words[0]}`
  return `Apply ${total} · ${words.join(', ')}`
}

/** The invoices lane's rows, counted the way the run counts them. */
export function invoicePlanRowCount(plan: Pick<InvoiceReconcilePlan, 'creates' | 'stamps' | 'links'>): number {
  return plan.creates.length + plan.stamps.length + plan.links.length
}

/** The payments lane's rows. */
export function paymentPlanRowCount(plan: Pick<PaymentReconcilePlan, 'corrections' | 'splits'>): number {
  return plan.corrections.length + plan.splits.length
}

/** Lane 1's button: *Apply 12 · 3 invoices, 5 dates, 4 links*. */
export function invoiceApplyLabel(plan: Pick<InvoiceReconcilePlan, 'creates' | 'stamps' | 'links'>): string {
  return applyLabel([
    [plan.creates.length, 'invoice'],
    [plan.stamps.length, 'date'],
    [plan.links.length, 'link'],
  ])
}

/** Lane 2's button: *Apply 9 · 7 dates, 2 splits*. */
export function paymentApplyLabel(plan: Pick<PaymentReconcilePlan, 'corrections' | 'splits'>): string {
  return applyLabel([
    [plan.corrections.length, 'date'],
    [plan.splits.length, 'split'],
  ])
}

/** The toast after a run and the head over the rows that did not apply. */
export function reconcileApplyWords(done: number, failed: number): BatchOutcome {
  return batchOutcomeWords({ verb: 'apply', past: 'applied', done, failed, noun: 'change' })
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** The writes lane 1 makes, handed in by the section (each throws on a refused write). */
export interface InvoiceApplyIo {
  /** Inserts the paid invoice and returns its id. */
  createInvoice: (c: InvoicePlanCreate) => Promise<string>
  linkPayments: (paymentIds: readonly string[], invoiceId: string) => Promise<void>
  stampBillDate: (s: InvoicePlanStamp) => Promise<void>
  linkPayment: (l: InvoicePlanLink) => Promise<void>
}

export type ReconcileApplyResult<P> = { done: number; total: number; failures: ReconcileFailure[]; remaining: P }

/** Runs lane 1 row by row, past a failure. `onProgress` hears each row as it settles. */
export async function applyInvoicePlanRows(plan: InvoiceReconcilePlan, io: InvoiceApplyIo, onProgress?: (settled: number, total: number) => void): Promise<ReconcileApplyResult<InvoiceReconcilePlan>> {
  const total = invoicePlanRowCount(plan)
  const failures: ReconcileFailure[] = []
  const remaining: InvoiceReconcilePlan = { ...plan, creates: [], stamps: [], links: [] }
  let done = 0
  let settled = 0
  const tick = () => onProgress?.(++settled, total)
  for (const c of plan.creates) {
    let invoiceId: string
    try {
      invoiceId = await io.createInvoice(c)
    } catch (e) {
      failures.push({ key: `create:${c.jobId}`, what: `Job ${c.jobNumber} · invoice #${c.invoiceNo}`, why: formatErrorMessage(e, 'Could not create the invoice') })
      remaining.creates.push(c)
      tick()
      continue
    }
    if (c.linkPaymentIds.length > 0) {
      try {
        await io.linkPayments(c.linkPaymentIds, invoiceId)
      } catch (e) {
        // The invoice is made: only its links come back, so a retry never makes it twice.
        const n = c.linkPaymentIds.length
        failures.push({ key: `create:${c.jobId}`, what: `Job ${c.jobNumber} · invoice #${c.invoiceNo} made, ${n} ${pluralNoun('payment', n)} not linked`, why: formatErrorMessage(e, 'Could not link the payments') })
        for (const paymentId of c.linkPaymentIds) remaining.links.push({ paymentId, invoiceId, jobNumber: c.jobNumber })
        tick()
        continue
      }
    }
    done += 1
    tick()
  }
  for (const s of plan.stamps) {
    try {
      await io.stampBillDate(s)
      done += 1
    } catch (e) {
      failures.push({ key: `stamp:${s.invoiceId}`, what: `Job ${s.jobNumber} · bill date`, why: formatErrorMessage(e, 'Could not stamp the bill date') })
      remaining.stamps.push(s)
    }
    tick()
  }
  for (const l of plan.links) {
    try {
      await io.linkPayment(l)
      done += 1
    } catch (e) {
      failures.push({ key: `link:${l.paymentId}`, what: `Job ${l.jobNumber} · payment link`, why: formatErrorMessage(e, 'Could not link the payment') })
      remaining.links.push(l)
    }
    tick()
  }
  return { done, total, failures, remaining }
}

/** The writes lane 2 makes, handed in by the section (each throws on a refused write). */
export interface PaymentApplyIo {
  correctDate: (c: PaymentPlanCorrection) => Promise<void>
  /** Inserts the split's true payments. */
  insertSplit: (s: PaymentPlanSplit) => Promise<void>
  /** Removes the rollup the split replaced. */
  removeRollup: (s: PaymentPlanSplit) => Promise<void>
}

/** Runs lane 2 row by row, past a failure. A split inserts its true rows first, then removes the rollup. */
export async function applyPaymentPlanRows(plan: PaymentReconcilePlan, io: PaymentApplyIo, onProgress?: (settled: number, total: number) => void): Promise<ReconcileApplyResult<PaymentReconcilePlan>> {
  const total = paymentPlanRowCount(plan)
  const failures: ReconcileFailure[] = []
  const remaining: PaymentReconcilePlan = { ...plan, corrections: [], splits: [] }
  let done = 0
  let settled = 0
  const tick = () => onProgress?.(++settled, total)
  for (const c of plan.corrections) {
    try {
      await io.correctDate(c)
      done += 1
    } catch (e) {
      failures.push({ key: `date:${c.paymentId}`, what: `Job ${c.jobNumber} · ${money(c.amount)} paid ${c.fromYmd ?? 'no date'} to ${c.toYmd}`, why: formatErrorMessage(e, 'Could not correct the date') })
      remaining.corrections.push(c)
    }
    tick()
  }
  for (const s of plan.splits) {
    // A split that comes back as the removal alone has no rows left to insert.
    if (s.inserts.length > 0) {
      try {
        await io.insertSplit(s)
      } catch (e) {
        failures.push({ key: `split:${s.deletePaymentId}`, what: `Job ${s.jobNumber} · split of ${money(s.rollupAmount)}`, why: formatErrorMessage(e, 'Could not insert the split payments') })
        remaining.splits.push(s)
        tick()
        continue
      }
    }
    try {
      await io.removeRollup(s)
      done += 1
    } catch (e) {
      // The true rows are in: only the removal comes back, so a retry never inserts them twice.
      failures.push({ key: `split:${s.deletePaymentId}`, what: `Job ${s.jobNumber} · split of ${money(s.rollupAmount)} made, the rollup not removed`, why: formatErrorMessage(e, 'Could not remove the rollup payment') })
      remaining.splits.push({ ...s, inserts: [] })
    }
    tick()
  }
  return { done, total, failures, remaining }
}
