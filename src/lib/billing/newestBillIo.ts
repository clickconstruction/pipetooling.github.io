/**
 * The read behind the Billed line's `{amount}` and `{bill}` on a Pipeline move (v2.6771): the job's billed bills with
 * their amounts, for `newestBill`. A read that fails reads as no bill, so the blanks are left and the box says so.
 */
import { supabase } from '../supabase'
import type { BillForLink } from './billLink'
import { newestBill, type NewestBill } from './newestBill'

export async function loadNewestBill(jobId: string, client: unknown = supabase): Promise<NewestBill | null> {
  try {
    const db = client as typeof supabase
    const res = await db.from('jobs_ledger_invoices').select('id, status, stripe_invoice_id, billed_at, created_at, amount').eq('job_id', jobId).eq('status', 'billed')
    if (res.error) return null
    return newestBill((res.data ?? []) as Array<BillForLink & { amount: number | null }>)
  } catch {
    return null
  }
}
