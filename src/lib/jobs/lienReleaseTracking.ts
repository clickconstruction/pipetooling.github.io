import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { billCheckClearsYmd, type ClearingPayment } from './checkClearing'
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
  return v === 'conditional_progress' || v === 'unconditional_progress' || v === 'conditional_final' || v === 'unconditional_final'
}

/** A conditional form — progress or final (v2.4274) — waits on the money behind it. */
export function isConditionalLienForm(v: string): boolean {
  return v === 'conditional_progress' || v === 'conditional_final'
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
 *
 * With `todayYmd` (v2.4564) a check on a covered line that is still inside its
 * clearing days keeps the release waiting: the same seven days the Bill tab,
 * View bill and GC Review hold the unconditional for (`checkClearing.ts`).
 */
export function lienReleaseClearance(
  release: Pick<JobLienReleaseRow, 'form_type' | 'amount' | 'invoice_ids' | 'created_at'>,
  job: Pick<JobWithDetails, 'payments' | 'payments_made'>,
  todayYmd?: string,
): LienReleaseClearance {
  if (!isConditionalLienForm(release.form_type)) return 'not_applicable'
  const amount = Number(release.amount ?? 0)
  if (amount <= 0) return 'cleared'
  const ids = new Set(release.invoice_ids ?? [])
  if (ids.size > 0) {
    let applied = 0
    for (const p of job.payments ?? []) {
      if (p.invoice_id && ids.has(p.invoice_id)) applied += Number(p.amount ?? 0)
    }
    if (applied < amount) return 'waiting'
    return todayYmd && lienReleaseCheckStillClearing(release, job.payments ?? [], todayYmd) ? 'waiting' : 'cleared'
  }
  return Number(job.payments_made ?? 0) >= amount ? 'cleared' : 'waiting'
}

/** A check on one of the release's bill lines has not had its clearing days yet (v2.4564). */
export function lienReleaseCheckStillClearing(
  release: Pick<JobLienReleaseRow, 'invoice_ids'>,
  payments: ReadonlyArray<ClearingPayment>,
  todayYmd: string,
): boolean {
  return (release.invoice_ids ?? []).some((id) => billCheckClearsYmd(id, payments, todayYmd) != null)
}

/** The unconditional form a cleared conditional is owed (v2.4564): a final stays a final. */
export function unconditionalFollowUpForm(formType: string): LienWaiverFormType {
  return formType === 'conditional_final' ? 'unconditional_final' : 'unconditional_progress'
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
  clearing?: LienCheckClearing,
): { count: number; total: number; jobIds: string[] } {
  let count = 0
  let total = 0
  const jobIds: string[] = []
  for (const [jobId, owed] of owedLienReleasesByJob(releases, appliedByInvoiceId, clearing)) {
    count += owed.length
    total += owed.reduce((s, r) => s + Number(r.amount ?? 0), 0)
    jobIds.push(jobId)
  }
  return { count, total, jobIds }
}

/**
 * A conditional release whose payment has cleared, with no unconditional
 * release issued on or after it — the GC is owed the unconditional version.
 * A draft is not issued (v2.4564): an unconditional still being written does
 * not settle the debt, and a conditional still being written owes nothing.
 */
export function lienReleasesOwingUnconditional(
  rows: JobLienReleaseRow[],
  job: Pick<JobWithDetails, 'payments' | 'payments_made'>,
): JobLienReleaseRow[] {
  const live = liveLienReleases(rows).filter((r) => (r.status ?? '').trim() !== 'draft')
  return live.filter((r) => {
    if (lienReleaseClearance(r, job) !== 'cleared') return false
    const covered = new Set(r.invoice_ids ?? [])
    return !live.some(
      (u) =>
        !isConditionalLienForm(u.form_type) &&
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

// ---------- The cleared-releases queue (Needs you → "Issue release") ----------

/** The payment columns the queue needs to say what cleared a release. */
export type LienQueuePayment = Pick<
  Database['public']['Tables']['jobs_ledger_payments']['Row'],
  'id' | 'invoice_id' | 'amount' | 'paid_on' | 'payment_type' | 'reference_number' | 'created_at'
>

/** The job columns the queue shows on each row. */
export type LienQueueJob = Pick<
  Database['public']['Tables']['jobs_ledger']['Row'],
  'id' | 'hcp_number' | 'click_number' | 'job_name' | 'customer_name' | 'job_address'
>

/**
 * One queue row: a cleared conditional release that is still owed its
 * unconditional follow-up, with the job and the payment that cleared it.
 */
export type LienUnconditionalQueueRow = {
  releaseId: string
  jobId: string
  /** HCP number, else Click number, else '' — same precedence as the board. */
  jobNumber: string
  jobName: string
  customerName: string
  jobAddress: string
  release: JobLienReleaseRow
  amount: number
  /** YYYY-MM-DD the conditional release was issued. */
  issuedOn: string
  invoiceIds: string[]
  /** Sum applied to the covered bill lines. */
  appliedTotal: number
  /** YYYY-MM-DD of the newest payment on the covered lines — '' when the date is unknown. */
  clearedOn: string
  /** "Check #4471", "ACH", "Payment" — from the newest payment on the covered lines. */
  clearedBy: string
}

/** Sum of payments by invoice id — the map `computeLienUnconditionalOwed` expects. */
export function appliedByInvoiceIdFromPayments(
  payments: ReadonlyArray<Pick<LienQueuePayment, 'invoice_id' | 'amount'>>,
): Map<string, number> {
  const applied = new Map<string, number>()
  for (const p of payments) {
    if (!p.invoice_id) continue
    applied.set(p.invoice_id, (applied.get(p.invoice_id) ?? 0) + Number(p.amount ?? 0))
  }
  return applied
}

/** The payments and the day that say whether a check is still clearing (v2.4564). */
export type LienCheckClearing = { payments: ReadonlyArray<ClearingPayment>; todayYmd: string }

/** Owed releases per job — the shared core of the roll-up and the queue. */
function owedLienReleasesByJob(
  releases: JobLienReleaseRow[],
  appliedByInvoiceId: ReadonlyMap<string, number>,
  clearing?: LienCheckClearing,
): Map<string, JobLienReleaseRow[]> {
  const byJob = new Map<string, JobLienReleaseRow[]>()
  for (const r of releases) {
    const list = byJob.get(r.job_id)
    if (list) list.push(r)
    else byJob.set(r.job_id, [r])
  }
  const out = new Map<string, JobLienReleaseRow[]>()
  for (const [jobId, rows] of byJob) {
    const invoiceIds = new Set(rows.flatMap((r) => r.invoice_ids ?? []))
    const payments = [...invoiceIds].map((invoice_id) => ({
      invoice_id,
      amount: appliedByInvoiceId.get(invoice_id) ?? 0,
    })) as JobWithDetails['payments']
    const owed = lienReleasesOwingUnconditional(rows, { payments, payments_made: 0 }).filter(
      (r) => (r.invoice_ids ?? []).length > 0 && !(clearing && lienReleaseCheckStillClearing(r, clearing.payments, clearing.todayYmd)),
    )
    if (owed.length > 0) out.set(jobId, owed)
  }
  return out
}

/** "Check #4471" / "ACH" / "Payment" — how a payment row names itself on the queue. */
export function lienQueuePaymentLabel(p: Pick<LienQueuePayment, 'payment_type' | 'reference_number'>): string {
  const type = (p.payment_type ?? '').trim()
  const ref = (p.reference_number ?? '').trim()
  const typeLabel = type ? type.charAt(0).toUpperCase() + type.slice(1) : ''
  if (typeLabel && ref) return `${typeLabel} #${ref}`
  if (typeLabel) return typeLabel
  if (ref) return `#${ref}`
  return 'Payment'
}

/**
 * Build the queue the Dashboard's "Issue release" action opens: every cleared
 * conditional release still owed its unconditional version, one row each,
 * with job identity and the payment that cleared it. Oldest cleared first,
 * so the longest-waiting customer sits on top. Same owed set as
 * `computeLienUnconditionalOwed` — the count on the card and the rows in the
 * queue can never disagree.
 */
export function buildLienUnconditionalQueue(
  releases: JobLienReleaseRow[],
  payments: ReadonlyArray<LienQueuePayment>,
  jobsById: ReadonlyMap<string, LienQueueJob>,
  todayYmd?: string,
): LienUnconditionalQueueRow[] {
  const owedByJob = owedLienReleasesByJob(releases, appliedByInvoiceIdFromPayments(payments), todayYmd ? { payments, todayYmd } : undefined)
  const rows: LienUnconditionalQueueRow[] = []
  for (const [jobId, owed] of owedByJob) {
    const job = jobsById.get(jobId)
    for (const r of owed) {
      const invoiceIds = r.invoice_ids ?? []
      const covered = new Set(invoiceIds)
      const matching = payments.filter((p) => p.invoice_id != null && covered.has(p.invoice_id))
      const dated = matching
        // paid_on is a date; the created_at fallback is an instant, read in APP_CALENDAR_TZ.
        .map((p) => ({ p, on: p.paid_on != null ? p.paid_on.slice(0, 10) : calendarYmdInAppTzFromIso(p.created_at ?? '') }))
        .sort((a, b) => a.on.localeCompare(b.on))
      const newest = dated[dated.length - 1]
      rows.push({
        releaseId: r.id,
        jobId,
        jobNumber: (job?.hcp_number ?? '').trim() || (job?.click_number ?? '').trim() || '',
        jobName: (job?.job_name ?? '').trim(),
        customerName: (job?.customer_name ?? '').trim(),
        jobAddress: (job?.job_address ?? '').trim(),
        release: r,
        amount: Number(r.amount ?? 0),
        issuedOn: calendarYmdInAppTzFromIso(r.created_at ?? ''),
        invoiceIds,
        appliedTotal: matching.reduce((s, p) => s + Number(p.amount ?? 0), 0),
        clearedOn: newest?.on ?? '',
        clearedBy: newest ? lienQueuePaymentLabel(newest.p) : 'Payment',
      })
    }
  }
  return rows.sort((a, b) => a.clearedOn.localeCompare(b.clearedOn) || a.issuedOn.localeCompare(b.issuedOn))
}
