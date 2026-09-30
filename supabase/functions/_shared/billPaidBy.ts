/**
 * What paid a bill — the one wording rule (v2.4100). Under a bill on the
 * statement email (both renders), the printed statement, GC Review's bill
 * lines and the portal:
 *
 *   paid in full by #48102 on Sep 10
 *   $12,000.00 paid by #48211 on Sep 24 · $1,333.00 still open
 *   $12,000.00 paid by #48211 on Sep 24 · $1,333.00 still open, the retainage you hold
 *   nothing applied yet
 *   paid $21,750.00 so far by #48102 on Sep 10 and #48211 on Sep 24   (a job balance, no bill)
 *
 * Which bill an unlinked payment pays is the shared oldest-bill-first rule
 * (`paymentAttribution.ts`). A payment's label is its check number; a
 * bank-recorded payment carries Mercury's transaction id in that field
 * (`apply_mercury_bank_payment_allocations`), which is a fold key and never a
 * number — it reads by its kind. Pure and dependency-free beyond the
 * attribution kernel; the client re-exports it from
 * `src/lib/jobs/gcChecksApplied.ts` and tests it there.
 */
import { attributeJobPayments } from './paymentAttribution.ts'

export type PaidByPayment = {
  invoice_id: string | null | undefined
  amount: number | string | null | undefined
  paid_on?: string | null
  payment_type?: string | null
  reference_number?: string | null
  sequence_order?: number | null
}

export type PaidByBill = {
  id: string
  amount: number | string | null | undefined
  status: string | null | undefined
  sequence_order?: number | null
  billed_at?: string | null
}

export type CheckKind = 'check' | 'ach' | 'wire' | 'card' | 'other'

const round2 = (n: number): number => Math.round(n * 100) / 100
const num = (v: number | string | null | undefined): number => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}
const ymd = (v: string | null | undefined): string | null => {
  const s = (v ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Sep 24, 2026" from a YYYY-MM-DD; the input back when it is not one. */
export function formatYmdLong(v: string | null | undefined): string {
  const s = ymd(v)
  if (!s) return (v ?? '').trim()
  return `${MONTHS[Number(s.slice(5, 7)) - 1] ?? s.slice(5, 7)} ${Number(s.slice(8, 10))}, ${s.slice(0, 4)}`
}

/** "Sep 24" from a YYYY-MM-DD. */
export function formatYmdShort(v: string | null | undefined): string {
  const s = ymd(v)
  if (!s) return (v ?? '').trim()
  return `${MONTHS[Number(s.slice(5, 7)) - 1] ?? s.slice(5, 7)} ${Number(s.slice(8, 10))}`
}

/** "$12,000.00" — the same formatting every statement lane uses. */
export const money = (n: number): string => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function paymentKind(paymentType: string | null | undefined): CheckKind {
  const t = (paymentType ?? '').trim().toLowerCase()
  if (!t) return 'other'
  if (/che(ck|que)|chk/.test(t)) return 'check'
  if (/ach|eft|direct|transfer/.test(t)) return 'ach'
  if (/wire/.test(t)) return 'wire'
  if (/card|stripe|credit|debit|online/.test(t)) return 'card'
  return 'other'
}

/** A bank-recorded payment carries Mercury's transaction id in the number field: a fold key, never a check number. */
export function isDepositRef(reference: string | null | undefined): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((reference ?? '').trim())
}

/** The number as the GC would say it: no leading #, no spaces around it; '' for a deposit id. */
export function checkNumberText(reference: string | null | undefined): string {
  const ref = (reference ?? '').trim().replace(/^#\s*/, '').trim()
  return isDepositRef(ref) ? '' : ref
}

export function checkLabel(kind: CheckKind, number: string, opts?: { deposit?: boolean }): string {
  if (number) return `#${number}`
  if (kind === 'check') return 'check · no number recorded'
  if (kind === 'ach') return 'ACH'
  if (kind === 'wire') return 'Wire'
  if (kind === 'card') return 'Card'
  // Recorded from a bank deposit with no type picked: say so rather than "Payment".
  return opts?.deposit ? 'Bank deposit' : 'Payment'
}

/** "a", "a and b", "a, b and c". */
export const joinList = (items: string[]): string => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`)

/** A payment as the GC would say it, with its day: "#48211 on Sep 24"; the label alone when no day is recorded. */
export function paymentLabelWords(p: PaidByPayment): string {
  const label = checkLabel(paymentKind(p.payment_type), checkNumberText(p.reference_number), { deposit: isDepositRef(p.reference_number) })
  const when = ymd(p.paid_on)
  return when ? `${label} on ${formatYmdShort(when)}` : label
}
const labelOf = paymentLabelWords

/**
 * The line under a bill: what paid it and when, and what is still open.
 * `invoice` null is a job balance with no bill behind it — then what the job
 * has been paid so far. `retainageHeld` is the job's recorded retainage; when
 * what is left on the bill is within it, the line says so.
 */
export function billPaidByWords(
  job: { bills: readonly PaidByBill[]; payments: readonly PaidByPayment[]; retainageHeld?: number | string | null },
  invoice: { id: string; amount: number | string | null | undefined } | null,
): string {
  if (!invoice) {
    const total = round2(job.payments.reduce((s, p) => s + num(p.amount), 0))
    if (total <= 0.005) return 'nothing applied yet'
    const labels = [...new Set(job.payments.map(labelOf))]
    return `paid ${money(total)} so far by ${joinList(labels)}`
  }
  const attribution = attributeJobPayments<PaidByPayment>(job.bills, job.payments)
  const bill = attribution.byBill.get(invoice.id)
  const applied = round2(bill?.applied ?? 0)
  if (applied <= 0.005) return 'nothing applied yet'
  const remaining = round2(Math.max(0, num(invoice.amount) - applied))
  const slices = [...(bill?.slices ?? [])].sort((a, b) => (ymd(a.payment.paid_on) ?? '9999').localeCompare(ymd(b.payment.paid_on) ?? '9999'))
  const labels = [...new Set(slices.map((s) => labelOf(s.payment)))]
  if (remaining <= 0.005) return `paid in full by ${joinList(labels)}`
  const held = round2(Math.max(0, num(job.retainageHeld)))
  const retainage = held > 0 && remaining <= held + 0.005 ? ', the retainage you hold' : ''
  return `${money(applied)} paid by ${joinList(labels)} · ${money(remaining)} still open${retainage}`
}
