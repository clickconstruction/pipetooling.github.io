/**
 * The link doors' read (punch list #104, v2.5119): before a door hands out the link a sent
 * agreement already carries, it reads the row again. Another tab may have voided it or moved its
 * token onto a new draft, and a stale row would hand out a dead link with no word to the office.
 * Null on any doubt (a failed read, a row no longer out, a lapsing link), so the door sends, and
 * the send says what is wrong.
 */
import { supabase } from '../supabase'
import { jobContractLinkOnRow, type JobContractRow } from './jobContractLifecycle'

export async function freshJobContractLink(rowId: string | null | undefined, origin: string, nowMs: number = Date.now()): Promise<string | null> {
  if (!rowId) return null
  try {
    const { data, error } = await supabase.from('job_contracts').select('status, voided_at, public_token, public_token_expires_at').eq('id', rowId).maybeSingle()
    if (error || !data) return null
    return jobContractLinkOnRow(data as Pick<JobContractRow, 'status' | 'voided_at' | 'public_token' | 'public_token_expires_at'>, origin, nowMs)
  } catch {
    return null
  }
}
