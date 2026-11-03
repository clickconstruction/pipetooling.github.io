/**
 * The Statement of charges (punch list #254, PR 2): a job-level paper for a period — the crew-days at the rate card or
 * the job's rule, the material lines at the markup, the office's adjustments on top — as one snapshot with two prints:
 * the office copy with cost, markup, margin, the adjustments and the price's stand (a premium or a shortfall), and the
 * customer copy with charged amounts only and the line that it is a statement, not an invoice. Pure: the window and
 * the saved row hand in the snapshot; this file words it and lays it on a Letter page in the hours statement's style.
 * Nothing on it is typed in: every line is a row the Costs tab already shows.
 */
import { buildJobCharges, type JobCharges, type JobChargesInput } from './jobCharges'
import type { CrewSessionInput } from './crewDays'
import type { MaterialLineInput } from './materialsCharged'
import { jobChargeRuleWords } from './crewDays'
import { crewRateWords, crewRateFor } from './rateCard'
import { PREMIUM_CARRIES } from './premium'
import { moneyWords } from './moneyParts'
import { chargeAdjustmentWords } from './adjustments'

export type ChargeStatementCopy = 'office' | 'customer'

export type ChargeStatementState = 'draft' | 'printed'

/** What a saved statement keeps: the window's read as it stood, cut to the period, and the facts the paper prints. */
export type ChargeStatementSnapshot = {
  input: JobChargesInput
  period: { start: string; end: string }
  job: { number: string; name: string; customer: string | null; site: string }
  /** The company's line under the signature: who prepared it and when, and when the rows were read. */
  preparedBy: string
  preparedOn: string
  asOf: string
  /** The switch: name how many days came from the pay records, not the clock. */
  nameImportedDays: boolean
}

/** `SC-629-0003`: the record id, counted per job from 0001. */
export function chargeStatementRecordId(jobNumber: string, n: number): string {
  return `SC-${(jobNumber || '').trim() || 'job'}-${String(n).padStart(4, '0')}`
}

export function parseChargeStatementRecordId(id: string): { jobNumber: string; n: number } | null {
  const m = /^SC-(.+)-(\d{4,})$/.exec(id)
  return m ? { jobNumber: m[1]!, n: Number(m[2]) } : null
}

export function nextChargeStatementRecordId(jobNumber: string, existing: readonly string[]): string {
  let max = 0
  for (const id of existing) {
    const p = parseChargeStatementRecordId(id)
    if (p && p.n > max) max = p.n
  }
  return chargeStatementRecordId(jobNumber, max + 1)
}

/** The read cut to the period: sessions by work date; lines by their date, an undated line kept. */
export function cutJobChargesToPeriod(input: JobChargesInput, start: string, end: string): JobChargesInput {
  const inSpan = (d: string | null | undefined) => d == null || (d >= start && d <= end)
  return {
    ...input,
    sessions: input.sessions.filter((s: CrewSessionInput) => s.workDate >= start && s.workDate <= end),
    lines: input.lines.filter((l: MaterialLineInput) => inSpan(l.dateKey)),
  }
}

/** The first and last day anything on the job happened, for the window's default span; null with nothing. */
export function jobChargesSpan(input: JobChargesInput): { start: string; end: string } | null {
  const days = [...input.sessions.map((s) => s.workDate), ...input.lines.map((l) => l.dateKey).filter((d): d is string => d != null)].sort()
  return days.length ? { start: days[0]!, end: days[days.length - 1]! } : null
}

export type ChargeStatementWords = {
  title: string
  periodLabel: string
  laborAt: string
  materialsAt: string
  /** The line under the Labor table. */
  laborNote: string
  /** The line under the Materials table. */
  materialsNote: string
  preparedLine: string
  /** `Charged into this job`. */
  totalLabel: string
  customerLine: string
}

function longDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function shortDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** `January 1 – October 31, 2026` or `March 10, 2025 – March 27, 2026`. */
export function chargeStatementPeriodLabel(start: string, end: string): string {
  if (start.slice(0, 4) === end.slice(0, 4)) {
    const [y, m1, d1] = start.split('-').map(Number)
    const [, m2, d2] = end.split('-').map(Number)
    const a = new Date(Date.UTC(y!, m1! - 1, d1!)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
    const b = new Date(Date.UTC(y!, m2! - 1, d2!)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    return `${a} – ${b}`
  }
  return `${longDate(start)} – ${longDate(end)}`
}

export function chargeStatementWords(snapshot: ChargeStatementSnapshot, charges: JobCharges): ChargeStatementWords {
  const rule = snapshot.input.rule ?? { kind: 'crew' as const }
  const card = snapshot.input.card
  const headline = rule.kind === 'flat' ? rule.rate : rule.kind === 'shape' ? (card.rates[rule.shape] ?? null) : (card.rates.master_helper ?? null)
  const laborAt = `${jobChargeRuleWords(rule)}${headline != null ? ` · ${crewRateWords(crewRateFor(card, rule.kind === 'shape' ? rule.shape : 'master_helper', 0)).replace(/^No rate\.$/, moneyWords(headline))}` : ''}`
  const markup = charges.materials.markupPct
  const materialsAt = markup != null ? `${markup}% over cost${snapshot.input.markupPct != null ? ', the job’s markup' : ', the company’s markup'}` : 'cost, no markup set'
  const imported = charges.days.filter((d) => d.imported).length
  const laborNoteParts = ['A crew’s hours are the longest day of anyone in it.']
  if (snapshot.nameImportedDays) laborNoteParts.push(imported ? `${imported} of the ${charges.days.length} days are imported from the pay records, the rest from the clock.` : 'No day on this paper is imported; every hour was clocked in the app.')
  if (charges.totals.unpricedDays) laborNoteParts.push(`${charges.totals.unpricedDays} ${charges.totals.unpricedDays === 1 ? 'day is' : 'days are'} not priced: ${charges.notes.filter((n) => !/markup/.test(n)).join(' ')}`)
  const materialsNote = charges.materials.why ?? (charges.materials.totals.passedThrough ? `${charges.materials.totals.passedThrough} ${charges.materials.totals.passedThrough === 1 ? 'line is' : 'lines are'} passed through at cost.` : '')
  return {
    title: 'Statement of charges',
    periodLabel: chargeStatementPeriodLabel(snapshot.period.start, snapshot.period.end),
    laborAt,
    materialsAt,
    laborNote: laborNoteParts.join(' '),
    materialsNote,
    preparedLine: `Prepared from the company’s records, labor as ${laborAt}, materials at ${materialsAt}`,
    totalLabel: 'Charged into this job',
    customerLine: 'This is a statement of charges for the period, not an invoice. Amounts billed and paid on this job are on its bills.',
  }
}

const esc = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
/** Money on the paper with the cents smaller than the dollars (the owner's rule). */
function m(n: number): string {
  const whole = Math.floor(Math.abs(n))
  const cents = Math.round((Math.abs(n) - whole) * 100)
  return `${n < 0 ? '−' : ''}$${whole.toLocaleString('en-US')}<span class="c">.${String(cents).padStart(2, '0')}</span>`
}
const h2 = (n: number): string => (Math.round(n * 100) / 100).toFixed(2)

export type ChargeStatementHtmlContext = {
  snapshot: ChargeStatementSnapshot
  copy: ChargeStatementCopy
  recordId: string | null
  company?: { name: string; ein: string | null; address: string }
}

/** The paper: one Letter page in the hours statement's style, the office or the customer copy from one snapshot. */
export function buildChargeStatementHtml(ctx: ChargeStatementHtmlContext): string {
  const { snapshot, copy } = ctx
  const charges = buildJobCharges(cutJobChargesToPeriod(snapshot.input, snapshot.period.start, snapshot.period.end))
  const w = chargeStatementWords(snapshot, charges)
  const office = copy === 'office'
  const company = ctx.company ?? { name: 'CLICK PLUMBING AND ELECTRICAL', ein: '33-3002741', address: '5501 Balcones Dr A141 Austin, TX 78731' }
  const stamp = `Made by ClickTooling from the clock, the supply-house invoices and the job’s charges as of ${snapshot.asOf}. Record ${ctx.recordId ?? 'not yet filed (draft)'}.`

  const laborRows = charges.weeks
    .map((wk) => {
      const days = charges.days.filter((d) => d.workDate >= wk.weekStart && d.workDate < addDays(wk.weekStart, 7))
      const first = days[0]?.workDate ?? wk.weekStart
      const last = days[days.length - 1]?.workDate ?? wk.weekStart
      const span = days.length > 1 ? `${shortDate(first)} – ${shortDate(last)}` : shortDate(first)
      const rate = wk.rates.length === 1 ? `<td class="n">${m(wk.rates[0]!)}</td>` : `<td class="n">${wk.rates.length ? 'varies' : '—'}</td>`
      return `<tr><td>${esc(`Week of ${shortDate(wk.weekStart)}`)}<span class="src">${esc(`${span} · ${wk.who} · ${wk.shapeWords}`)}</span></td><td class="n">${wk.days}</td><td class="n">${h2(wk.crewHours)}</td>${rate}<td class="n">${wk.unpriced === wk.days ? '—' : m(wk.charged)}</td></tr>`
    })
    .join('\n')
  const laborTotal = `<tr class="tot"><td>Labor · ${charges.totals.days} crew-days</td><td class="n">${charges.totals.days}</td><td class="n">${h2(charges.totals.crewHours)}</td><td></td><td class="n">${m(charges.totals.labor)}</td></tr>`

  const matHead = office
    ? '<tr><th>Materials · source and date</th><th class="n">Cost</th><th class="n">Markup</th><th class="n">Charged</th></tr>'
    : '<tr><th>Materials · source and date</th><th class="n">Charged</th></tr>'
  const matRows = charges.materials.lines
    .map((l) =>
      office
        ? `<tr><td>${esc(l.label)}${l.dateKey ? `<span class="src">${esc(shortDate(l.dateKey))}${l.passedThrough ? ' · passed through at cost' : ''}</span>` : ''}</td><td class="n">${m(l.cost)}</td><td class="n">${m(l.markup)}</td><td class="n">${m(l.charged)}</td></tr>`
        : `<tr><td>${esc(l.label)}${l.dateKey ? `<span class="src">${esc(shortDate(l.dateKey))}</span>` : ''}</td><td class="n">${m(l.charged)}</td></tr>`,
    )
    .join('\n')
  const matTotal = office
    ? `<tr class="tot"><td>Materials · ${charges.materials.totals.lines} lines${charges.materials.markupPct != null ? ` at ${charges.materials.markupPct}% over cost` : ' at cost'}</td><td class="n">${m(charges.materials.totals.cost)}</td><td class="n">${m(charges.materials.totals.markup)}</td><td class="n">${m(charges.materials.totals.charged)}</td></tr>`
    : `<tr class="tot"><td>Materials · ${charges.materials.totals.lines} lines</td><td class="n">${m(charges.materials.totals.charged)}</td></tr>`
  const matEmpty = charges.materials.lines.length === 0 ? `<tr><td colspan="${office ? 4 : 2}"><i>No material line on this job in the period.</i></td></tr>` : ''

  const adjustments = (snapshot.input.adjustments ?? []).map((a) => chargeAdjustmentWords(a, (d) => shortDate(d), (id) => snapshot.input.lines.find((l) => l.id === id)?.label ?? id))
  const officeBox = office
    ? `<div class="gap"><b>Office only · never on the customer copy</b>
    <div class="pay"><b>Price on the bills</b><div>${m(charges.premium.price)}</div>
    <b>${charges.premium.kind === 'premium' ? 'Premium' : charges.premium.kind === 'shortfall' ? 'Shortfall' : 'Even'}</b><div>${charges.premium.kind === 'even' ? 'The price and the charges are even.' : `${m(charges.premium.amount)} · ${esc(charges.premium.sentence)}`}</div>
    <b>Materials</b><div>cost ${m(charges.materials.totals.cost)} · margin ${m(charges.materials.totals.markup)}${charges.materials.markupPct != null ? ` (${Math.round((charges.materials.markupPct / (100 + charges.materials.markupPct)) * 1000) / 10}% of the sale)` : ''}</div>
    <b>Labor behind it</b><div>${h2(charges.totals.personHours)} person-hours across ${charges.totals.days} crew-days; labor cost at wages is on each person’s hours statement</div>
    ${adjustments.length ? `<b>Adjustments</b><div>${adjustments.map(esc).join('<br>')}</div>` : '<b>Adjustments</b><div>none; every line is the record</div>'}
    <p class="note">${esc(PREMIUM_CARRIES)}</p></div>`
    : ''

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(`${w.title} · Job ${snapshot.job.number} · ${w.periodLabel}`)}</title>
<style>
@page { size: letter; margin: 0.5in 0.5in 0.6in; @bottom-left { content: "${esc(stamp).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"; font: 8px Georgia, "Times New Roman", serif; color: #555555; } @bottom-right { content: counter(page) " of " counter(pages); font: 8px Georgia, "Times New Roman", serif; color: #555555; } }
:root { color-scheme: light; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #e5e7eb; color: #111111; font: 12px/1.4 Georgia, "Times New Roman", serif; }
.sheet { width: 100%; max-width: 8.5in; min-height: 11in; padding: 0.5in; margin: 0 auto 16px; background: #ffffff; box-shadow: 0 2px 10px rgba(0,0,0,.12); }
.co { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #111111; padding-bottom: 8px; }
.co b { font-size: 15px; } .co small { display: block; color: #444444; font-size: 11px; line-height: 1.4; }
h1 { margin: 12px 0 6px; font: 700 18px/1.2 Georgia, "Times New Roman", serif; }
h2 { margin: 14px 0 4px; font: 700 12px/1.2 Georgia, "Times New Roman", serif; letter-spacing: .04em; text-transform: uppercase; }
.facts { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; padding: 6px 0 7px; border-top: 1px solid #111111; border-bottom: 1px solid #111111; font-size: 11.5px; margin-bottom: 10px; }
.facts span { color: #555555; } .facts b { color: #111111; }
table { width: 100%; border-collapse: collapse; font-size: 11px; }
th { text-align: left; border-bottom: 1px solid #111111; padding: 3px 5px; font-size: 9.5px; letter-spacing: .05em; text-transform: uppercase; color: #333333; white-space: nowrap; }
td { border-bottom: 1px solid #dddddd; padding: 3px 5px; vertical-align: top; }
td.n, th.n { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
tr.tot td { border-top: 2px solid #111111; border-bottom: 0; font-weight: 700; }
tr { break-inside: avoid; page-break-inside: avoid; }
thead { display: table-header-group; }
.src { display: block; font-size: 10px; color: #555555; }
.c { font-size: 0.78em; opacity: .85; }
.note { margin: 4px 0 0; font-size: 10.5px; color: #555555; }
.totals { margin-top: 12px; border-top: 2px solid #111111; padding-top: 6px; display: grid; grid-template-columns: 1fr auto; gap: 2px 24px; font-size: 12px; break-inside: avoid; }
.totals .big { font-size: 14px; font-weight: 700; padding-top: 3px; }
.gap { border: 1.5px dashed #777777; padding: 8px 10px; margin: 10px 0 0; font-size: 11px; background: #fafafa; break-inside: avoid; page-break-inside: avoid; }
.pay { display: grid; grid-template-columns: max-content 1fr; gap: 2px 12px; font-size: 11px; margin-top: 4px; }
.sig { display: grid; grid-template-columns: 1fr 160px; gap: 32px; margin-top: 22px; font-size: 10.5px; color: #333333; break-inside: avoid; }
.sig div { border-top: 1px solid #111111; padding-top: 3px; }
.foot { margin-top: 18px; font-size: 10px; color: #555555; border-top: 1px solid #cccccc; padding-top: 4px; }
@media print { html, body { background: #ffffff; } .sheet { box-shadow: none; margin: 0; padding: 0; min-height: 0; } .foot { display: none; } }
</style>
</head>
<body>
<div class="sheet">
  <div class="co">
    <div><b>${esc(company.name)}</b><small>${company.ein ? `EIN ${esc(company.ein)} · ` : ''}${esc(company.address)}</small></div>
    <div style="text-align:right"><small>${office ? 'Office copy · ' : ''}Statement ${esc(ctx.recordId ?? 'draft, not yet filed')}</small><small>Prepared ${esc(snapshot.preparedOn)}${office ? ` by ${esc(snapshot.preparedBy)}` : ''}</small><small>From the company’s records as of ${esc(snapshot.asOf)}</small></div>
  </div>
  <h1>${esc(w.title)}</h1>
  <div class="facts">
    <div><span>Job</span> · <b>${esc(snapshot.job.number)} · ${esc(snapshot.job.name)}</b></div>
    <div><span>Customer</span> · <b>${esc(snapshot.job.customer ?? '')}</b></div>
    <div><span>Period</span> · <b>${esc(w.periodLabel)}</b></div>
    <div><span>Site</span> · <b>${esc(snapshot.job.site)}</b></div>
    ${office ? `<div><span>Labor at</span> · <b>${esc(w.laborAt)}</b></div><div><span>Materials at</span> · <b>${esc(w.materialsAt)}</b></div>` : ''}
  </div>
  ${office ? '' : `<p style="margin:0 0 10px;font-size:12px">This statement lists the labor and materials charged into the job for the period, from the company’s time records and its supply-house invoices. Labor is charged by the crew’s hour.</p>`}
  <table>
    <thead><tr><th>Labor · week, who was out, the crew</th><th class="n">Days</th><th class="n">Crew hours</th><th class="n">Rate</th><th class="n">Charged</th></tr></thead>
    <tbody>${laborRows || '<tr><td colspan="5"><i>No approved hours on this job in the period.</i></td></tr>'}${laborTotal}</tbody>
  </table>
  <p class="note">${esc(w.laborNote)}</p>
  <table style="margin-top:12px">
    <thead>${matHead}</thead>
    <tbody>${matRows}${matEmpty}${matTotal}</tbody>
  </table>
  ${w.materialsNote ? `<p class="note">${esc(w.materialsNote)}</p>` : ''}
  <div class="totals">
    <span>Labor charged</span><b style="text-align:right">${m(charges.totals.labor)}</b>
    <span>Materials charged</span><b style="text-align:right">${m(charges.totals.materials)}</b>
    <span class="big">${esc(w.totalLabel)}</span><b class="big" style="text-align:right">${m(charges.totals.charges)}</b>
  </div>
  ${office ? officeBox : `<p class="note" style="margin-top:10px">${esc(w.customerLine)}</p>`}
  <div class="sig"><div>${esc(office ? w.preparedLine : 'Prepared from the company’s records')} · by ${esc(snapshot.preparedBy)}</div><div>Date</div></div>
  <div class="foot">${esc(stamp)}</div>
</div>
</body>
</html>`
}

function addDays(ymd: string, n: number): string {
  const [y, mo, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y!, mo! - 1, d! + n)).toISOString().slice(0, 10)
}

/** `Statement of charges… · 6 people, 11 material lines`, dead with nothing. */
export function statementOfChargesPressWords(people: number | null, lines: number | null): { label: string; dead: boolean } {
  if (people == null || lines == null) return { label: 'Statement of charges…', dead: false }
  const bits = [`${people} ${people === 1 ? 'person' : 'people'}`, `${lines} material ${lines === 1 ? 'line' : 'lines'}`]
  return { label: `Statement of charges… · ${bits.join(', ')}`, dead: people === 0 && lines === 0 }
}
