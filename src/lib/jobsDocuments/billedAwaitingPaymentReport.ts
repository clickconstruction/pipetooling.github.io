import type { StageRow } from '../jobsStagesBoard'
import { formatCurrency, formatPrintDaysSince } from '../jobs/jobFormatting'
import {
  printBilledRowReferenceDate,
  sortStageRowsForTotalByNameDetail,
  stageRowBilledRemainingAmount,
} from '../jobs/invoiceBilling'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'

/**
 * Stages → Billed Awaiting Payment "Print" report (Stage A of the Jobs.tsx
 * decomposition — see docs/JOBS_TABS_ARCHITECTURE.md). Pure HTML builder;
 * the empty-rows guard and window.open/print glue stay at the call site.
 * Output bytes are unchanged from the inline `printBilledAwaitingPaymentReport`.
 */

const escapeHtml = (s: string) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function buildBilledAwaitingPaymentReportHtml(
  rows: StageRow[],
  opts?: { searchFilter?: string; dateStr?: string },
): string {
  const dateStr = opts?.dateStr ?? new Date().toLocaleDateString()
  const title = escapeHtml(`Billed awaiting payment — ${dateStr}`)
  const filterNote = opts?.searchFilter?.trim()
    ? `<p style="margin:0.35rem 0 0; font-size:0.9rem; color:#4b5563;">Filtered (stages search): ${escapeHtml(opts.searchFilter.trim())}</p>`
    : ''
  const grandTotal = rows.reduce((s, r) => s + stageRowBilledRemainingAmount(r), 0)

  const groups = new Map<string, { displayName: string; rows: StageRow[] }>()
  for (const r of rows) {
    const job = r.job
    const nameNorm = (job.customer_name ?? '').trim().toLowerCase()
    const key = job.customer_id ?? (nameNorm.length > 0 ? `name:${nameNorm}` : '—')
    let g = groups.get(key)
    if (!g) {
      g = { displayName: (job.customer_name ?? '').trim() || '—', rows: [] }
      groups.set(key, g)
    }
    g.rows.push(r)
  }
  for (const g of groups.values()) {
    const named = g.rows.map((row) => (row.job.customer_name ?? '').trim()).find((n) => n.length > 0)
    if (named) g.displayName = named
  }

  const sortedGroups = [...groups.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
  )

  const sectionsHtml = sortedGroups
    .map((g) => {
      const sortedRows = sortStageRowsForTotalByNameDetail(g.rows)
      const contactJob = sortedRows[0]!.job
      const phoneRaw = (contactJob.customer_phone ?? '').trim()
      const emailRaw = (contactJob.customer_email ?? '').trim()
      const sectionHeading =
        (g.displayName ?? '').trim() && g.displayName !== '—' ? g.displayName : 'Jobs with no customer linked'
      const contactBlock =
        phoneRaw || emailRaw
          ? `<p style="margin:0 0 0.5rem; font-size:0.875rem; color:#374151">Phone: ${escapeHtml(phoneRaw || '—')} · Email: ${escapeHtml(emailRaw || '—')}</p>`
          : ''
      const subtotal = sortedRows.reduce((s, r) => s + stageRowBilledRemainingAmount(r), 0)
      const linesHtml = sortedRows
        .map((r) => {
          const j = r.job
          const detail =
            r.kind === 'job' ? 'Job balance' : r.kind === 'job_with_merged_billed' ? 'Billed line' : `Invoice #${r.inv.sequence_order}`
          const amt = stageRowBilledRemainingAmount(r)
          const { display: dateDisplay, ageDays } = printBilledRowReferenceDate(r)
          return `<tr>
              <td>${escapeHtml(effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—')}</td>
              <td style="line-height:1.2">${escapeHtml(j.job_name ?? '—')}<br />${escapeHtml(j.job_address ?? '—')}</td>
              <td>${escapeHtml(detail)}</td>
              <td style="text-align:center;line-height:1.2">${escapeHtml(dateDisplay)}<br />${escapeHtml(formatPrintDaysSince(ageDays))}</td>
              <td style="text-align:right">$${formatCurrency(amt)}</td>
            </tr>`
        })
        .join('')
      return `<section style="margin-bottom:1.25rem; page-break-inside:avoid">
  <h2 style="font-size:1.05rem; margin:0 0 0.35rem">${escapeHtml(sectionHeading)}</h2>
  ${contactBlock}
  <table>
    <thead><tr>
      <th>HCP</th><th style="text-align:left;line-height:1.15">Job<br />Address</th><th>Detail</th><th style="text-align:center;line-height:1.15">Billed<br />Days past</th><th style="text-align:right">Amount due</th>
    </tr></thead>
    <tbody>${linesHtml}
      <tr style="background:#f9fafb; font-weight:600">
        <td colspan="4" style="text-align:right">Subtotal:</td>
        <td style="text-align:right">$${formatCurrency(subtotal)}</td>
      </tr>
    </tbody>
  </table>
</section>`
    })
    .join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
  body { font-family: sans-serif; margin: 1in; }
  h1 { font-size: 1.25rem; margin-bottom: 0.25rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.35rem; font-size: 0.8125rem; }
  th, td { border: 1px solid #ccc; padding: 0.4rem 0.5rem; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; }
  section h2 + p { word-break: break-word; }
  @media print { body { margin: 0.5in; } }
</style></head><body>
  <h1>${title}</h1>${filterNote}
  ${sectionsHtml}
  <p style="margin-top:1rem; font-size:1rem; font-weight:600; text-align:right">Grand total: $${formatCurrency(grandTotal)}</p>
</body></html>`
}
