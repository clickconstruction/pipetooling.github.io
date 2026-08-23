/**
 * GC statement email rendering for the scheduled dispatcher (v2.1426).
 *
 * KEEP IN SYNC with the client builders in
 * src/lib/jobsDocuments/gcStatementEmail.ts — same table shape, same
 * recipient-safe vocabulary (job address / bill sent / amount owed; no
 * days-past-due, no Collections chips). The client builds from GcReviewGroup
 * (display strings precomputed); this module builds from the
 * get_gc_statement_email_payload RPC shape (ISO ref_date + ref_is_estimate).
 */

export type GcStatementPayloadRow = {
  job_id: string
  display_number: string | null
  job_name: string | null
  job_address: string | null
  customer_name: string | null
  ref_date: string | null
  ref_is_estimate: boolean
  age_days: number | null
  remaining: number
  in_collections: boolean
}

export type GcStatementPayloadGroup = {
  entity_id: string | null
  entity_name: string
  is_no_entity: boolean
  job_count: number
  subtotal: number
  oldest_age_days: number | null
  rows: GcStatementPayloadRow[]
}

export type GcStatementPayload = {
  generated_at: string
  group_by: 'gc' | 'development'
  include_collections: boolean
  grand_total: number
  groups: GcStatementPayloadGroup[]
}

import { APP_CALENDAR_TZ } from '../_shared/appTimeZone.ts'

export const GC_STATEMENT_COMPANY_NAME = 'Click Plumbing and Electrical'
export const GC_STATEMENT_FOOTER_LINE =
  'Questions about a bill? Reply to this email or call the office.'

/** Mirror of gcStatementFooterLine (v2.2133): office number from app_settings physical_invoice_issuer_v1.phone. */
export function gcStatementFooterLine(officePhone?: string | null): string {
  const phone = (officePhone ?? '').trim()
  return phone ? `Questions about a bill? Reply to this email or call the office at ${phone}.` : GC_STATEMENT_FOOTER_LINE
}

const escapeHtml = (s: string) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const formatCurrency = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function chicagoDateStr(now = new Date()): string {
  return now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: APP_CALENDAR_TZ,
  })
}

/** 'YYYY-MM-DD' → 'Mon D, YYYY' (+ ' (est.)' when the date is the estimate fallback). */
function refDisplay(row: GcStatementPayloadRow): string {
  if (!row.ref_date) return '—'
  const d = new Date(`${row.ref_date}T12:00:00Z`)
  const s = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  return row.ref_is_estimate ? `${s} (est.)` : s
}

/** Keep in sync with src/lib/jobsDocuments/gcStatementEmail.ts gcStatementEmailSubject (v2.2131 copy). */
export function gcStatementSubject(dateStr: string): string {
  return `Click Plumbing open balances: ${dateStr}`
}

export function gcShareAllSubject(groupBy: 'gc' | 'development', dateStr: string): string {
  const scope = groupBy === 'development' ? 'all developments' : 'all GCs'
  return `Open balances (${scope}) — ${GC_STATEMENT_COMPANY_NAME} — ${dateStr}`
}

const rowsHtml = (rows: GcStatementPayloadRow[]): string =>
  rows
    .map((r) => {
      const num = (r.display_number ?? '').trim()
      const sub = [num ? `Job ${num}` : '', (r.job_name ?? '').trim()].filter(Boolean).join(' · ')
      const lead = (r.job_address ?? '').trim() || (r.job_name ?? '').trim() || '—'
      return `<tr>
        <td style="padding:7px 6px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;line-height:1.3">${escapeHtml(lead)}${sub ? `<br /><span style="font-size:11px;color:#6b7280">${escapeHtml(sub)}</span>` : ''}</td>
        <td style="padding:7px 6px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;white-space:nowrap;vertical-align:top">${escapeHtml(refDisplay(r))}</td>
        <td style="padding:7px 6px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;text-align:right;vertical-align:top">$${formatCurrency(r.remaining)}</td>
      </tr>`
    })
    .join('')

const tableHeadHtml = `<thead><tr>
      <th style="padding:6px;border-bottom:2px solid #9ca3af;font-size:12px;color:#4b5563;text-align:left">Job address</th>
      <th style="padding:6px;border-bottom:2px solid #9ca3af;font-size:12px;color:#4b5563;text-align:left">Bill sent</th>
      <th style="padding:6px;border-bottom:2px solid #9ca3af;font-size:12px;color:#4b5563;text-align:right">Amount owed</th>
    </tr></thead>`

/**
 * Portal card under the statement table (v2.2151). Mirror of
 * src/lib/jobsDocuments/gcStatementEmail.ts `gcStatementPortalCardHtml` — keep in sync.
 */
export function portalCardHtml(portalUrl: string | null | undefined): string {
  const url = (portalUrl ?? '').trim()
  if (!url) return ''
  const shown = url.replace(/^https?:\/\//, '')
  return `<table role="presentation" style="width:100%;border-collapse:collapse;margin-top:14px"><tr>
    <td style="border:1px solid #ddd6c8;border-left:4px solid #b0662f;background:#fbf7f0;border-radius:6px;padding:12px 14px">
      <p style="margin:0;font-size:14px;font-weight:bold;color:#16283c">Your account, any time</p>
      <p style="margin:3px 0 0;font-size:13px;color:#5a6b7e;line-height:1.4">This statement stays current at <a href="${escapeHtml(url)}" style="color:#b0662f;font-weight:bold;text-decoration:none">${escapeHtml(shown)}</a> — pay any bill there by card or ACH.</p>
    </td>
  </tr></table>`
}

export function portalLineText(portalUrl: string | null | undefined): string | null {
  const url = (portalUrl ?? '').trim()
  return url ? `Your account, any time: this statement stays current at ${url} — pay any bill there by card or ACH.` : null
}

/** Single-GC (or single-development) statement — mirror of buildGcStatementEmailHtml. */
export function renderGcStatementHtml(group: GcStatementPayloadGroup, dateStr: string, officePhone?: string | null, portalUrl?: string | null): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px">
  <p style="margin:0;font-size:16px;font-weight:bold;color:#111827">${escapeHtml(GC_STATEMENT_COMPANY_NAME)}</p>
  <p style="margin:2px 0 12px;font-size:13px;color:#4b5563">Statement for ${escapeHtml(group.entity_name)} · ${escapeHtml(dateStr)}</p>
  <table style="width:100%;border-collapse:collapse">
    ${tableHeadHtml}
    <tbody>${rowsHtml(group.rows)}
      <tr>
        <td colspan="2" style="padding:9px 6px;font-size:14px;font-weight:bold;color:#111827">Total owed</td>
        <td style="padding:9px 6px;font-size:14px;font-weight:bold;color:#111827;text-align:right">$${formatCurrency(group.subtotal)}</td>
      </tr>
    </tbody>
  </table>${portalCardHtml(portalUrl)}
  <p style="margin:12px 0 0;font-size:12px;color:#6b7280">${escapeHtml(gcStatementFooterLine(officePhone))}</p>
</div>`
}

export function renderGcStatementText(group: GcStatementPayloadGroup, dateStr: string, officePhone?: string | null, portalUrl?: string | null): string {
  const lines = group.rows.map((r) => {
    const num = (r.display_number ?? '').trim()
    const sub = [num ? `Job ${num}` : '', (r.job_name ?? '').trim()].filter(Boolean).join(' · ')
    const lead = (r.job_address ?? '').trim() || (r.job_name ?? '').trim() || '—'
    return `- ${lead}${sub ? ` (${sub})` : ''} — billed ${refDisplay(r)} — $${formatCurrency(r.remaining)}`
  })
  return [
    GC_STATEMENT_COMPANY_NAME,
    `Statement for ${group.entity_name} · ${dateStr}`,
    '',
    ...lines,
    '',
    `Total owed: $${formatCurrency(group.subtotal)}`,
    '',
    ...(portalLineText(portalUrl) ? [portalLineText(portalUrl) as string, ''] : []),
    gcStatementFooterLine(officePhone),
  ].join('\n')
}

/** Whole-report email — mirror of buildGcReviewShareAllEmailHtml. */
export function renderGcShareAllHtml(payload: GcStatementPayload, dateStr: string, officePhone?: string | null): string {
  const scope = payload.group_by === 'development' ? 'development' : 'GC'
  const sectionsHtml = payload.groups
    .map(
      (g) => `<p style="margin:16px 0 4px;font-size:14px;font-weight:bold;color:#111827">${escapeHtml(g.entity_name)} <span style="font-weight:normal;font-size:12px;color:#6b7280">· ${g.job_count} job${g.job_count === 1 ? '' : 's'} · $${formatCurrency(g.subtotal)}</span></p>
  <table style="width:100%;border-collapse:collapse">
    ${tableHeadHtml}
    <tbody>${rowsHtml(g.rows)}</tbody>
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
        <td style="padding:9px 6px;border-top:2px solid #9ca3af;font-size:14px;font-weight:bold;color:#111827;text-align:right">$${formatCurrency(payload.grand_total)}</td>
      </tr>
    </tbody>
  </table>
  <p style="margin:12px 0 0;font-size:12px;color:#6b7280">${escapeHtml(gcStatementFooterLine(officePhone))}</p>
</div>`
}

export function renderGcShareAllText(payload: GcStatementPayload, dateStr: string, officePhone?: string | null): string {
  const scope = payload.group_by === 'development' ? 'development' : 'GC'
  const sections = payload.groups.flatMap((g) => [
    `${g.entity_name} · ${g.job_count} job${g.job_count === 1 ? '' : 's'} · $${formatCurrency(g.subtotal)}`,
    ...g.rows.map((r) => {
      const num = (r.display_number ?? '').trim()
      const sub = [num ? `Job ${num}` : '', (r.job_name ?? '').trim()].filter(Boolean).join(' · ')
      const lead = (r.job_address ?? '').trim() || (r.job_name ?? '').trim() || '—'
      return `- ${lead}${sub ? ` (${sub})` : ''} — billed ${refDisplay(r)} — $${formatCurrency(r.remaining)}`
    }),
    '',
  ])
  return [
    GC_STATEMENT_COMPANY_NAME,
    `Open balances by ${scope} · ${dateStr}`,
    '',
    ...sections,
    `Total owed: $${formatCurrency(payload.grand_total)}`,
    '',
    gcStatementFooterLine(officePhone),
  ].join('\n')
}
