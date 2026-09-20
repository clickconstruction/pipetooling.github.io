import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import {
  mercuryLinesFromRows,
  supplyInvoiceTotalFromRows,
  supplyLinesFromRows,
  tallyLinesFromRows,
  type JobMaterialsCostSnapshot,
  type JobMercuryAllocLine,
  type JobSupplyInvoiceLine,
  type JobTallyPartLine,
} from '../../supabase/functions/_shared/jobMaterialsCostLines'

// The line shapes, totals and row mappers live in the shared kernel (v2.3645) so dev-mcp's
// get_job computes the same parts cost; this file is the browser's reads around them.
export {
  jobAccountSplitFromLines,
  mercuryCardTotalFromLines,
  tallyPartsTotalFromLines,
  type JobMaterialsCostSnapshot,
  type JobMercuryAllocLine,
  type JobSupplyInvoiceLine,
  type JobTallyPartLine,
} from '../../supabase/functions/_shared/jobMaterialsCostLines'

/**
 * Supply/Mercury/tally snapshot for a job (matches Edit Job modal materials loaders).
 */
export async function fetchJobMaterialsCostSnapshot(jobId: string): Promise<JobMaterialsCostSnapshot> {
  let supplyTotal = 0
  let supplyRpcFailed = false
  try {
    const invRows = await withSupabaseRetry(
      () => supabase.rpc('get_invoice_amounts_for_jobs', { p_job_ids: [jobId] }),
      'job materials cost snapshot invoice amounts',
    )
    supplyTotal = supplyInvoiceTotalFromRows(invRows as { job_id: string; invoice_amount: string | number }[] | null, jobId)
  } catch {
    supplyRpcFailed = true
  }

  let supplyLines: JobSupplyInvoiceLine[] = []
  try {
    const raw = await withSupabaseRetry(
      async () =>
        supabase
          .from('supply_house_invoice_job_allocations')
          .select('pct, supply_house_invoices(invoice_number, invoice_date, amount, is_paid, on_job_account, supply_houses(name))')
          .eq('job_id', jobId),
      'job materials cost snapshot supply allocations',
    )
    supplyLines = supplyLinesFromRows(raw)
  } catch {
    supplyLines = []
  }

  let mercuryLines: JobMercuryAllocLine[] = []
  let mercuryFailed = false
  try {
    const raw = await withSupabaseRetry(
      async () =>
        supabase
          .from('mercury_transaction_job_allocations')
          .select('id, amount, note, mercury_transaction_id, mercury_transactions(posted_at, counterparty_name, amount, raw)')
          .eq('job_id', jobId)
          .order('created_at', { ascending: true }),
      'job materials cost snapshot mercury allocations',
    )
    mercuryLines = mercuryLinesFromRows(raw)
  } catch {
    mercuryFailed = true
    mercuryLines = []
  }

  let tallyLines: JobTallyPartLine[] = []
  let tallyFailed = false
  try {
    const raw = await withSupabaseRetry(
      () => supabase.rpc('list_tally_parts_with_po'),
      'job materials cost snapshot tally parts',
    )
    tallyLines = tallyLinesFromRows(raw, jobId)
  } catch {
    tallyFailed = true
    tallyLines = []
  }

  return {
    supplyInvoiceTotal: supplyTotal,
    supplyInvoiceRpcFailed: supplyRpcFailed,
    supplyInvoiceLines: supplyLines,
    mercuryAllocLines: mercuryLines,
    mercuryFetchFailed: mercuryFailed,
    tallyPartLines: tallyLines,
    tallyFetchFailed: tallyFailed,
  }
}
