import { supabase } from './supabase'
import type { Database, Json } from '../types/database'
import { mercuryDebitCardIdFromRaw } from './mercuryRawDebitCard'
import { withSupabaseRetry } from '../utils/errorHandling'

export type JobSupplyInvoiceLine = {
  pct: number
  invoiceNumber: string
  invoiceDate: string
  invoiceAmount: number
  allocatedAmount: number
  supplyHouseName: string | null
}

export type JobMercuryAllocLine = {
  id: string
  allocationAmount: number
  note: string | null
  postedAt: string | null
  counterpartyName: string | null
  debitCardId: string | null
}

export type JobTallyPartLine = {
  id: string
  fixtureName: string
  quantity: number
  partName: string | null
  lineTotal: number
}

export type JobMaterialsCostSnapshot = {
  supplyInvoiceTotal: number
  supplyInvoiceRpcFailed: boolean
  supplyInvoiceLines: JobSupplyInvoiceLine[]
  mercuryAllocLines: JobMercuryAllocLine[]
  mercuryFetchFailed: boolean
  tallyPartLines: JobTallyPartLine[]
  tallyFetchFailed: boolean
}

export function mercuryCardTotalFromLines(lines: JobMercuryAllocLine[]): number {
  return lines.reduce((s, l) => s + Math.abs(Number(l.allocationAmount)), 0)
}

export function tallyPartsTotalFromLines(lines: JobTallyPartLine[]): number {
  return lines.reduce((s, l) => s + l.lineTotal, 0)
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
    const arr = (invRows ?? []) as { job_id: string; invoice_amount: string | number }[]
    const row = arr.find((r) => r.job_id === jobId)
    supplyTotal = Number(row?.invoice_amount ?? 0)
  } catch {
    supplyRpcFailed = true
  }

  let supplyLines: JobSupplyInvoiceLine[] = []
  try {
    const raw = await withSupabaseRetry(
      async () =>
        supabase
          .from('supply_house_invoice_job_allocations')
          .select('pct, supply_house_invoices(invoice_number, invoice_date, amount, supply_houses(name))')
          .eq('job_id', jobId),
      'job materials cost snapshot supply allocations',
    )
    for (const row of raw ?? []) {
      const invNested = row.supply_house_invoices as
        | { invoice_number: string; invoice_date: string; amount: string | number; supply_houses?: { name: string } | { name: string }[] | null }
        | { invoice_number: string; invoice_date: string; amount: string | number; supply_houses?: { name: string } | { name: string }[] | null }[]
        | null
      const inv = Array.isArray(invNested) ? invNested[0] : invNested
      if (!inv) continue
      const shNested = inv.supply_houses
      const sh = Array.isArray(shNested) ? shNested[0] : shNested
      const pct = Number(row.pct ?? 0)
      const invAmt = Number(inv.amount ?? 0)
      const allocated = (invAmt * pct) / 100
      supplyLines.push({
        pct,
        invoiceNumber: inv.invoice_number ?? '',
        invoiceDate: inv.invoice_date ? String(inv.invoice_date).slice(0, 10) : '',
        invoiceAmount: invAmt,
        allocatedAmount: allocated,
        supplyHouseName: sh?.name ?? null,
      })
    }
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
    for (const row of raw ?? []) {
      const txNested = row.mercury_transactions as
        | {
            posted_at: string | null
            counterparty_name: string | null
            amount: string | number | null
            raw: Json | null
          }
        | {
            posted_at: string | null
            counterparty_name: string | null
            amount: string | number | null
            raw: Json | null
          }[]
        | null
      const tx = Array.isArray(txNested) ? txNested[0] : txNested
      const debitCardId = mercuryDebitCardIdFromRaw(tx?.raw ?? null)
      mercuryLines.push({
        id: row.id,
        allocationAmount: Number(row.amount),
        note: row.note ?? null,
        postedAt: tx?.posted_at ?? null,
        counterpartyName: tx?.counterparty_name ?? null,
        debitCardId,
      })
    }
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
    type TallyPoRow = Database['public']['Functions']['list_tally_parts_with_po']['Returns'][number]
    const rows = ((raw ?? []) as TallyPoRow[]).filter((r) => r.job_id === jobId)
    for (const row of rows) {
      const qty = Number(row.quantity)
      const hasPart = row.part_id != null && String(row.part_id).length > 0
      const lineTotal = !hasPart
        ? Number(row.fixture_cost ?? 0) * qty
        : Number(row.price_at_time ?? 0) * qty
      tallyLines.push({
        id: row.id,
        fixtureName: row.fixture_name ?? '',
        quantity: qty,
        partName: row.part_name?.trim() ? row.part_name : null,
        lineTotal,
      })
    }
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
