import type { JobBurnCumulativeRow, JobBurnDay, JobBurnModel } from '../jobs/jobBurn'
import { formatWorkDateYmdFriendly } from '../../utils/dateUtils'
import { baselineReadWords, timeLeftWords, type CostsVerdict } from '../jobs/jobCostsVerdict'
import type { MoneyRow } from '../jobs/jobMoneyTable'
import type { JobChargeEvent, JobPaymentEvent, JobValueEvent } from '../jobChargesTimeline'

/**
 * The job window's Costs tab on paper (punch list #143, v2.5749): four Letter pages built from
 * the numbers the tab already holds — the verdict, the burn model, the money rows and the lines
 * behind them — opened by **Print** on the tab through `openHtmlPrintWindow`. Pure: every figure
 * is the tab's own; this file only lays them out. Page 1 is the job at a glance (the identity
 * block, the printed stamp, the margin band, the three tiles, the chart, how the margin builds by
 * section); page 2 the baseline and where the money went, with the people, the sub sheets and the
 * supply house invoices behind it; page 3 the card charges by cost line, the pace and a notes box;
 * page 4 one row per day. The running footer is CSS (`@page` margin boxes).
 */

export type JobCostsPacketCardLine = {
  /** YYYY-MM-DD or null. */
  postedYmd: string | null
  /** The card's nickname, else its last digits; null when the line names no card. */
  card: string | null
  counterparty: string | null
  amount: number
  /** The cost-line tag the charge sits in (⛽ Fuel & gas), when it has one. */
  tag: { icon: string; name: string } | null
  /** Whether the one card rule counts the line; an excluded line is listed with its reason. */
  status: 'counts' | 'internal_transfer' | 'invoice_linked'
}

export type JobCostsPacketInput = {
  company: string
  job: {
    /** The window's pill: "891 PLUM". */
    numberLabel: string
    name: string
    address: string
    customer: string | null
    gc: string | null
    statusWords: string | null
    openedYmd: string | null
    lastWorkYmd: string | null
  }
  /** Words, already in the company's time zone: "Oct 22, 2026, 4:05 PM". */
  printedAt: string
  printedBy: string | null
  todayYmd: string
  verdict: CostsVerdict
  burn: JobBurnModel
  /** The tab's first line after the price: "30% done (set on the job) · by Taunya on Oct 7". */
  pctLine: string
  /** "Baseline kept Sep 12 on billing · per $1k", or '' when none is kept. */
  baselineKeptWords: string
  money: MoneyRow[]
  chargeEvents: readonly JobChargeEvent[]
  valueEvents: readonly JobValueEvent[]
  paymentEvents: readonly JobPaymentEvent[]
  supply: ReadonlyArray<{ supplyHouseName: string | null; invoiceNumber: string; invoiceDate: string; allocatedAmount: number }>
  cards: readonly JobCostsPacketCardLine[]
  tally: ReadonlyArray<{ fixtureName: string; partName: string | null; quantity: number; lineTotal: number }>
  other: ReadonlyArray<{ description: string; amount: number; chargedOn?: string | null; memo?: string | null }>
  paidToDateUsd: number
  /** Drawn as a dashed line on the chart when a bid or typed figure stands for the whole job. */
  bidFigure: { usd: number; label: string } | null
}

const esc = (s: unknown): string => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const usd0 = (n: number): string => (n < 0 ? `−$${Math.round(-n).toLocaleString('en-US')}` : `$${Math.round(n).toLocaleString('en-US')}`)
const usd2 = (n: number): string => (n < 0 ? `−$${(-n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const pct0 = (n: number | null): string => (n == null ? '' : `${Math.round(n)}%`)
const pctTail = (n: number | null): string => (n == null ? '' : ` · ${Math.round(n)}%`)
const h0 = (n: number): string => `${Math.round(n).toLocaleString('en-US')} h`
const h1 = (n: number): string => `${(Math.round(n * 10) / 10).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`
const d1 = (n: number): string => (Math.round(n * 10) / 10).toLocaleString('en-US')
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
/** The chart's two line colours, the packet's own red and blue. A printed page has no theme, so its colours are literal, as on the other print documents. */
const PACKET_COST_RED = '#dc2626'
const PACKET_EARNED_BLUE = '#2563eb'
const isYmd = (s: string | null | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}/.test(s)
/** "Oct 7" from a YYYY-MM-DD; the raw string when it is not one. */
export const jobCostsPacketDayLabel = (ymd: string): string => (isYmd(ymd) ? `${MONTHS[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8, 10))}` : ymd)
const dayLabelYear = (ymd: string): string => (isYmd(ymd) ? `${jobCostsPacketDayLabel(ymd)}, ${ymd.slice(0, 4)}` : ymd)
const weekday = (ymd: string): string => (isYmd(ymd) ? WEEKDAYS[new Date(`${ymd.slice(0, 10)}T12:00:00Z`).getUTCDay()]! : '')

/** Team labor by person, from the tab's own events: the people with the most cost first. */
export function jobCostsPacketTeamByPerson(events: readonly JobChargeEvent[]): Array<{ name: string; days: number; hours: number; cost: number }> {
  const byName = new Map<string, { name: string; days: Set<string>; hours: number; cost: number }>()
  for (const e of events) {
    if (e.source !== 'team_labor') continue
    const name = e.who ?? e.label.replace(/ — team labor.*$/, '')
    const row = byName.get(name) ?? { name, days: new Set<string>(), hours: 0, cost: 0 }
    if (e.dateKey) row.days.add(e.dateKey)
    row.hours += e.hours ?? 0
    row.cost += Number(e.amount) || 0
    byName.set(name, row)
  }
  return [...byName.values()].map((r) => ({ name: r.name, days: r.days.size, hours: r.hours, cost: r.cost })).sort((a, b) => b.cost - a.cost)
}

/** The sub labor sheets, one per event, oldest first. */
export function jobCostsPacketSubSheets(events: readonly JobChargeEvent[]): Array<{ name: string; dateKey: string | null; amount: number }> {
  return events
    .filter((e) => e.source === 'sub_labor')
    .map((e) => ({ name: e.who ?? e.label.replace(/ — sub labor$/, ''), dateKey: e.dateKey, amount: Number(e.amount) || 0 }))
    .sort((a, b) => (a.dateKey ?? '9999').localeCompare(b.dateKey ?? '9999'))
}

export type JobCostsPacketDayRow = {
  /** YYYY-MM-DD, or null for the charges with no date. */
  ymd: string | null
  team: number
  teamHours: number
  sub: number
  supply: number
  fuel: number
  card: number
  parts: number
  total: number
  /** Cost to date at the end of this day. */
  running: number
  /** The day's payments and % done events, as words. */
  notes: string[]
}

/** One row per dated day with a cost, a payment or a % done; the undated charges last, as one row. */
export function jobCostsPacketByDay(chargeEvents: readonly JobChargeEvent[], valueEvents: readonly JobValueEvent[], paymentEvents: readonly JobPaymentEvent[]): JobCostsPacketDayRow[] {
  const days = new Map<string, JobCostsPacketDayRow>()
  const rowFor = (ymd: string): JobCostsPacketDayRow => {
    const r = days.get(ymd) ?? { ymd, team: 0, teamHours: 0, sub: 0, supply: 0, fuel: 0, card: 0, parts: 0, total: 0, running: 0, notes: [] }
    days.set(ymd, r)
    return r
  }
  const undated: JobCostsPacketDayRow = { ymd: null, team: 0, teamHours: 0, sub: 0, supply: 0, fuel: 0, card: 0, parts: 0, total: 0, running: 0, notes: [] }
  for (const e of chargeEvents) {
    const r = e.dateKey ? rowFor(e.dateKey.slice(0, 10)) : undated
    const amt = Number(e.amount) || 0
    if (e.source === 'team_labor') {
      r.team += amt
      r.teamHours += e.hours ?? 0
    } else if (e.source === 'sub_labor') r.sub += amt
    else if (e.source === 'supply_house') r.supply += amt
    else if (e.source === 'fuel') r.fuel += amt
    else if (e.source === 'mercury_card') r.card += amt
    else r.parts += amt
    r.total += amt
  }
  for (const p of paymentEvents) {
    if (!p.dateKey) continue
    rowFor(p.dateKey.slice(0, 10)).notes.push(`+${usd2(Number(p.amount) || 0)} ${p.label}`)
  }
  for (const v of valueEvents) {
    if (!v.dateKey || v.percent == null) continue
    rowFor(v.dateKey.slice(0, 10)).notes.push(`${Math.round(v.percent)}% done · ${v.label}`)
  }
  const rows = [...days.values()].sort((a, b) => a.ymd!.localeCompare(b.ymd!))
  let running = 0
  for (const r of rows) {
    running += r.total
    r.running = running
  }
  if (undated.total !== 0) {
    running += undated.total
    undated.running = running
    rows.push(undated)
  }
  return rows
}

/** The "Cost against value earned" chart as inline SVG, from the burn model's cumulative rows. */
export function jobCostsPacketChartSvg(rows: readonly JobBurnCumulativeRow[], priceUsd: number | null, todayYmd: string, bidFigure: { usd: number; label: string } | null = null): string {
  if (rows.length === 0) return ''
  const W = 680
  const H = 230
  const padL = 46
  const padR = 14
  const padT = 18
  const padB = 24
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const t = (ymd: string): number => Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)))
  const t0 = t(rows[0]!.ymd)
  const t1 = Math.max(t(rows[rows.length - 1]!.ymd), t(todayYmd))
  const span = Math.max(1, t1 - t0)
  const maxV = Math.max(priceUsd ?? 0, bidFigure?.usd ?? 0, ...rows.map((r) => Math.max(r.actual ?? 0, r.earned ?? 0, r.forecast ?? 0)), 1) * 1.08
  const x = (ymd: string): number => padL + ((t(ymd) - t0) / span) * innerW
  const y = (v: number): number => padT + innerH - (v / maxV) * innerH
  const step = maxV > 400_000 ? 100_000 : maxV > 150_000 ? 50_000 : maxV > 60_000 ? 20_000 : maxV > 30_000 ? 15_000 : maxV > 12_000 ? 10_000 : maxV > 4_000 ? 2_000 : 500
  const ticks: number[] = []
  for (let v = 0; v <= maxV; v += step) ticks.push(v)
  const kFmt = (v: number): string => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)
  const xt: string[] = []
  const d0 = new Date(t0)
  let cur = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), 1)
  let guard = 0
  const spanDays = span / 86_400_000
  const tickDays = spanDays > 400 ? [1] : [1, 15]
  while (cur <= t1 && guard < 240) {
    const dd = new Date(cur)
    for (const day of tickDays) {
      const tt = Date.UTC(dd.getUTCFullYear(), dd.getUTCMonth(), day)
      if (tt >= t0 && tt <= t1) xt.push(`${dd.getUTCFullYear()}-${String(dd.getUTCMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
    }
    cur = Date.UTC(dd.getUTCFullYear(), dd.getUTCMonth() + 1, 1)
    guard += 1
  }
  const line = (key: 'actual' | 'earned' | 'forecast', stepAfter: boolean): string => {
    let d = ''
    let prev: string | null = null
    for (const r of rows) {
      const v = r[key]
      if (v == null) continue
      const px = x(r.ymd).toFixed(1)
      const py = y(v).toFixed(1)
      if (!d) d = `M${px} ${py}`
      else if (stepAfter && prev) d += ` L${px} ${prev} L${px} ${py}`
      else d += ` L${px} ${py}`
      prev = py
    }
    return d
  }
  const actualD = line('actual', false)
  const earnedD = line('earned', true)
  const forecastD = line('forecast', false)
  const forecastCount = rows.filter((r) => r.forecast != null).length
  const last = [...rows].reverse().find((r) => r.actual != null)
  const lastEarned = [...rows].reverse().find((r) => r.earned != null)
  const g: string[] = []
  g.push(`<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Cost to date against value earned" style="display:block;font:9.5px system-ui,sans-serif" data-testid="packet-chart">`)
  for (const v of ticks) g.push(`<line x1="${padL}" x2="${W - padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#e5e7eb" stroke-dasharray="2 3"/><text x="${padL - 6}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end" fill="#6b7280">${kFmt(v)}</text>`)
  for (const ymd of xt) g.push(`<text x="${x(ymd).toFixed(1)}" y="${H - 8}" text-anchor="middle" fill="#6b7280">${jobCostsPacketDayLabel(ymd)}</text>`)
  g.push(`<line x1="${padL}" x2="${W - padR}" y1="${(padT + innerH).toFixed(1)}" y2="${(padT + innerH).toFixed(1)}" stroke="#d1d5db"/>`)
  if (priceUsd != null && priceUsd > 0) g.push(`<line x1="${padL}" x2="${W - padR}" y1="${y(priceUsd).toFixed(1)}" y2="${y(priceUsd).toFixed(1)}" stroke="#6b7280" stroke-dasharray="2 6"/><text x="${padL + 4}" y="${(y(priceUsd) - 4).toFixed(1)}" fill="#6b7280">price ${usd0(priceUsd)}</text>`)
  if (bidFigure) g.push(`<line x1="${padL}" x2="${W - padR}" y1="${y(bidFigure.usd).toFixed(1)}" y2="${y(bidFigure.usd).toFixed(1)}" stroke="#6b7280" stroke-dasharray="6 4" data-testid="packet-chart-bid"/><text x="${W - padR - 4}" y="${(y(bidFigure.usd) - 4).toFixed(1)}" text-anchor="end" fill="#6b7280">${esc(bidFigure.label)} ${usd0(bidFigure.usd)}</text>`)
  if (t(todayYmd) >= t0) g.push(`<line x1="${x(todayYmd).toFixed(1)}" x2="${x(todayYmd).toFixed(1)}" y1="${padT}" y2="${(padT + innerH).toFixed(1)}" stroke="#d1d5db"/><text x="${(x(todayYmd) - 3).toFixed(1)}" y="${padT + 8}" text-anchor="end" fill="#6b7280">today</text>`)
  if (earnedD) g.push(`<path d="${earnedD}" fill="none" stroke="#2563eb" stroke-width="2.2" data-testid="packet-chart-earned"/>`)
  if (actualD) g.push(`<path d="${actualD}" fill="none" stroke="#dc2626" stroke-width="2.2" data-testid="packet-chart-cost"/>`)
  if (forecastCount > 1) g.push(`<path d="${forecastD}" fill="none" stroke="#dc2626" stroke-width="1.8" stroke-dasharray="2 4" data-testid="packet-chart-forecast"/>`)
  if (last?.actual != null) g.push(`<circle cx="${x(last.ymd).toFixed(1)}" cy="${y(last.actual).toFixed(1)}" r="3" fill="#dc2626"/>`)
  // The two end labels: the higher line's label sits above its end, the lower one's below, so they never collide.
  const labels: Array<{ v: number; color: string; text: string; x: number }> = []
  if (last?.actual != null) labels.push({ v: last.actual, color: PACKET_COST_RED, text: `cost to date ${usd0(last.actual)}`, x: x(last.ymd) })
  if (lastEarned?.earned != null) labels.push({ v: lastEarned.earned, color: PACKET_EARNED_BLUE, text: `value earned ${usd0(lastEarned.earned)}`, x: x(lastEarned.ymd) })
  labels.sort((a, b) => b.v - a.v)
  labels.forEach((l, i) => g.push(`<text x="${(l.x - 6).toFixed(1)}" y="${(y(l.v) + (i === 0 ? -6 : 12)).toFixed(1)}" text-anchor="end" fill="${l.color}" font-weight="600">${l.text}</text>`))
  g.push('</svg>')
  return g.join('')
}

/** The last 14 working days as stacked bars (team · subs · parts) with the 7-day average, as inline SVG. */
export function jobCostsPacketDailySvg(days: readonly JobBurnDay[]): string {
  if (days.length === 0 || !days.some((d) => d.total > 0)) return ''
  const W = 680
  const H = 150
  const padL = 40
  const padR = 10
  const padT = 10
  const padB = 22
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const maxV = Math.max(...days.map((d) => Math.max(d.total, d.avg7)), 1) * 1.1
  const slot = innerW / days.length
  const barW = Math.max(4, slot * 0.6)
  const y = (v: number): number => padT + innerH - (v / maxV) * innerH
  const g: string[] = [`<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Daily spend, last 14 working days" style="display:block;font:9px system-ui,sans-serif" data-testid="packet-daily">`]
  const step = maxV > 4000 ? 2000 : maxV > 1500 ? 500 : maxV > 400 ? 200 : 100
  for (let v = 0; v <= maxV; v += step) g.push(`<line x1="${padL}" x2="${W - padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#e5e7eb" stroke-dasharray="2 3"/><text x="${padL - 5}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end" fill="#6b7280">${v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`}</text>`)
  days.forEach((d, i) => {
    const cx = padL + slot * i + slot / 2
    const x0 = (cx - barW / 2).toFixed(1)
    let top = 0
    for (const [key, color] of [['team', '#dc2626'], ['sub', '#a855f7'], ['parts', '#f59e0b']] as const) {
      const v = d[key]
      if (v <= 0) continue
      g.push(`<rect x="${x0}" y="${y(top + v).toFixed(1)}" width="${barW.toFixed(1)}" height="${(y(top) - y(top + v)).toFixed(1)}" fill="${color}"/>`)
      top += v
    }
    if (i % 2 === 0) g.push(`<text x="${cx.toFixed(1)}" y="${H - 8}" text-anchor="middle" fill="#6b7280">${jobCostsPacketDayLabel(d.ymd)}</text>`)
  })
  const avg = days.map((d, i) => `${i === 0 ? 'M' : 'L'}${(padL + slot * i + slot / 2).toFixed(1)} ${y(d.avg7).toFixed(1)}`).join(' ')
  g.push(`<path d="${avg}" fill="none" stroke="#6b7280" stroke-width="2"/>`)
  g.push('</svg>')
  return g.join('')
}

function statusNote(s: JobCostsPacketCardLine['status']): string {
  if (s === 'internal_transfer') return 'not a job cost, an Internal Transfer'
  if (s === 'invoice_linked') return 'counted under its supply house invoice'
  return ''
}

export function buildJobCostsPacketHtml(input: JobCostsPacketInput): string {
  const { verdict: v, burn: m, job } = input
  const margin = v.trueMargin ?? v.directMargin
  const marginIsTrue = v.trueMargin != null
  const good = margin != null && margin.usd >= 0
  const tone = margin == null ? 'quiet' : good ? 'good' : 'bad'
  const title = [job.numberLabel, job.name].filter(Boolean).join(' · ')
  const stamp = `${input.company} · ${title} · printed ${input.printedAt}${input.printedBy ? ` by ${input.printedBy}` : ''}`
  const pageHead = (n: number, what: string): string => `<header class="head slim"><div><b>${esc(title)}</b> <span class="muted">· ${esc(job.address)}</span></div><div class="muted">Page ${n} of 4 · ${what}</div></header>`
  const pageFoot = (n: number): string => `<footer class="foot"><span>${esc(stamp)}</span><span>Page ${n} of 4</span></footer>`
  const tl = timeLeftWords(v.timeLeft, usd0)
  const daysLeft = v.timeLeft.workLeftFieldDays

  // ---- page 1: at a glance ----
  let heroBig: string
  let heroWords: string
  if (margin) {
    heroBig = `${usd0(margin.usd)}${pctTail(margin.pct)}`
    const eac = v.eacUsd != null ? usd0(v.eacUsd) : '—'
    heroWords = marginIsTrue && v.overheadProjectedUsd != null
      ? `At today's pace the job costs ${eac} direct plus ${usd0(v.overheadToDateUsd + v.overheadProjectedUsd)} of overhead.${v.directMargin ? ` The direct margin alone is ${usd0(v.directMargin.usd)}, which is ${pct0(v.directMargin.pct)} of the price.` : ''}`
      : `At today's pace the job costs ${eac} direct. The overhead share is not in yet.`
  } else {
    heroBig = v.timeLeft.early ? 'too early' : '—'
    heroWords = v.timeLeft.early ? 'The projection needs three field days and 10% done.' : 'The projection needs a price and a % done.'
  }
  if (v.priced) heroWords += ` The bid was priced at ${v.priced.pctWords} direct.${v.priced.vsWords ? ` This job runs ${v.priced.vsWords}.` : ''}`
  const identity = [job.customer, job.gc ? `GC ${job.gc}` : null, job.statusWords, job.openedYmd ? `opened ${dayLabelYear(job.openedYmd)}` : null, job.lastWorkYmd ? `last field day ${dayLabelYear(job.lastWorkYmd)}` : null].filter(Boolean).map(esc).join(' · ')
  const sectionRows = v.sections
    .map((s) => {
      const bid = s.budgetHours != null ? `${h0(s.budgetHours)}${s.budgetUsd != null ? ` · ${usd0(s.budgetUsd)}` : ''}` : s.budgetUsd != null ? usd0(s.budgetUsd) : s.budgetWords
      const read = [
        s.key === 'labor' && v.baseline.avgWageUsd != null ? `$${v.baseline.avgWageUsd.toFixed(2)}/h${v.baseline.hoursPerThousand != null ? ` · ${v.baseline.hoursPerThousand.toFixed(1)} h per $1k so far` : ''}` : '',
        s.key === 'materials' && v.baseline.materialsPctOfPrice != null ? `${pct0(v.baseline.materialsPctOfPrice)} of the price` : '',
        s.pctOfBudget != null ? `${pct0(s.pctOfBudget)} of the bid figure${s.aheadPts != null ? (s.aheadPts > 5 ? ' · ahead of the work' : s.aheadPts < -5 ? ' · behind the work' : ' · with the work') : ''}` : '',
      ]
        .filter(Boolean)
        .join(' · ')
      return `<tr><td><b>${esc(s.label)}</b> <span class="muted">${s.hours != null ? `${h0(s.hours)} · ` : ''}${esc(s.sub)}</span></td><td class="num">${usd0(s.spentUsd)}</td><td class="num">${s.atCompletionUsd != null ? usd0(s.atCompletionUsd) : '—'}</td><td class="num muted">${esc(bid)}</td><td class="muted">${esc(read)}</td></tr>`
    })
    .join('')
  const marginRowSoFar = v.trueMarginSoFar && marginIsTrue ? `${usd0(v.trueMarginSoFar.usd)}${pctTail(v.trueMarginSoFar.pct)} so far` : v.earned ? `${usd0(v.earned.aheadUsd)} so far` : ''
  const sectionTable = `<table class="sections" data-testid="packet-sections">
<thead><tr><th>Section</th><th class="num">Spent so far</th><th class="num">At completion</th><th class="num">Bid figure</th><th>Read</th></tr></thead>
<tbody>
${sectionRows}
<tr class="band"><td>Direct cost</td><td class="num">${usd0(v.spent.usd)}</td><td class="num">${v.eacUsd != null ? usd0(v.eacUsd) : '—'}</td><td class="num muted">${v.assumedDirectUsd != null && v.targetMarginPct != null ? `≈ ${usd0(v.assumedDirectUsd)} assumed, ${100 - v.targetMarginPct}% of price` : ''}</td><td class="muted">${v.eacUsd != null && v.pctDone != null ? `spent ÷ ${pct0(v.pctDone)} done` : ''}</td></tr>
<tr><td><b>Overhead share</b></td><td class="num">${usd0(v.overheadToDateUsd)}</td><td class="num">${v.overheadProjectedUsd != null ? usd0(v.overheadToDateUsd + v.overheadProjectedUsd) : '—'}</td><td class="num muted">—</td><td class="muted">${v.overheadProjectedUsd != null && daysLeft != null && daysLeft > 0 ? `${usd0(v.overheadProjectedUsd / daysLeft)} a field day × ${Math.round(daysLeft)} days left` : ''}</td></tr>
<tr class="band"><td>True cost</td><td class="num">${usd0(v.spent.usd + v.overheadToDateUsd)}</td><td class="num">${v.eacUsd != null && v.overheadProjectedUsd != null ? usd0(v.eacUsd + v.overheadToDateUsd + v.overheadProjectedUsd) : '—'}</td><td></td><td></td></tr>
<tr><td><b>Price</b></td><td class="num"></td><td class="num">${v.priceUsd != null ? usd0(v.priceUsd) : '—'}</td><td class="num muted">${esc(v.budgetLabel)}</td><td></td></tr>
<tr class="${tone} strong"><td>${marginIsTrue ? 'True margin' : 'Direct margin'}</td><td class="num">${esc(marginRowSoFar)}</td><td class="num">${margin ? `${usd0(margin.usd)}${pctTail(margin.pct)}` : '—'}</td><td class="num muted">${v.targetMarginPct != null ? `${v.targetMarginPct}% target` : ''}</td><td class="muted">${marginIsTrue && v.directMargin ? `direct margin ${usd0(v.directMargin.usd)}${pctTail(v.directMargin.pct)}` : ''}</td></tr>
</tbody></table>`

  const page1 = `<section class="sheet" data-testid="packet-page-1">
<header class="head">
  <div class="who">
    <div class="co">${esc(input.company)}</div>
    <h1>${esc(job.name)}</h1>
    <div class="idline"><span class="chip">${esc(job.numberLabel)}</span> ${esc(job.address)}</div>
    <div class="idline muted">${identity}</div>
  </div>
  <div class="stamp">
    <div class="kicker">Job costs</div>
    <div>Printed ${esc(input.printedAt)}</div>
    ${input.printedBy ? `<div>by ${esc(input.printedBy)}</div>` : ''}
    <div class="muted">Page 1 of 4 · at a glance</div>
  </div>
</header>

<div class="pctline">${v.priceUsd != null ? `<b>${usd0(v.priceUsd)}</b> price · ` : ''}<b>${esc(input.pctLine)}</b></div>

<div class="hero ${tone}" data-testid="packet-hero">
  <div class="lab">${marginIsTrue ? 'True margin at completion' : 'Direct margin at completion'}</div>
  <div class="big">${esc(heroBig)}</div>
  <div class="sub" data-words>${esc(heroWords)}</div>
</div>

<div class="tiles">
  <div class="tile"><div class="lab">Spent so far</div><div class="big">${usd0(v.spent.usd)}</div><div class="sub">${v.spent.pctOfPrice != null ? `${pct0(v.spent.pctOfPrice)} of the price · ` : ''}${h0(v.spent.teamHours)} team · ${usd0(v.spent.materialsUsd)} materials</div></div>
  <div class="tile"><div class="lab">Earned so far</div><div class="big">${v.earned ? usd0(v.earned.usd) : '—'}</div><div class="sub">${v.earned && v.pctDone != null && v.priceUsd != null ? `${pct0(v.pctDone)} of ${usd0(v.priceUsd)} · ${v.earned.aheadUsd >= 0 ? `${usd0(v.earned.aheadUsd)} ahead on direct` : `${usd0(-v.earned.aheadUsd)} behind on direct`}` : v.priceUsd == null ? 'no price on the job' : 'needs a % complete'}</div></div>
  <div class="tile"><div class="lab">Time left</div><div class="big">${esc(tl.big)}</div><div class="sub">${esc(tl.sub)}</div></div>
</div>

<div class="chartbox">
  <div class="ttl">Cost against value earned <span class="muted" data-words>Value earned is % done × price. It steps on each report. The dashed red line is the forecast at today's pace.</span></div>
  ${jobCostsPacketChartSvg(m.cumulative, v.priceUsd, input.todayYmd, input.bidFigure) || '<p class="muted small">No dated spend yet.</p>'}
  <div class="legend"><span><i class="sw red"></i>cost to date</span><span><i class="sw blue"></i>value earned</span><span><i class="sw red dashed"></i>forecast at today's pace</span><span><i class="sw gray dashed"></i>price</span>${input.bidFigure ? `<span><i class="sw gray dashed"></i>${esc(input.bidFigure.label)}</span>` : ''}</div>
</div>

<h2>How the margin builds, by section <span class="muted">at today's pace</span></h2>
<p class="muted small" data-words>True margin is the price, less the direct cost at completion, less the job's overhead share. Bid figures: ${esc(v.budgetLabel)}.</p>
${sectionTable}
${pageFoot(1)}
</section>`

  // ---- page 2: the baseline and where the money went ----
  const b = v.baseline
  const baseline = b.kind === 'bid'
    ? `<div class="strip bid" data-testid="packet-baseline"><b>◆ Baseline from ${esc(b.bidLabel ?? 'the bid')} · ${h0(b.bidHours ?? 0)} predicted</b><div>${esc(baselineReadWords(b, v.pctDone))}</div>${input.baselineKeptWords ? `<div class="muted">${esc(input.baselineKeptWords)}</div>` : ''}</div>`
    : `<div class="strip none" data-testid="packet-baseline"><b>No baseline for this job yet. ${b.bidLabel ? `Bid ${esc(b.bidLabel)} was sent without hours.` : 'No bid is linked.'}</b>
<div>What it has taken so far is the baseline:</div>
<div class="facts"><span><b>${h0(b.teamHours)}</b> team</span>${b.hoursPerThousand != null ? `<span><b>${b.hoursPerThousand.toFixed(1)} h</b> per $1k of price</span>` : ''}${b.avgWageUsd != null ? `<span><b>$${b.avgWageUsd.toFixed(2)}/h</b> average wage</span>` : ''}${b.people != null ? `<span><b>${b.people}</b> ${b.people === 1 ? 'person' : 'people'}</span>` : ''}<span><b>${usd0(b.materialsUsd)}</b> materials${b.materialsPctOfPrice != null ? ` · ${pct0(b.materialsPctOfPrice)} of price` : ''}</span></div>
${input.baselineKeptWords ? `<div class="muted">${esc(input.baselineKeptWords)}</div>` : ''}</div>`

  const moneyBody = input.money
    .filter((r) => r.key !== 'total')
    .map((r) => {
      const cost = r.state === 'loading' ? 'Loading…' : r.state === 'failed' ? "Couldn't load" : usd2(r.usd)
      return `<tr data-testid="packet-money-${esc(r.key)}"><td>${esc(r.label)} <span class="muted">${esc(r.sub)}</span></td><td class="num">${r.hours != null ? h0(r.hours) : '—'}</td><td class="num">${cost}</td><td class="num">${r.sharePct != null ? `<i class="bar" style="width:${Math.max(2, Math.round(r.sharePct))}px"></i>${pct0(r.sharePct)}` : '—'}</td></tr>`
    })
    .join('')
  const total = input.money.find((r) => r.key === 'total')
  const moneyTable = `<table class="money" data-testid="packet-money">
<thead><tr><th>Where the money went</th><th class="num">Hours</th><th class="num">Cost</th><th class="num">Share</th></tr></thead>
<tbody>${moneyBody}
${total ? `<tr class="band strong"><td>${esc(total.label)}${total.sub ? ` <span class="muted">${esc(total.sub)}</span>` : ''}</td><td class="num">${total.hours != null ? h0(total.hours) : '—'}</td><td class="num">${usd2(total.usd)}</td><td class="num">100%</td></tr>` : ''}</tbody></table>`

  const team = jobCostsPacketTeamByPerson(input.chargeEvents)
  const teamTable = team.length
    ? `<table data-testid="packet-team"><thead><tr><th>Team labor, by person</th><th class="num">Field days</th><th class="num">Hours</th><th class="num">Cost</th></tr></thead><tbody>${team.map((p) => `<tr><td>${esc(p.name)}</td><td class="num">${p.days}</td><td class="num">${h1(p.hours)}</td><td class="num">${usd2(p.cost)}</td></tr>`).join('')}<tr class="band strong"><td>${team.length} ${team.length === 1 ? 'person' : 'people'}</td><td class="num">${m.fieldDays}</td><td class="num">${h1(team.reduce((s, p) => s + p.hours, 0))}</td><td class="num">${usd2(team.reduce((s, p) => s + p.cost, 0))}</td></tr></tbody></table>`
    : '<p class="muted">Team labor: none on this job.</p>'
  const subs = jobCostsPacketSubSheets(input.chargeEvents)
  const subTable = subs.length
    ? `<table data-testid="packet-subs"><thead><tr><th>Sub labor, by sheet</th><th>Day</th><th class="num">Cost</th></tr></thead><tbody>${subs.map((s) => `<tr><td>${esc(s.name)}</td><td>${s.dateKey ? esc(dayLabelYear(s.dateKey)) : '—'}</td><td class="num">${usd2(s.amount)}</td></tr>`).join('')}<tr class="band strong"><td>${subs.length} ${subs.length === 1 ? 'sheet' : 'sheets'}</td><td></td><td class="num">${usd2(subs.reduce((s, r) => s + r.amount, 0))}</td></tr></tbody></table>`
    : '<p class="muted">Sub labor: none on this job.</p>'
  const supplyTable = input.supply.length
    ? `<table data-testid="packet-supply"><thead><tr><th>Supply house invoices</th><th>Invoice</th><th>Date</th><th class="num">Allocated</th></tr></thead><tbody>${input.supply.map((r) => `<tr><td>${esc(r.supplyHouseName ?? '—')}</td><td>${esc(r.invoiceNumber)}</td><td>${esc(r.invoiceDate ? dayLabelYear(r.invoiceDate) : '—')}</td><td class="num">${usd2(r.allocatedAmount)}</td></tr>`).join('')}<tr class="band strong"><td>${input.supply.length} ${input.supply.length === 1 ? 'line' : 'lines'}</td><td></td><td></td><td class="num">${usd2(input.supply.reduce((s, r) => s + r.allocatedAmount, 0))}</td></tr></tbody></table>`
    : '<p class="muted">Supply house invoices: none on this job.</p>'

  const page2 = `<section class="sheet" data-testid="packet-page-2">
${pageHead(2, 'where the money went')}
<h2>The baseline</h2>
${baseline}
<h2>Where the money went</h2>
${moneyTable}
<div class="two">
<div>${teamTable}</div>
<div>${subTable}</div>
</div>
<div class="gap">${supplyTable}</div>
${pageFoot(2)}
</section>`

  // ---- page 3: the card lines by cost line, the rest, the pace and a notes box ----
  const counted = input.cards.filter((c) => c.status === 'counts')
  const excluded = input.cards.filter((c) => c.status !== 'counts')
  const tagNames = [...new Set(counted.filter((c) => c.tag).map((c) => `${c.tag!.icon} ${c.tag!.name}`))]
  const cardRows = (rows: readonly JobCostsPacketCardLine[]): string => rows.map((c) => `<tr><td>${c.postedYmd ? esc(jobCostsPacketDayLabel(c.postedYmd)) : '—'}</td><td>${esc(c.card ?? '—')}</td><td>${esc(c.counterparty ?? '—')}</td><td class="num">${usd2(c.amount)}</td></tr>`).join('')
  const cardTable = (label: string, rows: readonly JobCostsPacketCardLine[], testId: string): string =>
    rows.length
      ? `<table data-testid="${testId}"><thead><tr><th>${esc(label)}</th><th>Card</th><th>Where</th><th class="num">Amount</th></tr></thead><tbody>${cardRows(rows)}<tr class="band strong"><td>${rows.length} ${rows.length === 1 ? 'charge' : 'charges'}</td><td></td><td></td><td class="num">${usd2(rows.reduce((s, r) => s + r.amount, 0))}</td></tr></tbody></table>`
      : `<p class="muted">${esc(label)}: none on this job.</p>`
  const tagTables = tagNames.map((name, i) => cardTable(name, counted.filter((c) => c.tag && `${c.tag.icon} ${c.tag.name}` === name), `packet-cards-tag-${i}`)).join('')
  const otherCards = counted.filter((c) => !c.tag)
  const excludedTable = excluded.length
    ? `<table data-testid="packet-cards-excluded"><thead><tr><th>Card charges not in the total</th><th>Card</th><th>Where</th><th class="num">Amount</th></tr></thead><tbody>${excluded.map((c) => `<tr><td>${c.postedYmd ? esc(jobCostsPacketDayLabel(c.postedYmd)) : '—'}</td><td>${esc(c.card ?? '—')}</td><td>${esc(c.counterparty ?? '—')} <span class="muted">${esc(statusNote(c.status))}</span></td><td class="num muted">${usd2(c.amount)}</td></tr>`).join('')}</tbody></table>`
    : ''
  const tallyTable = input.tally.length
    ? `<table data-testid="packet-tally"><thead><tr><th>Parts from tally</th><th class="num">Qty</th><th class="num">Line total</th></tr></thead><tbody>${input.tally.map((t) => `<tr><td>${esc([t.fixtureName, t.partName].filter(Boolean).join(' · ') || '—')}</td><td class="num">${t.quantity}</td><td class="num">${usd2(t.lineTotal)}</td></tr>`).join('')}<tr class="band strong"><td>${input.tally.length} ${input.tally.length === 1 ? 'part' : 'parts'}</td><td></td><td class="num">${usd2(input.tally.reduce((s, t) => s + t.lineTotal, 0))}</td></tr></tbody></table>`
    : '<p class="muted">Parts from tally: none on this job.</p>'
  const otherTable = input.other.length
    ? `<table data-testid="packet-other"><thead><tr><th>Date</th><th>Other job charges</th><th class="num">Amount</th></tr></thead><tbody>${input.other.map((t) => `<tr><td class="date">${t.chargedOn ? esc(formatWorkDateYmdFriendly(t.chargedOn)) : '—'}</td><td>${esc(t.description || '—')}${t.memo ? `<div class="muted">${esc(t.memo)}</div>` : ''}</td><td class="num">${usd2(t.amount)}</td></tr>`).join('')}<tr class="band strong"><td colspan="2">${input.other.length} ${input.other.length === 1 ? 'line' : 'lines'}</td><td class="num">${usd2(input.other.reduce((s, t) => s + t.amount, 0))}</td></tr></tbody></table>`
    : '<p class="muted">Other job charges: none on this job.</p>'
  const burnRate = m.burnPerFieldDayUsd != null ? `${usd0(m.burnPerFieldDayUsd)} a day` : m.fieldDays === 0 ? 'no field days yet' : 'idle 30+ days'
  const workLeft = daysLeft != null ? (daysLeft === 0 ? 'done' : `≈ ${d1(daysLeft)} working days`) : '—'
  const cash = input.paidToDateUsd - v.spent.usd

  const page3 = `<section class="sheet" data-testid="packet-page-3">
${pageHead(3, 'card charges and pace')}
<h2>Card charges <span class="muted" data-words>A charge that is also on a supply house invoice is counted once, under the invoice.</span></h2>
<div class="two">
<div>${tagTables || cardTable('Card charges', [], 'packet-cards-none')}</div>
<div>${cardTable('Other card charges', otherCards, 'packet-cards-other')}${excludedTable}${tallyTable}${otherTable}</div>
</div>
<h2>Pace</h2>
<table class="pace" data-testid="packet-pace"><tbody>
<tr><td>Burn rate <span class="muted">direct dollars per field day, over the last ${Math.min(10, m.fieldDays)} field ${Math.min(10, m.fieldDays) === 1 ? 'day' : 'days'}</span></td><td class="num">${esc(burnRate)}</td></tr>
<tr><td>Work left at the current pace <span class="muted">${m.progressPerFieldDay != null ? `${d1(m.progressPerFieldDay)}% of the work per field day so far` : 'needs a % complete'}</span></td><td class="num">${esc(workLeft)}</td></tr>
<tr><td>Field days so far <span class="muted">days with team labor on the job</span></td><td class="num">${m.fieldDays}</td></tr>
<tr><td>Overhead landed so far <span class="muted">the job's share of the office's running cost</span></td><td class="num">${usd2(v.overheadToDateUsd)}</td></tr>
<tr><td>Cash position <span class="muted">paid by the customer, less direct cost</span></td><td class="num">${usd2(input.paidToDateUsd)} − ${usd2(v.spent.usd)} = <b>${usd0(cash)}</b></td></tr>
</tbody></table>
<h2>Notes</h2>
<div class="notes"><div></div><div></div><div></div><div></div></div>
${pageFoot(3)}
</section>`

  // ---- page 4: by day ----
  const dayRows = jobCostsPacketByDay(input.chargeEvents, input.valueEvents, input.paymentEvents)
  const cell = (n: number, extra = ''): string => (n !== 0 ? `${usd2(n)}${extra}` : '<span class="muted">—</span>')
  const byDayBody = dayRows
    .map(
      (r) =>
        `<tr><td class="date">${r.ymd ? `${weekday(r.ymd)} ${esc(jobCostsPacketDayLabel(r.ymd))}` : 'No date'}</td><td class="num">${cell(r.team, r.teamHours > 0 ? `<div class="muted">${h1(r.teamHours)}</div>` : '')}</td><td class="num">${cell(r.sub)}</td><td class="num">${cell(r.supply)}</td><td class="num">${cell(r.fuel)}</td><td class="num">${cell(r.card)}</td><td class="num">${cell(r.parts)}</td><td class="num strongcell">${r.total !== 0 ? usd2(r.total) : '<span class="muted">—</span>'}</td><td class="num muted">${usd0(r.running)}</td><td class="note">${r.notes.map(esc).join('<br>')}</td></tr>`,
    )
    .join('')
  const daily = jobCostsPacketDailySvg(m.daily)
  const page4 = `<section class="sheet" data-testid="packet-page-4">
${pageHead(4, 'by day')}
${daily ? `<div class="chartbox"><div class="ttl">Daily spend <span class="muted" data-words>The last 14 working days. Each bar is team labor, sub labor and parts. The line is the 7-day average.</span></div>${daily}<div class="legend"><span><i class="sw red"></i>team labor</span><span><i class="sw violet"></i>sub labor</span><span><i class="sw amber"></i>parts</span><span><i class="sw gray"></i>7-day average</span></div></div>` : '<p class="muted small" data-words>No spend in the last 14 working days, so the daily spend bars are not drawn.</p>'}
<h2>What happened, by day <span class="muted" data-words>One row for each day with a cost, a payment or a % done. The last column is the cost to date at the end of that day.</span></h2>
${dayRows.length ? `<table class="byday" data-testid="packet-byday"><thead><tr><th>Day</th><th class="num">Team labor</th><th class="num">Sub labor</th><th class="num">Supply house</th><th class="num">Fuel</th><th class="num">Cards</th><th class="num">Parts, other</th><th class="num">Day total</th><th class="num">Cost to date</th><th>Payment or % done</th></tr></thead><tbody>${byDayBody}</tbody></table>` : '<p class="muted">No dated cost, payment or % done yet.</p>'}
${pageFoot(4)}
</section>`

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · Job costs</title>
<style>
@page { size: letter; margin: 0.5in 0.5in 0.6in; @bottom-left { content: "${esc(stamp).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"; font: 8px -apple-system, "Segoe UI", system-ui, sans-serif; color: #6b7280; } @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8px -apple-system, "Segoe UI", system-ui, sans-serif; color: #6b7280; } }
:root { color-scheme: light; }
* { box-sizing: border-box; }
html, body { margin: 0; }
body { background: #e5e7eb; color: #111827; font: 10.5px/1.4 -apple-system, "Segoe UI", system-ui, sans-serif; padding: 16px 0 40px; }
.sheet { width: 8.5in; min-height: 11in; padding: 0.5in; margin: 0 auto 16px; background: #ffffff; box-shadow: 0 2px 10px rgba(0,0,0,.12); display: flex; flex-direction: column; position: relative; }
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #111827; padding-bottom: 8px; margin-bottom: 8px; }
.head.slim { border-bottom: 1px solid #d1d5db; padding-bottom: 5px; margin-bottom: 6px; font-size: 10px; align-items: baseline; }
.co { font-size: 10px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #6b7280; }
h1 { font-size: 20px; margin: 2px 0 2px; line-height: 1.15; }
.idline { font-size: 11px; margin-top: 2px; }
.chip { display: inline-block; background: #d97706; color: #fff; font-weight: 700; font-size: 10px; letter-spacing: .04em; border-radius: 4px; padding: 1px 6px; margin-right: 4px; vertical-align: 1px; }
.stamp { text-align: right; font-size: 10px; color: #374151; white-space: nowrap; line-height: 1.45; }
.stamp .kicker { font-size: 13px; font-weight: 700; color: #111827; }
.muted { color: #6b7280; font-weight: 400; }
.small { font-size: 9.5px; margin: 0 0 4px; }
.pctline { font-size: 11px; margin: 2px 0 8px; }
.hero { border: 1px solid #d1d5db; border-radius: 8px; padding: 8px 12px; margin-bottom: 8px; }
.hero.good { border-color: #86efac; background: #dcfce7; }
.hero.bad { border-color: #fca5a5; background: #fee2e2; }
.hero.good .big { color: #15803d; }
.hero.bad .big { color: #dc2626; }
.hero.quiet .big { color: #6b7280; }
.lab { font-size: 8.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #6b7280; }
.big { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.15; margin-top: 1px; }
.sub { font-size: 10px; color: #374151; margin-top: 2px; }
.tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 10px; }
.tile { border: 1px solid #d1d5db; border-radius: 8px; padding: 7px 10px; }
.tile .big { font-size: 17px; }
.chartbox { border: 1px solid #d1d5db; border-radius: 8px; padding: 8px 10px 6px; margin-bottom: 6px; }
.chartbox .ttl { font-size: 11px; font-weight: 700; margin-bottom: 2px; }
.chartbox .ttl .muted { font-size: 9.5px; }
.legend { display: flex; gap: 14px; font-size: 9.5px; color: #6b7280; margin-top: 2px; flex-wrap: wrap; }
.sw { display: inline-block; width: 14px; height: 3px; vertical-align: middle; margin-right: 5px; border-radius: 2px; }
.sw.red { background: #dc2626; } .sw.blue { background: #2563eb; } .sw.gray { background: #6b7280; } .sw.violet { background: #a855f7; } .sw.amber { background: #f59e0b; }
.sw.dashed { height: 0; border-top: 2px dashed currentColor; background: none; }
.sw.red.dashed { color: #dc2626; } .sw.gray.dashed { color: #6b7280; }
h2 { font-size: 12px; margin: 10px 0 4px; display: flex; justify-content: space-between; align-items: baseline; gap: 10px; page-break-after: avoid; }
h2 .muted { font-size: 9.5px; font-weight: 400; text-align: right; max-width: 70%; }
table { width: 100%; border-collapse: collapse; font-size: 10px; page-break-inside: auto; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
th { text-align: left; font-size: 8.5px; letter-spacing: .06em; text-transform: uppercase; color: #6b7280; border-bottom: 1px solid #d1d5db; padding: 3px 6px; font-weight: 700; }
td { padding: 3px 6px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
th.num, td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
td.date { white-space: nowrap; }
tr.band td { background: #f9fafb; }
tr.strong td { font-weight: 700; }
tr.good td { background: #dcfce7; }
tr.bad td { background: #fee2e2; }
.sections td:first-child { white-space: nowrap; }
.sections .muted { font-size: 9px; }
.money .bar { display: inline-block; height: 6px; background: #2563eb; opacity: .7; border-radius: 3px; vertical-align: middle; margin-right: 6px; }
.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; align-items: start; margin-top: 8px; }
.two table + table, .two table + p, .two p + p, .two p + table { margin-top: 10px; }
.gap { margin-top: 10px; }
.strip { border-radius: 8px; padding: 7px 10px; font-size: 10.5px; display: grid; gap: 3px; }
.strip.none { border: 1px solid #f59e0b; background: #fef3c7; }
.strip.bid { border: 1px solid #86efac; background: #dcfce7; }
.strip .facts { display: flex; gap: 14px; flex-wrap: wrap; }
.pace td:first-child { width: 72%; }
.notes { border: 1px solid #d1d5db; border-radius: 8px; padding: 6px 10px 2px; }
.notes div { height: 20px; border-bottom: 1px dotted #d1d5db; }
.notes div:last-child { border-bottom: 0; }
.foot { margin-top: auto; padding-top: 8px; border-top: 1px solid #d1d5db; font-size: 8.5px; color: #6b7280; display: flex; justify-content: space-between; }
.byday td.date { white-space: nowrap; }
.byday th:last-child, .byday td.note { min-width: 150px; }
.byday td .muted { font-size: 8.5px; }
.byday td.strongcell { font-weight: 700; }
.byday td.note { font-size: 9px; color: #374151; }
@media print {
  body { background: none; padding: 0; }
  .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; page-break-after: always; display: block; }
  .sheet:last-child { page-break-after: auto; }
  .foot { display: none; }
}
</style>
</head>
<body>
${page1}
${page2}
${page3}
${page4}
</body>
</html>`
}
