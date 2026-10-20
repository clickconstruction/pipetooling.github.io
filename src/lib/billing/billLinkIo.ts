/** The read behind `{bill}` (v2.5628): a job's billed bills, for `newestBillLink`. A read that fails fills nothing, so the blank is left and the box says so. */
import { supabase } from '../supabase'
import { newestBillLink, type BillForLink } from './billLink'

export async function loadNewestBillLink(jobId: string, client: unknown = supabase): Promise<string | null> {
  try {
    const db = client as typeof supabase
    const res = await db.from('jobs_ledger_invoices').select('id, status, stripe_invoice_id, billed_at, created_at').eq('job_id', jobId).eq('status', 'billed')
    if (res.error) return null
    return newestBillLink((res.data ?? []) as BillForLink[])
  } catch {
    return null
  }
}
