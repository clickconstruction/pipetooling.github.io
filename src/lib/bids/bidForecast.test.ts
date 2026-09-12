import { describe, expect, it } from 'vitest'
import {
  FORECAST_MATURITY_DAYS,
  cohortsByMonth,
  daysBetween,
  decisionTimes,
  forecastByEstimator,
  forecastOpen,
  forecastRows,
  monthLabel,
  oddsBySize,
  oddsForPerson,
  oddsWords,
  openAgeBuckets,
  sizeBandOf,
} from './bidForecast'
import type { PursuitRow } from './bidPursuit'

const TODAY = '2026-09-11'
let n = 0
const row = (o: Partial<PursuitRow> & { outcome: PursuitRow['outcome']; dateYmd: string }): PursuitRow => ({
  bidId: `b${++n}`, label: `B${n}`, projectName: `P${n}`, bidNumber: String(n), estimatorName: null, gcName: null, robot: false, sentYmd: o.dateYmd, outcomeAtYmd: null,
  hours: 0, laborUsd: 0, cardUsd: 0, materialsUsd: 0, totalUsd: 0, bidValue: null, usdPerThousandBid: null, people: [], ...o,
})

// A small world shaped like prod: mature months with decided bids in every size band, young months mostly open, one stale open, one robot, one unsent.
const W = 'William', D = 'Wendi'
const rows: PursuitRow[] = [
  // mature (sent ≥ 120 days ago)
  row({ outcome: 'won', dateYmd: '2025-09-05', bidValue: 20_000, estimatorName: W }),
  row({ outcome: 'won', dateYmd: '2025-09-12', bidValue: 30_000, estimatorName: W }),
  row({ outcome: 'lost', dateYmd: '2025-09-20', bidValue: 40_000, estimatorName: W }),
  row({ outcome: 'lost', dateYmd: '2025-11-02', bidValue: 300_000, estimatorName: W }),
  row({ outcome: 'won', dateYmd: '2025-11-15', bidValue: 100_000, estimatorName: D, sentYmd: '2025-11-15', outcomeAtYmd: '2025-12-20' }),
  row({ outcome: 'lost', dateYmd: '2025-12-01', bidValue: 800_000, estimatorName: D, outcomeAtYmd: '2026-01-10' }),
  row({ outcome: 'lost', dateYmd: '2026-02-10', bidValue: 10_000, estimatorName: D }),
  row({ outcome: 'open', dateYmd: '2026-03-01', bidValue: 60_000, estimatorName: W }), // stale open (194 d)
  // deciding (sent < 120 days ago)
  row({ outcome: 'won', dateYmd: '2026-07-03', bidValue: 15_000, estimatorName: W }),
  row({ outcome: 'open', dateYmd: '2026-07-20', bidValue: 25_000, estimatorName: W }),
  row({ outcome: 'open', dateYmd: '2026-08-05', bidValue: 15_800_000, estimatorName: D }),
  row({ outcome: 'open', dateYmd: '2026-08-14', bidValue: 90_000, estimatorName: null }),
  // folded
  row({ outcome: 'open', dateYmd: '2026-08-20', bidValue: 5_000, robot: true, estimatorName: 'Twin' }),
  row({ outcome: 'unsent', dateYmd: '2026-09-01', bidValue: 9_000 }),
  row({ outcome: 'lost', dateYmd: '0002-04-09', bidValue: 163_000 }), // a mis-dated row
]

describe('rows, bands, dates', () => {
  it('reads sent bids only, folds robots, filters a person', () => {
    const all = forecastRows(rows, { showRobots: false, estimator: null })
    expect(all.map((r) => r.outcome)).not.toContain('unsent')
    expect(all.some((r) => r.robot)).toBe(false)
    expect(all).toHaveLength(13)
    expect(forecastRows(rows, { showRobots: true, estimator: null })).toHaveLength(14)
    expect(forecastRows(rows, { showRobots: false, estimator: 'Wendi' })).toHaveLength(4)
    expect(forecastRows(rows, { showRobots: false, estimator: '' }).map((r) => r.bidValue)).toEqual([90_000, 163_000])
  })
  it('bands by size, no value reads small; month labels; day math', () => {
    expect([sizeBandOf(null), sizeBandOf(49_999), sizeBandOf(50_000), sizeBandOf(499_999), sizeBandOf(500_000)]).toEqual(['small', 'small', 'mid', 'mid', 'large'])
    expect(monthLabel('2026-09')).toBe('Sep ’26')
    expect(daysBetween('2026-05-14', TODAY)).toBe(FORECAST_MATURITY_DAYS)
  })
})

describe('cohortsByMonth', () => {
  const all = forecastRows(rows, { showRobots: false, estimator: null })
  const c = cohortsByMonth(all, TODAY)
  it('one entry per month from the first sent bid to today, empty months included, mis-dated rows skipped', () => {
    expect(c[0]!.month).toBe('2025-09')
    expect(c[c.length - 1]!.month).toBe('2026-09')
    expect(c).toHaveLength(13)
    expect(c.find((m) => m.month === '2025-10')).toMatchObject({ won: 0, lost: 0, open: 0, rateByCount: null })
  })
  it('buckets by outcome, marks stale opens, rates the decided, flags deciding months', () => {
    const sep = c.find((m) => m.month === '2025-09')!
    expect(sep).toMatchObject({ won: 2, lost: 1, open: 0, wonUsd: 50_000, lostUsd: 40_000, deciding: false })
    expect(sep.rateByCount).toBeCloseTo(2 / 3, 6)
    expect(sep.rateByValue).toBeCloseTo(50 / 90, 6)
    expect(sep.bids.won).toHaveLength(2)
    expect(c.find((m) => m.month === '2026-03')).toMatchObject({ open: 0, openStale: 1, openStaleUsd: 60_000, deciding: false })
    expect(c.find((m) => m.month === '2026-07')).toMatchObject({ won: 1, open: 1, deciding: true })
    expect(c.find((m) => m.month === '2026-05')!.deciding).toBe(false) // 2026-05-01 is 133 days back
    expect(c.find((m) => m.month === '2026-06')!.deciding).toBe(true)
  })
})

describe('odds', () => {
  const all = forecastRows(rows, { showRobots: false, estimator: null })
  const everyone = oddsBySize(all, TODAY)
  it('reads mature decided bids only, band by band', () => {
    // mature decided: won 20k, 30k (small); lost 40k (small); lost 300k (mid); won 100k (mid); lost 800k (large); lost 10k (small); the 0002 row counts as mature+small+lost
    expect(everyone.bands.small).toMatchObject({ won: 2, lost: 2 })
    expect(everyone.bands.mid).toMatchObject({ won: 1, lost: 2 })
    expect(everyone.bands.large).toMatchObject({ won: 0, lost: 1, byCount: 0 })
    expect(everyone.bands.small.byCount).toBeCloseTo(0.5, 6)
    expect(everyone).toMatchObject({ won: 3, lost: 5 })
    expect(everyone.byCount).toBeCloseTo(3 / 8, 6)
    // the July win is too young to count
    expect(everyone.bands.small.bids.some((r) => r.dateYmd === '2026-07-03')).toBe(false)
  })
  it("a person with too few decided bids uses everyone's odds; with enough, their own per band", () => {
    const wendi = oddsForPerson(all.filter((r) => r.estimatorName === 'Wendi'), everyone, TODAY)
    expect(wendi).toMatchObject({ own: false, decided: 3 })
    expect(wendi.odds).toBe(everyone)
    const many = Array.from({ length: 12 }, (_, i) => row({ outcome: i < 8 ? 'won' : 'lost', dateYmd: '2025-10-01', bidValue: 20_000, estimatorName: 'Ace' }))
    const ace = oddsForPerson(many, everyone, TODAY)
    expect(ace.own).toBe(true)
    expect(ace.ownBand).toEqual({ small: true, mid: false, large: false })
    expect(ace.odds.bands.small.byCount).toBeCloseTo(8 / 12, 6)
    expect(ace.odds.bands.mid).toBe(everyone.bands.mid)
    expect(oddsWords({ ownRate: false, matureDecided: 3 })).toBe("everyone's odds · 3 decided")
    expect(oddsWords({ ownRate: true, matureDecided: 12 })).toBe('own odds')
  })
})

describe('forecastOpen', () => {
  const all = forecastRows(rows, { showRobots: false, estimator: null })
  const everyone = oddsBySize(all, TODAY)
  const f = forecastOpen(all, everyone, TODAY)
  it('counts fresh opens at the odds of their size, leaves stale opens out, names the whale', () => {
    // fresh opens: 25k (small, p .5), 15.8M (large, p 0), 90k (mid, p 1/3)
    expect(f.n).toBe(3)
    expect(f.usd).toBe(15_915_000)
    expect(f.expCount).toBeCloseTo(0.5 + 0 + 1 / 3, 6)
    expect(f.expUsd).toBeCloseTo(12_500 + 0 + 30_000, 3)
    expect(f.sd).toBeCloseTo(Math.sqrt(0.25 * 25_000 ** 2 + (1 / 3) * (2 / 3) * 90_000 ** 2), 3)
    expect(f.lowUsd).toBeGreaterThanOrEqual(0)
    expect(f.highUsd).toBeCloseTo(f.expUsd + f.sd, 6)
    expect(f.largest?.row.bidValue).toBe(15_800_000)
    expect(f.largest?.share).toBeCloseTo(15_800_000 / 15_915_000, 6)
    expect(f.largest?.p).toBe(0)
    expect(f.stale).toMatchObject({ n: 1, usd: 60_000 })
  })
  it('rolls up by estimator with a footer', () => {
    const { people, everyone: total } = forecastByEstimator(all, TODAY)
    expect(people.map((p) => p.label)).toEqual(['William', 'Wendi', 'No estimator'])
    const w = people[0]!
    expect(w).toMatchObject({ sent: 7, matureDecided: 4, ownRate: false, open: 2, fresh: 1, freshUsd: 25_000 })
    expect(w.byCount).toBeCloseTo(0.5, 6)
    expect(w.expCount).toBeCloseTo(0.5, 6) // everyone's small odds
    expect(total).toMatchObject({ label: 'Everyone', sent: 13, fresh: 3 })
    expect(total.expUsd).toBeCloseTo(f.expUsd, 6)
  })
})

describe('decision times + open ages', () => {
  const all = forecastRows(rows, { showRobots: false, estimator: null })
  it('reads sent → decided days where both dates exist, and says when there is not enough', () => {
    const d = decisionTimes(all)
    expect(d.n).toBe(2)
    expect(d.enough).toBe(false)
    expect(d.sample.map((s) => s.days).sort((a, b) => a - b)).toEqual([35, 40])
    expect(d.medianDays).toBe(40)
    expect(d.byMonth.map((m) => `${m.label} ${m.n} ${m.medianDays}`)).toEqual(['Dec ’25 1 35', 'Jan ’26 1 40'])
    expect(decisionTimes([]).medianDays).toBeNull()
  })
  it('buckets open bids by age and marks the stale ones', () => {
    const b = openAgeBuckets(all, TODAY)
    expect(b.map((x) => `${x.key}:${x.n}`)).toEqual(['0-30:1', '31-90:2', '91-180:0', '181+:1'])
    expect(b[3]).toMatchObject({ stale: true, usd: 60_000 })
  })
})
