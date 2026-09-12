import { describe, expect, it } from 'vitest'
import { bidListText, cohortDrill, filterDrillRows, rollupByEstimator, rollupByGc, sliceWords } from './bidDrill'
import { cohortsByMonth, forecastRows } from './bidForecast'
import type { PursuitRow } from './bidPursuit'

const TODAY = '2026-09-11'
let n = 0
const row = (o: Partial<PursuitRow> & { outcome: PursuitRow['outcome']; dateYmd: string }): PursuitRow => ({
  bidId: `b${++n}`, label: `B${n}`, projectName: `P${n}`, bidNumber: String(n), estimatorName: null, gcName: null, robot: false, sentYmd: o.dateYmd, outcomeAtYmd: null,
  hours: 0, laborUsd: 0, cardUsd: 0, materialsUsd: 0, totalUsd: 0, bidValue: null, usdPerThousandBid: null, people: [], ...o,
})
// December 2025 in miniature: 2 won, 4 lost (Malachi 2, nobody 2; Summit 2, Structura 1), nothing open; January: 1 stale open.
const rows = forecastRows([
  row({ outcome: 'won', dateYmd: '2025-12-05', bidValue: 100_000, estimatorName: 'Malachi', gcName: 'Knight' }),
  row({ outcome: 'won', dateYmd: '2025-12-06', bidValue: 46_000 }),
  row({ outcome: 'lost', dateYmd: '2025-12-09', bidValue: 303_200, gcName: 'R.C. Page' }),
  row({ outcome: 'lost', dateYmd: '2025-12-03', bidValue: 187_300, estimatorName: 'Malachi', gcName: 'Structura' }),
  row({ outcome: 'lost', dateYmd: '2025-12-22', bidValue: 41_500, gcName: 'Summit' }),
  row({ outcome: 'lost', dateYmd: '2025-12-15', bidValue: 144_900, estimatorName: 'Malachi', gcName: 'Summit' }),
  row({ outcome: 'open', dateYmd: '2026-01-10', bidValue: 4_000 }),
], { showRobots: false, estimator: null })
const cohorts = cohortsByMonth(rows, TODAY)
const dec = cohorts.findIndex((c) => c.month === '2025-12')

describe('cohortDrill', () => {
  it('carries the slice, the month, its slices, the share of decided value, and the neighbours', () => {
    const d = cohortDrill(cohorts, dec, 'lost')!
    expect(d).toMatchObject({ month: '2025-12', label: 'Dec ’25', bucket: 'lost', monthCount: 6, monthUsd: 822_900, prevIndex: null, nextIndex: dec + 1 })
    expect(d.rows).toHaveLength(4)
    expect(d.slices.map((s) => `${s.bucket} ${s.n}`)).toEqual(['won 2', 'lost 4', 'open 0', 'openStale 0'])
    expect(d.shareOfDecided).toBeCloseTo(676_900 / 822_900, 6)
    expect(cohortDrill(cohorts, dec, 'won')!.shareOfDecided).toBeCloseTo(146_000 / 822_900, 6)
    const jan = cohortDrill(cohorts, dec + 1, 'openStale')!
    expect(jan).toMatchObject({ month: '2026-01', shareOfDecided: null, prevIndex: dec })
    expect(jan.rows).toHaveLength(1)
    expect(cohortDrill(cohorts, 99, 'won')).toBeNull()
  })
  it('rolls the slice up by estimator and by GC, most first', () => {
    const d = cohortDrill(cohorts, dec, 'lost')!
    expect(d.byEstimator.map((r) => `${r.label} ${r.n}`)).toEqual(['No estimator 2', 'Malachi 2']) // tie on count → larger value first ($344.7k vs $332.2k)
    expect(d.byGc.map((r) => `${r.label} ${r.n}`)).toEqual(['Summit 2', 'R.C. Page 1', 'Structura 1'])
    expect(rollupByEstimator(d.rows).find((r) => r.label === 'Malachi')!.usd).toBe(187_300 + 144_900)
    expect(rollupByGc([])).toEqual([])
  })
  it('filters by a chip, words a slice, and writes the list as text', () => {
    const d = cohortDrill(cohorts, dec, 'lost')!
    expect(filterDrillRows(d.rows, { estimator: 'Malachi' })).toHaveLength(2)
    expect(filterDrillRows(d.rows, { estimator: '' })).toHaveLength(2)
    expect(filterDrillRows(d.rows, { gc: 'Summit', estimator: 'Malachi' })).toHaveLength(1)
    const fmt = (v: number) => `$${Math.round(v / 1000)}k`
    expect(sliceWords(d.slices[1]!, fmt)).toBe('Lost · 4 · $677k')
    expect(sliceWords(d.slices[2]!, fmt)).toBe('Still open · 0')
    const text = bidListText('Lost · sent Dec ’25', d.rows, fmt)
    expect(text.split('\n')[0]).toBe('Lost · sent Dec ’25 — 4 bids')
    expect(text.split('\n')[1]).toBe('B3 · R.C. Page · sent 2025-12-09 · $303k')
    expect(text.split('\n')).toHaveLength(5)
  })
})
