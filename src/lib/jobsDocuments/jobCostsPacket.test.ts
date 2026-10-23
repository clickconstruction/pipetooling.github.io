import { describe, expect, it } from 'vitest'
import { buildJobBurn, resolveJobBurnBudget, type JobBurnDay } from '../jobs/jobBurn'
import { buildCostsVerdict, timeLeftWords } from '../jobs/jobCostsVerdict'
import { spendByComponent, type ResolvedJobBudget } from '../jobs/jobBudget'
import { buildMoneyRows } from '../jobs/jobMoneyTable'
import type { JobChargeEvent, JobPaymentEvent, JobValueEvent } from '../jobChargesTimeline'
import { plainWordsFailures } from '../plainWords'
import {
  buildJobCostsPacketHtml,
  jobCostsPacketByDay,
  jobCostsPacketChartSvg,
  jobCostsPacketDailySvg,
  jobCostsPacketSubSheets,
  jobCostsPacketTeamByPerson,
  type JobCostsPacketInput,
} from './jobCostsPacket'

/**
 * The Costs tab on paper (punch list #143): the builder lays out what the tab holds, so the
 * fixture is the tab's own path — events in, the burn model and the verdict through the kernels,
 * the money rows through theirs — on a job shaped like 891 on 2026-10-22.
 */

const T = (ymd: string, who: string, hours: number, cost: number): JobChargeEvent => ({ source: 'team_labor', dateKey: ymd, amount: cost, label: `${who} — team labor (${hours}h)`, who, hours })
const F = (ymd: string, where: string, usd: number): JobChargeEvent => ({ source: 'fuel', dateKey: ymd, amount: usd, label: where })
const C = (ymd: string, where: string, usd: number): JobChargeEvent => ({ source: 'mercury_card', dateKey: ymd, amount: usd, label: where })
const S = (ymd: string, inv: string, usd: number): JobChargeEvent => ({ source: 'supply_house', dateKey: ymd, amount: usd, label: `Reece — invoice ${inv}` })

const chargeEvents: JobChargeEvent[] = [
  S('2026-07-02', 'S1', 1996.36),
  { source: 'sub_labor', dateKey: '2026-07-06', amount: 1800, label: 'Miguel — sub labor', who: 'Miguel' },
  T('2026-07-08', 'Malachi', 8, 461.84),
  T('2026-07-08', 'Isiah', 9, 71.98),
  F('2026-07-08', 'Pilot Flying J', 105.03),
  C('2026-07-08', 'Bertling Equipment Rental & Repair', 433.55),
  T('2026-07-11', 'Isiah', 4.49, 35.93),
  T('2026-07-27', 'Darren', 9.68, 96.75),
  T('2026-08-05', 'Darren', 10.2, 101.99),
  S('2026-08-05', 'S2', 1321.81),
  T('2026-08-07', 'Malachi', 2.54, 146.87),
  T('2026-08-09', 'Isiah', 6.95, 55.64),
  T('2026-08-11', 'Malachi', 5.58, 322.36),
]
const valueEvents: JobValueEvent[] = [
  { dateKey: '2026-10-05', percent: 100, label: 'Set on the job by Taunya', kind: 'manual' },
  { dateKey: '2026-10-07', percent: 30, label: 'Set on the job by Taunya', kind: 'manual' },
]
const paymentEvents: JobPaymentEvent[] = [{ dateKey: '2026-09-08', amount: 15102.36, label: 'Payment — checkDeposit' }]
const PRICE = 43249.31
const TODAY = '2026-10-22'
const assumed: ResolvedJobBudget = { source: 'assumed', glyph: '≈', directUsd: 28112, components: null, completeness: null, targetMarginPct: 35, bidId: null, takenAt: null, takenBy: null, note: null, partial: null }

function tabFor(events: JobChargeEvent[], priceUsd: number | null = PRICE, pct: number | null = 30) {
  const burn = buildJobBurn({
    chargeEvents: events,
    valueEvents: pct == null ? [] : valueEvents,
    fallbackPercent: pct,
    priceUsd,
    budget: resolveJobBurnBudget({ priceUsd, bidEstimateUsd: null, targetMarginPct: 35 }),
    overhead: { shareToDateUsd: 1010.39, perFieldDayUsd: 144.34 },
    todayYmd: TODAY,
    earnedBasis: 'price',
  })
  const teamHours = events.filter((e) => e.source === 'team_labor').reduce((s, e) => s + (e.hours ?? 0), 0)
  const verdict = buildCostsVerdict({ burn, priceUsd, spend: spendByComponent(events), teamHours, teamPeople: 3, resolved: assumed, bidLabel: null, latestReportYmd: null, jobPct: pct, jobFinished: false, todayYmd: TODAY, priced: null })
  return { burn, verdict }
}

function inputFor(events: JobChargeEvent[] = chargeEvents, p: Partial<JobCostsPacketInput> = {}): JobCostsPacketInput {
  const { burn, verdict } = tabFor(events)
  const spend = spendByComponent(events)
  const fuel = events.filter((e) => e.source === 'fuel').reduce((s, e) => s + e.amount, 0)
  const card = events.filter((e) => e.source === 'mercury_card').reduce((s, e) => s + e.amount, 0)
  const supplyUsd = events.filter((e) => e.source === 'supply_house').reduce((s, e) => s + e.amount, 0)
  return {
    company: 'Click Plumbing and Electrical',
    job: { numberLabel: '891 PLUM', name: 'Take 5- Liberty Hill', address: '11730 TX-29, Liberty Hill, TX 78642', customer: 'Burd & Assoc.', gc: null, statusWords: 'Billed', openedYmd: '2026-07-01', lastWorkYmd: '2026-08-11' },
    printedAt: 'Oct 22, 2026, 4:05 PM',
    printedBy: 'Robert',
    todayYmd: TODAY,
    verdict,
    burn,
    pctLine: '30% done · set on the job by Taunya on Oct 7',
    baselineKeptWords: 'Baseline kept Sep 12 on billing · per $1k',
    money: buildMoneyRows({
      supplyUsd, supplyCount: 2, supplyFailed: false,
      teamUsd: spend.teamUsd, teamHours: verdict.spent.teamHours, teamPeople: 3, teamLoading: false, teamFailed: false,
      cardUsd: fuel + card, cardCount: 2, cardFailed: false, cardCostLines: fuel > 0 ? [{ tagId: 'fuel', name: 'Fuel & gas', icon: '⛽', usd: fuel }] : [],
      subUsd: spend.subUsd, subCount: 1, subLoading: false, subFailed: false,
      tallyUsd: 0, tallyCount: 0, tallyFailed: false,
      otherUsd: 0, otherCount: 0,
    }),
    chargeEvents: events,
    valueEvents,
    paymentEvents,
    supply: [
      { supplyHouseName: 'Reece', invoiceNumber: 'S1', invoiceDate: '2026-07-02', allocatedAmount: 1996.36 },
      { supplyHouseName: 'Reece', invoiceNumber: 'S2', invoiceDate: '2026-08-05', allocatedAmount: 1321.81 },
    ],
    cards: [
      { postedYmd: '2026-07-08', card: 'Malachi 6783', counterparty: 'Pilot Flying J', amount: 105.03, tag: { icon: '⛽', name: 'Fuel & gas' }, status: 'counts' },
      { postedYmd: '2026-07-08', card: 'Malachi 6783', counterparty: 'Bertling Equipment Rental & Repair', amount: 433.55, tag: null, status: 'counts' },
      { postedYmd: '2026-07-09', card: 'Michael A 4003', counterparty: 'Reece <counter>', amount: 60, tag: null, status: 'invoice_linked' },
    ],
    tally: [],
    other: [],
    paidToDateUsd: 15102.36,
    bidFigure: null,
    ...p,
  }
}

const usd0 = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

describe('buildJobCostsPacketHtml — four pages from the tab’s own numbers', () => {
  it('lays out four sheets with the identity block and the printed stamp', () => {
    const html = buildJobCostsPacketHtml(inputFor())
    expect(html.match(/data-testid="packet-page-\d"/g)).toHaveLength(4)
    expect(html).toContain('<title>891 PLUM · Take 5- Liberty Hill · Job costs</title>')
    expect(html).toContain('<span class="chip">891 PLUM</span> 11730 TX-29, Liberty Hill, TX 78642')
    expect(html).toContain('Burd &amp; Assoc. · Billed · opened Jul 1, 2026 · last field day Aug 11, 2026')
    expect(html).toContain('Printed Oct 22, 2026, 4:05 PM')
    expect(html).toContain('<div>by Robert</div>')
    expect(html).toContain('<b>$43,249</b> price · <b>30% done · set on the job by Taunya on Oct 7</b>')
    expect(html).toContain('printed Oct 22, 2026, 4:05 PM by Robert')
    expect(html).toContain('counter(page) " of " counter(pages)')
  })

  it('reads the margin band and the three tiles off the verdict, green when the margin is kept', () => {
    const input = inputFor()
    const v = input.verdict
    const html = buildJobCostsPacketHtml(input)
    expect(v.trueMargin).not.toBeNull()
    expect(html).toContain('<div class="hero good" data-testid="packet-hero">')
    expect(html).toContain(`<div class="big">${usd0(v.trueMargin!.usd)} · ${Math.round(v.trueMargin!.pct!)}%</div>`)
    expect(html).toContain(`At today's pace the job costs ${usd0(v.eacUsd!)} direct plus ${usd0(v.overheadToDateUsd + v.overheadProjectedUsd!)} of overhead. The direct margin alone is ${usd0(v.directMargin!.usd)}, which is ${Math.round(v.directMargin!.pct!)}% of the price.`)
    expect(html).toContain(`<div class="big">${usd0(v.spent.usd)}</div>`)
    expect(html).toContain(`<div class="big">${usd0(v.earned!.usd)}</div>`)
    const tl = timeLeftWords(v.timeLeft, usd0)
    expect(html).toContain(`<div class="big">${tl.big}</div><div class="sub">${tl.sub}</div>`)
  })

  it('turns red on a job that loses money and names the direct margin when overhead is not in', () => {
    const { burn, verdict } = tabFor(chargeEvents, 9000)
    const html = buildJobCostsPacketHtml(inputFor(chargeEvents, { burn, verdict }))
    expect(html).toContain('<div class="hero bad" data-testid="packet-hero">')
    expect(html).toContain('<div class="big">−$')
    const noOverhead = { ...verdict, trueMargin: null, overheadProjectedUsd: null }
    const html2 = buildJobCostsPacketHtml(inputFor(chargeEvents, { burn, verdict: noOverhead }))
    expect(html2).toContain('Direct margin at completion')
    expect(html2).toContain('The overhead share is not in yet.')
  })

  it('says too early on a young job and leaves every list as none', () => {
    const young = [T('2026-10-21', 'Malachi', 8, 400)]
    const { burn, verdict } = tabFor(young, PRICE, 5)
    const html = buildJobCostsPacketHtml(inputFor(young, { burn, verdict, supply: [], cards: [], paymentEvents: [], valueEvents: [], money: buildMoneyRows({ supplyUsd: 0, supplyCount: 0, supplyFailed: false, teamUsd: 400, teamHours: 8, teamPeople: 1, teamLoading: false, teamFailed: false, cardUsd: 0, cardCount: 0, cardFailed: false, subUsd: 0, subCount: 0, subLoading: false, subFailed: false, tallyUsd: 0, tallyCount: 0, tallyFailed: false, otherUsd: 0, otherCount: 0 }) }))
    expect(html).toContain('<div class="big">too early</div>')
    expect(html).toContain('The projection needs three field days and 10% done.')
    expect(html).toContain('Sub labor: none on this job.')
    expect(html).toContain('Supply house invoices: none on this job.')
    expect(html).toContain('Card charges: none on this job.')
    expect(html).toContain('Parts from tally: none on this job.')
    expect(html).toContain('Other job charges: none on this job.')
  })

  it('draws the by-section table with the kernel’s rows and the margin row last', () => {
    const input = inputFor()
    const html = buildJobCostsPacketHtml(input)
    const v = input.verdict
    expect(html).toContain('<tr><td><b>Labor</b> <span class="muted">')
    expect(html).toContain('<tr><td><b>Materials</b> <span class="muted">supply house · cards · tally</span></td>')
    expect(html).toContain(`<tr class="band"><td>Direct cost</td><td class="num">${usd0(v.spent.usd)}</td><td class="num">${usd0(v.eacUsd!)}</td><td class="num muted">≈ $28,112 assumed, 65% of price</td><td class="muted">spent ÷ 30% done</td></tr>`)
    expect(html).toContain('<tr class="good strong"><td>True margin</td>')
    expect(html).toContain('35% target')
    expect(html).toContain('Bid figures: no bid linked.')
  })

  it('prints Where the money went in the kernel’s order with its shares and total', () => {
    const html = buildJobCostsPacketHtml(inputFor())
    const order = [...html.matchAll(/data-testid="packet-money-([a-z:]+)"/g)].map((m) => m[1])
    expect(order).toEqual(['supply', 'sub', 'team', 'card', 'tag:fuel', 'tally', 'other'])
    expect(html).toContain('<td>Supply house invoices <span class="muted">2 lines</span></td><td class="num">—</td><td class="num">$3,318.17</td>')
    expect(html).toContain('<tr class="band strong"><td>Direct cost to date</td><td class="num">56 h</td><td class="num">$6,950.11</td><td class="num">100%</td></tr>')
  })

  it('groups team labor by person, most cost first, and lists the sub sheets', () => {
    const team = jobCostsPacketTeamByPerson(chargeEvents)
    expect(team.map((p) => p.name)).toEqual(['Malachi', 'Darren', 'Isiah'])
    expect(team[0]).toMatchObject({ name: 'Malachi', days: 3 })
    expect(team[0]!.hours).toBeCloseTo(16.12, 2)
    expect(team[0]!.cost).toBeCloseTo(931.07, 2)
    expect(jobCostsPacketSubSheets(chargeEvents)).toEqual([{ name: 'Miguel', dateKey: '2026-07-06', amount: 1800 }])
    const html = buildJobCostsPacketHtml(inputFor())
    expect(html).toContain('<tr><td>Malachi</td><td class="num">3</td><td class="num">16.1 h</td><td class="num">$931.07</td></tr>')
    expect(html).toContain('<tr class="band strong"><td>3 people</td><td class="num">7</td><td class="num">56.4 h</td>')
    expect(html).toContain('<tr><td>Miguel</td><td>Jul 6, 2026</td><td class="num">$1,800.00</td></tr>')
  })

  it('falls back to the label when an event carries no who', () => {
    const bare: JobChargeEvent[] = [{ source: 'team_labor', dateKey: '2026-07-08', amount: 10, label: 'Ana — team labor (1h)' }, { source: 'sub_labor', dateKey: null, amount: 5, label: 'Bo — sub labor' }]
    expect(jobCostsPacketTeamByPerson(bare)[0]).toEqual({ name: 'Ana', days: 1, hours: 0, cost: 10 })
    expect(jobCostsPacketSubSheets(bare)).toEqual([{ name: 'Bo', dateKey: null, amount: 5 }])
  })

  it('lists the card charges by cost line, the rest, and what the one card rule left out', () => {
    const html = buildJobCostsPacketHtml(inputFor())
    expect(html).toContain('<table data-testid="packet-cards-tag-0"><thead><tr><th>⛽ Fuel &amp; gas</th>')
    expect(html).toContain('<tr><td>Jul 8</td><td>Malachi 6783</td><td>Pilot Flying J</td><td class="num">$105.03</td></tr>')
    expect(html).toContain('<table data-testid="packet-cards-other">')
    expect(html).toContain('<td>Bertling Equipment Rental &amp; Repair</td><td class="num">$433.55</td>')
    expect(html).toContain('<table data-testid="packet-cards-excluded">')
    expect(html).toContain('Reece &lt;counter&gt; <span class="muted">counted under its supply house invoice</span>')
    expect(html).not.toContain('<counter>')
  })

  it('writes one row per day with the running cost, the payment and the % events', () => {
    const rows = jobCostsPacketByDay(chargeEvents, valueEvents, paymentEvents)
    expect(rows.map((r) => r.ymd)).toEqual(['2026-07-02', '2026-07-06', '2026-07-08', '2026-07-11', '2026-07-27', '2026-08-05', '2026-08-07', '2026-08-09', '2026-08-11', '2026-09-08', '2026-10-05', '2026-10-07'])
    const jul8 = rows[2]!
    expect(jul8.team).toBeCloseTo(533.82, 2)
    expect(jul8.teamHours).toBe(17)
    expect(jul8.fuel).toBeCloseTo(105.03, 2)
    expect(jul8.card).toBeCloseTo(433.55, 2)
    expect(jul8.total).toBeCloseTo(1072.4, 2)
    expect(Math.round(jul8.running * 100) / 100).toBe(4868.76)
    expect(rows[8]!.running).toBeCloseTo(inputFor().burn.spentUsd, 2)
    expect(rows[9]!.notes).toEqual(['+$15,102.36 Payment — checkDeposit'])
    expect(rows[11]!.notes).toEqual(['30% done · Set on the job by Taunya'])
    const html = buildJobCostsPacketHtml(inputFor())
    expect(html).toContain('<td class="date">Wed Jul 8</td><td class="num">$533.82<div class="muted">17.0 h</div></td>')
    expect(html).toContain('No spend in the last 14 working days, so the daily spend bars are not drawn.')
  })

  it('puts the charges with no date last, as one row', () => {
    const rows = jobCostsPacketByDay([...chargeEvents, { source: 'billed_material', dateKey: null, amount: 50, label: 'Permit' }], [], [])
    const lastRow = rows[rows.length - 1]!
    expect(lastRow).toMatchObject({ ymd: null, parts: 50, total: 50 })
    expect(lastRow.running).toBeCloseTo(7000.11, 2)
    expect(buildJobCostsPacketHtml(inputFor([...chargeEvents, { source: 'billed_material', dateKey: null, amount: 50, label: 'Permit' }]))).toContain('<td class="date">No date</td>')
  })

  it('draws the chart with the cost and value lines, the price, no forecast when the burn is idle, and the bid figure when one stands', () => {
    const input = inputFor()
    const svg = jobCostsPacketChartSvg(input.burn.cumulative, PRICE, TODAY)
    expect(svg).toContain('data-testid="packet-chart-cost"')
    expect(svg).toContain('data-testid="packet-chart-earned"')
    expect(svg).not.toContain('data-testid="packet-chart-forecast"')
    expect(svg).toContain('price $43,249')
    expect(svg).toContain('cost to date $6,950')
    expect(svg).toContain('value earned $12,975')
    expect(svg).not.toContain('packet-chart-bid')
    const withBid = jobCostsPacketChartSvg(input.burn.cumulative, PRICE, TODAY, { usd: 30000, label: '◆ bid figure' })
    expect(withBid).toContain('data-testid="packet-chart-bid"')
    expect(withBid).toContain('◆ bid figure $30,000')
    expect(jobCostsPacketChartSvg([], PRICE, TODAY)).toBe('')
    expect(buildJobCostsPacketHtml(inputFor([], { burn: tabFor([]).burn, verdict: tabFor([]).verdict }))).toContain('No dated spend yet.')
  })

  it('draws the daily bars only when the last 14 working days had spend', () => {
    expect(jobCostsPacketDailySvg([])).toBe('')
    const quiet: JobBurnDay[] = [{ ymd: '2026-10-21', team: 0, sub: 0, parts: 0, total: 0, avg7: 0 }]
    expect(jobCostsPacketDailySvg(quiet)).toBe('')
    const busy: JobBurnDay[] = [
      { ymd: '2026-10-20', team: 300, sub: 0, parts: 120, total: 420, avg7: 60 },
      { ymd: '2026-10-21', team: 0, sub: 500, parts: 0, total: 500, avg7: 131 },
    ]
    const svg = jobCostsPacketDailySvg(busy)
    expect(svg).toContain('data-testid="packet-daily"')
    expect(svg.match(/<rect /g)).toHaveLength(3)
    const html = buildJobCostsPacketHtml(inputFor(chargeEvents, { burn: { ...inputFor().burn, daily: busy } }))
    expect(html).toContain('Daily spend')
    expect(html).not.toContain('so the daily spend bars are not drawn')
  })

  it('reads the pace rows off the burn model and the cash position off the payments', () => {
    const html = buildJobCostsPacketHtml(inputFor())
    expect(html).toContain('<td class="num">idle 30+ days</td>')
    expect(html).toContain('<td class="num">≈ 16.3 working days</td>')
    expect(html).toContain('<tr><td>Field days so far <span class="muted">days with team labor on the job</span></td><td class="num">7</td></tr>')
    expect(html).toContain('$15,102.36 − $6,950.11 = <b>$8,152</b>')
  })

  it('shows the kept baseline and the bid’s baseline strip', () => {
    const html = buildJobCostsPacketHtml(inputFor())
    expect(html).toContain('<b>No baseline for this job yet. No bid is linked.</b>')
    expect(html).toContain('Baseline kept Sep 12 on billing · per $1k')
    const input = inputFor()
    const bid = { ...input.verdict, baseline: { ...input.verdict.baseline, kind: 'bid' as const, bidLabel: 'B66', bidHours: 120, hoursShare: 0.47, expectedShare: 0.3, read: 'over' as const } }
    const html2 = buildJobCostsPacketHtml(inputFor(chargeEvents, { verdict: bid, baselineKeptWords: '' }))
    expect(html2).toContain('◆ Baseline from B66 · 120 h predicted')
    expect(html2).toContain("47% of the bid's hours at 30% done · the book was light here")
  })

  it('keeps every fixed sentence in plain words', () => {
    const html = buildJobCostsPacketHtml(inputFor(chargeEvents, { burn: { ...inputFor().burn, daily: [{ ymd: '2026-10-21', team: 1, sub: 0, parts: 0, total: 1, avg7: 1 }] } }))
    const words = [...html.matchAll(/data-words>([^<]+)</g)].map((m) => m[1]!.replace(/&amp;/g, '&').replace(/&#39;/g, "'"))
    expect(words.length).toBeGreaterThanOrEqual(6)
    for (const w of words) expect(plainWordsFailures(w)).toEqual([])
  })
})
