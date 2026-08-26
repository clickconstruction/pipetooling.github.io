import type { PortalBill } from './portalPayload'

/**
 * Job grouping for the portal statement (v2.2318). The edge function sends a
 * flat newest-first bill list; a job with several progress bills scatters
 * across the ledger with other properties in between. This kernel regroups
 * the payload client-side — the payload already carries job number, per-bill
 * payments, and cached totals, so the edge function is untouched.
 */

export type PortalJobPayment = { date: string | null; method: string; amount: number }

export type PortalJobGroup = {
  /** Bills newest-first — the same order the flat statement used. */
  bills: PortalBill[]
  jobNumber: string
  jobName: string | null
  serviceTag: PortalBill['serviceTag']
  jobAddress: string | null
  jobLabel: string
  asGc: boolean
  ownerName: string | null
  /** Every payment across the job's bills, oldest first, customer-safe labels. */
  payments: PortalJobPayment[]
  /**
   * Sum of the listed payment rows. When this matches totalPaid the recap can
   * itemize per-payment; when it falls short (job-remainder bills carry only
   * the cached aggregate), the recap falls back to one Paid-to-date line so
   * the arithmetic on the page never lies (v2.2320).
   */
  paymentRowsTotal: number
  totalPaid: number
  /** balance + totalPaid — what the job has been billed so far. */
  billedToDate: number
  /** Sum of the bills' open amounts. */
  balance: number
  /**
   * The boxed recap earns its space only when it says something the rows
   * don't: money has landed, or several bills need one closing line.
   */
  showRecap: boolean
}

const round2 = (n: number): number => Math.round(n * 100) / 100

/**
 * The catch-all label for a payment with no meaningful method. Rows carrying
 * it render date-only in the recap (v2.2322) — "Paid Jul 31, 2026" says it
 * all — while real methods (a check number) keep their suffix.
 */
export const PORTAL_GENERIC_PAYMENT_METHOD = 'Payment'

/**
 * Customer-facing method label. The raw payment_type lands here verbatim from
 * the edge function; `other` (HCP's catch-all) reads like a shrug on customer
 * paper, so it becomes the generic label alongside the blank case.
 */
export function portalPaymentMethodLabel(method: string): string {
  const m = method.trim()
  if (!m || m.toLowerCase() === 'other') return PORTAL_GENERIC_PAYMENT_METHOD
  return m
}

/** What this bill was originally billed: its open amount plus what's been paid on it. */
export function portalBillBilledAmount(bill: PortalBill): number {
  return round2(bill.amount + bill.totalPaid)
}

/**
 * Nulls sort as '9999' — the same "undated floats newest" convention the edge
 * function's flat sort uses, so grouping never reorders what a customer saw.
 */
const newestKey = (bills: PortalBill[]): string =>
  bills.reduce((max, b) => {
    const k = b.billedOn ?? '9999'
    return k > max ? k : max
  }, '')

export function groupPortalBillsByJob(bills: PortalBill[]): PortalJobGroup[] {
  const groups = new Map<string, PortalBill[]>()
  for (const bill of bills) {
    // Job number is the identity when we have one; unnumbered bills fall back
    // to label + address + name, which same-job rows share by construction.
    const key = bill.jobNumber
      ? `num:${bill.jobNumber}`
      : `job:${bill.jobLabel}|${bill.jobAddress ?? ''}|${bill.jobName ?? ''}`
    const list = groups.get(key)
    if (list) list.push(bill)
    else groups.set(key, [bill])
  }

  const out: PortalJobGroup[] = []
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => (b.billedOn ?? '9999').localeCompare(a.billedOn ?? '9999'))
    const first = sorted[0]
    if (!first) continue
    const payments = sorted
      .flatMap((b) => b.payments)
      .map((p) => ({ ...p, method: portalPaymentMethodLabel(p.method) }))
      .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'))
    const paymentRowsTotal = round2(payments.reduce((s, p) => s + p.amount, 0))
    const totalPaid = Math.max(0, round2(sorted.reduce((s, b) => s + b.totalPaid, 0)))
    const balance = round2(sorted.reduce((s, b) => s + b.amount, 0))
    out.push({
      bills: sorted,
      jobNumber: first.jobNumber,
      jobName: first.jobName,
      serviceTag: first.serviceTag,
      jobAddress: first.jobAddress,
      jobLabel: first.jobLabel,
      asGc: sorted.some((b) => b.asGc),
      ownerName: sorted.map((b) => b.ownerName).find((n) => n != null) ?? null,
      payments,
      paymentRowsTotal,
      totalPaid,
      billedToDate: round2(balance + totalPaid),
      balance,
      showRecap: totalPaid > 0 || sorted.length > 1,
    })
  }

  out.sort((a, b) => newestKey(b.bills).localeCompare(newestKey(a.bills)))
  return out
}
