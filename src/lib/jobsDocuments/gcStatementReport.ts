import type { GcReviewGroup } from '../gcReviewRollup'
import { formatCurrency, formatPrintDaysSince } from '../jobs/jobFormatting'

/**
 * GC Review → per-GC "statement" print (v2.1181). Pure HTML builder in the
 * billedAwaitingPaymentReport mold: light-pinned inline styles, the
 * window.open/print glue stays at the call site. One section per GC group;
 * pass a single group for the per-GC Print button or every group for
 * Print all.
 */

const escapeHtml = (s: string) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function buildGcStatementReportHtml(
  groups: GcReviewGroup[],
  opts?: { dateStr?: string; groupBy?: 'gc' | 'development' },
): string {
  const dateStr = opts?.dateStr ?? new Date().toLocaleDateString()
  const single = groups.length === 1 ? groups[0] : null
  const entityLabel = opts?.groupBy === 'development' ? 'Development' : 'GC'
  const title = escapeHtml(
    single
      ? `${entityLabel} statement — ${single.gcName} — ${dateStr}`
      : `${entityLabel} Review — billed awaiting payment — ${dateStr}`,
  )
  const grandTotal = groups.reduce((s, g) => s + g.subtotal, 0)

  const sectionsHtml = groups
    .map((g) => {
      const linesHtml = g.rows
        .map(
          (r) => `<tr>
              <td>${escapeHtml(r.customerName)}${r.inCollections ? ' <span style="font-size:0.6875rem;font-weight:600;color:#b91c1c">(Collections)</span>' : ''}</td>
              <td style="line-height:1.2">${escapeHtml(r.hcp)}${r.jobName ? `<br />${escapeHtml(r.jobName)}` : ''}</td>
              <td style="text-align:center;line-height:1.2">${escapeHtml(r.referenceDateDisplay)}<br />${escapeHtml(formatPrintDaysSince(r.ageDays))}</td>
              <td style="text-align:right">$${formatCurrency(r.remaining)}</td>
            </tr>`,
        )
        .join('')
      return `<section style="margin-bottom:1.25rem; page-break-inside:avoid">
  <h2 style="font-size:1.05rem; margin:0 0 0.2rem">${escapeHtml(g.gcName)}</h2>
  <p style="margin:0 0 0.35rem; font-size:0.875rem; color:#374151">${g.jobCount} job${g.jobCount === 1 ? '' : 's'} · $${formatCurrency(g.subtotal)} outstanding${g.oldestAgeDays != null ? ` · oldest ${g.oldestAgeDays} days` : ''}</p>
  <table>
    <thead><tr>
      <th>Customer</th><th style="text-align:left;line-height:1.15">Job</th><th style="text-align:center;line-height:1.15">Billed<br />Days past</th><th style="text-align:right">Amount due</th>
    </tr></thead>
    <tbody>${linesHtml}
      <tr style="background:#f9fafb; font-weight:600">
        <td colspan="3" style="text-align:right">Subtotal:</td>
        <td style="text-align:right">$${formatCurrency(g.subtotal)}</td>
      </tr>
    </tbody>
  </table>
</section>`
    })
    .join('')

  const grandTotalHtml =
    groups.length > 1
      ? `<p style="font-size:1rem; font-weight:700; text-align:right; margin-top:0.5rem">Total: $${formatCurrency(grandTotal)}</p>`
      : ''

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
  body { font-family: sans-serif; margin: 1in; }
  h1 { font-size: 1.25rem; margin-bottom: 0.25rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.35rem; font-size: 0.8125rem; }
  th, td { border: 1px solid #ccc; padding: 0.4rem 0.5rem; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; }
  @media print { body { margin: 0.5in; } }
</style></head><body>
  <h1>${title}</h1>
  ${sectionsHtml}${grandTotalHtml}
</body></html>`
}
