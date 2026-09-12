import { describe, expect, it } from 'vitest'
import { baselineReadWords, buildCostsVerdict, pctDoneWords, timeLeftWords } from './jobCostsVerdict'
import type { JobBurnModel } from './jobBurn'
import type { ResolvedJobBudget } from './jobBudget'

// Mission Hills J523 on 2026-09-12, as the live tab read it.
const burn: JobBurnModel = {
  status: 'hot', spentUsd: 80_600, undatedUsd: 0, percentDone: 77, percentSource: 'report',
  budget: { usd: 80_340, source: 'target_margin', targetMarginPct: 35 } as JobBurnModel['budget'],
  spentPctOfBudget: 100.3, leadPts: 23.3, fieldDays: 70, burnPerFieldDayUsd: 944,
  eacUsd: 104_675, marginUsd: 18_925, marginPct: 15.3, budgetRemainingUsd: -260, budgetGoneInFieldDays: null, budgetGoneYmd: null,
  progressPerFieldDay: 1.1, workLeftFieldDays: 21.8,
  overhead: { shareToDateUsd: 7_898, perFieldDayUsd: 149, projectedRemainingUsd: 3_245, trueMarginUsd: 7_782, trueMarginPct: 6.3 },
  daily: [], cumulative: [],
}
const assumed: ResolvedJobBudget = { source: 'assumed', glyph: '≈', directUsd: 80_340, components: null, completeness: null, targetMarginPct: 35, bidId: 'b66', takenAt: null, takenBy: null, note: null, partial: null }
const spend = { teamUsd: 32_814, subUsd: 1_409, partsUsd: 46_376, totalUsd: 80_599 }
const base = { burn, priceUsd: 123_600, spend, teamHours: 959, teamPeople: 13, resolved: assumed, bidLabel: '66', latestReportYmd: '2026-09-04', jobPct: 90, todayYmd: '2026-09-12' }

describe('buildCostsVerdict', () => {
  const v = buildCostsVerdict(base)
  it('leads with true margin, spent off price, earned off price, and time left', () => {
    expect(v.trueMargin).toEqual({ usd: 7_782, pct: 6.3 })
    expect(v.directMargin).toEqual({ usd: 18_925, pct: 15.3 })
    expect(v.spent.usd).toBe(80_600)
    expect(v.spent.pctOfPrice).toBeCloseTo(65.2, 1)
    expect(v.earned!.usd).toBeCloseTo(95_172, 0)
    expect(v.earned!.aheadUsd).toBeCloseTo(14_572, 0)
    expect(v.trueMarginSoFar!.usd).toBeCloseTo(95_172 - 80_600 - 7_898, 0)
    expect(v.pctReport).toEqual({ ymd: '2026-09-04', ageDays: 8 })
    expect(v.pctJob).toBe(90)
    expect(pctDoneWords(v, (d) => d.slice(5))).toBe('77% done per the 09-04 report (8 days old) · the job says 90%')
    expect(pctDoneWords({ ...v, pctJob: null }, (d) => d.slice(5))).toBe('77% done per the 09-04 report (8 days old)')
    expect(timeLeftWords(v.timeLeft, (n) => `$${Math.round(n)}`)).toEqual({ big: '≈ 21.8 working days', sub: '1.1% of the work a day · spending $944 a field day' })
  })
  it('builds the sections at pace and says the bid carried nothing — never "assumed" per row', () => {
    const labor = v.sections.find((s) => s.key === 'labor')!
    expect(labor).toMatchObject({ spentUsd: 32_814, hours: 959, budgetUsd: null, budgetHours: null, budgetWords: 'no hours on B66', pctOfBudget: null })
    expect(labor.atCompletionUsd).toBeCloseTo(32_814 / 0.77, 0)
    expect(v.sections.find((s) => s.key === 'materials')!.budgetWords).toBe('no materials on B66')
    expect(v.sections.find((s) => s.key === 'other')!.atCompletionUsd).toBe(0)
    expect(v.budgetLabel).toBe('no figures on B66')
    const emptySnap = buildCostsVerdict({ ...base, resolved: { ...assumed, source: 'bid', glyph: '◆', components: { laborHours: 0, laborRate: null, laborUsd: 0, materialsUsd: 0, subsUsd: 0, otherUsd: 0 } } })
    expect(emptySnap.budgetLabel).toBe('no figures on B66') // a snapshot with nothing on it is no footing
    expect(emptySnap.baseline.kind).toBe('none')
    expect(v.assumedDirectUsd).toBe(80_340)
  })
  it('the baseline the job is producing', () => {
    expect(v.baseline).toMatchObject({ kind: 'none', bidLabel: 'B66', teamHours: 959, people: 13, materialsUsd: 46_376, bidHours: null, read: null })
    expect(v.baseline.hoursPerThousand).toBeCloseTo(7.76, 2)
    expect(v.baseline.avgWageUsd).toBeCloseTo(34.2, 1)
    expect(v.baseline.materialsPctOfPrice).toBeCloseTo(37.5, 1)
    expect(baselineReadWords(v.baseline, 77)).toBe('')
  })
  it('a costed bid fills the budget column and reads the hours against the work done', () => {
    const costed: ResolvedJobBudget = { ...assumed, source: 'bid', glyph: '◆', directUsd: 689, components: { laborHours: 36, laborRate: null, laborUsd: 0, materialsUsd: 0, subsUsd: 0, otherUsd: 0 }, targetMarginPct: null, partial: { labor: true, materials: false, subs: false } }
    const w = buildCostsVerdict({ ...base, burn: { ...burn, percentDone: 50 }, priceUsd: 41_550, spend: { teamUsd: 200, subUsd: 0, partsUsd: 920, totalUsd: 1_120 }, teamHours: 6, teamPeople: 2, resolved: costed, bidLabel: '76' })
    const labor = w.sections.find((s) => s.key === 'labor')!
    expect(labor).toMatchObject({ budgetHours: 36, budgetUsd: null, budgetWords: '◆ B76' })
    expect(w.sections.find((s) => s.key === 'materials')!.budgetWords).toBe('no materials on B76')
    expect(w.budgetLabel).toBe('◆ from B76')
    expect(w.baseline).toMatchObject({ kind: 'bid', bidHours: 36, read: 'under' })
    expect(w.baseline.hoursShare).toBeCloseTo(6 / 36, 6)
    expect(baselineReadWords(w.baseline, 50)).toBe("17% of the bid's hours at 50% done · the book was heavy here")
  })
  it('words the edges: done, early, idle, no bid', () => {
    expect(timeLeftWords({ ...burn, workLeftFieldDays: 0, early: false, idle: false, fieldDays: 12, progressPerFieldDay: 2, burnPerFieldDayUsd: 10 } as never, (n) => `$${n}`)).toEqual({ big: 'done', sub: 'the job reads 100%' })
    expect(timeLeftWords({ workLeftFieldDays: null, progressPerFieldDay: null, burnPerFieldDayUsd: null, fieldDays: 2, early: true, idle: false }, (n) => `$${n}`).sub).toBe('too early to call · 2 field days')
    expect(timeLeftWords({ workLeftFieldDays: 5, progressPerFieldDay: 4, burnPerFieldDayUsd: null, fieldDays: 20, early: false, idle: true }, (n) => `$${n}`).sub).toBe('4% of the work a day · idle 30+ days')
    const noBid = buildCostsVerdict({ ...base, bidLabel: null, resolved: { ...assumed, bidId: null } })
    expect(noBid.budgetLabel).toBe('no bid linked')
    expect(noBid.sections[0]!.budgetWords).toBe('—')
    expect(noBid.baseline.bidLabel).toBeNull()
    expect(pctDoneWords({ pctDone: null, pctSource: null, pctReport: null, pctJob: null, finished: false }, (d) => d)).toBe('no % complete yet')
    expect(pctDoneWords({ pctDone: null, pctSource: null, pctReport: null, pctJob: null, finished: true }, (d) => d)).toBe('billed · no % recorded')
    expect(pctDoneWords({ pctDone: 100, pctSource: 'job', pctReport: null, pctJob: null, finished: true }, (d) => d)).toBe('100% done (billed)')
    expect(pctDoneWords({ pctDone: 40, pctSource: 'job', pctReport: null, pctJob: null, finished: false }, (d) => d)).toBe('40% done (set on the job)')
  })
})
