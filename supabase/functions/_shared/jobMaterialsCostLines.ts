// Job parts-cost lines (v2.3645, to-dos/mcp-servers.md PR 4b-2): the PURE half of the job window's
// materials snapshot — the line shapes, the totals, and the mappers that turn the raw rows of
// `supply_house_invoice_job_allocations`, `mercury_transaction_job_allocations` and
// `list_tally_parts_with_po` into those lines. `src/lib/fetchJobMaterialsCostSnapshot.ts` reads
// the rows in the browser and dev-mcp's `get_job` reads them over GET; both run these mappers,
// so the two cannot disagree. Pure: no supabase client, no env.

import { cardChargeCostUsd } from './cardChargeAllocationFilter.ts'
import { mercuryDebitCardIdFromRaw } from './mercuryRawDebitCard.ts'

export type JobSupplyInvoiceLine = {
  pct: number
  invoiceNumber: string
  invoiceDate: string
  invoiceAmount: number
  allocatedAmount: number
  supplyHouseName: string | null
  isPaid: boolean
  /** Rides on the house's job account (v2.2669) — unpaid balance is the owner's exposure, not ours. */
  onJobAccount: boolean
}

/**
 * Unpaid allocated dollars on job accounts vs unpaid overall — the job window's Parts Cost split line.
 *
 * This is an EXPOSURE, not a cost, so it counts unpaid invoices only. An open credit memo (v2.3500,
 * stored negative) is money the house owes us and is skipped here. That is deliberately the opposite
 * of `supplyInvoiceTotal` in this same file, which nets credits because the job really did cost less.
 * Netting here would drop `flaggedDollars` under the `> 0.005` gate in `billTabJobAccountNote` and
 * silently take away the "these invoices ride on the owner's account" warning.
 */
export function jobAccountSplitFromLines(lines: JobSupplyInvoiceLine[]): { unpaidTotal: number; unpaidOnJobAccount: number } {
  let unpaidTotal = 0
  let unpaidOnJobAccount = 0
  for (const l of lines) {
    if (l.isPaid) continue
    if (l.allocatedAmount < 0) continue
    unpaidTotal += l.allocatedAmount
    if (l.onJobAccount) unpaidOnJobAccount += l.allocatedAmount
  }
  return { unpaidTotal, unpaidOnJobAccount }
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
  /** For the charges timeline: when the tally line was entered and by whom. */
  createdAt: string | null
  createdByName: string | null
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
  return lines.reduce((s, l) => s + cardChargeCostUsd(l.allocationAmount), 0)
}

export function tallyPartsTotalFromLines(lines: JobTallyPartLine[]): number {
  return lines.reduce((s, l) => s + l.lineTotal, 0)
}

type Num = number | string | null | undefined

/** `get_invoice_amounts_for_jobs` rows → this job's supply-invoice total (credits netted by the RPC). */
export function supplyInvoiceTotalFromRows(rows: readonly { job_id: string; invoice_amount: Num }[] | null | undefined, jobId: string): number {
  const row = (rows ?? []).find((r) => r.job_id === jobId)
  return Number(row?.invoice_amount ?? 0)
}

type SupplyInvoiceEmbed = {
  invoice_number?: string | null
  invoice_date?: string | null
  amount?: Num
  is_paid?: boolean | null
  on_job_account?: boolean | null
  supply_houses?: { name: string } | { name: string }[] | null
}
export type SupplyAllocationRow = { pct?: Num; supply_house_invoices?: SupplyInvoiceEmbed | SupplyInvoiceEmbed[] | null }

/** Allocation rows (with the invoice and its house embedded) → the job's supply-invoice lines. */
export function supplyLinesFromRows(rows: readonly SupplyAllocationRow[] | null | undefined): JobSupplyInvoiceLine[] {
  const lines: JobSupplyInvoiceLine[] = []
  for (const row of rows ?? []) {
    const invNested = row.supply_house_invoices ?? null
    const inv = Array.isArray(invNested) ? invNested[0] : invNested
    if (!inv) continue
    const shNested = inv.supply_houses
    const sh = Array.isArray(shNested) ? shNested[0] : shNested
    const pct = Number(row.pct ?? 0)
    const invAmt = Number(inv.amount ?? 0)
    lines.push({
      pct,
      invoiceNumber: inv.invoice_number ?? '',
      invoiceDate: inv.invoice_date ? String(inv.invoice_date).slice(0, 10) : '',
      invoiceAmount: invAmt,
      allocatedAmount: (invAmt * pct) / 100,
      supplyHouseName: sh?.name ?? null,
      isPaid: inv.is_paid === true,
      onJobAccount: inv.on_job_account === true,
    })
  }
  return lines
}

type MercuryTxEmbed = { posted_at?: string | null; counterparty_name?: string | null; amount?: Num; raw?: unknown }
export type MercuryAllocationRow = { id: string; amount?: Num; note?: string | null; mercury_transactions?: MercuryTxEmbed | MercuryTxEmbed[] | null }

/** Card-charge allocation rows (with the bank transaction embedded) → the job's card lines. */
export function mercuryLinesFromRows(rows: readonly MercuryAllocationRow[] | null | undefined): JobMercuryAllocLine[] {
  return (rows ?? []).map((row) => {
    const txNested = row.mercury_transactions ?? null
    const tx = Array.isArray(txNested) ? txNested[0] : txNested
    return {
      id: row.id,
      allocationAmount: Number(row.amount),
      note: row.note ?? null,
      postedAt: tx?.posted_at ?? null,
      counterpartyName: tx?.counterparty_name ?? null,
      debitCardId: mercuryDebitCardIdFromRaw(tx?.raw ?? null),
    }
  })
}

export type TallyPartRow = {
  id: string
  job_id?: string | null
  quantity?: Num
  part_id?: string | null
  fixture_cost?: Num
  price_at_time?: Num
  fixture_name?: string | null
  part_name?: string | null
  created_at?: string | null
  created_by_name?: string | null
}

/** `list_tally_parts_with_po` rows (every job's) → this job's tally lines: a part prices at its price-at-time, a bare fixture at its cost. */
export function tallyLinesFromRows(rows: readonly TallyPartRow[] | null | undefined, jobId: string): JobTallyPartLine[] {
  return (rows ?? [])
    .filter((r) => r.job_id === jobId)
    .map((row) => {
      const qty = Number(row.quantity)
      const hasPart = row.part_id != null && String(row.part_id).length > 0
      return {
        id: row.id,
        fixtureName: row.fixture_name ?? '',
        quantity: qty,
        partName: row.part_name?.trim() ? row.part_name : null,
        lineTotal: (hasPart ? Number(row.price_at_time ?? 0) : Number(row.fixture_cost ?? 0)) * qty,
        createdAt: row.created_at ?? null,
        createdByName: row.created_by_name?.trim() ? row.created_by_name : null,
      }
    })
}
