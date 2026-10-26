import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { CustomerAddressRow } from './lienProperty'

/** The property a job names: the link on its own row and the record behind it (null when unlinked or unreadable). */
export type JobPropertyRead = { link: string | null; record: CustomerAddressRow | null }

/**
 * The property record a job names, read from the job's own row — the record Edit Job's Property record row
 * and the Legal desk read. A caller's copy of the row can lag a link made since it loaded (the board keeps a
 * link made from its row in memory until it reloads, `usePropertyKinds`), so its link is only the fallback for
 * a row that cannot be read. Each read fails soft: a record that cannot be read is null, the kind unknown.
 */
export async function readJobPropertyRecord(jobId: string, fallbackLink: string | null): Promise<JobPropertyRead> {
  let link = fallbackLink
  try {
    const row = await withSupabaseRetry(async () => await supabase.from('jobs_ledger').select('customer_address_id').eq('id', jobId).maybeSingle(), 'read the job’s property link')
    if (row) link = (row as { customer_address_id: string | null }).customer_address_id ?? null
  } catch {
    // the caller's link stands
  }
  if (!link) return { link: null, record: null }
  const id = link
  try {
    const record = await withSupabaseRetry(async () => await supabase.from('customer_addresses').select('*').eq('id', id).maybeSingle(), 'read the job’s property record')
    return { link: id, record: (record as CustomerAddressRow | null) ?? null }
  } catch {
    return { link: id, record: null }
  }
}
