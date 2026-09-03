import { describe, expect, it } from 'vitest'
import type { TeamSummaryBreakdown } from '../../components/people/teamSummary/types'
import {
  buildReviewHygiene,
  buildReviewPersonMath,
  buildReviewRankedBars,
  buildReviewVerdict,
  classifyReviewPerson,
  compareProfit,
  inclusiveDayCount,
  priorPeriodRange,
} from './reviewRanked'

type Job = TeamSummaryBreakdown['gb']['jobs'][number]

function job(over: Partial<Job> & { jobId: string }): Job {
  return {
    hcp: over.jobId.toUpperCase(),
    jobName: 'Job',
    totalBill: 1000,
    pctComplete: 100,
    pctCompleteSource: 'set',
    valueCreated: 1000,
    totalLaborOnJob: 500,
    costInPeriod: 250,
    ratio: 0.5,
    allocatedRevenue: 500,
    ...over,
  }
}

function row(over: Partial<TeamSummaryBreakdown> & { name: string }): TeamSummaryBreakdown {
  const gross = over.gross ?? 0
  const net = over.net ?? 0
  const overheadLaborCost = over.overheadLaborCost ?? 0
  const overheadBurden = over.overheadBurden === undefined ? 0 : over.overheadBurden
  const profitAfterOverhead =
    over.profitAfterOverhead !== undefined
      ? over.profitAfterOverhead
      : overheadBurden == null
        ? null
        : net + overheadLaborCost + overheadBurden
  const totalHours = over.totalHours ?? 0
  return {
    idx: 0,
    hb: { source: 'hourly', onlyPaidJobs: false, dailyRows: [], subLaborRows: [], totals: { daily: 0, crew: 0, subLabor: 0, totalHours } },
    gb: { jobs: [], total: gross },
    nb: { jobs: [], total: net },
    pb: { jobs: [], totalNet: net, totalHours, fieldHours: over.fieldHours ?? 0, overheadHours: over.overheadHours ?? 0, unaccountedHours: 0 },
    totalHours,
    overheadHours: 0,
    officeHours: 0,
    bidHours: 0,
    fieldHours: 0,
    hourlyWage: 50,
    overheadWage: 50,
    allocatedParts: over.allocatedParts ?? 0,
    allocatedByTag: over.allocatedByTag ?? {},
    allocatedLabor: over.allocatedLabor ?? Math.max(0, gross - net - (over.allocatedParts ?? 0)),
    overheadSessions: [],
    gross,
    net,
    revPerHour: totalHours > 0 ? gross / totalHours : 0,
    netPerHour: totalHours > 0 ? net / totalHours : 0,
    profitPerHourAfterOverhead: profitAfterOverhead != null && totalHours > 0 ? profitAfterOverhead / totalHours : null,
    payConfigSource: 'hourly',
    ...over,
    overheadLaborCost,
    overheadBurden,
    profitAfterOverhead,
  }
}

// Today's live shape (2026-09-03, last 30 days), rounded.
const malachi = row({ name: 'Malachi', payConfigSource: 'salary', totalHours: 176, overheadHours: 10.5, fieldHours: 165.5, gross: 49063, net: 23326, overheadLaborCost: -604, overheadBurden: -828 })
const taunya = row({ name: 'Taunya', totalHours: 85.3, overheadHours: 81.6, fieldHours: 3.7, gross: 687, net: 367, overheadLaborCost: -1367, overheadBurden: -19 })
const wendi = row({ name: 'Wendi', totalHours: 85.1, overheadHours: 85.1, fieldHours: 0, overheadLaborCost: -1276, overheadBurden: -0 })
const micah = row({ name: 'Micah' })

describe('classifyReviewPerson', () => {
  it('puts field earners, office people and idle people in their groups', () => {
    expect(classifyReviewPerson(malachi)).toBe('field')
    expect(classifyReviewPerson(taunya)).toBe('office')
    expect(classifyReviewPerson(wendi)).toBe('office')
    expect(classifyReviewPerson(micah)).toBe('none')
  })
  it('treats a person with a little field time and more office time as office', () => {
    expect(classifyReviewPerson(row({ name: 'W', totalHours: 24.1, overheadHours: 23.5, fieldHours: 0.6 }))).toBe('office')
  })
})

describe('period helpers', () => {
  it('counts inclusive days and builds the prior window of equal length', () => {
    expect(inclusiveDayCount('2026-08-05', '2026-09-03')).toBe(30)
    expect(inclusiveDayCount('2026-09-03', '2026-09-03')).toBe(1)
    expect(priorPeriodRange('2026-08-05', '2026-09-03')).toEqual(['2026-07-06', '2026-08-04'])
    expect(priorPeriodRange('2026-09-03', '2026-09-03')).toEqual(['2026-09-02', '2026-09-02'])
  })
})

describe('compareProfit', () => {
  it('reads up / down / flat with a 5% band and null when there is nothing to compare', () => {
    expect(compareProfit(110, 100).direction).toBe('up')
    expect(compareProfit(90, 100).direction).toBe('down')
    expect(compareProfit(103, 100).direction).toBe('flat')
    expect(compareProfit(103, 100).deltaPct).toBeCloseTo(0.03)
    expect(compareProfit(500, 0)).toEqual({ direction: 'flat', deltaPct: null, priorProfit: 0 })
  })
  it('measures against |prior| so a loss turning into a gain reads as up', () => {
    const t = compareProfit(200, -100)
    expect(t.direction).toBe('up')
    expect(t.deltaPct).toBeCloseTo(3)
  })
})

describe('buildReviewVerdict', () => {
  it('sums the team, splits the groups, and composes gross into segments that reconcile', () => {
    const v = buildReviewVerdict([malachi, taunya, wendi, micah], null)
    expect(v.people).toBe(4)
    expect(v.gross).toBe(49750)
    expect(v.net).toBe(23693)
    expect(v.overheadLabor).toBe(3247)
    expect(v.burden).toBe(847)
    expect(v.profit).toBe(23693 - 3247 - 847)
    expect(v.field).toMatchObject({ count: 1, fieldHours: 165.5 })
    expect(v.field.profit).toBe(21894)
    expect(v.field.profitPerFieldHour).toBeCloseTo(21894 / 165.5)
    expect(v.office).toMatchObject({ count: 2, overheadHours: 166.7, overheadLabor: 2643 })
    expect(v.none.names).toEqual(['Micah'])
    const shareSum = v.segments.reduce((s, seg) => s + seg.share, 0)
    expect(shareSum).toBeCloseTo(1, 5)
    expect(v.segments.map((s) => s.key)).toEqual(['costs', 'overheadLabor', 'burden', 'profit'])
    expect(v.byTag).toEqual([])
    expect(v.trend).toBeNull()
  })
  it('leaves profit null until the overhead rate lands, and compares against the prior period when given', () => {
    const loading = row({ name: 'A', totalHours: 10, gross: 100, net: 50, overheadBurden: null })
    expect(buildReviewVerdict([loading], null).profit).toBeNull()
    expect(buildReviewVerdict([loading], null).segments).toEqual([])
    const prior = [row({ name: 'Malachi', totalHours: 100, gross: 30000, net: 20000 })]
    const v = buildReviewVerdict([malachi], prior)
    expect(v.trend?.direction).toBe('up')
    expect(v.trend?.priorProfit).toBe(20000)
  })
})

describe('buildReviewRankedBars', () => {
  it('ranks by value, puts losses left of the zero line, and scales to the widest bar', () => {
    const { bars, zeroPct } = buildReviewRankedBars([wendi, malachi, taunya, micah], 'profit')
    expect(bars.map((b) => b.name)).toEqual(['Malachi', 'Micah', 'Taunya', 'Wendi'])
    const span = 21894 + 1276
    expect(zeroPct).toBeCloseTo((1276 / span) * 100)
    const m = bars[0]!
    expect(m.startPct).toBeCloseTo(zeroPct)
    expect(m.widthPct).toBeCloseTo((21894 / span) * 100)
    const w = bars[3]!
    expect(w.widthPct).toBeCloseTo((1276 / span) * 100)
    expect(w.startPct).toBeCloseTo(0)
    expect(m.sub).toBe('176.0 h assumed · $124/hr')
    expect(w.sub).toBe('85.1 h · 85.1 h office/bid')
  })
  it('filters by name and sorts null values last', () => {
    const loading = row({ name: 'Zed', totalHours: 10, gross: 100, net: 50, overheadBurden: null })
    const { bars } = buildReviewRankedBars([loading, malachi], 'profit')
    expect(bars.map((b) => b.name)).toEqual(['Malachi', 'Zed'])
    expect(bars[1]!.value).toBeNull()
    expect(buildReviewRankedBars([malachi, taunya], 'gross', 'tau').bars.map((b) => b.name)).toEqual(['Taunya'])
  })
})

describe('buildReviewPersonMath', () => {
  it('writes a formula chain that reconciles to profit after overhead', () => {
    const m = buildReviewPersonMath(malachi, { partsRate: 5 })
    const by = Object.fromEntries(m.lines.map((l) => [l.key, l.usd]))
    expect(by.gross).toBe(49063)
    // row() fixtures carry no parts split, so everything between gross and net is labor.
    expect(by.parts).toBe(-0)
    expect(by.labor).toBe(-(49063 - 23326))
    expect(by.net).toBe(23326)
    expect(by.overheadLabor).toBe(-604)
    expect(by.burden).toBe(-828)
    expect(by.profit).toBe(21894)
    expect(m.perHour).toEqual({ profit: 21894 / 176, hours: 176, basis: 'assumed' })
    expect(m.lines.find((l) => l.key === 'burden')?.why).toContain('$5.00')
    expect(m.watchouts.some((w) => w.includes('assumed'))).toBe(true)
  })
  it('sizes the levers from the breakdowns: assumed pct, no bill, concentration, worst job, zero-hour rows', () => {
    const b = row({
      name: 'M',
      totalHours: 40,
      gross: 10000,
      net: 4000,
      gb: {
        total: 10000,
        jobs: [
          job({ jobId: 'a', hcp: 'JP1', jobName: 'Big', allocatedRevenue: 7000, ratio: 0.28, totalLaborOnJob: 1659 }),
          job({ jobId: 'b', hcp: 'JP2', jobName: 'Guess', allocatedRevenue: 2000, pctCompleteSource: 'assumed' }),
          job({ jobId: 'c', hcp: 'JP3', jobName: 'Free', allocatedRevenue: 0, totalBill: 0, valueCreated: 0, costInPeriod: 34 }),
        ],
      },
      pb: { jobs: [{ jobId: 'c', hcp: 'JP3', jobName: 'Free', allocatedNet: -53, hoursInPeriod: 0.6 }], totalNet: 4000, totalHours: 40, fieldHours: 40, overheadHours: 0, unaccountedHours: 2 },
      hb: {
        source: 'hourly',
        onlyPaidJobs: false,
        dailyRows: [{ date: '2026-08-25', hours: 8, crewAllocations: [{ hcp: 'JP1', jobName: 'Big', address: '', pct: 0, hours: 0, valueCreated: 0 }] }],
        subLaborRows: [],
        totals: { daily: 8, crew: 0, subLabor: 0, totalHours: 40 },
      },
    })
    const m = buildReviewPersonMath(b, { partsRate: 5 })
    const texts = m.levers.map((l) => l.text)
    expect(texts[0]).toContain('1 job has no % complete')
    expect(texts[0]).toContain('$2,000')
    expect(texts[1]).toContain('1 job has no bill amount')
    expect(texts[2]).toContain('70% of gross is one job (JP1 Big)')
    expect(texts[3]).toContain('Worst job: JP3 Free · -$53 over 0.6 h')
    expect(texts[4]).toContain('2.0 h of the period landed on no job')
    expect(texts[5]).toContain('1 crew assignment carries 0 h')
  })
})

describe('buildReviewHygiene', () => {
  it('lists approvals, no-bill jobs, assumed-% jobs (deduped across people) and the salary assumption', () => {
    const j1 = job({ jobId: 'x', hcp: 'JP950', totalBill: 0, valueCreated: 0, costInPeriod: 34 })
    const j2 = job({ jobId: 'y', hcp: 'JP273', pctCompleteSource: 'assumed' })
    const a = row({ name: 'A', payConfigSource: 'salary', totalHours: 8, gb: { total: 0, jobs: [j1, j2] } })
    const b = row({ name: 'B', totalHours: 8, gb: { total: 0, jobs: [j1, j2] } })
    const items = buildReviewHygiene([a, b], { sessions: 118, totalHours: 610.6, people: 9, oldestAgeDays: 21 })
    expect(items.map((i) => i.key)).toEqual(['approvals', 'noBill', 'assumedPct', 'salaried'])
    expect(items[0]!.headline).toBe('118 sessions · 610.6 h awaiting approval')
    expect(items[1]!.headline).toBe('1 job has no bill amount')
    expect(items[1]!.detail).toBe('Labor there lands as pure loss (JP950 Job).')
    const clickOnly = row({ name: 'C', totalHours: 8, gb: { total: 0, jobs: [job({ jobId: 'z', hcp: 'Unknown', jobName: 'Water Leak', totalBill: 0, valueCreated: 0, costInPeriod: 5 })] } })
    expect(buildReviewHygiene([clickOnly], null)[0]!.detail).toBe('Labor there lands as pure loss (Water Leak).')
    expect(items[2]!.headline).toBe('1 job has no % complete')
    expect(items[3]!.headline).toBe('Salaried hours are assumed for 1 person')
  })
  it('returns nothing when the period is clean', () => {
    expect(buildReviewHygiene([row({ name: 'A', totalHours: 8 })], null)).toEqual([])
    expect(buildReviewHygiene([row({ name: 'A', totalHours: 8 })], null, { usd: 0, charges: 0, jobs: 0, top: [] })).toEqual([])
  })
  it('names office-type card charges that landed on field jobs and points at Banking sorting', () => {
    const items = buildReviewHygiene([row({ name: 'A', totalHours: 8 })], null, {
      usd: 3171,
      charges: 9,
      jobs: 5,
      top: [
        { category: 'Software', counterparty: 'Auto Group', usd: 1700 },
        { category: 'Utilities', counterparty: 'Post Oak Landfill', usd: 397 },
        { category: 'Utilities', counterparty: 'City Of Kyle', usd: 364 },
        { category: 'InternetAndTelephone', counterparty: 'Starlink', usd: 275 },
      ],
    })
    expect(items).toHaveLength(1)
    expect(items[0]!.key).toBe('officeLikeCharges')
    expect(items[0]!.headline).toBe('$3,171 of office-type charges on 5 field jobs')
    expect(items[0]!.detail).toContain('Auto Group $1,700, Post Oak Landfill $397, City Of Kyle $364, …')
    expect(items[0]!.href).toBe('/banking?tab=sorting')
  })
})

describe('cost-line tags (v2.2723)', () => {
  const fuelTag = { id: 't-fuel', name: 'Fuel & gas', icon: '⛽', color: 'amber' as const, sort_order: 0, default_key: 'fuel_vehicle', show_as_cost_line: true, hide_from_picker: false }
  const permitsTag = { id: 't-gov', name: 'Government', icon: '🏛', color: 'gray' as const, sort_order: 40, default_key: 'government', show_as_cost_line: true, hide_from_picker: false }
  const r = row({ name: 'M', totalHours: 100, gross: 10000, net: 4000, allocatedParts: 3000, allocatedLabor: 3000, allocatedByTag: { 't-fuel': 500, 't-gov': 120 } })
  it('draws one verdict segment and one drawer line per cost-line tag, slicing them out of parts', () => {
    const v = buildReviewVerdict([r], null, [fuelTag, permitsTag])
    expect(v.byTag.map((t) => `${t.tag.name} ${t.usd}`)).toEqual(['Fuel & gas 500', 'Government 120'])
    expect(v.segments.map((s) => s.key)).toEqual(['costs', 'tag:t-fuel', 'tag:t-gov', 'overheadLabor', 'burden', 'profit'])
    expect(v.segments[0]!.usd).toBe(6000 - 620)
    expect(v.segments[1]).toMatchObject({ color: 'amber', icon: '⛽', label: 'Fuel & gas', usd: 500 })
    const m = buildReviewPersonMath(r, { partsRate: 5, costLineTags: [fuelTag, permitsTag] })
    const by = Object.fromEntries(m.lines.map((l) => [l.key, l.usd]))
    expect(by.parts).toBe(-(3000 - 620))
    expect(by['tag:t-fuel']).toBe(-500)
    expect(by['tag:t-gov']).toBe(-120)
    expect(by.labor).toBe(-3000)
    expect(m.lines.find((l) => l.key === 'tag:t-fuel')?.label).toBe('− ⛽ Fuel & gas')
  })
})
