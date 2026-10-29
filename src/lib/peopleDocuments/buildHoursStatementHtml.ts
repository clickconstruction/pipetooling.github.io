/**
 * The signed hours statement as a Letter page (punch list #212, v2.6069): the paper the job window prints from
 * `buildHoursStatement`'s result, in the pay report's manner and the Costs packet's page rule (`<html data-theme="light">`,
 * `@page { size: letter; margin: 0.5in 0.5in 0.6in }`, the stamp and the page numbers in the margin boxes). Pure: it
 * takes the statement and the header facts and returns one HTML document string; the caller opens it with
 * `openHtmlPrintWindow`. Nothing on the paper says how a row was recorded, by the owner's call of 2026-10-29.
 */

import { PAY_REPORT_ADDRESS, PAY_REPORT_EIN, PAY_REPORT_EMPLOYER_NAME } from '../../constants/payReportEmployerHeader'
import { hoursStatementHours, hoursStatementMoney, type HoursStatement } from '../people/hoursStatement'

export type HoursStatementHtmlContext = {
  statement: HoursStatement
  /** `HS-1042-0007` once filed (PR 2); null prints as a draft. */
  recordId: string | null
  worker: { name: string; standing: string; company?: string | null }
  job: { number: string; name: string; customer: string | null; site: string; isOfficeJob?: boolean }
  approvedBy: string | null
  preparedBy: string
  /** `October 29, 2026`. */
  preparedOn: string
  /** When the rows were read, e.g. `October 29, 2026 6:12 pm`. */
  asOf: string
  company?: { name: string; ein: string | null; address: string }
}

const esc = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const money = (n: number | null) => (n == null ? '' : hoursStatementMoney(n))

export function hoursStatementDocumentTitle(ctx: Pick<HoursStatementHtmlContext, 'worker' | 'job' | 'statement'>): string {
  return `Statement of hours worked · ${ctx.worker.name} · Job ${ctx.job.number} · ${ctx.statement.periodLabel}`
}

export function buildHoursStatementHtml(ctx: HoursStatementHtmlContext): string {
  const { statement: s, worker, job } = ctx
  const company = ctx.company ?? { name: PAY_REPORT_EMPLOYER_NAME, ein: PAY_REPORT_EIN, address: PAY_REPORT_ADDRESS }
  const withPay = s.withPay && s.kind !== 'schedule'
  const title = s.withPay && s.pay ? 'Statement of hours worked and paid' : 'Statement of hours worked'
  const docTitle = hoursStatementDocumentTitle(ctx)
  const stamp = `Made by ClickTooling from the clock, the pay reports and the payments as of ${ctx.asOf}. Record ${ctx.recordId ?? 'not yet filed (draft)'}.`
  const isSheet = s.kind === 'sheet'
  const cols = (isSheet ? 4 : 5) + (withPay ? 2 : 0)

  const head = isSheet
    ? `<tr><th>Sheet</th><th>Day</th><th>Line</th><th class="n">Hours</th>${withPay ? '<th class="n">Rate</th><th class="n">Amount</th>' : ''}</tr>`
    : `<tr><th>Day</th><th>In</th><th>Out</th><th class="n">Hours</th><th>What ${isSheet ? 'they were' : 'they were'} working on</th>${withPay ? '<th class="n">Rate</th><th class="n">Amount</th>' : ''}</tr>`

  const rows: string[] = []
  for (const g of s.groups) {
    rows.push(`<tr class="wk"><td colspan="${cols - 1 - (withPay ? 2 : 0)}">${esc(g.label)}</td><td class="n">${hoursStatementHours(g.hours)}</td>${withPay ? `<td></td><td class="n">${money(g.amount)}</td>` : ''}</tr>`)
    for (const d of g.days) {
      if (d.pending) {
        rows.push(`<tr class="pend"><td>${esc(d.dayLabel)}</td><td colspan="${cols - 1}"><i>${esc(d.words)}</i></td></tr>`)
        continue
      }
      if (isSheet) rows.push(`<tr><td>${esc(g.label.split(' · ')[0])}</td><td>${esc(d.dayLabel)}</td><td>${esc(d.note)}</td><td class="n">${hoursStatementHours(d.hours)}</td>${withPay ? `<td class="n">${money(d.rate)}</td><td class="n">${money(d.amount)}</td>` : ''}</tr>`)
      else rows.push(`<tr><td>${esc(d.dayLabel)}</td><td>${esc(d.inLabel ?? '')}</td><td>${esc(d.outLabel ?? '')}</td><td class="n">${hoursStatementHours(d.hours)}</td><td>${esc(d.note)}</td>${withPay ? `<td class="n">${money(d.rate)}</td><td class="n">${money(d.amount)}</td>` : ''}</tr>`)
    }
  }
  if (rows.length === 0) rows.push(`<tr><td colspan="${cols}"><i>Nothing recorded on this job for the period.</i></td></tr>`)
  const totalRow = `<tr class="tot"><td colspan="${isSheet ? 3 : 3}">${esc(s.totals.label)}</td><td class="n">${hoursStatementHours(s.totals.hours)}</td>${isSheet ? '' : `<td>${esc(s.totals.daysWords)}</td>`}${withPay ? `<td></td><td class="n">${money(s.totals.amount)}</td>` : ''}</tr>`

  const stated = s.stated
    ? `<div class="gap"><b>${esc(s.stated.heading)}</b>${esc(s.stated.words)}
      <table class="stated"><tr><th>Day</th><th class="n">Hours</th><th>What ${isSheet ? 'they were' : 'they were'} working on</th><th>Stated by</th></tr>
      ${s.stated.rows.map((r) => `<tr><td>${esc(r.day)}</td><td class="n">${r.hours == null ? '' : hoursStatementHours(r.hours)}</td><td>${esc(r.note)}</td><td class="src">${esc(r.statedBy)}</td></tr>`).join('')}
      <tr><td>&nbsp;</td><td></td><td></td><td></td></tr><tr><td>&nbsp;</td><td></td><td></td><td></td></tr><tr><td>&nbsp;</td><td></td><td></td><td></td></tr></table></div>`
    : ''

  const pay = s.pay
    ? `<div class="pay"><b>Paid</b>${s.pay.lines.map((l) => `<p>${esc(l.words)}</p>`).join('')}${s.pay.lines.length === 0 ? '<p><i>Nothing recorded as paid for this period.</i></p>' : ''}<p class="note">${esc(s.pay.note)}</p>${s.pay.lines.some((l) => l.rateSource === 'current') ? '<p class="note">A day no pay report has priced yet is shown at the current wage.</p>' : ''}</div>`
    : ''

  const standing = worker.company ? `${esc(worker.standing)}, ${esc(worker.company)}` : esc(worker.standing)
  const meta = [
    `<div><span>Worker</span> · <b>${esc(worker.name)}</b> (${standing})`,
    `<div><span>Period</span> · <b>${esc(s.periodLabel)}</b></div>`,
    `<div><span>Job</span> · <b>${esc(job.number)} · ${esc(job.name)}</b></div>`,
    job.customer && !job.isOfficeJob ? `<div><span>Customer</span> · <b>${esc(job.customer)}</b></div>` : '<div></div>',
    `<div><span>Site</span> · <b>${esc(job.site)}</b>${job.isOfficeJob ? ' (the company’s office)' : ''}</div>`,
    ctx.approvedBy ? `<div><span>Approved by</span> · <b>${esc(ctx.approvedBy)}</b></div>` : '<div></div>',
  ]

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<title>${esc(docTitle)}</title>
<style>
@page { size: letter; margin: 0.5in 0.5in 0.6in; @bottom-left { content: "${esc(stamp).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"; font: 8px Georgia, "Times New Roman", serif; color: #555555; } @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8px Georgia, "Times New Roman", serif; color: #555555; } }
* { box-sizing: border-box; }
html, body { margin: 0; background: #e5e7eb; color: #111111; font: 12.5px/1.45 Georgia, "Times New Roman", serif; }
.sheet { width: 8.5in; min-height: 11in; padding: 0.5in 0.6in; margin: 0 auto 16px; background: #ffffff; box-shadow: 0 2px 10px rgba(0,0,0,.12); }
.co { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #111111; padding-bottom: 8px; }
.co b { font-size: 15px; } .co small { display: block; color: #444444; font-size: 11px; }
h1 { margin: 14px 0 2px; font: 700 18px/1.2 Georgia, "Times New Roman", serif; }
.meta { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 18px; margin: 8px 0 12px; font-size: 12px; }
.meta span { color: #555555; } .meta b { color: #111111; }
table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 11.5px; }
th { text-align: left; border-bottom: 1px solid #111111; padding: 4px 4px; font-size: 10.5px; letter-spacing: .04em; text-transform: uppercase; color: #333333; }
td { border-bottom: 1px solid #dddddd; padding: 4px 4px; vertical-align: top; }
td.n, th.n { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
tr.wk td { background: #f3f3f3; font-weight: 700; border-bottom: 1px solid #bbbbbb; }
tr.pend td { color: #555555; }
tr.tot td { border-top: 2px solid #111111; border-bottom: 0; font-weight: 700; }
tr { page-break-inside: avoid; }
thead { display: table-header-group; }
.src { font-size: 10px; color: #555555; white-space: nowrap; }
.gap { border: 1.5px dashed #777777; padding: 8px 10px; margin: 12px 0; font-size: 11.5px; background: #fafafa; page-break-inside: avoid; }
.gap b { display: block; margin-bottom: 2px; }
.stated td { border-bottom: 1px solid #999999; height: 22px; }
.pay { margin-top: 14px; page-break-inside: avoid; }
.pay p { margin: 2px 0; font-size: 11.5px; }
.pay p.note { color: #555555; }
.attest { margin-top: 16px; padding-top: 10px; border-top: 1px solid #111111; font-size: 12px; page-break-inside: avoid; }
.sig { display: grid; grid-template-columns: 1.4fr .8fr; gap: 24px; margin-top: 34px; page-break-inside: avoid; }
.sig div { border-top: 1px solid #111111; padding-top: 3px; font-size: 10.5px; color: #333333; }
.foot { margin-top: 18px; font-size: 10px; color: #555555; border-top: 1px solid #cccccc; padding-top: 4px; }
@media print {
  html, body { background: #ffffff; }
  .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
  .foot { display: none; }
}
</style>
</head>
<body>
<div class="sheet">
  <div class="co">
    <div><b>${esc(company.name)}</b><small>${company.ein ? `EIN ${esc(company.ein)}` : ''}</small><small>${esc(company.address)}</small></div>
    <div style="text-align:right"><small>Statement ${esc(ctx.recordId ?? 'draft, not yet filed')}</small><small>Prepared ${esc(ctx.preparedOn)} by ${esc(ctx.preparedBy)}</small><small>From the company’s records as of ${esc(ctx.asOf)}</small></div>
  </div>
  <h1>${esc(title)}</h1>
  <div class="meta">${meta.join('')}</div>
  <table><thead>${head}</thead><tbody>${rows.join('')}${totalRow}</tbody></table>
  ${stated}
  ${pay}
  <div class="attest">${esc(s.attestation)}</div>
  <div class="sig"><div>Signature of the worker${worker.company ? ` for ${esc(worker.company)}` : ''} · printed name</div><div>Date</div></div>
  <div class="sig"><div>Prepared from the company’s records by ${esc(ctx.preparedBy)}</div><div>Date</div></div>
  <div class="foot">${esc(stamp)}</div>
</div>
</body>
</html>`
}
