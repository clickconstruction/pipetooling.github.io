import { describe, expect, it } from 'vitest'
import { buildBuildPace, parseReportPct, type BuildJob } from './buildPace'

const job = (id: string, revenueUsd: number | null, pctComplete: number | null, createdYmd: string | null = '2026-07-01', status = 'working'): BuildJob => ({ id, label: id, hcpNumber: '', jobName: id, revenueUsd, pctComplete, status, createdYmd })

describe('buildBuildPace', () => {
  it('reads the report percent from the answer’s leading number', () => {
    expect(parseReportPct('60% done')).toBe(60)
    expect(parseReportPct(' 100 ')).toBe(100)
    expect(parseReportPct('140')).toBe(100)
    expect(parseReportPct('about half')).toBeNull()
    expect(parseReportPct(null)).toBeNull()
  })

  it('builds per week from percent deltas times contract, from the baseline before the window', () => {
    const a = job('a', 100_000, 70)
    const b = job('b', 50_000, null, '2026-09-20')
    const pace = buildBuildPace({
      windowStart: '2026-08-16',
      todayYmd: '2026-10-10',
      openJobs: [a, b],
      jobsByPoint: new Map([
        ['a', a],
        ['b', b],
      ]),
      points: [
        { jobId: 'a', atYmd: '2026-08-01', pct: 20, source: 'hand' },
        { jobId: 'a', atYmd: '2026-08-20', pct: 40, source: 'report' },
        { jobId: 'a', atYmd: '2026-08-20', pct: 40, source: 'hand' },
        { jobId: 'a', atYmd: '2026-09-15', pct: 70, source: 'hand' },
        { jobId: 'b', atYmd: '2026-09-22', pct: 30, source: 'report' },
      ],
      createdInWindow: [{ id: 'b', revenueUsd: 50_000 }],
    })
    // a: 20 → 40 (+$20k, week of Aug 16), 40 → 70 (+$30k, week of Sep 13); b: created in window, 0 → 30 (+$15k, week of Sep 20)
    expect(pace.builtUsd).toBe(65_000)
    expect(pace.builtByWeek.get('2026-08-16')).toBe(20_000)
    expect(pace.builtByWeek.get('2026-09-13')).toBe(30_000)
    expect(pace.builtByWeek.get('2026-09-20')).toBe(15_000)
    expect(pace.weeks).toBeCloseTo(55 / 7, 5)
    expect(pace.builtPerWeekUsd).toBeCloseTo(65_000 / (55 / 7), 3)
    expect(pace.soldUsd).toBe(50_000)
    expect(pace.soldJobs).toBe(1)
  })

  it('a job with no point before the window and created before it starts from its first point', () => {
    const a = job('a', 100_000, 50)
    const pace = buildBuildPace({ windowStart: '2026-08-16', todayYmd: '2026-10-10', openJobs: [a], jobsByPoint: new Map([['a', a]]), points: [{ jobId: 'a', atYmd: '2026-09-01', pct: 40, source: 'hand' }, { jobId: 'a', atYmd: '2026-09-29', pct: 50, source: 'hand' }], createdInWindow: [] })
    expect(pace.builtUsd).toBe(10_000)
  })

  it('reads the pile: known percents, half for the jobs with none, and counts the unpriced', () => {
    const pace = buildBuildPace({
      windowStart: '2026-08-16',
      todayYmd: '2026-10-10',
      openJobs: [job('a', 100_000, 70), job('b', 50_000, null), job('c', null, 20), job('d', 0, null), job('e', 200_000, 0)],
      jobsByPoint: new Map(),
      points: [],
      createdInWindow: [],
    })
    expect(pace.pile).toEqual({ knownUsd: 230_000, knownJobs: 2, guessUsd: 25_000, guessJobs: 1, noPriceJobs: 2, openJobs: 5 })
    expect(pace.stageInput).toEqual({ pileUsd: 230_000, pileCount: 2, inPerWeekUsd: 0, outPerWeekUsd: 0, knownJobs: 2, guessUsd: 25_000, guessJobs: 1 })
  })
})
