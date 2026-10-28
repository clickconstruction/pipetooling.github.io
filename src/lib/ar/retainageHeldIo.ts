import { supabase } from '../supabase'
import type { RetainageApplicationRow, RetainageInvoiceRow, RetainageJobRow } from './retainageHeldRows'

/**
 * The reads behind AR's Retainage held section (punch list #165, PR 2): every live pay
 * application, the jobs that could carry a line (a figure typed in the lien details, or a live
 * application), and those jobs' bills. Three tables, no RPC; RLS applies as the viewer. A
 * refused read throws, and the section says why in its own words.
 */

const JOB_COLS = 'id, hcp_number, click_number, job_name, job_address, status, customer_name, gc_customer_id, lien_retainage_held, lien_contract_ended_on, gc:customers!jobs_ledger_gc_customer_id_fkey(name)'

const CHUNK = 200

function chunks<T>(items: ReadonlyArray<T>, size = CHUNK): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export type RetainageHeldRows = { jobs: RetainageJobRow[]; applications: RetainageApplicationRow[]; invoices: RetainageInvoiceRow[] }

export async function loadRetainageHeldRows(): Promise<RetainageHeldRows> {
  const apps = await supabase.from('job_pay_applications').select('job_id, application_number, retainage_held, updated_at, invoice_id').is('deleted_at', null).limit(5000)
  if (apps.error) throw apps.error
  const applications = (apps.data ?? []) as unknown as RetainageApplicationRow[]

  const typed = await supabase.from('jobs_ledger').select(JOB_COLS).gt('lien_retainage_held', 0).limit(2000)
  if (typed.error) throw typed.error
  const jobs = (typed.data ?? []) as unknown as RetainageJobRow[]
  const have = new Set(jobs.map((j) => j.id))
  const missing = [...new Set(applications.map((a) => a.job_id))].filter((id) => !have.has(id))
  for (const ids of chunks(missing)) {
    const more = await supabase.from('jobs_ledger').select(JOB_COLS).in('id', ids)
    if (more.error) throw more.error
    jobs.push(...((more.data ?? []) as unknown as RetainageJobRow[]))
  }

  const invoices: RetainageInvoiceRow[] = []
  for (const ids of chunks(jobs.map((j) => j.id))) {
    const bills = await supabase.from('jobs_ledger_invoices').select('id, job_id, amount, status').in('job_id', ids).limit(5000)
    if (bills.error) throw bills.error
    invoices.push(...((bills.data ?? []) as unknown as RetainageInvoiceRow[]))
  }
  return { jobs, applications, invoices }
}
