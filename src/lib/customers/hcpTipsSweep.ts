/**
 * HCP tips sweep (payment-backfill follow-up): HouseCall Pro's "Job amount"
 * includes tips, but the app's jobs were imported at the pre-tip figure — so
 * a job HCP shows as $370 collected reads $360 billed/$360 paid here and the
 * $10 tip is invisible. This kernel plans, per tipped HCP job, one "Tip
 * (HCP)" line item plus one matching tip payment (dated on the backfill's
 * fallback chain), so billed and collected both land on the HCP total.
 *
 * Guards: a job whose revenue already equals the HCP total has the tip baked
 * in (planned as `included` — never double-count); a job that already carries
 * a tip-named line is `done` (re-running is safe); anything else that doesn't
 * reconcile is `mismatch` and left for a human. Pure — flat rows in, a
 * reviewable plan out; nothing writes here.
 */

import { normalizeHcpNumber, type BackfillDateSource, type HcpExportRow } from './backfillHcpPayments'

export const TIP_LINE_NAME = 'Tip (HCP)'

export type TipsSweepJobInput = {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  customer_name: string | null
  status: string | null
  revenue: number | null
  payments_made: number | null
  created_at: string | null
}

export type TipsSweepState =
  /** Plannable: add the tip line + tip payment. */
  | 'add'
  /** Job revenue already equals the HCP total — tip is already in the figure. */
  | 'included'
  /** Job already carries a tip-named line item — added on a previous run. */
  | 'done'
  /** Tip exists in HCP but the job number isn't in the app. */
  | 'no_job'
  /** Revenue matches neither HCP total nor total-minus-tip — human call. */
  | 'mismatch'

export type TipsSweepRow = {
  state: TipsSweepState
  jobId: string | null
  /** Display number — HCP wins over Click, matching effectiveJobLedgerNumber. */
  label: string
  jobName: string
  customerName: string
  tip: number
  /** HCP "Job amount" (invoice total including the tip). */
  hcpTotal: number
  /** The app's current billed figure (null revenue reads 0). */
  revenueBefore: number
  /** revenueBefore + tip — what the job will bill after Apply. */
  revenueAfter: number
  paidOn: string | null
  dateSource: BackfillDateSource
  /** Billed job whose payments cover revenueAfter once the tip lands → flip to Paid via mark_job_paid. */
  markPaid: boolean
}

const CENTS = 0.005

function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= CENTS
}

/**
 * One plan row per HCP export row with a tip, matched to app jobs by number.
 * `tipLineJobIds` = jobs that already have a tip-named line item (query
 * `jobs_ledger_fixtures` with `name ilike 'tip%'`) — those rows come back as
 * `done` so the sweep is safe to re-run mid-failure.
 */
export function planHcpTipsSweep(
  jobs: TipsSweepJobInput[],
  exportRows: HcpExportRow[],
  tipLineJobIds: Set<string>,
): TipsSweepRow[] {
  const byNumber = new Map<string, TipsSweepJobInput>()
  const duplicateNumbers = new Set<string>()
  for (const j of jobs) {
    const n = normalizeHcpNumber(j.hcp_number)
    if (byNumber.has(n)) duplicateNumbers.add(n)
    byNumber.set(n, j)
  }
  const plan: TipsSweepRow[] = []
  for (const hcp of exportRows) {
    if (!(hcp.tipAmount > 0)) continue
    const job = byNumber.get(hcp.hcpNumber)
    let paidOn: string | null = null
    let dateSource: BackfillDateSource = 'ledger_created'
    if (hcp.paidOn) {
      paidOn = hcp.paidOn
      dateSource = 'hcp_paid'
    } else if (hcp.completedOn) {
      paidOn = hcp.completedOn
      dateSource = 'hcp_completed'
    } else if (hcp.createdOn) {
      paidOn = hcp.createdOn
      dateSource = 'hcp_created'
    } else if (job?.created_at) {
      paidOn = job.created_at.slice(0, 10)
    }
    const revenueBefore = Number(job?.revenue ?? 0)
    const base: Omit<TipsSweepRow, 'state'> = {
      jobId: job?.id ?? null,
      label: (job?.hcp_number ?? '').trim() || (job?.click_number ?? '').trim() || hcp.hcpNumber,
      jobName: (job?.job_name ?? '').trim(),
      customerName: (job?.customer_name ?? '').trim(),
      tip: hcp.tipAmount,
      hcpTotal: hcp.jobAmount,
      revenueBefore,
      revenueAfter: Math.round((revenueBefore + hcp.tipAmount) * 100) / 100,
      paidOn,
      dateSource,
      markPaid: false,
    }
    if (!job) {
      plan.push({ ...base, state: 'no_job' })
    } else if (duplicateNumbers.has(hcp.hcpNumber)) {
      // Two app jobs share this number (e.g. "033" and "33") — never guess
      // which one carries the money; a human sorts it out.
      plan.push({ ...base, state: 'mismatch' })
    } else if (tipLineJobIds.has(job.id)) {
      plan.push({ ...base, state: 'done' })
    } else if (near(revenueBefore, hcp.jobAmount)) {
      plan.push({ ...base, state: 'included' })
    } else if (near(revenueBefore + hcp.tipAmount, hcp.jobAmount) && paidOn) {
      const covered = Number(job.payments_made ?? 0) + hcp.tipAmount >= base.revenueAfter - CENTS
      plan.push({ ...base, state: 'add', markPaid: job.status === 'billed' && covered })
    } else {
      plan.push({ ...base, state: 'mismatch' })
    }
  }
  plan.sort((a, b) => ((a.paidOn ?? '') < (b.paidOn ?? '') ? 1 : (a.paidOn ?? '') > (b.paidOn ?? '') ? -1 : 0))
  return plan
}

export function tipPaymentNote(row: TipsSweepRow): string {
  return `Tip recorded in HouseCall Pro (HCP collected $${row.hcpTotal.toFixed(2)} total)`
}
