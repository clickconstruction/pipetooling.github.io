/**
 * Change orders on the estimates rails (v2.1826+ CO train).
 *
 * A change order is an estimate row with `doc_kind = 'change_order'`: it rides
 * the whole acceptance machine (public accept page, typed signature, send
 * email, notify, status pipeline) and stores its narrative in
 * `estimates.change_order_fields` (jsonb — parsed/serialized here). The cost
 * impact IS the estimate's line items — negative lines are credits — so the
 * net change to contract is computed, not typed. The document layout follows
 * the Bids change-order generator (`bidDocuments/changeOrder.ts`) so both
 * surfaces read the same to a GC.
 */

import { addressLines, escapeHtml } from './bidDocuments/htmlDoc'
import type { EstimateLineItemNormalized } from './estimateLineItemNormalize'

export type EstimateChangeOrderFields = {
  /** What is changing — scope narrative (multi-line). */
  description_of_change: string
  /** Why — owner directive, field condition, plan revision… */
  reason_for_change: string
  /** Schedule impact narrative ("+2 working days", "none"). */
  impact_on_schedule: string
  /** 'YYYY-MM-DD' the office wants a response by; '' = unset. */
  response_requested_by: string
}

export const EMPTY_ESTIMATE_CHANGE_ORDER_FIELDS: EstimateChangeOrderFields = {
  description_of_change: '',
  reason_for_change: '',
  impact_on_schedule: '',
  response_requested_by: '',
}

const s = (v: unknown): string => (typeof v === 'string' ? v : '')

/** Tolerant parse of `estimates.change_order_fields` — unknown/missing keys become ''. */
export function parseEstimateChangeOrderFields(raw: unknown): EstimateChangeOrderFields {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...EMPTY_ESTIMATE_CHANGE_ORDER_FIELDS }
  const o = raw as Record<string, unknown>
  return {
    description_of_change: s(o.description_of_change),
    reason_for_change: s(o.reason_for_change),
    impact_on_schedule: s(o.impact_on_schedule),
    response_requested_by: s(o.response_requested_by),
  }
}

export function isChangeOrderDocKind(docKind: string | null | undefined): boolean {
  return docKind === 'change_order'
}

/** Signed sum of line amounts — credits (negative lines) subtract. */
export function changeOrderNetChangeCents(lines: Array<Pick<EstimateLineItemNormalized, 'amount_cents'>>): number {
  return lines.reduce((sum, l) => sum + Math.round(l.amount_cents), 0)
}

export function formatSignedCentsUsd(cents: number): string {
  const abs = Math.abs(cents) / 100
  const usd = abs.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  return cents < 0 ? `−${usd}` : usd
}

export interface EstimateChangeOrderDocArgs {
  /** e.g. "Change Order #1044" — shared estimate number sequence. */
  documentLabel: string
  customerName: string
  customerAddress: string
  /** The work being changed — job/project/estimate label. */
  projectLabel: string
  projectAddress: string
  fields: EstimateChangeOrderFields
  /** Cost impact lines — amount_cents signed; negatives render as credits. */
  lines: EstimateLineItemNormalized[]
  /** Sending office; omitted line when blank. */
  companyName?: string
}

function costRows(lines: EstimateLineItemNormalized[]): Array<{ label: string; amount: number }> {
  return lines
    .map((l) => ({
      label: [l.line_item.trim(), l.description.trim()].filter(Boolean).join(' — ') || '—',
      amount: Math.round(l.amount_cents),
    }))
    .filter((r) => r.label !== '—' || r.amount !== 0)
}

export function buildEstimateChangeOrderDocHtml(a: EstimateChangeOrderDocArgs): string {
  const br = '<br/>'
  const pStyle = 'margin: 0 0 0.5em 0'
  const customerBlock =
    '<strong>' + escapeHtml(a.customerName || '—') + '</strong>' +
    (a.customerAddress.trim() ? br + addressLines(a.customerAddress).map((l) => escapeHtml(l)).join(br) : '')
  const projectBlock =
    '<strong>' + escapeHtml(a.projectLabel || '—') + '</strong>' +
    (a.projectAddress.trim() ? br + addressLines(a.projectAddress).map((l) => escapeHtml(l)).join(br) : '')
  const rows = costRows(a.lines)
  const net = changeOrderNetChangeCents(a.lines)
  const paragraphs: string[] = [
    '<strong style="font-size: 1.1em;">' + escapeHtml(a.documentLabel) + '</strong>',
    '',
    customerBlock + br + br + projectBlock,
    '',
    ...(a.fields.response_requested_by.trim()
      ? ['Response requested by ' + escapeHtml(a.fields.response_requested_by), '']
      : []),
    '<div style="border-top: 1px solid #d1d5db; margin: 0.85em 0;"></div>',
    '<strong>Description of change</strong>' + br + escapeHtml(a.fields.description_of_change || '—').replace(/\n/g, br),
    '',
    '<strong>Reason for change</strong>' + br + escapeHtml(a.fields.reason_for_change || '—').replace(/\n/g, br),
    '',
    '<div style="border-top: 1px solid #d1d5db; margin: 0.85em 0;"></div>',
    '<strong>Impact on cost</strong>',
  ]
  const costTable =
    '<table style="border-collapse: collapse; min-width: 60%;">' +
    rows
      .map(
        (r) =>
          '<tr><td style="padding: 2px 24px 2px 0;">' + escapeHtml(r.label) + '</td><td style="padding: 2px 0; text-align: right;">' + escapeHtml(formatSignedCentsUsd(r.amount)) + '</td></tr>'
      )
      .join('') +
    '<tr><td style="padding: 6px 24px 2px 0; border-top: 1px solid #444;"><strong>Net change to contract</strong></td><td style="padding: 6px 0 2px; border-top: 1px solid #444; text-align: right;"><strong>' +
    escapeHtml(formatSignedCentsUsd(net)) +
    '</strong></td></tr></table>'
  paragraphs.push(costTable)
  paragraphs.push('')
  paragraphs.push('<div style="border-top: 1px solid #d1d5db; margin: 0.85em 0;"></div>')
  paragraphs.push('<strong>Impact on schedule</strong>' + br + escapeHtml(a.fields.impact_on_schedule || '—').replace(/\n/g, br))
  if (a.companyName?.trim()) {
    paragraphs.push('')
    paragraphs.push(escapeHtml(a.companyName))
  }
  return paragraphs.map((p) => (p === '' ? '<p style="' + pStyle + '">&nbsp;</p>' : '<p style="' + pStyle + '">' + p + '</p>')).join('')
}

export function buildEstimateChangeOrderDocText(a: EstimateChangeOrderDocArgs): string {
  const rows = costRows(a.lines)
  const net = changeOrderNetChangeCents(a.lines)
  const out: string[] = [
    a.documentLabel,
    '',
    a.customerName || '—',
    ...addressLines(a.customerAddress),
    '',
    a.projectLabel || '—',
    ...addressLines(a.projectAddress),
    '',
  ]
  if (a.fields.response_requested_by.trim()) {
    out.push(`Response requested by ${a.fields.response_requested_by}`, '')
  }
  out.push('Description of change:', a.fields.description_of_change || '—', '')
  out.push('Reason for change:', a.fields.reason_for_change || '—', '')
  out.push('Impact on cost:')
  for (const r of rows) out.push(`  ${r.label}: ${formatSignedCentsUsd(r.amount)}`)
  out.push(`  Net change to contract: ${formatSignedCentsUsd(net)}`, '')
  out.push('Impact on schedule:', a.fields.impact_on_schedule || '—')
  if (a.companyName?.trim()) out.push('', a.companyName)
  return out.join('\n')
}
