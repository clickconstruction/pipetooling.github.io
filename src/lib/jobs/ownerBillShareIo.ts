/**
 * The owner sees the bills (v2.3827) — the reads and the one write behind the switch.
 * The rule is `ownerBillShare.ts`; this file only moves rows.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { PORTAL_OPEN_INVOICE_STATUS } from '../../../supabase/functions/_shared/portalBillMembership'
import type { OwnerShareInvoice, OwnerShareJob, OwnerShareWrites } from './ownerBillShare'

export type OwnerSharePropertyJob = OwnerShareJob & {
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  job_address: string | null
  revenue: number | null
  payments_made: number | null
}

/** Every job at the saved property with the same customer, and their open bills. A job with no property reads alone. */
export async function loadOwnerShareProperty(job: OwnerShareJob): Promise<{ jobs: OwnerSharePropertyJob[]; invoices: OwnerShareInvoice[] }> {
  const addr = (job.customer_address_id ?? '').trim()
  const cols = 'id, customer_id, gc_customer_id, bill_to_party, customer_address_id, show_bills_to_other_party, hcp_number, click_number, job_name, job_address, revenue, payments_made'
  const jobs = (await withSupabaseRetry(
    () => {
      const q = supabase.from('jobs_ledger').select(cols)
      return addr && job.customer_id ? q.eq('customer_address_id', addr).eq('customer_id', job.customer_id) : q.eq('id', job.id)
    },
    'owner sees the bills: jobs',
  )) as unknown as OwnerSharePropertyJob[]
  const ids = (jobs ?? []).map((j) => j.id)
  const invoices = ids.length
    ? ((await withSupabaseRetry(
        () => supabase.from('jobs_ledger_invoices').select('id, job_id, status, bill_to_party, bill_to_email, shown_to_party').in('job_id', ids).eq('status', PORTAL_OPEN_INVOICE_STATUS),
        'owner sees the bills: bills',
      )) as unknown as OwnerShareInvoice[])
    : []
  return { jobs: jobs ?? [], invoices: invoices ?? [] }
}

/** The flip: the jobs' memory for their next bills, then the open bills' stamps. */
export async function applyOwnerShare(w: OwnerShareWrites): Promise<void> {
  if (w.jobIds.length) {
    const { error } = await supabase.from('jobs_ledger').update({ show_bills_to_other_party: w.on }).in('id', w.jobIds)
    if (error) throw new Error(error.message)
  }
  if (w.invoiceIds.length) {
    const { error } = await supabase.from('jobs_ledger_invoices').update({ shown_to_party: w.on ? 'customer' : null }).in('id', w.invoiceIds)
    if (error) throw new Error(error.message)
  }
}
