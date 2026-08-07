import { describe, expect, it } from 'vitest'
import {
  buildWeeklyMoneyReportHtml,
  buildWeeklyMoneyRow,
  buildWeeklyMoneyView,
  formatWeeklyMoneySigned,
  weeklyMoneyJobDisplay,
  weeklyMoneyNetForLens,
  type WeeklyMoneyPayload,
  type WeeklyMoneyPayloadJob,
} from './weeklyMoneyMovement'

const job = (over: Partial<WeeklyMoneyPayloadJob>): WeeklyMoneyPayloadJob => ({
  job_id: 'j1',
  hcp_number: '523',
  click_number: null,
  job_name: 'Mission Hills',
  job_address: '2100 Independence Dr',
  status: 'working',
  revenue: 123600,
  labor_hours: 0,
  labor_cost: 0,
  sub_cost: 0,
  mercury_cost: 0,
  supply_cost: 0,
  tally_cost: 0,
  other_cost: 0,
  payments_in: 0,
  pct_start: null,
  pct_end: null,
  ...over,
})

const payload = (jobs: WeeklyMoneyPayloadJob[], overhead?: Partial<WeeklyMoneyPayload['overhead']>): WeeklyMoneyPayload => ({
  week_monday: '2026-08-03',
  week_end: '2026-08-09',
  office_job_id: null,
  jobs,
  overhead: {
    office_labor_hours: 0,
    office_labor_cost: 0,
    office_job_charges: 0,
    bid_labor_hours: 0,
    bid_labor_cost: 0,
    ...overhead,
  },
})

describe('weeklyMoneyJobDisplay', () => {
  it('prefers HCP over Click and falls back cleanly', () => {
    expect(weeklyMoneyJobDisplay({ hcp_number: '523', click_number: 'C9', job_name: 'A' })).toBe('523 · A')
    expect(weeklyMoneyJobDisplay({ hcp_number: ' ', click_number: 'C9', job_name: 'A' })).toBe('C9 · A')
    expect(weeklyMoneyJobDisplay({ hcp_number: null, click_number: null, job_name: null })).toBe('Unnamed job')
  })
})

describe('buildWeeklyMoneyRow', () => {
  it('computes value created from Δ% × revenue (reconciliation: pct convention)', () => {
    const r = buildWeeklyMoneyRow(job({ pct_start: 42, pct_end: 55, labor_cost: 9420 }))
    expect(r.pctDelta).toBe(13)
    expect(r.valueCreated).toBeCloseTo(16068, 5)
    expect(r.earnedNet).toBeCloseTo(16068 - 9420, 5)
  })

  it('treats a first-ever REAL % as starting from 0', () => {
    const r = buildWeeklyMoneyRow(job({ pct_start: null, pct_end: 35, pct_end_source: 'manual', revenue: 1850 }))
    expect(r.pctDelta).toBe(35)
    expect(r.valueCreated).toBeCloseTo(647.5, 5)
  })

  it('bootstrap rule: a seed-only end with no start anchor is NOT movement', () => {
    const r = buildWeeklyMoneyRow(job({ pct_start: null, pct_end: 60, pct_end_source: 'seed', labor_cost: 500 }))
    expect(r.pctDelta).toBeNull()
    expect(r.valueCreated).toBeNull()
    expect(r.flagNoPctSignal).toBe(true)
    // Once a start-of-week anchor exists, a seed-sourced end is a fine endpoint.
    const later = buildWeeklyMoneyRow(job({ pct_start: 40, pct_end: 60, pct_end_source: 'seed' }))
    expect(later.pctDelta).toBe(20)
  })

  it('never assumes a % when there is no end signal — flags instead', () => {
    const r = buildWeeklyMoneyRow(job({ pct_start: 25, pct_end: null, labor_cost: 240 }))
    expect(r.pctDelta).toBeNull()
    expect(r.valueCreated).toBeNull()
    expect(r.earnedNet).toBeNull()
    expect(r.flagNoPctSignal).toBe(true)
  })

  it('flags spend with zero progress and missing job totals', () => {
    const stuck = buildWeeklyMoneyRow(job({ pct_start: 25, pct_end: 25, labor_cost: 4930 }))
    expect(stuck.flagSpendNoProgress).toBe(true)
    const noTotal = buildWeeklyMoneyRow(job({ revenue: 0, labor_cost: 240, pct_start: 10, pct_end: 20 }))
    expect(noTotal.flagNoJobTotal).toBe(true)
    expect(noTotal.valueCreated).toBeNull()
  })

  it('sums material sources into one bucket and cash net is always computable', () => {
    const r = buildWeeklyMoneyRow(
      job({ mercury_cost: 100, supply_cost: 200, tally_cost: 50, other_cost: 25, payments_in: 500, labor_cost: 100 }),
    )
    expect(r.outMaterials).toBe(375)
    expect(r.moneyOut).toBe(475)
    expect(r.cashNet).toBe(25)
  })
})

describe('buildWeeklyMoneyView', () => {
  it('buckets made/lost by lens, unknown nets sink to the lost bottom', () => {
    const p = payload([
      job({ job_id: 'a', job_name: 'Winner', pct_start: 40, pct_end: 50, labor_cost: 1000 }), // earned +11,360
      job({ job_id: 'b', job_name: 'Loser', pct_start: 50, pct_end: 50, labor_cost: 2000 }), // earned −2,000
      job({ job_id: 'c', job_name: 'Mystery', revenue: null, labor_cost: 300 }), // earned null
    ])
    const v = buildWeeklyMoneyView(p, 'earned')
    expect(v.made.map((r) => r.jobId)).toEqual(['a'])
    expect(v.lost.map((r) => r.jobId)).toEqual(['b', 'c'])
  })

  it('cash lens reshuffles: collected-but-stalled jobs make money in cash terms', () => {
    const p = payload([job({ job_id: 'b', pct_start: 25, pct_end: 25, labor_cost: 4930, payments_in: 5000 })])
    expect(buildWeeklyMoneyView(p, 'earned').lost).toHaveLength(1)
    expect(buildWeeklyMoneyView(p, 'cash').made).toHaveLength(1)
  })

  it('KPIs include overhead in money out and earned net (invariant #4: nothing dropped)', () => {
    const p = payload(
      [job({ pct_start: 0, pct_end: 10, labor_cost: 1000, payments_in: 2000 })],
      { office_labor_cost: 500, office_job_charges: 100, bid_labor_cost: 250 },
    )
    const v = buildWeeklyMoneyView(p, 'earned')
    expect(v.kpis.moneyOut).toBe(1850)
    expect(v.kpis.moneyIn).toBe(2000)
    expect(v.kpis.netCash).toBe(150)
    expect(v.kpis.valueCreated).toBeCloseTo(12360, 5)
    expect(v.kpis.earnedNet).toBeCloseTo(12360 - 1850, 5)
  })

  it('drops zero-movement rows (payload jobs with no in-week money)', () => {
    const v = buildWeeklyMoneyView(payload([job({ pct_start: 1, pct_end: 2 })]), 'earned')
    expect(v.rows).toHaveLength(0)
  })
})

describe('print + formatting', () => {
  it('signed formatter uses a true minus and two decimals', () => {
    expect(formatWeeklyMoneySigned(-4930)).toBe('−$4,930.00')
    expect(formatWeeklyMoneySigned(6648.5)).toBe('+$6,648.50')
  })

  it('print HTML carries sections, lens label, and escapes job names', () => {
    const p = payload([
      job({ job_id: 'a', job_name: 'A <script> co', pct_start: 40, pct_end: 50, labor_cost: 1000 }),
    ])
    const html = buildWeeklyMoneyReportHtml(buildWeeklyMoneyView(p, 'earned'), 'Aug 3 – 9', 'earned')
    expect(html).toContain('Made money this week')
    expect(html).toContain('Earned lens')
    expect(html).toContain('A &lt;script&gt; co')
    expect(html).not.toContain('<script> co')
  })

  it('net for lens helper returns the right field', () => {
    const r = buildWeeklyMoneyRow(job({ pct_start: 0, pct_end: 10, labor_cost: 100, payments_in: 50 }))
    expect(weeklyMoneyNetForLens(r, 'earned')).toBe(r.earnedNet)
    expect(weeklyMoneyNetForLens(r, 'cash')).toBe(r.cashNet)
  })
})
