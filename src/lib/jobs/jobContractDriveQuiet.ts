/**
 * Signed contracts in Google Drive (punch list #377, PR 4): the quiet ask, on its own so the write paths can call it
 * without importing the press's I/O (which imports them back). After the office's own write (a paper filed, a GC's paper
 * saved, a paper voided) it asks `job-contract-drive` to take that one record now, fire and forget. It never throws and
 * is never awaited: whatever goes wrong, the sweep takes the paper within ten minutes.
 */
import { supabase } from '../supabase'

export function fileContractInDriveQuietly(contractId: string | null | undefined): void {
  if (!contractId) return
  try {
    void Promise.resolve(supabase.functions.invoke('job-contract-drive', { body: { contract_id: contractId } })).catch(() => {})
  } catch {
    // A client with no functions door (a test's stand-in) is the same as a call that failed.
  }
}
