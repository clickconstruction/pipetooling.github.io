import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { LienClaimCorrection } from './lienClaimCorrection'

const table = () => supabase.from('job_lien_claim_corrections')

/** The table row → the kernel's shape. */
export function parseLienClaimCorrection(row: unknown): LienClaimCorrection | null {
  const r = row as { job_id?: unknown; amount_off?: unknown; per_month?: unknown; reason?: unknown; carry?: unknown; set_by_name?: unknown; set_at?: unknown; looked_at?: unknown; looked_by_name?: unknown } | null
  if (!r || typeof r.job_id !== 'string') return null
  const perRaw = r.per_month && typeof r.per_month === 'object' ? (r.per_month as Record<string, unknown>) : null
  const perMonth = perRaw ? Object.fromEntries(Object.entries(perRaw).filter(([, v]) => typeof v === 'number').map(([k, v]) => [k, v as number])) : null
  return {
    jobId: r.job_id,
    amountOff: Number(r.amount_off) || 0,
    perMonth: perMonth && Object.keys(perMonth).length ? perMonth : null,
    reason: typeof r.reason === 'string' ? r.reason : '',
    carry: r.carry !== false,
    setByName: typeof r.set_by_name === 'string' ? r.set_by_name : '',
    setAt: typeof r.set_at === 'string' ? r.set_at : '',
    lookedAt: typeof r.looked_at === 'string' ? r.looked_at : null,
    lookedByName: typeof r.looked_by_name === 'string' ? r.looked_by_name : '',
  }
}

/** Set or change the job's correction — one row per job. Clears any "still true" so the next notice asks again. */
export async function saveLienClaimCorrection(input: { jobId: string; amountOff: number; perMonth: Record<string, number> | null; reason: string; carry: boolean; userId: string | null; userName: string }): Promise<void> {
  const now = new Date().toISOString()
  await withSupabaseRetry(
    () =>
      table().upsert(
        {
          job_id: input.jobId,
          amount_off: input.amountOff,
          per_month: input.perMonth,
          reason: input.reason.trim(),
          carry: input.carry,
          set_by: input.userId,
          set_by_name: input.userName.trim(),
          set_at: now,
          looked_at: null,
          looked_by_name: '',
          updated_at: now,
        } as never,
        { onConflict: 'job_id' },
      ),
    'lien desk: correct the claim',
  )
}

/** Back to the job's figure — the office's to do. */
export async function clearLienClaimCorrection(jobId: string): Promise<void> {
  await withSupabaseRetry(() => table().delete().eq('job_id', jobId), 'lien desk: clear the claim correction')
}

/** "Still true" — someone looked at a carried correction before this notice goes. */
export async function lookLienClaimCorrection(jobId: string, userName: string): Promise<void> {
  const now = new Date().toISOString()
  await withSupabaseRetry(
    () => table().update({ looked_at: now, looked_by_name: userName.trim(), updated_at: now } as never).eq('job_id', jobId),
    'lien desk: still true',
  )
}

/** After a notice goes out, a correction that was for this notice only is done. */
export async function clearOneShotLienClaimCorrection(jobId: string): Promise<void> {
  await withSupabaseRetry(() => table().delete().eq('job_id', jobId).eq('carry', false), 'lien desk: clear a one-notice correction')
}
