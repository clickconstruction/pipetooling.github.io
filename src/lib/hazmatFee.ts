import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { ESTIMATE_PUBLIC_TERMS_BODY_APP_KEY } from './estimatePublicTerms'

/**
 * Hazmat Fee (Jobs → Stages): documents a biohazard exposure incident and
 * bills the customer a fixed rider fee via the `create_hazmat_fee_incident`
 * RPC (trip-charge mechanics: independent ready_to_bill invoice row).
 */

export const HAZMAT_FEE_DEFAULT_APP_KEY = 'hazmat_fee_default' as const
export const HAZMAT_FEE_FALLBACK_AMOUNT = 500

export type HazmatTestimonial = {
  name: string
  userId?: string | null
  statement: string
  givenAt: string
}

export type HazmatIncidentDraft = {
  incidentAt: string
  description: string
  exposedPeople: string
  stageLabel: string | null
  photoLinks: string[]
  testimonials: HazmatTestimonial[]
  tosClauseSnapshot: string
  feeAmount: number
}

/** Must match `v_memo` in the `create_hazmat_fee_incident` migration. */
export function buildHazmatFeeMemo(incidentDateMdy: string): string {
  return `Hazmat remediation fee — incident ${incidentDateMdy}`
}

/**
 * Pull the biohazard clause (§11) out of the live terms body: from the line
 * starting `11. Biohazard` up to the next numbered section or the trailing
 * company block. Returns null when the clause is missing so the wizard can
 * warn instead of snapshotting nothing.
 */
export function extractHazmatClause(termsBody: string): string | null {
  const lines = termsBody.split('\n')
  const startIdx = lines.findIndex((l) => /^\s*11\.\s*Biohazard/i.test(l))
  if (startIdx === -1) return null
  const out: string[] = []
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (i > startIdx && (/^\s*\d+\.\s+\S/.test(line) || /^\s*Click Plumbing/i.test(line))) break
    out.push(line)
  }
  const text = out.join('\n').trim()
  return text.length > 0 ? text : null
}

/** Live terms body (same setting the /estimate/terms page serves) → clause + full length for the snapshot metadata. */
export async function loadHazmatClauseFromTerms(): Promise<{
  clause: string | null
  termsLength: number
}> {
  try {
    const row = await withSupabaseRetry<{ value_text: string | null } | null>(
      async () =>
        supabase
          .from('app_settings')
          .select('value_text')
          .eq('key', ESTIMATE_PUBLIC_TERMS_BODY_APP_KEY)
          .maybeSingle(),
      'load terms for hazmat clause',
    )
    const body = row?.value_text ?? ''
    return { clause: extractHazmatClause(body), termsLength: body.length }
  } catch {
    return { clause: null, termsLength: 0 }
  }
}

export async function loadHazmatFeeDefault(): Promise<number> {
  try {
    const row = await withSupabaseRetry<{ value_num: number | null } | null>(
      async () =>
        supabase
          .from('app_settings')
          .select('value_num')
          .eq('key', HAZMAT_FEE_DEFAULT_APP_KEY)
          .maybeSingle(),
      'load hazmat fee default',
    )
    const n = Number(row?.value_num)
    return Number.isFinite(n) && n > 0 ? n : HAZMAT_FEE_FALLBACK_AMOUNT
  } catch {
    return HAZMAT_FEE_FALLBACK_AMOUNT
  }
}

export async function createHazmatFeeIncident(
  jobId: string,
  draft: HazmatIncidentDraft,
): Promise<{ ok: boolean; error: string | null; invoiceId?: string; incidentId?: string }> {
  const { data, error: rpcErr } = await supabase.rpc('create_hazmat_fee_incident', {
    p_job_id: jobId,
    p_amount: draft.feeAmount,
    p_incident: {
      incident_at: draft.incidentAt,
      description: draft.description,
      exposed_people: draft.exposedPeople,
      stage_label: draft.stageLabel,
      photo_links: draft.photoLinks,
      testimonials: draft.testimonials.map((t) => ({
        name: t.name,
        user_id: t.userId ?? null,
        statement: t.statement,
        given_at: t.givenAt,
      })),
      tos_clause_snapshot: draft.tosClauseSnapshot,
    },
  })
  if (rpcErr) return { ok: false, error: rpcErr.message }
  const result = (data ?? {}) as { ok?: boolean; error?: string; invoice_id?: string; incident_id?: string }
  if (result.error) return { ok: false, error: result.error }
  if (!result.ok) return { ok: false, error: 'Could not create the hazmat fee' }
  return { ok: true, error: null, invoiceId: result.invoice_id, incidentId: result.incident_id }
}
