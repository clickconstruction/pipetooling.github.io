/**
 * The signed hours statement as a Letter page (punch list #212, v2.6069; restyled as one full-width paper 2026-11-02):
 * the paper the job window prints from `buildHoursStatement`'s result, in the Costs packet's page rule
 * (`<html data-theme="light">`, `@page { size: letter; margin: 0.5in 0.5in 0.6in }`, the stamp and the page numbers in
 * the margin boxes). Pure: it takes the statement and the header facts and returns one HTML document string; the caller
 * opens it with `openHtmlPrintWindow`, and the window shows the same string as its preview. Nothing on the paper says
 * how a row was recorded, by the owner's call of 2026-10-29.
 *
 * The shape: the company header, the title, the facts as one band across the width (worker, period, the rate when it
 * is the same on every row, job, customer, approver, the site on its own line), then the table full width with one line
 * per day — Day · In – Out · Hours · What they were working on · Amount, the Rate column only when the rate changes
 * inside the period, a long note on its own line under its day, hours always to two decimals, each week's subtotals
 * under Hours and Amount — then Paid, the stated block, the attestation and the two signature lines as full-width
 * bands. The column header repeats on every page, no row splits across a page, and a week heading (or a day with its
 * note) never ends a page without its first row; Chromium honours `break-after: avoid` on a table row. The attestation
 * and the signature lines keep with what is above them, so a signature line never opens a page alone.
 */

import { PAY_REPORT_ADDRESS, PAY_REPORT_EIN, PAY_REPORT_EMPLOYER_NAME } from '../../constants/payReportEmployerHeader'
import { HOURS_STATEMENT_NOTE_FITS, HOURS_STATEMENT_NOTE_FITS_WITH_RATE, hoursStatementHours2, hoursStatementMoney, hoursStatementUniformRate, type HoursStatement, type HoursStatementDay } from '../people/hoursStatement'

// The paper's shape lives in the kernel since v2.6629, so the signed PDF draws the same one; re-exported for this file's readers.
export { HOURS_STATEMENT_NOTE_FITS, HOURS_STATEMENT_NOTE_FITS_WITH_RATE, hoursStatementHours2, hoursStatementUniformRate }

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
  const chargedPaper = s.basis === 'charged' && s.charged != null
  const chargedPriced = chargedPaper && s.charged != null && s.charged.total != null
  // The money columns: with the pay, or on the charged basis once the days are priced (punch list #251).
  const withPay = (s.withPay && s.kind !== 'schedule') || chargedPriced
  const title = chargedPaper ? 'Statement of hours charged' : s.withPay && s.pay ? 'Statement of hours worked and paid' : 'Statement of hours worked'
  const docTitle = hoursStatementDocumentTitle(ctx)
  const stamp = `Made by ClickTooling from the clock, the pay reports and the payments as of ${ctx.asOf}. Record ${ctx.recordId ?? 'not yet filed (draft)'}.`
  const isSheet = s.kind === 'sheet'
  const uniformRate = hoursStatementUniformRate(s)
  const rateCol = withPay && uniformRate == null
  // Day · In – Out · Hours · What they were working on (a sheet: Day · Line · Hours), then Rate and Amount with the pay.
  const cols = (isSheet ? 3 : 4) + (rateCol ? 1 : 0) + (withPay ? 1 : 0)
  const noteFits = rateCol ? HOURS_STATEMENT_NOTE_FITS_WITH_RATE : HOURS_STATEMENT_NOTE_FITS

  const colgroup = isSheet
    ? `<col class="c-day"><col><col class="c-h">${rateCol ? '<col class="c-rate">' : ''}${withPay ? '<col class="c-amt">' : ''}`
    : `<col class="c-day"><col class="c-io"><col class="c-h"><col>${rateCol ? '<col class="c-rate">' : ''}${withPay ? '<col class="c-amt">' : ''}`
  const moneyHead = `${rateCol ? '<th class="n">Rate</th>' : ''}${withPay ? '<th class="n">Amount</th>' : ''}`
  const head = isSheet
    ? `<tr><th>Day</th><th>Line</th><th class="n">Hours</th>${moneyHead}</tr>`
    : `<tr><th>Day</th><th>In – Out</th><th class="n">Hours</th><th>What they were working on</th>${moneyHead}</tr>`
  const moneyCells = (d: Extract<HoursStatementDay, { pending: false }>) => `${rateCol ? `<td class="n">${money(d.rate)}</td>` : ''}${withPay ? `<td class="n">${money(d.amount)}</td>` : ''}`

  const rows: string[] = []
  for (const g of s.groups) {
    rows.push(`<tbody><tr class="wk"><td colspan="2">${esc(g.label)}</td><td class="n">${hoursStatementHours2(g.hours)}</td>${isSheet ? '' : '<td></td>'}${rateCol ? '<td></td>' : ''}${withPay ? `<td class="n">${money(g.amount)}</td>` : ''}</tr>`)
    for (const d of g.days) {
      if (d.pending) {
        rows.push(`<tr class="pend"><td class="d">${esc(d.dayLabel)}</td><td colspan="${cols - 1}"><i>${esc(d.words)}</i></td></tr>`)
        continue
      }
      const long = d.note.length > noteFits
      const inOut = [d.inLabel, d.outLabel].filter((t) => t).join(' – ')
      if (isSheet) rows.push(`<tr class="day${long ? ' hasnote' : ''}"><td class="d">${esc(d.dayLabel)}</td><td class="w">${long ? '' : esc(d.note)}</td><td class="n">${hoursStatementHours2(d.hours)}</td>${moneyCells(d)}</tr>`)
      else rows.push(`<tr class="day${long ? ' hasnote' : ''}"><td class="d">${esc(d.dayLabel)}</td><td class="io">${esc(inOut)}</td><td class="n">${hoursStatementHours2(d.hours)}</td><td class="w">${long ? '' : esc(d.note)}</td>${moneyCells(d)}</tr>`)
      if (long) rows.push(`<tr class="nt"><td></td><td colspan="${cols - 1}">${esc(d.note)}</td></tr>`)
    }
    rows.push('</tbody>')
  }
  if (rows.length === 0) rows.push(`<tbody><tr><td colspan="${cols}"><i>Nothing recorded on this job for the period.</i></td></tr></tbody>`)
  const totalRow = `<tbody><tr class="tot"><td colspan="2">${esc(s.totals.label)}</td><td class="n">${hoursStatementHours2(s.totals.hours)}</td>${isSheet ? '' : `<td>${esc(s.totals.daysWords)}</td>`}${rateCol ? '<td></td>' : ''}${withPay ? `<td class="n">${money(s.totals.amount)}</td>` : ''}</tr></tbody>`

  const stated = s.stated
    ? `<div class="gap"><b>${esc(s.stated.heading)}</b>${esc(s.stated.words)}
    <table class="stated"><tr><th>Day</th><th class="n">Hours</th><th>What they were working on</th><th>Stated by</th></tr>
    ${s.stated.rows.map((r) => `<tr><td>${esc(r.day)}</td><td class="n">${r.hours == null ? '' : hoursStatementHours2(r.hours)}</td><td>${esc(r.note)}</td><td class="src">${esc(r.statedBy)}</td></tr>`).join('')}
    <tr><td>&nbsp;</td><td></td><td></td><td></td></tr><tr><td>&nbsp;</td><td></td><td></td><td></td></tr><tr><td>&nbsp;</td><td></td><td></td><td></td></tr></table></div>`
    : ''

  // Each pay line is the week (or the sheet) in bold with the rest of the kernel's words after it.
  const payLine = (l: { label: string; words: string }) => {
    const rest = l.words.startsWith(l.label) ? l.words.slice(l.label.length).replace(/^ · /, '') : l.words
    return `<b>${esc(l.label)}</b><div>${esc(rest)}</div>`
  }
  const chargedBand =
    chargedPaper && s.charged
      ? `<div class="band"><h2>Charged</h2><div class="pay">
    ${s.charged.lines.map(payLine).join('\n    ')}${s.charged.lines.length === 0 ? '<p class="wide"><i>Nothing recorded on this job for the period.</i></p>' : ''}
    <p class="wide"><b>${esc(s.charged.totalWords)}</b></p>
    <p class="note">${esc(s.charged.note)}</p>${s.charged.leftOut.length ? `<p class="note">${esc(s.charged.leftOut.join(' '))}</p>` : ''}
  </div></div>`
      : ''
  const pay = s.pay
    ? `<div class="band"><h2>Paid</h2><div class="pay">
    ${s.pay.lines.map(payLine).join('\n    ')}${s.pay.lines.length === 0 ? '<p class="wide"><i>Nothing recorded as paid for this period.</i></p>' : ''}
    <p class="note">${esc(s.pay.note)}</p>${s.pay.lines.some((l) => l.rateSource === 'current') ? '<p class="note">A day no pay report has priced yet is shown at the current wage.</p>' : ''}
  </div></div>`
    : ''

  const standing = worker.company ? `${esc(worker.standing)}, ${esc(worker.company)}` : esc(worker.standing)
  const facts = [
    `<div><span>Worker</span> · <b>${esc(worker.name)}</b> (${standing})</div>`,
    `<div><span>Period</span> · <b>${esc(s.periodLabel)}</b></div>`,
    uniformRate != null ? `<div><span>Rate</span> · <b>${money(uniformRate)} an hour</b></div>` : '',
    `<div><span>Job</span> · <b>${esc(job.number)} · ${esc(job.name)}</b></div>`,
    job.customer && !job.isOfficeJob ? `<div><span>Customer</span> · <b>${esc(job.customer)}</b></div>` : '',
    ctx.approvedBy ? `<div><span>Approved by</span> · <b>${esc(ctx.approvedBy)}</b></div>` : '',
    `<div class="wide"><span>Site</span> · <b>${esc(job.site)}</b>${job.isOfficeJob ? ' (the company’s office)' : ''}</div>`,
  ].filter((f) => f)

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(docTitle)}</title>
<style>
@page { size: letter; margin: 0.5in 0.5in 0.6in; @bottom-left { content: "${esc(stamp).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"; font: 8px Georgia, "Times New Roman", serif; color: #555555; } @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8px Georgia, "Times New Roman", serif; color: #555555; } }
:root { color-scheme: light; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #e5e7eb; color: #111111; font: 12px/1.4 Georgia, "Times New Roman", serif; }
.sheet { width: 100%; max-width: 8.5in; min-height: 11in; padding: 0.5in; margin: 0 auto 16px; background: #ffffff; box-shadow: 0 2px 10px rgba(0,0,0,.12); }
.co { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #111111; padding-bottom: 8px; }
.co b { font-size: 15px; } .co small { display: block; color: #444444; font-size: 11px; line-height: 1.4; }
h1 { margin: 12px 0 6px; font: 700 18px/1.2 Georgia, "Times New Roman", serif; }
.facts { display: grid; grid-template-columns: 1.2fr 1fr .8fr; gap: 2px 16px; padding: 6px 0 7px; border-top: 1px solid #111111; border-bottom: 1px solid #111111; font-size: 11.5px; margin-bottom: 10px; }
.facts div { min-width: 0; } .facts .wide { grid-column: 1 / -1; }
.facts span { color: #555555; } .facts b { color: #111111; }
table.days { width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed; }
col.c-day { width: 0.9in; } col.c-io { width: 1.35in; } col.c-h { width: 0.6in; } col.c-rate { width: 0.7in; } col.c-amt { width: 0.85in; }
th { text-align: left; border-bottom: 1px solid #111111; padding: 3px 5px; font-size: 9.5px; letter-spacing: .05em; text-transform: uppercase; color: #333333; white-space: nowrap; }
td { border-bottom: 1px solid #dddddd; padding: 3px 5px; vertical-align: top; }
td.d, td.io { white-space: nowrap; }
td.n, th.n { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
td.w { overflow-wrap: anywhere; }
tr.wk td { background: #f3f3f3; font-weight: 700; border-bottom: 1px solid #bbbbbb; }
tr.hasnote td { border-bottom: 0; }
tr.nt td { padding-top: 0; color: #333333; overflow-wrap: anywhere; }
tr.pend td { color: #555555; }
tr.tot td { border-top: 2px solid #111111; border-bottom: 0; font-weight: 700; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
tr.wk, tr.hasnote { break-after: avoid; page-break-after: avoid; }
tr.nt { break-before: avoid; page-break-before: avoid; }
.band { margin-top: 12px; padding-top: 8px; border-top: 1px solid #111111; }
.band h2 { margin: 0 0 4px; font-size: 9.5px; letter-spacing: .05em; text-transform: uppercase; color: #333333; break-after: avoid; page-break-after: avoid; }
.pay { display: grid; grid-template-columns: max-content 1fr; gap: 1px 12px; font-size: 11px; }
.pay b { white-space: nowrap; } .pay div { break-inside: avoid; page-break-inside: avoid; }
.pay p { grid-column: 1 / -1; margin: 0; }
.pay p.note { margin-top: 5px; color: #555555; }
.gap { border: 1.5px dashed #777777; padding: 7px 10px; margin-top: 12px; font-size: 11px; background: #fafafa; break-inside: avoid; page-break-inside: avoid; }
.gap b { display: block; margin-bottom: 2px; }
.stated { width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 11px; }
.stated th { font-size: 9px; } .stated td { border-bottom: 1px solid #999999; height: 22px; }
.stated .src { font-size: 10px; color: #555555; white-space: nowrap; }
.attest { margin-top: 12px; padding-top: 8px; border-top: 1px solid #111111; font-size: 12px; break-inside: avoid; page-break-inside: avoid; }
.sig { display: grid; grid-template-columns: 1fr 1.6in; gap: 24px; margin-top: 32px; break-inside: avoid; page-break-inside: avoid; }
.attest, .sig { break-before: avoid; page-break-before: avoid; }
.sig div { border-top: 1px solid #111111; padding-top: 3px; font-size: 10.5px; color: #333333; }
.foot { margin-top: 18px; font-size: 10px; color: #555555; border-top: 1px solid #cccccc; padding-top: 4px; }
@media print {
  html, body { background: #ffffff; }
  .sheet { width: auto; max-width: none; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
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
  <div class="facts">
    ${facts.join('\n    ')}
  </div>
  <table class="days">
    <colgroup>${colgroup}</colgroup>
    <thead>${head}</thead>
    ${rows.join('\n    ')}
    ${totalRow}
  </table>
  ${chargedBand}${pay}
  ${stated}
  <div class="attest">${esc(s.attestation)}</div>
  <div class="sig"><div>Signature of the worker${worker.company ? ` for ${esc(worker.company)}` : ''} · printed name</div><div>Date</div></div>
  <div class="sig"><div>${esc(s.preparedWords ?? 'Prepared from the company’s records')} by ${esc(ctx.preparedBy)}</div><div>Date</div></div>
  <div class="foot">${esc(stamp)}</div>
</div>
</body>
</html>`
}
