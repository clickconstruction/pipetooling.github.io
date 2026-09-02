import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import {
  LIEN_WAIVER_FORM_SHORT_LABELS,
  type LienWaiverFields,
  type LienWaiverFormType,
} from '../jobsDocuments/lienWaiverRelease'

/**
 * Tracking helpers for issued lien releases (v2.2582): rows in
 * `job_lien_releases` record what `LienReleaseModal` generated. Pure logic —
 * clearance status for conditional releases (has the money behind the release
 * actually landed?) and display labels for the Bill Customer strip / board
 * badge live here, unit-tested.
 */

export type JobLienReleaseRow = Database['public']['Tables']['job_lien_releases']['Row']

export function isLienWaiverFormType(v: string): v is LienWaiverFormType {
  return v === 'conditional_progress' || v === 'unconditional_progress' || v === 'unconditional_final'
}

export function lienReleaseFormLabel(formType: string): string {
  return isLienWaiverFormType(formType) ? LIEN_WAIVER_FORM_SHORT_LABELS[formType] : formType
}

/** The rendered-fields snapshot, tolerant of unknown/legacy JSON shapes. */
export function lienReleaseFieldsFromSnapshot(fields: unknown): Partial<LienWaiverFields> {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return {}
  const o = fields as Record<string, unknown>
  const out: Partial<LienWaiverFields> = {}
  const keys: (keyof LienWaiverFields)[] = [
    'companyName',
    'checkFrom',
    'amount',
    'projectDescription',
    'throughDate',
    'signedDate',
    'signerName',
    'signerTitle',
  ]
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'string') out[k] = v
  }
  return out
}

export type LienReleaseClearance = 'cleared' | 'waiting' | 'not_applicable'

/**
 * For a conditional-progress release: has payment ≥ the released amount been
 * applied to the covered bill lines since issuance? Payments are matched by
 * `invoice_id` against the release's `invoice_ids` snapshot; a release with no
 * line snapshot compares against the job's total `payments_made` recorded on
 * or after the release date. Unconditional forms have nothing to wait on.
 */
export function lienReleaseClearance(
  release: Pick<JobLienReleaseRow, 'form_type' | 'amount' | 'invoice_ids' | 'created_at'>,
  job: Pick<JobWithDetails, 'payments' | 'payments_made'>,
): LienReleaseClearance {
  if (release.form_type !== 'conditional_progress') return 'not_applicable'
  const amount = Number(release.amount ?? 0)
  if (amount <= 0) return 'cleared'
  const ids = new Set(release.invoice_ids ?? [])
  if (ids.size > 0) {
    let applied = 0
    for (const p of job.payments ?? []) {
      if (p.invoice_id && ids.has(p.invoice_id)) applied += Number(p.amount ?? 0)
    }
    return applied >= amount ? 'cleared' : 'waiting'
  }
  return Number(job.payments_made ?? 0) >= amount ? 'cleared' : 'waiting'
}

/** Live (non-voided) releases, newest first. */
export function liveLienReleases(rows: JobLienReleaseRow[]): JobLienReleaseRow[] {
  return rows.filter((r) => r.voided_at == null).slice().sort((a, b) => b.created_at.localeCompare(a.created_at))
}

/**
 * Company-wide roll-up for the Dashboard nudge (v2.2582): group all live
 * releases by job, resolve clearance from a payments-by-invoice map (built
 * from one `jobs_ledger_payments` query), and count the cleared conditionals
 * still owed their unconditional follow-up. Releases with no invoice snapshot
 * can't prove clearance from the map alone and are conservatively skipped.
 */
export function computeLienUnconditionalOwed(
  releases: JobLienReleaseRow[],
  appliedByInvoiceId: ReadonlyMap<string, number>,
): { count: number; total: number; jobIds: string[] } {
  const byJob = new Map<string, JobLienReleaseRow[]>()
  for (const r of releases) {
    const list = byJob.get(r.job_id)
    if (list) list.push(r)
    else byJob.set(r.job_id, [r])
  }
  let count = 0
  let total = 0
  const jobIds: string[] = []
  for (const [jobId, rows] of byJob) {
    const invoiceIds = new Set(rows.flatMap((r) => r.invoice_ids ?? []))
    const payments = [...invoiceIds].map((invoice_id) => ({
      invoice_id,
      amount: appliedByInvoiceId.get(invoice_id) ?? 0,
    })) as JobWithDetails['payments']
    const owed = lienReleasesOwingUnconditional(rows, { payments, payments_made: 0 }).filter(
      (r) => (r.invoice_ids ?? []).length > 0,
    )
    if (owed.length > 0) {
      count += owed.length
      total += owed.reduce((s, r) => s + Number(r.amount ?? 0), 0)
      jobIds.push(jobId)
    }
  }
  return { count, total, jobIds }
}

/**
 * A conditional release whose payment has cleared, with no unconditional
 * release issued on or after it — the GC is owed the unconditional version.
 */
export function lienReleasesOwingUnconditional(
  rows: JobLienReleaseRow[],
  job: Pick<JobWithDetails, 'payments' | 'payments_made'>,
): JobLienReleaseRow[] {
  const live = liveLienReleases(rows)
  return live.filter((r) => {
    if (lienReleaseClearance(r, job) !== 'cleared') return false
    const covered = new Set(r.invoice_ids ?? [])
    return !live.some(
      (u) =>
        u.form_type !== 'conditional_progress' &&
        u.created_at >= r.created_at &&
        (covered.size === 0 ||
          (u.invoice_ids ?? []).length === 0 ||
          (u.invoice_ids ?? []).some((id) => covered.has(id))),
    )
  })
}

/** The full snapshot rebuilt into renderable fields (row-level fallbacks for amount/dates) — one mapping, used by every re-render surface (v2.2620). */
export function lienReleaseSnapshotToWaiverFields(row: JobLienReleaseRow): LienWaiverFields {
  const s = lienReleaseFieldsFromSnapshot(row.fields)
  return {
    companyName: s.companyName ?? '',
    checkFrom: s.checkFrom ?? '',
    amount: s.amount ?? String(row.amount ?? ''),
    projectDescription: s.projectDescription ?? '',
    throughDate: s.throughDate ?? row.through_date ?? '',
    signedDate: s.signedDate ?? row.signed_date ?? '',
    signerName: s.signerName ?? '',
    signerTitle: s.signerTitle ?? '',
  }
}
