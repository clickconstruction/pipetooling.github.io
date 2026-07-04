import { supabase } from './supabase'

export type SetJobCollectionsFlagResult = {
  ok: boolean
  /** Friendly failure copy when !ok. */
  error?: string
}

/**
 * Flags/unflags a Billed job as in Collections via the `set_job_collections_flag` RPC.
 *
 * The RPC enforces authorization (office roles with master access), requires the job to be in
 * `billed` status, stamps `collections_at/by/note`, and logs a `collections_change` activity
 * event. Idempotent when the flag already matches.
 */
export async function setJobCollectionsFlag(
  jobId: string,
  flagged: boolean,
  note?: string | null,
): Promise<SetJobCollectionsFlagResult> {
  const { data, error } = await supabase.rpc('set_job_collections_flag', {
    p_job_id: jobId,
    p_flagged: flagged,
    ...(note != null && note.trim() !== '' ? { p_note: note.trim() } : {}),
  })
  if (error) return { ok: false, error: error.message }
  const rpcError = (data as { error?: string } | null)?.error
  if (rpcError) return { ok: false, error: rpcError }
  return { ok: true }
}
