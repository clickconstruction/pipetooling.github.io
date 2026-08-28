import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { APP_ORIGIN } from './appOrigin'
import type { Database } from '../types/database'
import type { HazmatIncidentDraft, HazmatTestimonial } from './hazmatFee'
import type { HazmatNoticeJobInfo } from './jobsDocuments/hazmatFeeNotice'

/**
 * Persisted hazmat incidents (`job_hazmat_incidents`, written only by the
 * `create_hazmat_fee_incident` RPC). These helpers re-hydrate the notice
 * builders from the saved record so the Biohazard Remediation Fee Notice can
 * be re-opened, downloaded, or attached any time after the wizard closes.
 */

// v2.1038 columns (edited_at / voided_at / voided_by) intersected manually until
// the next `gen-types:linked` run after the migration is pushed.
export type JobHazmatIncidentRow = Database['public']['Tables']['job_hazmat_incidents']['Row'] & {
  edited_at?: string | null
  voided_at?: string | null
  voided_by?: string | null
  notice_emailed_at?: string | null
  notice_emailed_to?: string | null
}

/** Tolerant jsonb → string[] (photo links). Malformed entries are dropped, never thrown. */
function parsePhotoLinks(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
}

/** Tolerant jsonb → testimonials. Malformed entries are dropped, never thrown. */
function parseTestimonials(value: unknown): HazmatTestimonial[] {
  if (!Array.isArray(value)) return []
  const out: HazmatTestimonial[] = []
  for (const v of value) {
    if (v == null || typeof v !== 'object') continue
    const o = v as { name?: unknown; user_id?: unknown; statement?: unknown; given_at?: unknown }
    const name = typeof o.name === 'string' ? o.name : ''
    const statement = typeof o.statement === 'string' ? o.statement : ''
    if (!name.trim() || !statement.trim()) continue
    out.push({
      name,
      userId: typeof o.user_id === 'string' ? o.user_id : null,
      statement,
      givenAt: typeof o.given_at === 'string' ? o.given_at : '',
    })
  }
  return out
}

/** Saved incident row → the draft shape both notice builders (HTML + PDF) take. */
export function hazmatIncidentRowToDraft(row: JobHazmatIncidentRow): HazmatIncidentDraft {
  return {
    incidentAt: row.incident_at,
    description: row.description,
    exposedPeople: row.exposed_people ?? '',
    stageLabel: row.stage_label,
    photoLinks: parsePhotoLinks(row.photo_links),
    testimonials: parseTestimonials(row.testimonials),
    tosClauseSnapshot: row.tos_clause_snapshot,
    feeAmount: Number(row.fee_amount),
    editedAt: row.edited_at ?? null,
    voidedAt: row.voided_at ?? null,
  }
}

/** Job fields the notice header needs — same fallbacks as the Stages ☣ button mapping. */
export function hazmatNoticeJobInfoFromJob(job: {
  hcp_number?: string | null
  click_number?: string | null
  job_name?: string | null
  job_address?: string | null
  customer_name?: string | null
}): HazmatNoticeJobInfo {
  return {
    jobNumber: (job.hcp_number ?? '').trim() || (job.click_number ?? '').trim() || '—',
    jobName: (job.job_name ?? '').trim() || 'Job',
    jobAddress: (job.job_address ?? '').trim() || '—',
    customerName: (job.customer_name ?? '').trim() || '—',
  }
}

/** Public tokenized notice URL (linked from the Stripe invoice footer). */
export function hazmatNoticePublicUrl(publicToken: string, origin?: string): string {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : APP_ORIGIN)
  return `${base}/hazmat-notice?token=${encodeURIComponent(publicToken)}`
}

/** All incidents for a job, newest first. Office/billing roles only (RLS). */
export async function loadJobHazmatIncidents(jobId: string): Promise<JobHazmatIncidentRow[]> {
  const data = await withSupabaseRetry(
    async () =>
      await supabase
        .from('job_hazmat_incidents')
        .select('*')
        .eq('job_id', jobId)
        .order('incident_at', { ascending: false }),
    'load job hazmat incidents',
  )
  return (data ?? []) as JobHazmatIncidentRow[]
}

/** Sum of all incidents' fees (v2.1029) — riders count toward the Job Total in
 * Edit Job's ① Line Items and in the revenue written on save, so editing a job
 * no longer wipes the fee's revenue bump. */
export function sumHazmatRiderFees(
  incidents: readonly (Pick<JobHazmatIncidentRow, 'fee_amount'> & { voided_at?: string | null })[],
): number {
  return incidents.reduce((s, r) => {
    if (r.voided_at) return s
    const fee = Number(r.fee_amount)
    return Number.isFinite(fee) && fee > 0 ? s + fee : s
  }, 0)
}
