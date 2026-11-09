/**
 * The Short press's writes (punch list #209, v2.6742), the Job Parts Tally's own path in one call:
 * the `jobs_tally_parts` row, then for a book part the draft purchase order through
 * `create_po_from_job_tally` and the row's `purchase_order_id`. A refused row throws its reason;
 * a purchase order that could not be made is an outcome, not a failure — the request stands.
 */
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { shortPoEntries, type ShortOutcome, type ShortRequestRow } from './shortRequest'

type Client = Pick<typeof supabase, 'from' | 'rpc'>

export async function sendShortRequest(row: ShortRequestRow, client: Client = supabase): Promise<ShortOutcome> {
  const inserted = await client.from('jobs_tally_parts').insert(row).select('id').single()
  checkSupabaseError(inserted, 'file parts request')
  const entries = shortPoEntries(row)
  if (entries.length === 0) return { kind: 'request' }
  const po = await client.rpc('create_po_from_job_tally', { p_job_id: row.job_id, p_entries: entries })
  const result = po.data && typeof po.data === 'object' ? (po.data as { po_id?: string; error?: string }) : null
  if (po.error || !result?.po_id) return { kind: 'po-failed', reason: po.error?.message ?? result?.error ?? 'the purchase order was not made' }
  const id = (inserted.data as { id: string } | null)?.id
  if (id) await client.from('jobs_tally_parts').update({ purchase_order_id: result.po_id }).eq('id', id)
  return { kind: 'po' }
}
