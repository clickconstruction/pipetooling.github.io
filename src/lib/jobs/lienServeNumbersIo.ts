import { supabase } from '../supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import type { LienServeWrite } from './lienServeNumbers'

export type LienServeRecordResult = { done: LienServeWrite[]; failed: Array<{ write: LienServeWrite; reason: string }> }

/**
 * Record the service of several filed liens (punch list #366, step 4): each its own write, the same two columns
 * **Record service…** writes. The batch keeps going past a lien that fails and hands it back with its reason.
 */
export async function recordLienServices(writes: ReadonlyArray<LienServeWrite>): Promise<LienServeRecordResult> {
  const result: LienServeRecordResult = { done: [], failed: [] }
  for (const write of writes) {
    try {
      await withSupabaseRetry(
        () => supabase.from('job_lien_filings').update({ served_at: write.servedOn, sends: JSON.parse(JSON.stringify(write.sends)) }).eq('id', write.filingId),
        'record lien service',
      )
      result.done.push(write)
    } catch (e) {
      result.failed.push({ write, reason: formatErrorMessage(e, 'the record was not saved') })
    }
  }
  return result
}
