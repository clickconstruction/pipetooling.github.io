import { lineLaborCost, type PeopleLaborJobItemLike } from '../peopleLaborJobItemLineCost'
import { formatCurrency } from '../jobs/jobFormatting'
import type { LaborJob } from '../../types/laborJob'

/**
 * Sub Labor sheet print builders (Stage A of the Jobs.tsx decomposition — see
 * docs/JOBS_TABS_ARCHITECTURE.md). One parameterized core replaces the two
 * near-duplicate inline printers (`printLaborSubSheet` / `printJobSubSheet`,
 * quirk #10) — they differed only in data source, title, and rate fallbacks.
 * Output bytes are unchanged.
 */

export type SubLaborSheetRow = PeopleLaborJobItemLike & { fixture?: string | null }

const escapeHtml = (s: string) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export type SubLaborSheetInput = {
  /** Raw (unescaped) window/H1 title, e.g. `Name — Address — 7/20/2026`. */
  title: string
  /** Rows to print — pre-filtered by the caller (the form printer drops blank-fixture rows; the saved-job printer prints all items). */
  rows: SubLaborSheetRow[]
  /** Rate used for line costs when a row has none (`lineLaborCost` fallback). */
  costFallbackRate: number
  /** Rate shown in the Rate column when a row has none (historically 0 for the form printer, the job rate for the saved-job printer). */
  displayRateFallback: number
}

export function buildSubLaborSheetHtml({ title, rows, costFallbackRate, displayRateFallback }: SubLaborSheetInput): string {
  const titleHtml = escapeHtml(title)
  const laborRowsHtml =
    rows.length === 0
      ? '<tr><td colspan="5" style="text-align:center; color:#6b7280;">No labor rows</td></tr>'
      : rows
          .map((row) => {
            const totalCost = lineLaborCost(row, costFallbackRate)
            const isDirect =
              row.direct_labor_amount != null && Number.isFinite(Number(row.direct_labor_amount))
            if (isDirect) {
              return `<tr><td>${escapeHtml(row.fixture ?? '')}</td><td style="text-align:center">—</td><td style="text-align:right">—</td><td style="text-align:right">—</td><td style="text-align:right">$${formatCurrency(totalCost)}</td></tr>`
            }
            const hrs = Number(row.hrs_per_unit) || 0
            const laborHrs = (row.is_fixed ?? false) ? hrs : (Number(row.count) || 0) * hrs
            const rate = row.labor_rate ?? displayRateFallback
            return `<tr><td>${escapeHtml(row.fixture ?? '')}</td><td style="text-align:center">${Number(row.count)}</td><td style="text-align:right">${laborHrs.toFixed(2)}</td><td style="text-align:right">$${rate.toFixed(2)}</td><td style="text-align:right">$${formatCurrency(totalCost)}</td></tr>`
          })
          .join('')

  const totalCost = rows.reduce((sum, row) => sum + lineLaborCost(row, costFallbackRate), 0)

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${titleHtml}</title><style>
  body { font-family: sans-serif; margin: 1in; }
  h1 { font-size: 1.25rem; margin-bottom: 1rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
  th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
  th { background: #f5f5f5; }
  @media print { body { margin: 0.5in; } }
</style></head><body>
  <h1>${titleHtml}</h1>
  <table>
    <thead><tr><th>Fixture or Tie-in</th><th style="text-align:center">Count</th><th style="text-align:right">Labor Hours</th><th style="text-align:right">Rate ($/hr)</th><th style="text-align:right">Cost</th></tr></thead>
    <tbody>${laborRowsHtml}<tr style="background:#f9fafb; font-weight:600"><td colspan="4" style="text-align:right">Total:</td><td style="text-align:right">$${formatCurrency(totalCost)}</td></tr></tbody>
  </table>
</body></html>`
}

/** Sub Labor modal "Print sub sheet": the in-progress labor form. */
export function buildLaborFormSubSheetHtml(opts: {
  assignedNames: string[]
  address: string
  rows: SubLaborSheetRow[]
  /** Injectable for tests; defaults to today. */
  dateStr?: string
}): string {
  const dateStr = opts.dateStr ?? new Date().toLocaleDateString()
  const assignedLabel = opts.assignedNames.length > 0 ? opts.assignedNames.join(', ') : 'Labor'
  const validRows = opts.rows.filter((r) => (r.fixture ?? '').trim())
  return buildSubLaborSheetHtml({
    title: `${assignedLabel} — ${opts.address || 'Job'} — ${dateStr}`,
    rows: validRows,
    // Historical fallbacks: cost falls back to the FIRST form row's rate (even
    // when that row is blank-fixture and filtered out) or $20; display shows 0.
    costFallbackRate: opts.rows[0]?.labor_rate ?? 20,
    displayRateFallback: 0,
  })
}

/** Sub Labor ledger row "Print sub sheet": a saved labor job. */
export function buildJobSubSheetHtml(job: LaborJob, dateStr?: string): string {
  const d =
    dateStr ??
    (job.job_date
      ? new Date(job.job_date + 'T12:00:00').toLocaleDateString()
      : job.created_at
        ? new Date(job.created_at).toLocaleDateString()
        : new Date().toLocaleDateString())
  const jobRate = job.labor_rate ?? 0
  const jobNumPart = job.job_number ? `${job.job_number} — ` : ''
  return buildSubLaborSheetHtml({
    title: `${job.assigned_to_name} — ${jobNumPart}${job.address} — ${d}`,
    rows: job.items ?? [],
    costFallbackRate: jobRate,
    displayRateFallback: jobRate,
  })
}
