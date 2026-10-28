import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { writeDraftInvoice } from '../jobs/draftInvoiceWrite'
import { assembleRetainageHeld, type RetainageApplicationRow, type RetainageInvoiceRow, type RetainageJobRow, type RetainagePaymentRow } from './retainageHeldRows'
import { RETAINAGE_RELEASE_MEMO, lienRetainageMirror } from './retainageHeld'
import { todayYmdInAppTz } from '../../utils/dateUtils'

/**
 * The reads behind AR's Retainage held section (punch list #165, PR 2) and the one job's line
 * the lien details and the Lien desk read (PR 3, PR 4): every live pay application, the jobs that
 * could carry a line (a figure typed in the lien details, or a live application), and those jobs'
 * bills with the release mark. Three tables, no RPC; RLS applies as the viewer. A refused read
 * throws, and the screen says why in its own words. PR 3 adds the release bill's write: a draft
 * for the held amount, marked `retainage_release` (migration 20261028160000).
 */

const JOB_COLS = 'id, hcp_number, click_number, job_name, job_address, status, customer_name, gc_customer_id, lien_retainage_held, lien_contract_ended_on, revenue, gc:customers!jobs_ledger_gc_customer_id_fkey(name)'
const APP_COLS = 'job_id, application_number, retainage_held, updated_at, invoice_id'
// The release mark came with PR 3's migration; a database without it answers 42703 and the read goes again without the column.
const BILL_COLS_WITH_MARK = 'id, job_id, amount, status, sequence_order, retainage_release'
const BILL_COLS = 'id, job_id, amount, status, sequence_order'
const isUnknownColumn = (code: string | undefined): boolean => code === '42703' || code === 'PGRST204'

const CHUNK = 200

function chunks<T>(items: ReadonlyArray<T>, size = CHUNK): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export type RetainageHeldRows = { jobs: RetainageJobRow[]; applications: RetainageApplicationRow[]; invoices: RetainageInvoiceRow[]; payments: RetainagePaymentRow[] }

async function readBills(jobIds: ReadonlyArray<string>): Promise<RetainageInvoiceRow[]> {
  const invoices: RetainageInvoiceRow[] = []
  let cols: string = BILL_COLS_WITH_MARK
  for (const ids of chunks(jobIds)) {
    let res = await supabase.from('jobs_ledger_invoices').select(cols).in('job_id', ids).limit(5000)
    if (res.error && cols === BILL_COLS_WITH_MARK && isUnknownColumn(res.error.code)) {
      cols = BILL_COLS
      res = await supabase.from('jobs_ledger_invoices').select(cols).in('job_id', ids).limit(5000)
    }
    if (res.error) throw res.error
    invoices.push(...((res.data ?? []) as unknown as RetainageInvoiceRow[]))
  }
  return invoices
}

/** The payments on the jobs (v2.6027): a bill paid by a recorded payment keeps its status, so the line reads the money. */
async function readPayments(jobIds: ReadonlyArray<string>): Promise<RetainagePaymentRow[]> {
  const payments: RetainagePaymentRow[] = []
  for (const ids of chunks(jobIds)) {
    const res = await supabase.from('jobs_ledger_payments').select('id, job_id, invoice_id, amount, paid_on').in('job_id', ids).limit(5000)
    if (res.error) throw res.error
    payments.push(...((res.data ?? []) as unknown as RetainagePaymentRow[]))
  }
  return payments
}

export async function loadRetainageHeldRows(): Promise<RetainageHeldRows> {
  const apps = await supabase.from('job_pay_applications').select(APP_COLS).is('deleted_at', null).limit(5000)
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

  const jobIds = jobs.map((j) => j.id)
  return { jobs, applications, invoices: await readBills(jobIds), payments: await readPayments(jobIds) }
}

/** One job's rows (the lien details, the Lien desk): its row, its live applications and its bills. No job the viewer can read: empty rows. */
export async function loadRetainageHeldRowsForJob(jobId: string): Promise<RetainageHeldRows> {
  const job = await supabase.from('jobs_ledger').select(JOB_COLS).eq('id', jobId).maybeSingle()
  if (job.error) throw job.error
  if (!job.data) return { jobs: [], applications: [], invoices: [], payments: [] }
  const apps = await supabase.from('job_pay_applications').select(APP_COLS).eq('job_id', jobId).is('deleted_at', null).limit(500)
  if (apps.error) throw apps.error
  return {
    jobs: [job.data as unknown as RetainageJobRow],
    applications: (apps.data ?? []) as unknown as RetainageApplicationRow[],
    invoices: await readBills([jobId]),
    payments: await readPayments([jobId]),
  }
}

/** The database cannot keep the release mark yet (its migration is not applied). */
export class RetainageReleaseNotReady extends Error {
  constructor() {
    super('The database is being updated to keep the release bill. Try again in a few minutes.')
    this.name = 'RetainageReleaseNotReady'
  }
}

/** Mark a bill as the retainage release. Throws `RetainageReleaseNotReady` on a database without the column. */
export async function markRetainageReleaseBill(invoiceId: string): Promise<void> {
  const { error } = await supabase.from('jobs_ledger_invoices').update({ retainage_release: true } as never).eq('id', invoiceId)
  if (!error) return
  if (isUnknownColumn(error.code)) throw new RetainageReleaseNotReady()
  throw error
}

export type RetainageReleaseDraftArgs = {
  jobId: string
  amount: number
  /** The job's bills so far: the draft takes the next place. */
  billCount: number
  jobStatus: string | null | undefined
}

/**
 * Draft the release bill (release C, a job with no pay application): a `ready_to_bill` draft for
 * the held amount with the release memo, marked as the release. The mark is written right after
 * the draft; when the database cannot keep it, the draft is taken back and the reason thrown, so
 * no unmarked bill is left behind. On a Ready to Bill job the remainder draft re-syncs after, as
 * every other draft door does; a failure there comes back as words beside the new bill's id.
 */
export async function draftRetainageReleaseBill(args: RetainageReleaseDraftArgs): Promise<{ invoiceId: string; ensureFailure: string | null }> {
  return writeDraftInvoice(supabase as unknown as SupabaseClient, {
    jobId: args.jobId,
    amount: args.amount,
    sequenceOrder: args.billCount,
    memo: RETAINAGE_RELEASE_MEMO,
    jobStatus: args.jobStatus,
    resyncLabel: 'ensure RTB remainder after retainage release',
    afterInsert: async (invoiceId) => {
      try {
        await markRetainageReleaseBill(invoiceId)
      } catch (e) {
        await supabase.rpc('delete_ready_to_bill_invoice', { p_invoice_id: invoiceId })
        throw e
      }
    },
  })
}

/**
 * The lien details' box mirrors the applications (PR 4): on a job with pay applications,
 * `jobs_ledger.lien_retainage_held` is set to the kernel's figure (`lienRetainageMirror`), so the
 * Lien desk's SQL readers, which take the typed column, see the number the GC signed. Called
 * after an application is saved, deleted or put back, and by the lien details when they open on
 * a figure that drifted. The figure written, or null on a job with no applications (the box is
 * the office's there) or one the viewer cannot read. A figure already equal is not rewritten.
 */
export async function mirrorLienRetainageFromApplications(jobId: string): Promise<number | null> {
  const rows = await loadRetainageHeldRowsForJob(jobId)
  const input = assembleRetainageHeld(rows.jobs, rows.applications, rows.invoices, rows.payments).inputs[0]
  if (!input) return null
  const figure = lienRetainageMirror(input, todayYmdInAppTz())
  if (figure == null) return null
  if (input.typedHeld != null && Math.abs(input.typedHeld - figure) < 0.005) return figure
  const { error } = await supabase.from('jobs_ledger').update({ lien_retainage_held: figure } as never).eq('id', jobId)
  if (error) throw error
  return figure
}
