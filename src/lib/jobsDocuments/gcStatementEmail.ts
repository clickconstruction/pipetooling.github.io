import type { GcReviewGroup, GcReviewGroupBy } from '../gcReviewRollup'
import { formatCurrency } from '../jobs/jobFormatting'

/**
 * GC-facing statement email (v2.1414) — what a General Contractor actually
 * receives, whether pasted into a personal email (Copy for email →
 * copyRichHtmlToClipboard) or sent by the app (send-gc-statement-email).
 *
 * Deliberately different from the internal gcStatementReport print: leads with
 * the three things a GC cares about — job address, the date the bill was
 * sent, and the amount owed — with the job number small underneath for
 * reference. No days-past-due pressure language, no internal vocabulary.
 * Table-based with inline styles so Gmail/Outlook/Apple Mail render it
 * faithfully.
 */

export const GC_STATEMENT_COMPANY_NAME = 'Click Plumbing and Electrical'
/** Subject-line short name (v2.2131, owner copy): "Click Plumbing open balances: Aug 22, 2026". */
export const GC_STATEMENT_SUBJECT_NAME = 'Click Plumbing'
export const GC_STATEMENT_FOOTER_LINE =
  'Questions about a bill? Reply to this email or call the office.'

const escapeHtml = (s: string) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Recipient-neutral on purpose — safe to paste to anyone without leaking another GC's name. */
export function gcStatementEmailSubject(_group: GcReviewGroup, dateStr: string): string {
  return `${GC_STATEMENT_SUBJECT_NAME} open balances: ${dateStr}`
}

const statementRowsHtml = (rows: GcReviewGroup['rows']): string =>
  rows
    .map((r) => {
      const sub = [r.hcp !== '—' ? `Job ${r.hcp}` : '', r.jobName].filter(Boolean).join(' · ')
      return `<tr>
        <td style="padding:7px 6px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;line-height:1.3">${escapeHtml(r.jobAddress || r.jobName || '—')}${sub ? `<br /><span style="font-size:11px;color:#6b7280">${escapeHtml(sub)}</span>` : ''}</td>
        <td style="padding:7px 6px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;white-space:nowrap;vertical-align:top">${escapeHtml(r.referenceDateDisplay)}</td>
        <td style="padding:7px 6px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;text-align:right;vertical-align:top">$${formatCurrency(r.remaining)}</td>
      </tr>`
    })
    .join('')

const statementTableHeadHtml = `<thead><tr>
      <th style="padding:6px;border-bottom:2px solid #9ca3af;font-size:12px;color:#4b5563;text-align:left">Job address</th>
      <th style="padding:6px;border-bottom:2px solid #9ca3af;font-size:12px;color:#4b5563;text-align:left">Bill sent</th>
      <th style="padding:6px;border-bottom:2px solid #9ca3af;font-size:12px;color:#4b5563;text-align:right">Amount owed</th>
    </tr></thead>`

/** The email body as an HTML fragment (for clipboard + the send pipeline wraps it itself). */
export function buildGcStatementEmailHtml(
  group: GcReviewGroup,
  opts?: { dateStr?: string; groupBy?: GcReviewGroupBy },
): string {
  const dateStr = opts?.dateStr ?? new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px">
  <p style="margin:0;font-size:16px;font-weight:bold;color:#111827">${escapeHtml(GC_STATEMENT_COMPANY_NAME)}</p>
  <p style="margin:2px 0 12px;font-size:13px;color:#4b5563">Statement for ${escapeHtml(group.gcName)} · ${escapeHtml(dateStr)}</p>
  <table style="width:100%;border-collapse:collapse">
    ${statementTableHeadHtml}
    <tbody>${statementRowsHtml(group.rows)}
      <tr>
        <td colspan="2" style="padding:9px 6px;font-size:14px;font-weight:bold;color:#111827">Total owed</td>
        <td style="padding:9px 6px;font-size:14px;font-weight:bold;color:#111827;text-align:right">$${formatCurrency(group.subtotal)}</td>
      </tr>
    </tbody>
  </table>
  <p style="margin:12px 0 0;font-size:12px;color:#6b7280">${escapeHtml(GC_STATEMENT_FOOTER_LINE)}</p>
</div>`
}

/**
 * "Share all" (v2.1420): the FULL GC Review report as one email — every
 * GC/development section with its own table and subtotal, then the grand
 * total. Same recipient-safe vocabulary as the per-GC statement (no
 * days-past-due, no internal terms), so it can go to someone inside or
 * outside the company.
 */
export function gcReviewShareAllEmailSubject(groupBy: GcReviewGroupBy, dateStr: string): string {
  const scope = groupBy === 'development' ? 'all developments' : 'all GCs'
  return `Open balances (${scope}) — ${GC_STATEMENT_COMPANY_NAME} — ${dateStr}`
}

export function buildGcReviewShareAllEmailHtml(
  report: { groups: GcReviewGroup[]; grandTotal: number },
  opts?: { dateStr?: string; groupBy?: GcReviewGroupBy },
): string {
  const dateStr = opts?.dateStr ?? new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const scope = opts?.groupBy === 'development' ? 'development' : 'GC'
  const sectionsHtml = report.groups
    .map(
      (g) => `<p style="margin:16px 0 4px;font-size:14px;font-weight:bold;color:#111827">${escapeHtml(g.gcName)} <span style="font-weight:normal;font-size:12px;color:#6b7280">· ${g.jobCount} job${g.jobCount === 1 ? '' : 's'} · $${formatCurrency(g.subtotal)}</span></p>
  <table style="width:100%;border-collapse:collapse">
    ${statementTableHeadHtml}
    <tbody>${statementRowsHtml(g.rows)}</tbody>
  </table>`,
    )
    .join('\n  ')
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px">
  <p style="margin:0;font-size:16px;font-weight:bold;color:#111827">${escapeHtml(GC_STATEMENT_COMPANY_NAME)}</p>
  <p style="margin:2px 0 4px;font-size:13px;color:#4b5563">Open balances by ${scope} · ${escapeHtml(dateStr)}</p>
  ${sectionsHtml}
  <table style="width:100%;border-collapse:collapse;margin-top:14px">
    <tbody>
      <tr>
        <td style="padding:9px 6px;border-top:2px solid #9ca3af;font-size:14px;font-weight:bold;color:#111827">Total owed</td>
        <td style="padding:9px 6px;border-top:2px solid #9ca3af;font-size:14px;font-weight:bold;color:#111827;text-align:right">$${formatCurrency(report.grandTotal)}</td>
      </tr>
    </tbody>
  </table>
  <p style="margin:12px 0 0;font-size:12px;color:#6b7280">${escapeHtml(GC_STATEMENT_FOOTER_LINE)}</p>
</div>`
}

export function buildGcReviewShareAllEmailText(
  report: { groups: GcReviewGroup[]; grandTotal: number },
  opts?: { dateStr?: string; groupBy?: GcReviewGroupBy },
): string {
  const dateStr = opts?.dateStr ?? new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const scope = opts?.groupBy === 'development' ? 'development' : 'GC'
  const sections = report.groups.flatMap((g) => [
    `${g.gcName} · ${g.jobCount} job${g.jobCount === 1 ? '' : 's'} · $${formatCurrency(g.subtotal)}`,
    ...g.rows.map((r) => {
      const sub = [r.hcp !== '—' ? `Job ${r.hcp}` : '', r.jobName].filter(Boolean).join(' · ')
      return `- ${r.jobAddress || r.jobName || '—'}${sub ? ` (${sub})` : ''} — billed ${r.referenceDateDisplay} — $${formatCurrency(r.remaining)}`
    }),
    '',
  ])
  return [
    GC_STATEMENT_COMPANY_NAME,
    `Open balances by ${scope} · ${dateStr}`,
    '',
    ...sections,
    `Total owed: $${formatCurrency(report.grandTotal)}`,
    '',
    GC_STATEMENT_FOOTER_LINE,
  ].join('\n')
}

/**
 * Standalone document for the Email… dialog's Preview window (v2.2061): the
 * exact email body the recipient gets, headed by the subject line, on a plain
 * light page (email clients render light regardless of app theme).
 */
export function buildGcStatementEmailPreviewHtml(
  group: GcReviewGroup,
  subject: string,
  opts?: { dateStr?: string; groupBy?: GcReviewGroupBy },
): string {
  return `<!doctype html><html><head><meta charset="utf-8" /><title>Statement preview — ${escapeHtml(group.gcName)}</title></head>
<body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:640px;margin:0 auto;padding:20px 16px">
    <p style="margin:0 0 2px;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280">Preview — what the recipient sees</p>
    <p style="margin:0 0 14px;font-size:13px;color:#374151"><strong>Subject:</strong> ${escapeHtml(subject)}</p>
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:20px">${buildGcStatementEmailHtml(group, opts)}</div>
  </div>
</body></html>`
}

/** Plain-text fallback for text-only paste targets. */
export function buildGcStatementEmailText(
  group: GcReviewGroup,
  opts?: { dateStr?: string },
): string {
  const dateStr = opts?.dateStr ?? new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const lines = group.rows.map((r) => {
    const sub = [r.hcp !== '—' ? `Job ${r.hcp}` : '', r.jobName].filter(Boolean).join(' · ')
    return `- ${r.jobAddress || r.jobName || '—'}${sub ? ` (${sub})` : ''} — billed ${r.referenceDateDisplay} — $${formatCurrency(r.remaining)}`
  })
  return [
    GC_STATEMENT_COMPANY_NAME,
    `Statement for ${group.gcName} · ${dateStr}`,
    '',
    ...lines,
    '',
    `Total owed: $${formatCurrency(group.subtotal)}`,
    '',
    GC_STATEMENT_FOOTER_LINE,
  ].join('\n')
}
