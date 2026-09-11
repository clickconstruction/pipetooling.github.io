/**
 * Which jobs' bills belong on the customer portal statement (v2.2839 —
 * journey-map J21-F1 / J22-F1, decision 6). One rule, shared with the
 * customer-portal edge function's invoice fetch and `buildPortalBills`, and
 * deliberately identical to the GC statement email payload RPC
 * (`get_gc_statement_email_payload`, migration 20260806232759):
 *
 *   * invoice rows: billed-status invoices from jobs of ANY non-paid status —
 *     a billed, unpaid invoice is owed whatever stage the job is in (progress
 *     bills on `working` jobs, change orders, `ready_to_bill` partials…);
 *   * job-shell rows: ONLY `billed` jobs with zero billed invoices print the
 *     job-level remainder (revenue − payments_made). A working job with no
 *     billed line has nothing owed yet — printing its revenue remainder as a
 *     "bill" would invent a debt.
 *
 * Before this rule the portal required the JOB to be `billed` for both, and
 * a customer with progress bills on in-progress jobs saw about half of what
 * they owed ($19,453 shown vs $38,036 owed on the live specimen).
 *
 * Dependency-free Deno module; unit-tested from vitest
 * (src/lib/portal/portalBillMembership.test.ts).
 */

import { effectiveInvoiceParty, payerCustomerId } from './billToParty.ts'

/** The only invoice status the statement lists. */
export const PORTAL_OPEN_INVOICE_STATUS = 'billed'

/**
 * A job whose billed invoices belong on the statement: any status except
 * `paid` (mirrors `j.status <> 'paid'` in the GC payload — a null/unknown
 * status is excluded there too, so it is excluded here).
 */
export function jobCarriesOpenBills(status: string | null | undefined): boolean {
  return typeof status === 'string' && status.length > 0 && status !== 'paid'
}

/**
 * A job that may print the invoice-less shell remainder when it has no
 * billed line: `billed` only. Never widen this — see the module header.
 */
export function jobPrintsShellRemainder(status: string | null | undefined): boolean {
  return status === 'billed'
}

/** Ids of the jobs whose billed invoices the payload should fetch. */
export function openBillJobIds<T extends { id: string; status: string | null }>(jobs: T[]): string[] {
  return jobs.filter((j) => jobCarriesOpenBills(j.status)).map((j) => j.id)
}

export type OwedJobFields = { id: string; status: string | null; customer_id?: string | null; gc_customer_id?: string | null; bill_to_party?: string | null }
export type OwedInvoiceFields = { job_id: string; bill_to_party?: string | null; bill_to_email?: string | null }

/**
 * Who pays (v2.3346): does this viewer owe this bill? The job's rule + the
 * invoice's pick + a typed recipient resolve to a payer customers row; the
 * bill is the viewer's when that row is theirs. A shell row (no invoice)
 * follows the job rule alone.
 */
export function viewerOwesBill(job: OwedJobFields, invoice: OwedInvoiceFields | null, viewerCustomerId: string): boolean {
  const party = effectiveInvoiceParty(job, invoice)
  return payerCustomerId(job, party) === viewerCustomerId
}

/**
 * Ids of the jobs on which the viewer owes at least one open bill (or the
 * shell remainder) — the scope a portal promise covers. Jobs with no billed
 * invoice yet fall back to the job rule.
 */
export function owedJobIdsForViewer(jobs: OwedJobFields[], invoices: OwedInvoiceFields[], viewerCustomerId: string): string[] {
  const byJob = new Map<string, OwedInvoiceFields[]>()
  for (const inv of invoices) {
    const list = byJob.get(inv.job_id) ?? []
    list.push(inv)
    byJob.set(inv.job_id, list)
  }
  const out: string[] = []
  for (const j of jobs) {
    if (!jobCarriesOpenBills(j.status)) continue
    const invs = byJob.get(j.id) ?? []
    const owed = invs.length > 0 ? invs.some((inv) => viewerOwesBill(j, inv, viewerCustomerId)) : viewerOwesBill(j, null, viewerCustomerId)
    if (owed) out.push(j.id)
  }
  return out
}
