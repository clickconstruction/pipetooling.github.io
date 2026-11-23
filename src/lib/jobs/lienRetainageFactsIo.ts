import { supabase } from '../supabase'
import type { LienContractPatch } from './lienRetainageFacts'

/**
 * The one write behind the retainage pane's values in place (punch list #399): the job's lien facts, straight to
 * the job, as Edit Job's *Our contract on this job* row writes them. A refusal is thrown as it came, so the open
 * field says the reason under what was typed.
 */
export async function saveLienContractFacts(jobId: string, patch: LienContractPatch): Promise<void> {
  const { error } = await supabase.from('jobs_ledger').update(patch as never).eq('id', jobId)
  if (error) throw error
}
