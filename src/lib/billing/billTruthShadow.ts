/**
 * Bill-truth shadow beacon (one release only — REMOVE with the next bill-truth
 * PR after v2.2862 data has been observed for a week; see the v2 fragment).
 *
 * Every surface that adopted `billTruth.ts` keeps its OLD sum for one release
 * as a shadow computation and calls `reportBillTruthShadow` with both. When
 * they differ by more than a cent the beacon fires:
 *  - dev / preview builds: `console.warn('[bill_truth_mismatch]', …)`;
 *  - signed-in users: one `ui_nav_clicks` row via `recordNavClick` — control
 *    `bill_truth_mismatch`, target `/<surface>?legacy=…&kernel=…` — so the
 *    live delta is queryable without a migration (the nav-click table already
 *    exists and is best-effort by design).
 *
 * A fired beacon is not a bug in the kernel: it is the documented reason the
 * old number was wrong (an orphan bill, a negative shell, a settled-but-
 * unmarked bill, a shell job the footer skipped) showing up in real data.
 *
 * The legacy sums live here — tiny, colocated, and deleted together.
 */
import { recordNavClick } from '../navClickTelemetry'
import {
  isBilledInvoiceStatus,
  openRemainder,
  type BillTruthInvoice,
  type BillTruthJob,
  type BillTruthPayment,
} from './billTruth'

export const BILL_TRUTH_MISMATCH_CONTROL = 'bill_truth_mismatch'

export type BillTruthShadowSurface =
  | 'dashboard-ar-card'
  | 'dashboard-billed-pin'
  | 'pipeline-strip-billed'
  | 'quickfill-ar-count'
  | 'customer-hub-lifetime'
  | 'customer-hub-open-balance'
  | 'customers-list-open-balance'

export type BillTruthShadowReport = {
  surface: BillTruthShadowSurface
  legacy: number
  kernel: number
  /** For the `ui_nav_clicks` row; omit (or null) to log only. */
  userId?: string | null
  role?: string | null
}

const TOLERANCE = 0.01

function isTestRun(): boolean {
  try {
    return typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test'
  } catch {
    return false
  }
}

/** Pure part: did the legacy figure and the kernel figure disagree? */
export function billTruthShadowMismatch(legacy: number, kernel: number): boolean {
  if (!Number.isFinite(legacy) || !Number.isFinite(kernel)) return legacy !== kernel
  return Math.abs(legacy - kernel) > TOLERANCE
}

/** Target string for the nav-click row (root-relative so it groups with nav targets). */
export function billTruthShadowTarget(report: Pick<BillTruthShadowReport, 'surface' | 'legacy' | 'kernel'>): string {
  const fmt = (n: number) => (Math.round(n * 100) / 100).toString()
  return `/${report.surface}?legacy=${fmt(report.legacy)}&kernel=${fmt(report.kernel)}`
}

/** Returns true when the beacon fired. Never throws. */
export function reportBillTruthShadow(report: BillTruthShadowReport): boolean {
  if (!billTruthShadowMismatch(report.legacy, report.kernel)) return false
  try {
    if (!isTestRun() && import.meta.env?.DEV) {
      console.warn(`[${BILL_TRUTH_MISMATCH_CONTROL}]`, report.surface, { legacy: report.legacy, kernel: report.kernel })
    }
    if (report.userId && !isTestRun()) {
      recordNavClick(report.userId, report.role ?? null, BILL_TRUTH_MISMATCH_CONTROL, billTruthShadowTarget(report))
    }
  } catch {
    /* measurement is best-effort by design */
  }
  return true
}

// ---------------------------------------------------------------------------
// Legacy sums, verbatim semantics (what each surface showed before the kernel).
// ---------------------------------------------------------------------------

/**
 * Dashboard AR card before v2.2862: every `billed` invoice regardless of
 * job (orphans included, "Unknown job"), max(0, amount − applied), dropping
 * ≤ ½¢; plus billed jobs with no billed invoice at max(0, revenue − paid),
 * dropping ≤ ½¢. Collections split ignored (ar + collections).
 */
export function legacyDashboardArOwed(
  jobs: ReadonlyArray<Pick<BillTruthJob, 'id' | 'status' | 'revenue' | 'payments_made'>>,
  invoices: ReadonlyArray<BillTruthInvoice>,
  payments: ReadonlyArray<BillTruthPayment>,
): number {
  const applied = new Map<string, number>()
  for (const p of payments) {
    if (!p.invoice_id) continue
    applied.set(p.invoice_id, (applied.get(p.invoice_id) ?? 0) + Number(p.amount ?? 0))
  }
  let total = 0
  const jobIdsWithBilled = new Set<string>()
  for (const inv of invoices) {
    if (!isBilledInvoiceStatus(inv.status)) continue
    jobIdsWithBilled.add(inv.job_id)
    const rem = openRemainder(inv.amount, applied.get(inv.id) ?? 0)
    if (rem > 0.005) total += rem
  }
  for (const j of jobs) {
    if ((j.status ?? '') !== 'billed' || jobIdsWithBilled.has(j.id)) continue
    const rem = openRemainder(j.revenue, j.payments_made)
    if (rem > 0.005) total += rem
  }
  return total
}

/**
 * Dashboard "Billed" pin (`useBilledTotal`) before: all `billed` invoices on
 * ANY job (orphans and paid-job bills included) plus billed job shells.
 */
export function legacyBilledPinTotal(
  billedJobs: ReadonlyArray<Pick<BillTruthJob, 'id' | 'revenue' | 'payments_made'>>,
  billedInvoices: ReadonlyArray<Pick<BillTruthInvoice, 'id' | 'job_id' | 'amount'>>,
  payments: ReadonlyArray<BillTruthPayment>,
): number {
  const applied = new Map<string, number>()
  for (const p of payments) {
    if (!p.invoice_id) continue
    applied.set(p.invoice_id, (applied.get(p.invoice_id) ?? 0) + Number(p.amount ?? 0))
  }
  const withInvoice = new Set(billedInvoices.map((i) => i.job_id))
  let sum = 0
  for (const inv of billedInvoices) sum += openRemainder(inv.amount, applied.get(inv.id) ?? 0)
  for (const j of billedJobs) if (!withInvoice.has(j.id)) sum += openRemainder(j.revenue, j.payments_made)
  return sum
}

/** Pipeline strip / board header before: shell rows summed UNCLAMPED (revenue − payments_made). */
export function legacyStripBilledTotal(
  rows: ReadonlyArray<{ kind: 'invoice' | 'shell'; billed: number; applied: number }>,
): number {
  let s = 0
  for (const r of rows) s += r.kind === 'shell' ? r.billed - r.applied : openRemainder(r.billed, r.applied)
  return s
}

/** Customer Hub OPEN BALANCE before: shells unclamped and netted across the customer's jobs. */
export function legacyHubOpenBalance(rows: ReadonlyArray<{ kind: 'invoice' | 'shell'; billed: number; applied: number }>): number {
  return legacyStripBilledTotal(rows)
}

/** Customers list open balance before: rows clamped per invoice, shells unclamped, then the CUSTOMER total clamped at 0. */
export function legacyListOpenBalance(rows: ReadonlyArray<{ kind: 'invoice' | 'shell'; billed: number; applied: number }>): number {
  return Math.max(0, legacyStripBilledTotal(rows))
}

/** Hub Invoices footer "Lifetime" before: Σ billed/paid INVOICE amounts only — no job-shell arm. */
export function legacyFooterLifetime(invoices: ReadonlyArray<Pick<BillTruthInvoice, 'status' | 'amount'>>): number {
  let s = 0
  for (const inv of invoices) if (inv.status === 'billed' || inv.status === 'paid') s += Number(inv.amount ?? 0)
  return s
}
