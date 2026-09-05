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
