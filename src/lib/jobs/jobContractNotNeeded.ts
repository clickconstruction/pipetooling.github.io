/**
 * "Not needed" on a job (Contract sweep PR 0 / 0c): the office's answer that
 * this job needs no customer agreement of ours — three columns on
 * jobs_ledger, written from the Contract modal and the new-job door. One
 * write path so both say the same thing to the count.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'

export type JobContractNotNeeded = { at: string; reason: string | null }

export async function markJobContractNotNeeded(jobId: string, reason: string, userId: string | null): Promise<JobContractNotNeeded> {
  const nowIso = new Date().toISOString()
  const cleaned = reason.trim() || null
  await withSupabaseRetry(
    () => supabase.from('jobs_ledger').update({ contract_not_needed_at: nowIso, contract_not_needed_by: userId, contract_not_needed_reason: cleaned }).eq('id', jobId),
    'mark job contract not needed',
  )
  return { at: nowIso, reason: cleaned }
}

export async function clearJobContractNotNeeded(jobId: string): Promise<void> {
  await withSupabaseRetry(
    () => supabase.from('jobs_ledger').update({ contract_not_needed_at: null, contract_not_needed_by: null, contract_not_needed_reason: null }).eq('id', jobId),
    'clear job contract not needed',
  )
}

/** Tell every contract surface (chips, the card, the Needs You item) to reload. */
export function dispatchJobContractChanged(): void {
  try {
    window.dispatchEvent(new Event('job-contract-changed'))
  } catch {
    /* non-browser */
  }
}
