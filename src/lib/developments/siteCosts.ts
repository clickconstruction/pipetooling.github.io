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
  mercuryLinesFromRows,
  supplyInvoiceTotalFromRows,
  tallyLinesFromRows,
  tallyPartsTotalFromLines,
  type MercuryAllocationRow,
  type TallyPartRow,
} from '../../../supabase/functions/_shared/jobMaterialsCostLines'
import { jobSubLaborInputsFromRows, type SubLaborItemRow, type SubLaborSheetRow } from '../../../supabase/functions/_shared/jobSubLaborInputs'
import type { CardChargeExclusions } from '../../../supabase/functions/_shared/cardChargeAllocationFilter'

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
  sheets: readonly (SubLaborSheetRow & { job_ledger_id: string | null })[]
  items: readonly SubLaborItemRow[]
  settings: readonly { key: string; value_num: number | null }[]
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
    out.set(jobId, { jobId, parts, subLabor: profit.laborCost, total: profit.partsCost + profit.laborCost })
  }
  return out
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
