/**
 * The reads and the save behind the sheet's tie to one bill (v2.7835, punch list #388). `drawTie.ts` beside
 * it is the kernel. The column and the function arrive with migration 20261118180000. Before it is pushed
 * the read finds no column and answers "nothing to ask", so a stage move stands either side of the push.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import type { DrawBill } from './drawTie'
import { customerPaidDays, type TiedBillPaymentRow, type TiedBillRow } from '../../../supabase/functions/_shared/subPortalCustomerPaid'

type Db = SupabaseClient<Database>
type CodedError = { code?: string | null; message: string }

export type DrawTieSheet = {
  sheetId: string
  /** The sheet's job; null for a sheet on no job, which has no bill to ride on. */
  jobId: string | null
  stage: string | null
  drawInvoiceId: string | null
  bills: DrawBill[]
}

/**
 * One sheet with its job's bills. Null when the read is refused or the column is not there yet: the caller
 * then moves the stage as it did before the tie, and the database decides what it can.
 */
export async function loadDrawTieSheet(db: Db, sheetId: string): Promise<DrawTieSheet | null> {
  const sheetRes = (await db
    .from('people_labor_jobs')
    .select('id, job_ledger_id, stage, draw_invoice_id' as 'id, job_ledger_id, stage')
    .eq('id', sheetId)
    .maybeSingle()) as { data: { id: string; job_ledger_id: string | null; stage: string | null; draw_invoice_id?: string | null } | null; error: CodedError | null }
  if (sheetRes.error || !sheetRes.data) return null
  const sheet = sheetRes.data
  const base = { sheetId: sheet.id, jobId: sheet.job_ledger_id, stage: sheet.stage, drawInvoiceId: sheet.draw_invoice_id ?? null }
  if (!sheet.job_ledger_id) return { ...base, bills: [] }
  const billsRes = await db.from('jobs_ledger_invoices').select('id, status, sequence_order, billed_at, amount, created_at').eq('job_id', sheet.job_ledger_id)
  if (billsRes.error) return null
  return { ...base, bills: (billsRes.data ?? []) as DrawBill[] }
}

/**
 * Every sheet's tie, by sheet id: only the sheets that hold one. Empty before the migration is pushed, and
 * empty when the read fails in any way: the ledger this rides beside must load whatever happens here.
 */
export async function loadDrawTies(db: Db): Promise<Map<string, string>> {
  const ties = new Map<string, string>()
  try {
    const res = (await db
      .from('people_labor_jobs')
      .select('id, draw_invoice_id' as 'id')
      .not('draw_invoice_id' as 'id', 'is', null)) as { data: Array<{ id: string; draw_invoice_id?: string | null }> | null; error: CodedError | null }
    if (res.error) return ties
    for (const r of res.data ?? []) if (r.draw_invoice_id) ties.set(r.id, r.draw_invoice_id)
  } catch {
    // No ties to show. The sheets still load.
  }
  return ties
}

/**
 * Every bill of the given jobs, by job id: what the office's row needs to name the bill a sheet rides on
 * (*Rides on bill 2 of 3*) without leaning on whatever list of jobs the screen happens to hold. On prod the
 * first walk showed why: the Pay view knew the test job's name and not its bills, and the row could only
 * say *Rides on a bill*. Empty when the read fails in any way.
 */
export async function loadDrawBillsByJob(db: Db, jobIds: readonly string[]): Promise<Map<string, DrawBill[]>> {
  const out = new Map<string, DrawBill[]>()
  const ids = [...new Set(jobIds.filter(Boolean))]
  if (ids.length === 0) return out
  try {
    const res = (await db.from('jobs_ledger_invoices').select('id, job_id, status, sequence_order, billed_at, amount, created_at').in('job_id', ids).limit(1000)) as {
      data: Array<DrawBill & { job_id: string }> | null
      error: CodedError | null
    }
    if (res.error) return out
    for (const { job_id, ...bill } of res.data ?? []) out.set(job_id, [...(out.get(job_id) ?? []), bill])
  } catch {
    // No names for the bills. The row still says the sheet is tied.
  }
  return out
}

/**
 * The day the customer paid each tied sheet's bill in full, by sheet id (step 2): the same rule the sub's page
 * reads, `customerPaidDays`, on the same rows. A tie reaches here only from a sheet at Waiting on customer,
 * since the database clears it everywhere else. Empty when a read fails in any way.
 */
export async function loadCustomerPaidDays(db: Db, ties: ReadonlyMap<string, string>): Promise<Map<string, string>> {
  const billIds = [...new Set(ties.values())]
  if (billIds.length === 0) return new Map()
  try {
    const [billsRes, paysRes] = await Promise.all([
      db.from('jobs_ledger_invoices').select('id, status').in('id', billIds),
      db.from('jobs_ledger_payments').select('invoice_id, paid_on').in('invoice_id', billIds).limit(1000),
    ])
    if (billsRes.error || paysRes.error) return new Map()
    const sheets = [...ties].map(([id, draw_invoice_id]) => ({ id, stage: 'customer_pay', draw_invoice_id }))
    return customerPaidDays(sheets, (billsRes.data ?? []) as TiedBillRow[], (paysRes.data ?? []) as TiedBillPaymentRow[])
  } catch {
    return new Map()
  }
}

/** Pick, change or clear (null) the bill a sheet rides on. Throws the refusal, in the database's own words. */
export async function saveDrawBill(db: Db, sheetId: string, billId: string | null): Promise<void> {
  const { data, error } = (await db.rpc('set_sub_sheet_draw_invoice' as never, { p_labor_job_id: sheetId, p_invoice_id: billId } as never)) as {
    data: { ok?: boolean; error?: string } | null
    error: CodedError | null
  }
  if (error) throw error
  if (data?.error) throw { message: data.error }
}
