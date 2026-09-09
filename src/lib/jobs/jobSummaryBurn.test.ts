import { describe, expect, it } from 'vitest'
import { buildPipelineBurnAlert, burnProjectedMarginForSort, projectJobSummaryBurn } from './jobSummaryBurn'

const heron = { contractUsd: 48700, spentUsd: 19860, pct: 62, finished: false, fieldDays: 20, overheadUsd: 1590, targetMarginPct: 40 }

describe('projectJobSummaryBurn', () => {
  it('the worked example: 68% of a 40%-target budget at 62% done is hot, with the overhead only in the true margin', () => {
    const b = projectJobSummaryBurn(heron)
    expect(b.budget).toMatchObject({ usd: 29220, source: 'target_margin', targetMarginPct: 40 })
    expect(b.targetMarginUsd).toBeCloseTo(19480, 5)
    expect(b.spentPct).toBeCloseTo(67.97, 1)
    expect(b.leadPts).toBeCloseTo(5.97, 1)
    expect(b.status).toBe('hot')
    expect(b.eacUsd).toBeCloseTo(32032.26, 1)
    expect(b.projectedMarginUsd).toBeCloseTo(16667.74, 1)
    expect(b.projectedMarginPct).toBeCloseTo(34.2, 1)
    // overhead: 1,590 so far over 20 field days = 79.5/day; 62% in 20 days → 38% needs 12.26 days → +974.5
    expect(b.projectedOverheadUsd).toBeCloseTo(1590 + 79.5 * (38 / 3.1), 1)
    expect(b.projectedTrueMarginUsd).toBeCloseTo(16667.74 - 1590 - 79.5 * (38 / 3.1), 1)
  })

  it('reads ok when progress keeps up, early under 3 field days or 10 %, and no_budget without a price', () => {
    expect(projectJobSummaryBurn({ ...heron, pct: 75 }).status).toBe('ok')
    expect(projectJobSummaryBurn({ ...heron, fieldDays: 2 }).status).toBe('early')
    expect(projectJobSummaryBurn({ ...heron, pct: 8 }).status).toBe('early')
    expect(projectJobSummaryBurn({ ...heron, pct: null }).status).toBe('early')
    // Unknown field days (no ledger yet): the 3-day rule is skipped, the % rule still applies.
    expect(projectJobSummaryBurn({ ...heron, fieldDays: null }).status).toBe('hot')
    expect(projectJobSummaryBurn({ ...heron, fieldDays: null }).projectedTrueMarginUsd).toBeNull()
    const nb = projectJobSummaryBurn({ ...heron, contractUsd: 0 })
    expect(nb.status).toBe('no_budget')
    expect(nb.eacUsd).toBeNull()
  })

  it('a finished job is done: the projection is what happened', () => {
    const b = projectJobSummaryBurn({ ...heron, pct: 100, finished: true, spentUsd: 31008, contractUsd: 33500, overheadUsd: 3874 })
    expect(b.status).toBe('done')
    expect(b.eacUsd).toBe(31008)
    expect(b.projectedMarginUsd).toBeCloseTo(2492, 5)
    expect(b.projectedTrueMarginUsd).toBeCloseTo(2492 - 3874, 5)
    expect(b.projectedTrueMarginPct).toBeLessThan(0)
  })

  it('falls back to the 35 % default when the Target chip is off', () => {
    expect(projectJobSummaryBurn({ ...heron, targetMarginPct: 0 }).budget).toMatchObject({ usd: 48700 * 0.65, targetMarginPct: 35 })
  })

  it('sorts on the true margin when known, else the direct margin', () => {
    expect(burnProjectedMarginForSort(projectJobSummaryBurn(heron))).toBeCloseTo(projectJobSummaryBurn(heron).projectedTrueMarginUsd!, 5)
    expect(burnProjectedMarginForSort(projectJobSummaryBurn({ ...heron, overheadUsd: null }))).toBeCloseTo(16667.74, 1)
    expect(burnProjectedMarginForSort(null)).toBeNull()
  })
})

describe('buildPipelineBurnAlert', () => {
  it('collects hot unfinished jobs, sums the shortfall against the target margin, worst three first', () => {
    const rows = [
      { jobId: 'a', label: 'J927 Mike Holub', burn: projectJobSummaryBurn({ contractUsd: 12400, spentUsd: 9880, pct: 70, finished: false, fieldDays: 8, overheadUsd: null, targetMarginPct: 40 }) },
      { jobId: 'b', label: 'J931 Heron', burn: projectJobSummaryBurn(heron) },
      { jobId: 'c', label: 'J650 done', burn: projectJobSummaryBurn({ ...heron, pct: 100, finished: true }) },
      { jobId: 'd', label: 'J1007 fine', burn: projectJobSummaryBurn({ ...heron, pct: 80 }) },
      { jobId: 'e', label: 'no burn', burn: null },
    ]
    const alert = buildPipelineBurnAlert(rows)!
    expect(alert.count).toBe(2)
    expect(alert.worst.map((w) => w.jobId)).toEqual(['a', 'b'])
    // J927: target margin 4,960; projected margin 12,400 − 9,880/0.7 = −1,714 → shortfall 6,674
    expect(alert.worst[0]).toMatchObject({ spentPct: expect.closeTo(132.8, 0), pct: 70 })
    expect(alert.worst[0]!.atRiskUsd).toBeCloseTo(4960 + 1714.29, 0)
    expect(alert.marginAtRiskUsd).toBeCloseTo(alert.worst[0]!.atRiskUsd + alert.worst[1]!.atRiskUsd, 5)
  })
  it('is null when nothing is hot', () => {
    expect(buildPipelineBurnAlert([{ jobId: 'd', label: 'fine', burn: projectJobSummaryBurn({ ...heron, pct: 80 }) }])).toBeNull()
    expect(buildPipelineBurnAlert([])).toBeNull()
  })
})
