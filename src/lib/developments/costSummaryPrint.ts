/**
 * The cost summary print (v2.6534): the Scoreboard's figures on paper for a dev or a controller. The
 * owner asked for it on 2026-11-04 after a site's costs had been totted up outside the app. It carries
 * the site's totals, a row per job, who put what in, the parts by bucket, the card charges by payee,
 * the supply invoices, every other charge with the estimates marked, and what the total leaves out.
 * The numbers are the board's own: the model's measures and the cost rows the Costs column totals
 * (`siteCosts.ts`), the clock's people (`siteLabor.ts`), the day ledger's overhead. Pure: `buildCostSummary` makes the data,
 * `costSummaryPrintHtml` the page, `openHtmlPrintWindow` opens it and the print dialog saves the PDF.
 */
import {
  jobCardLineStatus,
  mercuryLinesFromRows,
  supplyLinesFromRows,
  tallyLinesFromRows,
  type JobCardLineStatus,
} from '../../../supabase/functions/_shared/jobMaterialsCostLines'
import { cardChargeCostUsd } from '../../../supabase/functions/_shared/cardChargeAllocationFilter'
import { labelJobsLedgerStatus } from '../jobsLedgerStatusPipeline'
import { scoreboardDays, scoreboardHours, scoreboardPctOf, scoreboardUsd, type ScoreboardFlag, type ScoreboardJob, type ScoreboardMeasures, type ScoreboardModel, type ScoreboardReads, type SiteOverheadRead } from './scoreboard'
import type { SiteCostRows, SiteCostsRead } from './siteCosts'
import type { SiteLaborRead } from './siteLabor'

/** How many payees get a line of their own before the rest fold into one (the long tail of fuel stops and small stores). */
export const COST_SUMMARY_PAYEE_LINES = 25

/** An other charge whose description starts with ESTIMATE is a guess the office wrote, not a bank row (the Costs tab's chip). */
export const COST_SUMMARY_ESTIMATE = /^\s*ESTIMATE\b/i

export type CostSummaryHead = {
  siteName: string
  /** The board's line under the name: the customer, the jobs and the bids counted. */
  line: string
  /** The board's small line: left to collect, the people on it, the overhead rule; null when the board has none. */
  small: string | null
  printedAt: string
  printedBy: string | null
}

export type CostSummaryJobRow = {
  label: string
  name: string
  /** The status in words, with the percent on a working job and the board's flags: *working · 20% · no price*. */
  state: string
  m: ScoreboardMeasures
}

export type CostSummaryPayee = { name: string; rows: number; usd: number }

export type CostSummaryBucket = { rows: number; usd: number }

export type CostSummary = {
  head: CostSummaryHead
  totals: ScoreboardMeasures
  reads: ScoreboardReads
  /** The jobs with money on them, in the board's order. */
  jobs: CostSummaryJobRow[]
  /** How many jobs had nothing on them yet. */
  emptyJobs: number
  /** The clock's people over the whole site, largest labor first. */
  people: Array<{ name: string; hours: number; days: number; usd: number }>
  /** The sub sheets by the names on them, largest first. */
  subs: Array<{ name: string; usd: number; sheets: number }>
  buckets: { supply: CostSummaryBucket; card: CostSummaryBucket; tally: CostSummaryBucket; other: CostSummaryBucket }
  /** The card charges the total counts, by payee, largest first; `rest` folds the tail past COST_SUMMARY_PAYEE_LINES. */
  payees: CostSummaryPayee[]
  rest: { payees: number; rows: number; usd: number } | null
  supply: Array<{ job: string; house: string; number: string; ymd: string; usd: number; paid: boolean }>
  other: Array<{ job: string; ymd: string | null; description: string; usd: number; estimate: boolean }>
  estimates: CostSummaryBucket
  /** The card rows the total leaves out, with their dollars: an internal transfer, a charge also on a supply invoice. */
  leftOut: { internal: CostSummaryBucket; invoiceLinked: CostSummaryBucket }
  /** What the reader should know about the figures: a read that failed, days not known, the overhead rule. */
  notes: string[]
}

export type CostSummaryInput = {
  model: ScoreboardModel
  costs: SiteCostsRead | undefined
  labor: SiteLaborRead | undefined
  overhead: SiteOverheadRead | undefined
  head: CostSummaryHead
  /** A job's label for the lists (the board's chip words). */
  jobLabelOf: (jobId: string) => string
  /** A bank row's or a charge's timestamp to the site's calendar day. */
  toYmd: (iso: string) => string
  /** The day the overhead pool began, for the note; null when the ledger is not in. */
  overheadSince: string | null
}

const FLAG_WORDS: Record<ScoreboardFlag, string> = { 'no-price': 'no price', 'materials-only': 'materials only', 'assumed-50': '≈ 50% assumed', 'no-pct': 'no percent on record' }

/** The row's state in words: the status, the percent on a working job, then the board's flags. */
export function costSummaryStateWords(row: Pick<ScoreboardJob, 'status' | 'pct' | 'flags'>): string {
  const parts: string[] = []
  if (row.status) parts.push(labelJobsLedgerStatus(row.status).toLowerCase())
  if (row.status === 'working' && row.pct != null) parts.push(`${row.pct}%`)
  // *no percent on record* is inside *≈ 50% assumed*, as the board folds it.
  for (const f of row.flags) if (f !== 'no-pct' || !row.flags.includes('assumed-50')) parts.push(FLAG_WORDS[f])
  return parts.join(' · ')
}

/** The counted card charges by payee, largest first, the tail past `lines` folded into `rest`. */
export function costSummaryPayees(lines: ReadonlyArray<{ payee: string | null; usd: number }>, max = COST_SUMMARY_PAYEE_LINES): { payees: CostSummaryPayee[]; rest: CostSummary['rest'] } {
  const by = new Map<string, CostSummaryPayee>()
  for (const l of lines) {
    const name = l.payee?.trim() || 'No payee on the bank row'
    const cur = by.get(name) ?? { name, rows: 0, usd: 0 }
    cur.rows += 1
    cur.usd += l.usd
    by.set(name, cur)
  }
  const all = [...by.values()].sort((a, b) => b.usd - a.usd || a.name.localeCompare(b.name))
  if (all.length <= max) return { payees: all, rest: null }
  const shown = all.slice(0, max - 1)
  const tail = all.slice(max - 1)
  return { payees: shown, rest: { payees: tail.length, rows: tail.reduce((s, p) => s + p.rows, 0), usd: tail.reduce((s, p) => s + p.usd, 0) } }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function buildCostSummary(input: CostSummaryInput): CostSummary {
  const { model } = input
  const rows: SiteCostRows | null = input.costs?.state === 'read' ? (input.costs.rows ?? null) : null
  const costsBy = input.costs?.state === 'read' ? input.costs.byJobId : null
  const jobs: CostSummaryJobRow[] = model.rows.map((r) => ({ label: r.label, name: r.name, state: costSummaryStateWords(r), m: r.m }))

  // The clock's people, summed over the site's jobs.
  const peopleBy = new Map<string, { name: string; hours: number; days: number; usd: number }>()
  if (input.labor?.state === 'read') {
    for (const job of input.labor.labor.byJobId.values()) {
      for (const p of job.people) {
        const key = p.personId ?? p.personName
        const cur = peopleBy.get(key) ?? { name: p.personName, hours: 0, days: 0, usd: 0 }
        cur.hours += p.hours
        cur.days += p.days
        cur.usd += p.costUsd
        peopleBy.set(key, cur)
      }
    }
  }
  const people = [...peopleBy.values()].map((p) => ({ ...p, usd: round2(p.usd) })).sort((a, b) => b.usd - a.usd || b.hours - a.hours)

  // The subs and the buckets from the Costs column's own rows per job.
  const subsBy = new Map<string, { name: string; usd: number; sheets: number }>()
  const buckets = { supply: { rows: 0, usd: 0 }, card: { rows: 0, usd: 0 }, tally: { rows: 0, usd: 0 }, other: { rows: 0, usd: 0 } }
  if (costsBy) {
    for (const row of costsBy.values()) {
      for (const s of row.breakdown.subs) {
        const cur = subsBy.get(s.name) ?? { name: s.name, usd: 0, sheets: 0 }
        cur.usd += s.usd
        cur.sheets += s.sheets
        subsBy.set(s.name, cur)
      }
      buckets.supply.usd += row.parts.supplyInvoices
      buckets.card.usd += row.parts.cardCharges
      buckets.tally.usd += row.parts.tallyParts
      buckets.other.usd += row.parts.otherCharges
    }
  }
  const subs = [...subsBy.values()].map((s) => ({ ...s, usd: round2(s.usd) })).sort((a, b) => b.usd - a.usd)

  // The lines: the card rows under the one card rule, the supply invoices, the tally, the other charges.
  const cardLines: Array<{ payee: string | null; usd: number; status: JobCardLineStatus }> = []
  const supply: CostSummary['supply'] = []
  const other: CostSummary['other'] = []
  const leftOut = { internal: { rows: 0, usd: 0 }, invoiceLinked: { rows: 0, usd: 0 } }
  if (rows) {
    for (const jobId of rows.jobIds) {
      const job = input.jobLabelOf(jobId)
      for (const line of mercuryLinesFromRows(rows.cardAlloc.filter((r) => r.job_id === jobId))) {
        const status = jobCardLineStatus(line, rows.cardExclusions)
        const usd = cardChargeCostUsd(line.allocationAmount)
        cardLines.push({ payee: line.counterpartyName, usd, status })
        if (status === 'internal_transfer') {
          leftOut.internal.rows += 1
          leftOut.internal.usd += usd
        } else if (status === 'invoice_linked') {
          leftOut.invoiceLinked.rows += 1
          leftOut.invoiceLinked.usd += usd
        } else buckets.card.rows += 1
      }
      for (const inv of supplyLinesFromRows((rows.supplyAlloc ?? []).filter((r) => r.job_id === jobId))) {
        supply.push({ job, house: inv.supplyHouseName?.trim() || 'A supply house with no name', number: inv.invoiceNumber, ymd: inv.invoiceDate, usd: round2(inv.allocatedAmount), paid: inv.isPaid })
        buckets.supply.rows += 1
      }
      const tally = tallyLinesFromRows(rows.tally, jobId)
      buckets.tally.rows += tally.length
      for (const m of rows.otherCharges.filter((o) => o.job_id === jobId)) {
        const usd = Number(m.amount) || 0
        if (!usd) continue
        const description = m.description?.trim() || 'An other charge with no words'
        other.push({ job, ymd: m.created_at ? input.toYmd(m.created_at) : null, description, usd: round2(usd), estimate: COST_SUMMARY_ESTIMATE.test(description) })
        buckets.other.rows += 1
      }
    }
  }
  supply.sort((a, b) => a.ymd.localeCompare(b.ymd) || a.house.localeCompare(b.house))
  other.sort((a, b) => (a.ymd ?? '').localeCompare(b.ymd ?? '') || b.usd - a.usd)
  const { payees, rest } = costSummaryPayees(cardLines.filter((l) => l.status === 'counts'))
  const estimates = other.filter((o) => o.estimate).reduce((acc, o) => ({ rows: acc.rows + 1, usd: acc.usd + o.usd }), { rows: 0, usd: 0 })
  for (const b of Object.values(buckets)) b.usd = round2(b.usd)
  leftOut.internal.usd = round2(leftOut.internal.usd)
  leftOut.invoiceLinked.usd = round2(leftOut.invoiceLinked.usd)

  const notes: string[] = []
  if (model.reads.labor === 'failed') notes.push('The clock did not read, so hours, days and labor are not on this page.')
  else if (model.reads.labor === 'reading') notes.push('The clock was still reading when this page was printed, so hours, days and labor are not on it.')
  else if (input.labor?.state === 'read' && !input.labor.labor.daysKnown) notes.push('Days are not known to this reader, so the Days column is left out.')
  if (model.reads.overhead === 'failed') notes.push('The overhead ledger did not read, so overhead is not on this page.')
  else if (model.reads.overhead === 'reading') notes.push('The overhead ledger was still reading when this page was printed, so overhead is not on it.')
  else if (model.reads.overhead === 'read' && input.overheadSince) notes.push(`Overhead is the office day share from the day the pool began, ${input.overheadSince}.`)
  notes.push('Earned follows the percent done: a finished job earns its whole price, a working job its percent’s share, a job with no percent on record half its price.')
  if (estimates.rows) notes.push(`${estimates.rows === 1 ? 'One other charge is an estimate' : `${estimates.rows} other charges are estimates`} the office wrote, not bank rows: ${scoreboardUsd(estimates.usd)} of the parts.`)

  return { head: input.head, totals: model.site, reads: model.reads, jobs, emptyJobs: model.empties.length, people, subs, buckets, payees, rest, supply, other, estimates: { rows: estimates.rows, usd: round2(estimates.usd) }, leftOut, notes }
}

// ---- the page ----------------------------------------------------------------------------------

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** A dollar figure with cents for a line, the board's whole dollars for a total. */
const cents = (n: number): string => `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function cell(key: keyof ScoreboardMeasures, m: ScoreboardMeasures, reads: ScoreboardReads, daysKnown: boolean): string {
  if ((key === 'hours' || key === 'days' || key === 'labor') && reads.labor !== 'read') return '—'
  if (key === 'days' && !daysKnown) return '—'
  if (key === 'overhead' && reads.overhead !== 'read') return '—'
  if (key === 'hours') return scoreboardHours(m.hours)
  if (key === 'days') return scoreboardDays(m.days)
  return scoreboardUsd(m[key])
}

const COLS: Array<{ key: keyof ScoreboardMeasures; label: string }> = [
  { key: 'hours', label: 'Hours' },
  { key: 'days', label: 'Days' },
  { key: 'labor', label: 'Labor' },
  { key: 'subs', label: 'Subs' },
  { key: 'parts', label: 'Parts' },
  { key: 'overhead', label: 'Overhead' },
  { key: 'earned', label: 'Earned' },
  { key: 'cost', label: 'Cost' },
  { key: 'profit', label: 'Profit' },
]

function table(head: string[], rows: string[][], numericFrom = 1): string {
  const th = head.map((h, i) => `<th${i >= numericFrom ? ' class="n"' : ''}>${esc(h)}</th>`).join('')
  const tr = rows.map((r) => `<tr>${r.map((c, i) => `<td${i >= numericFrom ? ' class="n"' : ''}>${c}</td>`).join('')}</tr>`).join('\n')
  return `<table><thead><tr>${th}</tr></thead><tbody>\n${tr}\n</tbody></table>`
}

/**
 * The page: letter portrait, the totals strip, the jobs, who put it in, the parts by bucket and by payee, the
 * supply invoices, the other charges, what is left out, the notes and the stamp. A printed page has no theme,
 * so its colours are literal, as on the other print documents. Pure; `openHtmlPrintWindow` opens it.
 */
export function costSummaryPrintHtml(s: CostSummary): string {
  const daysKnown = !s.notes.some((n) => n.startsWith('Days are not known'))
  const stamp = `Printed ${s.head.printedAt}${s.head.printedBy ? ` by ${s.head.printedBy}` : ''}`
  const margin = s.reads.labor === 'read' && s.reads.overhead !== 'reading' ? scoreboardPctOf(s.totals.profit, s.totals.earned) : '—'
  const tiles = COLS.map((c) => `<div class="tile"><span class="cap">${esc(c.label)}</span><b>${cell(c.key, s.totals, s.reads, daysKnown)}</b>${c.key === 'profit' ? `<span class="sub">${esc(margin)} of earned</span>` : ''}</div>`).join('')
  const jobRows = s.jobs.map((j) => [`<b>${esc(j.label)}</b> ${esc(j.name)}<br><span class="muted">${esc(j.state)}</span>`, ...COLS.map((c) => cell(c.key, j.m, s.reads, daysKnown))])
  const jobsTable = s.jobs.length ? table(['Job', ...COLS.map((c) => c.label)], jobRows) : '<p class="muted">No job with money on it yet.</p>'
  const emptiesLine = s.emptyJobs ? `<p class="muted">${s.emptyJobs === 1 ? '1 job with nothing on it yet is left out.' : `${s.emptyJobs} jobs with nothing on them yet are left out.`}</p>` : ''
  const peopleTable = s.people.length ? table(['Person', 'Hours', 'Days', 'Labor'], s.people.map((p) => [esc(p.name), scoreboardHours(p.hours), daysKnown ? scoreboardDays(p.days) : '—', cents(p.usd)])) : '<p class="muted">No clocked hours on the site.</p>'
  const subsTable = s.subs.length ? table(['Sub', 'Sheets', 'Cost'], s.subs.map((x) => [esc(x.name), String(x.sheets), cents(x.usd)])) : '<p class="muted">No sub sheet on the site.</p>'
  const bucketRows: string[][] = [
    ['Supply-house invoices', String(s.buckets.supply.rows), cents(s.buckets.supply.usd)],
    ['Card charges the total counts', String(s.buckets.card.rows), cents(s.buckets.card.usd)],
    ['Parts from the tally', String(s.buckets.tally.rows), cents(s.buckets.tally.usd)],
    ['Other charges', String(s.buckets.other.rows), cents(s.buckets.other.usd)],
    ['<b>Parts</b>', `<b>${s.buckets.supply.rows + s.buckets.card.rows + s.buckets.tally.rows + s.buckets.other.rows}</b>`, `<b>${cents(s.buckets.supply.usd + s.buckets.card.usd + s.buckets.tally.usd + s.buckets.other.usd)}</b>`],
  ]
  const payeeRows = s.payees.map((p) => [esc(p.name), String(p.rows), cents(p.usd)])
  if (s.rest) payeeRows.push([`<i>Everything else, ${s.rest.payees} payees</i>`, String(s.rest.rows), cents(s.rest.usd)])
  const payeeTable = payeeRows.length ? table(['Payee', 'Rows', 'Dollars'], payeeRows) : '<p class="muted">No card charge counted on the site.</p>'
  const supplyTable = s.supply.length ? table(['Job', 'House', 'Invoice', 'Date', 'Paid', 'Dollars'], s.supply.map((i) => [esc(i.job), esc(i.house), esc(i.number), esc(i.ymd), i.paid ? 'paid' : 'unpaid', cents(i.usd)]), 5) : '<p class="muted">No supply-house invoice on the site.</p>'
  const otherTable = s.other.length ? table(['Job', 'Date', 'Charge', 'Dollars'], s.other.map((o) => [esc(o.job), esc(o.ymd ?? '—'), `${o.estimate ? '<span class="chip">Estimate</span> ' : ''}${esc(o.description)}`, cents(o.usd)]), 3) : '<p class="muted">No other charge on the site.</p>'
  const leftOut = [
    s.leftOut.internal.rows ? `${s.leftOut.internal.rows} internal ${s.leftOut.internal.rows === 1 ? 'transfer' : 'transfers'}, ${cents(s.leftOut.internal.usd)}, not a job cost` : null,
    s.leftOut.invoiceLinked.rows ? `${s.leftOut.invoiceLinked.rows} card ${s.leftOut.invoiceLinked.rows === 1 ? 'charge' : 'charges'} also on a supply-house invoice, ${cents(s.leftOut.invoiceLinked.usd)}, counted there` : null,
  ].filter((x): x is string => x != null)
  const leftOutWords = leftOut.length ? `The card total leaves out ${leftOut.join('; and ')}.` : 'Every card row on the site counts toward the total.'
  return `<!doctype html>
<html lang="en" data-theme="light"><head><meta charset="utf-8"><title>${esc(s.head.siteName)} · cost summary</title>
<style>
@page { size: letter portrait; margin: 14mm 12mm; }
body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; color: #111827; margin: 0; padding: 12px 16px; background: #ffffff; font-size: 10.5px; line-height: 1.35; }
h1 { font-size: 18px; margin: 0 0 2px; }
h2 { font-size: 12.5px; margin: 16px 0 5px; page-break-after: avoid; border-bottom: 1px solid #d1d5db; padding-bottom: 2px; }
.line { font-size: 11px; color: #4b5563; margin: 0 0 2px; }
.muted { color: #6b7280; margin: 2px 0; }
.tiles { display: grid; grid-template-columns: repeat(9, minmax(0, 1fr)); gap: 4px; margin: 8px 0 2px; }
.tile { border: 1px solid #d1d5db; border-radius: 5px; padding: 4px 5px; text-align: center; }
.tile .cap { display: block; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; }
.tile b { display: block; font-size: 11.5px; font-variant-numeric: tabular-nums; }
.tile .sub { display: block; font-size: 8.5px; color: #6b7280; }
table { width: 100%; border-collapse: collapse; margin: 2px 0 4px; }
th, td { padding: 2px 5px; border-bottom: 1px solid #e5e7eb; text-align: left; vertical-align: top; }
th { font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; color: #4b5563; }
td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
tr { page-break-inside: avoid; }
.chip { display: inline-block; border: 1px solid #d1d5db; border-radius: 9999px; padding: 0 5px; font-size: 8.5px; color: #4b5563; }
.notes { margin: 6px 0 0; padding-left: 16px; }
.stamp { font-size: 9.5px; color: #6b7280; margin-top: 10px; }
</style></head><body>
<h1>${esc(s.head.siteName)} · cost summary</h1>
<p class="line">${esc(s.head.line)}</p>
${s.head.small ? `<p class="line">${esc(s.head.small)}</p>` : ''}
<div class="tiles">${tiles}</div>
<h2>The jobs</h2>
${jobsTable}
${emptiesLine}
<h2>Who put it in</h2>
${peopleTable}
${subsTable}
<h2>Parts by bucket</h2>
${table(['Bucket', 'Rows', 'Dollars'], bucketRows)}
<h2>Card charges by payee</h2>
${payeeTable}
<h2>Supply-house invoices</h2>
${supplyTable}
<h2>Other charges</h2>
${otherTable}
<h2>What the total leaves out</h2>
<p>${esc(leftOutWords)}</p>
<h2>Notes</h2>
<ul class="notes">${s.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
<p class="stamp">${esc(stamp)}</p>
</body></html>`
}
