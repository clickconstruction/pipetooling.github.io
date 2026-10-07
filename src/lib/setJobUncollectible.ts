import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type SetJobUncollectibleResult = {
  ok: boolean
  /** Friendly failure copy when !ok. */
  error?: string
}

/** The RPC refuses a reason shorter than this when marking — it is stamped on the row for everyone to read. */
export const UNCOLLECTIBLE_REASON_MIN = 12

// The RPC is ahead of the generated types until they regenerate after the push (v2.4782).
const db = supabase as unknown as SupabaseClient

/**
 * Marks / unmarks a Collections job as Uncollectible via `set_job_uncollectible` (punch list #94).
 *
 * The RPC enforces authorization (the Collections managers: dev, master_technician, assistant,
 * controller), requires the job to be `billed` and in Collections, requires a reason when marking,
 * stamps `uncollectible_at/by/reason`, and logs an `uncollectible_change` activity event. Idempotent
 * when the mark already matches.
 */
export async function setJobUncollectible(jobId: string, flagged: boolean, reason?: string | null): Promise<SetJobUncollectibleResult> {
  const trimmed = (reason ?? '').trim()
  if (flagged && trimmed.length < UNCOLLECTIBLE_REASON_MIN) {
    return { ok: false, error: 'Write the reason — it is stamped on the row for everyone to read' }
  }
  const { data, error } = await db.rpc('set_job_uncollectible', {
    p_job_id: jobId,
    p_flagged: flagged,
    ...(flagged ? { p_reason: trimmed } : {}),
  })
  if (error) return { ok: false, error: error.message }
  const rpcError = (data as { error?: string } | null)?.error
  if (rpcError) return { ok: false, error: rpcError }
  return { ok: true }
}
