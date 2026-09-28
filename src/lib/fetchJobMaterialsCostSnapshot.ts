import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { EMPTY_CARD_CHARGE_EXCLUSIONS, type CardChargeExclusions } from './jobs/cardChargeAllocationFilter'
import { loadCardChargeExclusions } from './jobs/loadCardChargeExclusions'
import { fetchLabelIdByTxId, loadCategoryTags } from './banking/categoryTagsData'
import { buildCategoryTagLookups, type CategoryTagRow } from './banking/categoryTags'
import { costLineTags } from './mercuryTagSplit'
import { jobCardCostLines, type JobCardCostLine } from './jobs/jobCardCostLines'
import {
  jobCardChargesCountedFromLines,
  mercuryLinesFromRows,
  supplyInvoiceTotalFromRows,
  supplyLinesFromRows,
  tallyLinesFromRows,
  type JobMaterialsCostSnapshot as SharedJobMaterialsCostSnapshot,
  type JobMercuryAllocLine,
  type JobSupplyInvoiceLine,
  type JobTallyPartLine,
} from '../../supabase/functions/_shared/jobMaterialsCostLines'

// The line shapes, totals and row mappers live in the shared kernel (v2.3645) so dev-mcp's
// get_job computes the same parts cost; this file is the browser's reads around them.
export {
  jobAccountSplitFromLines,
  jobCardChargesCountedFromLines,
  jobCardLineStatus,
  jobCardLineStatusNote,
  mercuryCardTotalFromLines,
  tallyPartsTotalFromLines,
  type JobCardLineStatus,
  type JobMercuryAllocLine,
  type JobSupplyInvoiceLine,
  type JobTallyPartLine,
} from '../../supabase/functions/_shared/jobMaterialsCostLines'

/**
 * The shared snapshot plus the browser's cost-line split of the card charges (punch list
 * #52): ⛽ Fuel & gas and any other tag flagged "show as cost line", clamped to the card
 * charges that count, and each transaction's tag for a marker on its line. Absent or empty
 * when the tags or labels cannot be read (RLS keeps them to office staff).
 */
export type JobMaterialsCostSnapshot = SharedJobMaterialsCostSnapshot & {
  cardCostLines?: JobCardCostLine[]
  cardTagByTxId?: ReadonlyMap<string, CategoryTagRow>
}

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
  // The bank's category per transaction — the cost-line classifier's fallback when nobody has labelled it.
  const categoryByTxId = new Map<string, unknown>()
  try {
    const raw = await withSupabaseRetry(
      async () =>
        supabase
          .from('mercury_transaction_job_allocations')
          .select('id, amount, note, mercury_transaction_id, mercury_transactions(posted_at, counterparty_name, amount, raw, mercury_category)')
          .eq('job_id', jobId)
          .order('created_at', { ascending: true }),
      'job materials cost snapshot mercury allocations',
    )
    mercuryLines = mercuryLinesFromRows(raw)
    for (const row of (raw ?? []) as Array<{ mercury_transaction_id?: string | null; mercury_transactions?: unknown }>) {
      const tx = Array.isArray(row.mercury_transactions) ? row.mercury_transactions[0] : row.mercury_transactions
      const category = (tx as { mercury_category?: unknown } | null | undefined)?.mercury_category
      if (row.mercury_transaction_id && category != null) categoryByTxId.set(row.mercury_transaction_id, category)
    }
  } catch {
    mercuryFailed = true
    mercuryLines = []
  }

  // The one card rule's lookups (Jobs → Job Summary's, v2.2692). Each degrades to "everything
  // counts" on its own when RLS hides it; a throw here leaves the lines counted as before.
  const txIds = [...new Set(mercuryLines.map((l) => l.mercuryTransactionId).filter((id): id is string => !!id))]
  let cardExclusions: CardChargeExclusions = EMPTY_CARD_CHARGE_EXCLUSIONS
  try {
    cardExclusions = await loadCardChargeExclusions(txIds)
  } catch {
    cardExclusions = EMPTY_CARD_CHARGE_EXCLUSIONS
  }

  // The cost lines (punch list #52): the tags, the accounting labels on the job's
  // transactions, and Job Summary's classifier. Tags and labels are office-staff reads;
  // any failure leaves the card charges as one line, as before.
  let cardCostLines: JobCardCostLine[] = []
  let cardTagByTxId: ReadonlyMap<string, CategoryTagRow> = new Map()
  if (txIds.length > 0) {
    try {
      const [tagRows, labelIdByTxId] = await Promise.all([loadCategoryTags(), fetchLabelIdByTxId(txIds)])
      const lookups = buildCategoryTagLookups(tagRows.tags, tagRows.members)
      const split = jobCardCostLines({
        lines: mercuryLines,
        exclusions: cardExclusions,
        labelIdByTxId,
        categoryByTxId,
        lookups,
        tags: costLineTags(lookups),
        countedCardUsd: jobCardChargesCountedFromLines(mercuryLines, cardExclusions),
      })
      cardCostLines = split.costLines
      cardTagByTxId = split.tagByTxId
    } catch {
      cardCostLines = []
      cardTagByTxId = new Map()
    }
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
    cardExclusions,
    cardCostLines,
    cardTagByTxId,
    tallyPartLines: tallyLines,
    tallyFetchFailed: tallyFailed,
  }
}
