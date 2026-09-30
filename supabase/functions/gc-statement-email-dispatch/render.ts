/**
 * GC statement email rendering for the scheduled dispatcher (v2.1426).
 *
 * The statement for one GC reads one property at a time (v2.4255) and is
 * written once, in `_shared/gcStatementByProperty.ts` — the client's Draft
 * Message, Preview and Copy for email lanes call the same module. This file
 * maps the get_gc_statement_email_payload RPC's rows onto it (ISO ref_date +
 * ref_is_estimate; the bill and the job's payments since v2.4100).
 * `src/lib/jobsDocuments/gcStatementEmailParity.test.ts` pins this mapping and
 * the client's (`gcStatementBillsOf`) on one fixture (journey-map #46).
 *
 * "Share all" (every GC in one email) keeps its flat table below; KEEP IT IN
 * SYNC with the client's `buildGcReviewShareAllEmailHtml` / `…Text` in
 * src/lib/jobsDocuments/gcStatementEmail.ts — same table shape, same
 * recipient-safe vocabulary (no days-past-due, no Collections chips).
 */

export type GcStatementPayloadRow = {
  job_id: string
  /** The bill's id, or the job's for a balance with no bill behind it. */
  row_key?: string | null
  display_number: string | null
  job_name: string | null
  job_address: string | null
  customer_name: string | null
  ref_date: string | null
  ref_is_estimate: boolean
  age_days: number | null
  remaining: number
  in_collections: boolean
  /** What paid the bill (v2.4100) — absent from a payload older than the RPC change, and then no line prints. */
  invoice_id?: string | null
  invoice_amount?: number | null
  retainage_held?: number | null
  job_bills?: PaidByBill[] | null
  job_payments?: PaidByPayment[] | null
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
import { billPaidByWords, type PaidByBill, type PaidByPayment } from '../_shared/billPaidBy.ts'
import {
  GC_STATEMENT_COMPANY_NAME,
  escapeHtml,
  gcStatementFooterHtml,
  gcStatementFooterLine,
  gcStatementIntroHtml,
  renderStatementByPropertyHtml,
  renderStatementByPropertyText,
  type StatementBillIn,
} from '../_shared/gcStatementByProperty.ts'

export {
  GC_STATEMENT_COMPANY_NAME,
  GC_STATEMENT_FOOTER_LINE,
  GC_STATEMENT_PAY_LINK_SRC,
  gcStatementFooterHtml,
  gcStatementFooterLine,
  officePhoneTelHref,
} from '../_shared/gcStatementByProperty.ts'

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

/**
 * Row label — mirror of gcStatementEmail.ts `gcStatementRowLabel` (journey-map
 * #46 duplicate-name fix): the address leads; a job with no address leads with
 * its name, and the sub-line must not print that name again.
 */
export function rowLabel(r: GcStatementPayloadRow): { lead: string; sub: string } {
  const address = (r.job_address ?? '').trim()
  const name = (r.job_name ?? '').trim()
  const num = (r.display_number ?? '').trim()
  const lead = address || name || '—'
  const sub = [num && num !== '—' ? `Job ${num}` : '', name && name !== lead ? name : ''].filter(Boolean).join(' · ')
  return { lead, sub }
}

/**
 * The line under the bill (v2.4100) — mirror of the client's `GcReviewRow.paidBy`, worded by
 * `_shared/billPaidBy.ts`. '' when the payload predates the RPC change (no bills, no payments).
 */
export function rowPaidBy(r: GcStatementPayloadRow): string {
  if (!r.job_bills && !r.job_payments) return ''
  return billPaidByWords(
    { bills: r.job_bills ?? [], payments: r.job_payments ?? [], retainageHeld: r.retainage_held },
    r.invoice_id ? { id: r.invoice_id, amount: r.invoice_amount ?? 0 } : null,
  )
}

const rowsHtml = (rows: GcStatementPayloadRow[]): string =>
  rows
    .map((r) => {
      const { lead, sub } = rowLabel(r)
      const paidBy = rowPaidBy(r)
      return `<tr>
        <td style="padding:7px 6px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;line-height:1.3">${escapeHtml(lead)}${sub ? `<br /><span style="font-size:11px;color:#6b7280">${escapeHtml(sub)}</span>` : ''}${paidBy ? `<br /><span style="font-size:11px;color:#6b7280">${escapeHtml(paidBy)}</span>` : ''}</td>
        <td style="padding:7px 6px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;white-space:nowrap;vertical-align:top">${escapeHtml(refDisplay(r))}</td>
        <td style="padding:7px 6px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;text-align:right;vertical-align:top">$${formatCurrency(r.remaining)}</td>
      </tr>`
    })
    .join('')

const rowText = (r: GcStatementPayloadRow): string => {
  const { lead, sub } = rowLabel(r)
  const paidBy = rowPaidBy(r)
  return `- ${lead}${sub ? ` (${sub})` : ''} — billed ${refDisplay(r)} — $${formatCurrency(r.remaining)}${paidBy ? ` — ${paidBy}` : ''}`
}

const tableHeadHtml = `<thead><tr>
      <th style="padding:6px;border-bottom:2px solid #9ca3af;font-size:12px;color:#4b5563;text-align:left">Job address</th>
      <th style="padding:6px;border-bottom:2px solid #9ca3af;font-size:12px;color:#4b5563;text-align:left">Bill sent</th>
      <th style="padding:6px;border-bottom:2px solid #9ca3af;font-size:12px;color:#4b5563;text-align:right">Amount owed</th>
    </tr></thead>`

const introTextLines = (introText: string | null | undefined): string[] => {
  const text = (introText ?? '').trim()
  return text ? [text, ''] : []
}

/** What the dispatcher adds to the payload before it renders one statement. */
export type GcStatementRenderExtras = {
  /** Each job's property record (`jobs_ledger.customer_address_id`), read beside the payload; a job left out groups by its address. */
  propertyIdByJob?: Readonly<Record<string, string | null>> | null
  /** What the account card's QR code loads — `cid:portal-qr` when the file is attached; null draws the card without a code. */
  qrImgSrc?: string | null
}

/** The payload's rows as the shared statement reads them — mirror of the client's `gcStatementBillsOf`. */
export function statementBillsOf(group: GcStatementPayloadGroup, propertyIdByJob?: Readonly<Record<string, string | null>> | null): StatementBillIn[] {
  return group.rows.map((r) => {
    // A payload from before v2.4100 carries no bill and no payments: the row is worded as owed in full.
    const decorated = r.job_bills != null || r.job_payments != null
    const jobPayments = r.job_payments ?? []
    return {
      key: r.row_key ?? r.invoice_id ?? r.job_id,
      jobId: r.job_id,
      jobNumber: r.display_number,
      jobName: r.job_name,
      jobAddress: r.job_address,
      customerName: r.customer_name,
      propertyId: propertyIdByJob?.[r.job_id] ?? null,
      sentYmd: r.ref_date,
      sentIsEstimate: r.ref_is_estimate,
      billed: !decorated ? r.remaining : r.invoice_id ? r.invoice_amount ?? r.remaining : null,
      owed: r.remaining,
      payments: !decorated ? [] : r.invoice_id ? jobPayments.filter((p) => p.invoice_id === r.invoice_id) : jobPayments,
      retainageHeld: r.retainage_held ?? null,
    }
  })
}

/** Single-GC (or single-development) statement — the same module the client's buildGcStatementEmailHtml calls. */
export function renderGcStatementHtml(group: GcStatementPayloadGroup, dateStr: string, officePhone?: string | null, portalUrl?: string | null, introText?: string | null, extras?: GcStatementRenderExtras | null): string {
  return renderStatementByPropertyHtml({
    payerName: group.entity_name,
    dateStr,
    bills: statementBillsOf(group, extras?.propertyIdByJob),
    officePhone,
    portalUrl,
    qrImgSrc: extras?.qrImgSrc,
    introText,
  })
}

export function renderGcStatementText(group: GcStatementPayloadGroup, dateStr: string, officePhone?: string | null, portalUrl?: string | null, introText?: string | null, extras?: GcStatementRenderExtras | null): string {
  return renderStatementByPropertyText({
    payerName: group.entity_name,
    dateStr,
    bills: statementBillsOf(group, extras?.propertyIdByJob),
    officePhone,
    portalUrl,
    introText,
  })
}

/** Whole-report email — mirror of buildGcReviewShareAllEmailHtml. */
export function renderGcShareAllHtml(payload: GcStatementPayload, dateStr: string, officePhone?: string | null, introText?: string | null): string {
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
  ${gcStatementIntroHtml(introText)}<p style="margin:0;font-size:16px;font-weight:bold;color:#111827">${escapeHtml(GC_STATEMENT_COMPANY_NAME)}</p>
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
  <p style="margin:12px 0 0;font-size:12px;color:#6b7280">${gcStatementFooterHtml(officePhone)}</p>
</div>`
}

export function renderGcShareAllText(payload: GcStatementPayload, dateStr: string, officePhone?: string | null, introText?: string | null): string {
  const scope = payload.group_by === 'development' ? 'development' : 'GC'
  const sections = payload.groups.flatMap((g) => [
    `${g.entity_name} · ${g.job_count} job${g.job_count === 1 ? '' : 's'} · $${formatCurrency(g.subtotal)}`,
    ...g.rows.map(rowText),
    '',
  ])
  return [
    ...introTextLines(introText),
    GC_STATEMENT_COMPANY_NAME,
    `Open balances by ${scope} · ${dateStr}`,
    '',
    ...sections,
    `Total owed: $${formatCurrency(payload.grand_total)}`,
    '',
    gcStatementFooterLine(officePhone),
  ].join('\n')
}
