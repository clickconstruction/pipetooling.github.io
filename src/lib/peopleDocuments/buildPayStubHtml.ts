/**
 * Pay-report (pay stub) print/preview HTML builder for People → Pay.
 *
 * Pure: this takes an explicit `PayStubHtmlContext` (including the resolved
 * person `contact`, so it does not depend on the People roster) and returns a
 * standalone HTML document string. It is shared by the pay-stub ledger's
 * `printPayStub` (in `PeoplePayStubsTab`) and the draft-payroll
 * `viewPayStub` / `generatePayStub` flows (still in `People.tsx`). Lifted out of
 * `People.tsx` verbatim during the `pay_stubs` extraction so both callers share
 * one tested builder.
 *
 * `openPayStubWindow` is the tiny browser side-effect that opens the built HTML
 * in a new tab (and optionally prints). Kept alongside the builder so the two
 * always travel together.
 */

import {
  PAY_REPORT_ADDRESS,
  PAY_REPORT_EIN,
  PAY_REPORT_EMPLOYER_NAME,
} from '../../constants/payReportEmployerHeader'
import { formatCurrency } from '../format'
import { buildPayReportDocumentTitle } from '../payReportDocumentTitle'
import { stubNetPay } from '../payStubDeductions'
import { stripPrevailingWageTag } from '../payStubPrevailingWageLine'
import type { RateSplitSummary } from '../officeJobRateSplit'

export type PayStubHtmlVehicle = {
  year: number
  make: string
  model: string
  vin: string | null
  weekly_insurance_cost: number
  weekly_registration_cost: number
}

export type PayStubHtmlHousing = {
  address: string
  rent_per_week: number
  utilities_per_week: number
  insurance_per_week: number
}

export type PayStubHtmlContext = {
  personName: string
  /** Resolved at the call site from the People roster (email/phone or nulls). */
  contact: { email: string | null; phone: string | null }
  periodStart: string
  periodEnd: string
  hourlyWage: number
  hoursRows: Array<{ date: string; hours: number }>
  hoursTotal: number
  grossPay: number
  rowsWithJobs?: Array<{ date: string; hours: number; jobsText: string }>
  vehicles?: PayStubHtmlVehicle[]
  additionalLines?: Array<{ description: string; quantity: number; rate: number; line_total: number }>
  lessDeductionLines?: Array<{ amount: number; description: string; source: string }>
  pendingOffsets?: Array<{ type: string; amount: number; description: string | null }>
  physicalPayments?: Array<{ paid_at: string; amount: number; memo: string | null }>
  housingRows?: PayStubHtmlHousing[]
  /** Present only for dual-rate (office vs. field) stubs; itemizes the two earnings lines. */
  rateSplit?: RateSplitSummary
}

export function buildPayStubHtml(ctx: PayStubHtmlContext): string {
  const {
    personName,
    contact,
    periodStart,
    periodEnd,
    hourlyWage,
    hoursRows,
    hoursTotal,
    grossPay,
    rowsWithJobs,
    vehicles,
    additionalLines,
    lessDeductionLines,
    pendingOffsets,
    physicalPayments,
    housingRows,
    rateSplit,
  } = ctx
  const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const dateWithDay = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    const day = d.toLocaleDateString('en-US', { weekday: 'short' })
    return `${dateStr} (${day})`
  }
  const { email, phone } = contact
  const periodLabel = `Pay Period: ${new Date(periodStart + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(periodEnd + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  const wageDisplay = hourlyWage > 0 ? `$${formatCurrency(hourlyWage)}/hr` : '—'
  const wageSection = rateSplit
    ? `<div class="meta">Office: ${rateSplit.officeHours.toFixed(2)} h @ $${formatCurrency(rateSplit.officeRate)}/hr = $${formatCurrency(rateSplit.officePaid)}</div>` +
      `<div class="meta">Field: ${rateSplit.jobHours.toFixed(2)} h @ $${formatCurrency(rateSplit.jobRate)}/hr = $${formatCurrency(rateSplit.jobPaid)}</div>`
    : `<div class="meta">Hourly wage: ${wageDisplay}</div>`
  const hasJobs = rowsWithJobs && rowsWithJobs.length > 0
  const tableRows = hasJobs
    ? rowsWithJobs!.map((r) => `<tr><td>${escapeHtml(dateWithDay(r.date))}</td><td style="text-align:right">${r.hours.toFixed(2)}</td><td>${escapeHtml(r.jobsText)}</td></tr>`).join('')
    : hoursRows.map((r) => `<tr><td>${escapeHtml(dateWithDay(r.date))}</td><td style="text-align:right">${r.hours.toFixed(2)}</td></tr>`).join('')
  const tableHeader = hasJobs
    ? '<thead><tr><th>Date</th><th style="text-align:right">Hours</th><th>Jobs / Bids</th></tr></thead>'
    : '<thead><tr><th>Date</th><th style="text-align:right">Hours</th></tr></thead>'
  const tableFooter = hasJobs
    ? `<tfoot><tr><td style="font-weight:600">Total</td><td style="text-align:right; font-weight:600">${hoursTotal.toFixed(2)}</td><td></td></tr></tfoot>`
    : `<tfoot><tr><td style="font-weight:600">Total</td><td style="text-align:right; font-weight:600">${hoursTotal.toFixed(2)}</td></tr></tfoot>`
  const payReportDocumentTitle = buildPayReportDocumentTitle(personName, periodStart, periodEnd)
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(payReportDocumentTitle)}</title><style>
      body { font-family: sans-serif; margin: 1in; }
      .pay-report-employer-header { text-align: center; margin-bottom: 1.25rem; }
      .pay-report-employer-name { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.35rem; letter-spacing: 0.02em; }
      .pay-report-employer-meta { color: #666; font-size: 0.9rem; line-height: 1.4; }
      table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
      th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
      th { background: #f5f5f5; }
      .meta { margin-bottom: 0.5rem; color: #666; }
      @media print { body { margin: 0.5in; } }
    </style></head><body>
      <div class="pay-report-employer-header">
        <div class="pay-report-employer-name">${PAY_REPORT_EMPLOYER_NAME}</div>
        <div class="pay-report-employer-meta">EIN: ${PAY_REPORT_EIN}</div>
        <div class="pay-report-employer-meta">${PAY_REPORT_ADDRESS}</div>
      </div>
      <h1>Pay Report</h1>
      <div style="margin-bottom: 0.5rem;"><strong>${escapeHtml(personName)}</strong></div>
      ${email ? `<div class="meta">${escapeHtml(email)}</div>` : ''}
      ${phone ? `<div class="meta">${escapeHtml(phone)}</div>` : ''}
      <div class="meta">${periodLabel}</div>
      ${wageSection}
      <table>
        ${tableHeader}
        <tbody>${tableRows}</tbody>
        ${tableFooter}
      </table>
      <div style="margin-top: 1rem; font-weight: 600;">Gross Pay: $${formatCurrency(grossPay)}</div>
      ${(() => {
        const addLines = additionalLines ?? []
        const addTotal = Math.round(addLines.reduce((s, x) => s + x.line_total, 0) * 100) / 100
        const lessLines = lessDeductionLines ?? []
        const lessTotal = Math.round(lessLines.reduce((s, x) => s + x.amount, 0) * 100) / 100
        const netPay = stubNetPay(grossPay, lessTotal, addTotal)
        let block = ''
        if (addLines.length > 0) {
          block += '<div style="margin-top: 0.75rem;"><strong>Additional</strong></div>'
          for (const A of addLines) {
            block += `<div class="meta">- ${escapeHtml(stripPrevailingWageTag(A.description))}: ${A.quantity} × $${formatCurrency(A.rate)} = $${formatCurrency(A.line_total)}</div>`
          }
          block += `<div class="meta"><strong>Total Additional: $${formatCurrency(addTotal)}</strong></div>`
        }
        if (lessLines.length > 0) {
          block += '<div style="margin-top: 0.75rem;"><strong>Less</strong></div>'
          for (const L of lessLines) {
            const tag = L.source === 'offset' ? 'Offset' : 'Manual'
            block += `<div class="meta">- ${escapeHtml(tag)}: ${escapeHtml(L.description)} — $${formatCurrency(L.amount)}</div>`
          }
          block += `<div class="meta"><strong>Total Less: $${formatCurrency(lessTotal)}</strong></div>`
        }
        block += `<div class="meta" style="margin-top: 0.75rem; font-weight: 600;">Net Pay: $${formatCurrency(netPay)}</div>`
        const pending = pendingOffsets ?? []
        if (pending.length > 0) {
          block += '<div style="margin-top: 0.75rem;"><strong>Pending Offsets (not yet on a pay report):</strong></div>'
          for (const o of pending) {
            const pendingTypeLabel =
              o.type === 'backcharge' ? 'Backcharge' : o.type === 'damage' ? 'Damage' : o.type === 'employee_credit' ? 'Employee credit' : o.type
            block += `<div class="meta">- ${escapeHtml(pendingTypeLabel)}${o.description ? ` (${escapeHtml(o.description)})` : ''}: $${formatCurrency(o.amount)}</div>`
          }
        }
        return block
      })()}
      ${physicalPayments && physicalPayments.length > 0
        ? (() => {
            const total = physicalPayments.reduce((s, p) => s + p.amount, 0)
            let block = '<div style="margin-top: 1rem;"><strong>Physical payments</strong></div>'
            for (const p of physicalPayments) {
              const d = new Date(p.paid_at)
              const line = `$${formatCurrency(p.amount)} on ${escapeHtml(d.toLocaleDateString())}${p.memo?.trim() ? ` — ${escapeHtml(p.memo.trim())}` : ''}`
              block += `<div class="meta">${line}</div>`
            }
            block += `<div class="meta" style="font-weight:600;">Total paid: $${formatCurrency(total)}</div></div>`
            return block
          })()
        : ''}
      ${vehicles && vehicles.length > 0 ? `<div style="margin-top: 1rem;">${vehicles.map((v) => `<div class="meta">Vehicle: ${escapeHtml(String(v.year))} ${escapeHtml(v.make)} ${escapeHtml(v.model)}${v.vin ? ` (VIN: ${escapeHtml(v.vin)})` : ''}</div><div class="meta">Weekly insurance: $${formatCurrency(v.weekly_insurance_cost)} | Weekly registration: $${formatCurrency(v.weekly_registration_cost)}</div>`).join('')}</div>` : ''}
      ${
        housingRows && housingRows.length > 0
          ? `<div style="margin-top: 1rem;"><strong>Housing</strong>${housingRows
              .map(
                (h) =>
                  `<div class="meta">Address: ${escapeHtml(h.address)}</div><div class="meta">Rent/week: $${formatCurrency(h.rent_per_week)} | Utilities/week: $${formatCurrency(h.utilities_per_week)} | Insurance/week: $${formatCurrency(h.insurance_per_week)}</div>`,
              )
              .join('')}</div>`
          : ''
      }
    </body></html>`
  return html
}

export function openPayStubWindow(html: string, doPrint: boolean): void {
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  if (doPrint) {
    win.print()
    win.onafterprint = () => win.close()
  }
}
