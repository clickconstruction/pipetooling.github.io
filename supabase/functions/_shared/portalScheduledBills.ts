/**
 * Scheduled in kind on the customer's page (v2.8314, punch list #301; the owner's call of 2026-11-22).
 *
 * A job on an in kind deal carries `jobs_ledger.in_kind_arrangement_id`. Its bill is paid down by
 * credits, so it is scheduled and is not money owed. On the customer's page that means three things:
 * the bill is not on the statement, it is not in the balance, and it has no pay link, so nobody pays
 * with money a bill a credit pays down. The bill still stays on the page, in its own card, so it does
 * not read as lost.
 *
 * `customer-portal` splits its jobs here. The money jobs go to `buildPortalBills` as before, and the
 * deal's jobs come back through `buildPortalScheduledBills`: the same builder, so the same membership
 * and the same payment rule, with the pay link dropped. The pay-by promise covers the money jobs alone.
 *
 * It lives in its own file because `portalMergedBills.ts` and `portalBillMembership.ts` ride in a dozen
 * functions through the sample pages. A change there would send each of them back for a deploy.
 *
 * Pure, tested from vitest (`src/lib/portal/portalScheduledBills.test.ts`).
 */
import { buildPortalBills, type PortalInvoiceRow, type PortalJobRow, type PortalPaymentRow, type PortalSentBillRow } from './portalMergedBills.ts'

/** A portal job with the deal that pays it, when one does. */
export type PortalDealJobRow = PortalJobRow & { in_kind_arrangement_id?: string | null }

/** A job an in kind deal pays. A job read without the column is on no deal. */
export function jobIsOnInKindDeal(job: { in_kind_arrangement_id?: string | null }): boolean {
  return Boolean(job.in_kind_arrangement_id)
}

/** The jobs money pays, in the order they came: what the statement, the balance and the pay-by promise read. */
export function moneyJobsOf<T extends { in_kind_arrangement_id?: string | null }>(jobs: readonly T[]): T[] {
  return jobs.filter((j) => !jobIsOnInKindDeal(j))
}

/** One bill a deal pays, as its card reads it. No field carries a pay link. */
export type PortalScheduledBillOut = {
  /** The bill's jobs_ledger_invoices id; null for a billed job's remainder with no bill behind it. */
  invoiceId: string | null
  jobLabel: string
  jobNumber: string
  jobName: string | null
  serviceTag: string | null
  jobAddress: string | null
  /** Still to come in kind (dollars). */
  amount: number
  /** What was billed (dollars). */
  billedAmount: number
  /** What the credits have paid so far (dollars). */
  totalPaid: number
  billedOn: string | null
}

/**
 * The viewer's bills on jobs a deal pays, oldest billed first, a remainder with no bill last. The rows
 * are the ledger's own rows for those jobs: an open bill the viewer owes, netted by the one payment rule.
 */
export function buildPortalScheduledBills(args: {
  jobs: readonly PortalDealJobRow[]
  invoices: PortalInvoiceRow[]
  payments: PortalPaymentRow[]
  viewerCustomerId: string
  /** Every sent bill (billed or paid) on these jobs, for the payment rule (v2.4534). */
  sentBills?: readonly PortalSentBillRow[] | null
}): PortalScheduledBillOut[] {
  const dealJobs = args.jobs.filter(jobIsOnInKindDeal)
  if (dealJobs.length === 0) return []
  const rows = buildPortalBills({ jobs: dealJobs, invoices: args.invoices, payments: args.payments, viewerCustomerId: args.viewerCustomerId, markGcRows: false, sentBills: args.sentBills ?? null })
  return rows
    .map((b) => ({
      invoiceId: b.invoiceId,
      jobLabel: b.jobLabel,
      jobNumber: b.jobNumber,
      jobName: b.jobName,
      serviceTag: b.serviceTag,
      jobAddress: b.jobAddress,
      amount: b.amount,
      billedAmount: Math.round((b.amount + b.totalPaid) * 100) / 100,
      totalPaid: b.totalPaid,
      billedOn: b.billedOn,
    }))
    .sort((a, b) => (a.billedOn ?? '9999').localeCompare(b.billedOn ?? '9999'))
}
