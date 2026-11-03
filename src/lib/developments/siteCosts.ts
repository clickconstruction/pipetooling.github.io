/**
 * The costs on a site's jobs (v2.6215; the owner: *for devs and controllers only, in that particular
 * table, I would like to also see the costs*). One job's costs are what the Job window's profit band
 * counts (`buildJobProfitSummary`): the four parts buckets — supply-house invoices, card charges, the
 * tally, the job's other charges — and the sub-labor sheets. The rows come in one batched read for
 * the whole site (`fetchSiteCosts.ts`); this kernel groups them by job and totals them with the same
 * shared kernels dev-mcp's get_job and the Job window use, so every screen says one number. Pure.
 */
import { buildJobProfitSummary } from '../../../supabase/functions/_shared/jobProfitSummary'
import {
  jobCardChargesCountedFromLines,
  jobCardLineStatus,
  supplyLinesFromRows,
  type SupplyAllocationRow,
  mercuryLinesFromRows,
  supplyInvoiceTotalFromRows,
  tallyLinesFromRows,
  tallyPartsTotalFromLines,
  type MercuryAllocationRow,
  type TallyPartRow,
} from '../../../supabase/functions/_shared/jobMaterialsCostLines'
import { jobSubLaborInputsFromRows, type SubLaborItemRow, type SubLaborSheetRow } from '../../../supabase/functions/_shared/jobSubLaborInputs'
import { laborJobSubCost } from '../../../supabase/functions/_shared/subLaborCost'
import { cardChargeCostUsd, type CardChargeExclusions } from '../../../supabase/functions/_shared/cardChargeAllocationFilter'
import { splitSheetNames } from '../jobs/jobCrewPosition'

/** Who reads the costs column: dev and controller, the finance seats — never a master or an estimator. */
export function canSeeSiteCosts(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'controller'
}

export type JobCostRow = {
  jobId: string
  /** The four parts buckets, in dollars. */
  parts: { supplyInvoices: number; cardCharges: number; tallyParts: number; otherCharges: number }
  /** The sub-labor sheets' total. */
  subLabor: number
  /** Parts and sub labor together: the figure the column shows. */
  total: number
  /**
   * Who the money went to (v2.6457, the Scoreboard's rows under a job): the sub sheets by the names on
   * them, the supply invoices by house, the card charges the total counts (an internal transfer and a
   * charge also on a supply invoice left out, as the total leaves them), and how many tally and other
   * lines. The sheets sum to `subLabor`; the houses to `parts.supplyInvoices` when the allocation read
   * is whole; the card lines to `parts.cardCharges` but in the clamped corner Job Summary keeps.
   */
  breakdown: JobCostBreakdown
}

export type JobCostBreakdown = {
  subs: Array<{ name: string; usd: number; sheets: number }>
  suppliers: Array<{ name: string; usd: number; invoices: number }>
  cardLines: Array<{ txId: string | null; usd: number }>
  tallyLines: number
  otherLines: number
}

/** What the page holds: reading, read (a row per job), or failed (a source would not read; the cells say so, never a false zero). */
export type SiteCostsRead = { state: 'reading' } | { state: 'read'; byJobId: ReadonlyMap<string, JobCostRow> } | { state: 'failed' }

export type SiteCostRows = {
  jobIds: readonly string[]
  invoiceAmounts: readonly { job_id: string; invoice_amount: number | string }[]
  cardAlloc: readonly (MercuryAllocationRow & { job_id: string })[]
  cardExclusions: CardChargeExclusions
  tally: readonly TallyPartRow[]
  otherCharges: readonly { job_id: string; amount: number | string | null }[]
  sheets: readonly (SubLaborSheetRow & { job_ledger_id: string | null; assigned_to_name?: string | null })[]
  items: readonly SubLaborItemRow[]
  settings: readonly { key: string; value_num: number | null }[]
  /** The supply invoices' allocations with the house embedded (v2.6457); absent on an older caller, then no house rows. */
  supplyAlloc?: readonly (SupplyAllocationRow & { job_id: string })[]
}

export function jobCostsFromRows(rows: SiteCostRows): Map<string, JobCostRow> {
  const out = new Map<string, JobCostRow>()
  for (const jobId of rows.jobIds) {
    const cardLines = mercuryLinesFromRows(rows.cardAlloc.filter((r) => r.job_id === jobId))
    const sheets = rows.sheets.filter((s) => s.job_ledger_id === jobId)
    const sheetIds = new Set(sheets.map((s) => s.id))
    const labor = jobSubLaborInputsFromRows(sheets, rows.items.filter((i) => sheetIds.has(i.job_id)), [...rows.settings])
    const parts = {
      supplyInvoices: supplyInvoiceTotalFromRows(rows.invoiceAmounts, jobId),
      cardCharges: jobCardChargesCountedFromLines(cardLines, rows.cardExclusions),
      tallyParts: tallyPartsTotalFromLines(tallyLinesFromRows(rows.tally, jobId)),
      otherCharges: rows.otherCharges.filter((m) => m.job_id === jobId).reduce((s, m) => s + (Number(m.amount) || 0), 0),
    }
    const profit = buildJobProfitSummary({
      revenue: null,
      supplyInvoiceTotal: parts.supplyInvoices,
      cardChargesTotal: parts.cardCharges,
      tallyPartsTotal: parts.tallyParts,
      otherChargesTotal: parts.otherCharges,
      laborJobs: labor.laborJobs,
      mileageCost: labor.mileageCost,
      timePerMile: labor.timePerMile,
    })
    out.set(jobId, { jobId, parts, subLabor: profit.laborCost, total: profit.partsCost + profit.laborCost, breakdown: breakdownOf(jobId, rows, sheets, labor, cardLines) })
  }
  return out
}

/** A sheet's names as the board shows them: the crew on it, comma-joined; a sheet with none says so. */
export function sheetNamesWords(raw: string | null | undefined): string {
  return splitSheetNames(raw).join(', ') || 'A sub sheet with no name'
}

function breakdownOf(
  jobId: string,
  rows: SiteCostRows,
  sheets: SiteCostRows['sheets'],
  labor: ReturnType<typeof jobSubLaborInputsFromRows>,
  cardLines: ReturnType<typeof mercuryLinesFromRows>,
): JobCostBreakdown {
  const subs = new Map<string, { name: string; usd: number; sheets: number }>()
  // The sheets and the labor jobs line up one for one (`jobSubLaborInputsFromRows` maps the sheets in order).
  sheets.forEach((sheet, i) => {
    const lj = labor.laborJobs[i]
    if (!lj) return
    const name = sheetNamesWords(sheet.assigned_to_name)
    const cur = subs.get(name) ?? { name, usd: 0, sheets: 0 }
    cur.usd += laborJobSubCost(lj, labor.mileageCost, labor.timePerMile)
    cur.sheets += 1
    subs.set(name, cur)
  })
  const suppliers = new Map<string, { name: string; usd: number; invoices: number }>()
  for (const line of supplyLinesFromRows((rows.supplyAlloc ?? []).filter((r) => r.job_id === jobId))) {
    const name = line.supplyHouseName?.trim() || 'A supply house with no name'
    const cur = suppliers.get(name) ?? { name, usd: 0, invoices: 0 }
    cur.usd += line.allocatedAmount
    cur.invoices += 1
    suppliers.set(name, cur)
  }
  const counted = cardLines.filter((l) => jobCardLineStatus(l, rows.cardExclusions) === 'counts').map((l) => ({ txId: l.mercuryTransactionId, usd: cardChargeCostUsd(l.allocationAmount) }))
  return {
    subs: [...subs.values()].sort((a, b) => b.usd - a.usd),
    suppliers: [...suppliers.values()].sort((a, b) => b.usd - a.usd),
    cardLines: counted,
    tallyLines: tallyLinesFromRows(rows.tally, jobId).length,
    otherLines: rows.otherCharges.filter((m) => m.job_id === jobId && Number(m.amount)).length,
  }
}

/** The cell's title: where the figure comes from, bucket by bucket, the empty ones left out. */
export function costBreakdownWords(row: JobCostRow, money: (n: number) => string): string {
  const parts: string[] = []
  if (row.parts.supplyInvoices) parts.push(`supply houses ${money(row.parts.supplyInvoices)}`)
  if (row.parts.cardCharges) parts.push(`card ${money(row.parts.cardCharges)}`)
  if (row.parts.tallyParts) parts.push(`tally ${money(row.parts.tallyParts)}`)
  if (row.parts.otherCharges) parts.push(`other charges ${money(row.parts.otherCharges)}`)
  if (row.subLabor) parts.push(`sub labor ${money(row.subLabor)}`)
  return parts.length ? parts.join(' · ') : 'No cost is on this job yet.'
}
