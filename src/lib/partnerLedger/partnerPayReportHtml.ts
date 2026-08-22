/**
 * Partner pay-report document builder (Partnerships → Ledger drill-in).
 *
 * A labor row on the partner ledger opens the pay report for that statement
 * week: the per-day hours at the rates stamped when the statement was
 * generated (pay_stub_days), plus everything attached to the statement —
 * additional lines, deductions, and payouts. Pure: takes loaded rows, returns
 * a standalone print-ready HTML document (rendered in PayStubViewModal's
 * iframe, so Print prints only the report). Deliberately partner-safe: shows
 * the partner's own hours, rates, and money — never company revenue or
 * anyone else's wages.
 */

import {
  PAY_REPORT_ADDRESS,
  PAY_REPORT_EMPLOYER_NAME,
} from '../../constants/payReportEmployerHeader'

export type PartnerPayReportDay = {
  work_date: string
  hours: number
  rate: number
  paid: number
}

export type PartnerPayReportContext = {
  personName: string
  periodStart: string
  periodEnd: string
  hoursTotal: number
  grossPay: number
  days: PartnerPayReportDay[]
  additionalLines: Array<{ description: string; line_total: number }>
  deductions: Array<{ description: string; amount: number }>
  payments: Array<{ paid_at: string; amount: number; memo: string | null }>
  generatedYmd: string
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDateLong(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/**
 * Statement-local remainder: gross + additions − deductions − payouts.
 * The document's closing line — what this statement still owes (or, when
 * negative, how far payouts overran it).
 */
export function partnerStatementRemainder(ctx: Pick<PartnerPayReportContext, 'grossPay' | 'additionalLines' | 'deductions' | 'payments'>): number {
  const add = ctx.additionalLines.reduce((s, l) => s + l.line_total, 0)
  const ded = ctx.deductions.reduce((s, l) => s + l.amount, 0)
  const paid = ctx.payments.reduce((s, p) => s + p.amount, 0)
  return Math.round((ctx.grossPay + add - ded - paid) * 100) / 100
}

export function buildPartnerPayReportHtml(ctx: PartnerPayReportContext): string {
  const dayRows = ctx.days
    .map(
      (d) =>
        `<tr><td>${fmtDateLong(d.work_date)}</td><td class="num">${d.hours.toLocaleString()} h</td><td class="num">$${fmtMoney(d.rate)}/hr</td><td class="num">$${fmtMoney(d.paid)}</td></tr>`,
    )
    .join('')
  const extraRows = [
    ...ctx.additionalLines.map(
      (l) => `<tr><td colspan="3">Plus: ${escapeHtml(l.description || 'Additional')}</td><td class="num">+$${fmtMoney(l.line_total)}</td></tr>`,
    ),
    ...ctx.deductions.map(
      (l) => `<tr class="less"><td colspan="3">Less: ${escapeHtml(l.description || 'Deduction')}</td><td class="num">−$${fmtMoney(l.amount)}</td></tr>`,
    ),
    ...ctx.payments.map(
      (p) =>
        `<tr class="less"><td colspan="3">Paid out ${fmtDateLong(p.paid_at.slice(0, 10))}${p.memo ? ` — ${escapeHtml(p.memo)}` : ''}</td><td class="num">−$${fmtMoney(p.amount)}</td></tr>`,
    ),
  ].join('')
  const remainder = partnerStatementRemainder(ctx)
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pay report — ${escapeHtml(ctx.personName)} (${ctx.periodStart} – ${ctx.periodEnd})</title><style>
body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #1f2937; margin: 2rem auto; max-width: 640px; padding: 0 1rem; }
header { border-bottom: 2px solid #1f2937; padding-bottom: 8px; margin-bottom: 4px; }
h1 { font-size: 1.15rem; margin: 0; }
.muted { color: #6b7280; font-size: 0.8rem; margin: 2px 0; }
.strip { display: flex; gap: 2rem; margin: 14px 0 6px; }
.strip b { display: block; font-size: 1.05rem; }
.strip span { font-size: 0.72rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; }
table { width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-top: 8px; }
th { text-align: left; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; padding: 4px 0; border-bottom: 1px solid #d1d5db; }
th.num { text-align: right; }
td { padding: 4px 0; border-bottom: 1px solid #f3f4f6; }
td.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
tr.less td { color: #991b1b; }
.total td { border-top: 1px solid #d1d5db; border-bottom: none; font-weight: 700; }
footer { margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 8px; color: #9ca3af; font-size: 0.75rem; }
@media print { body { margin: 0.5rem auto; } }
</style></head><body>
<header>
  <h1>Pay report — ${escapeHtml(ctx.personName)}</h1>
  <p class="muted">${escapeHtml(PAY_REPORT_EMPLOYER_NAME)} · ${escapeHtml(PAY_REPORT_ADDRESS)}</p>
  <p class="muted">Week ${ctx.periodStart} – ${ctx.periodEnd}</p>
</header>
<div class="strip">
  <div><span>Hours</span><b>${ctx.hoursTotal.toLocaleString()} h</b></div>
  <div><span>Gross</span><b>$${fmtMoney(ctx.grossPay)}</b></div>
  <div><span>Still on this statement</span><b>${remainder < 0 ? '−' : ''}$${fmtMoney(Math.abs(remainder))}</b></div>
</div>
<table>
  <thead><tr><th>Day</th><th class="num">Hours</th><th class="num">Rate</th><th class="num">Paid</th></tr></thead>
  <tbody>
    ${dayRows || '<tr><td colspan="4" class="muted">No per-day detail recorded for this week.</td></tr>'}
    <tr class="total"><td>Labor total</td><td class="num">${ctx.hoursTotal.toLocaleString()} h</td><td></td><td class="num">$${fmtMoney(ctx.grossPay)}</td></tr>
    ${extraRows}
  </tbody>
</table>
<footer>Rates are the rates stamped when this statement was generated — later Deal-tab changes never rewrite history. Generated ${ctx.generatedYmd}.</footer>
</body></html>`
}
