import { describe, expect, it } from 'vitest'
import { baselineFrozenWords, baselineHeadWords, baselineReadWords, baselineScoreWords, buildCostsVerdict, pctDoneWords, timeLeftWords } from './jobCostsVerdict'
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
  it('the read waits: no hour in is nothing to judge, and hours with no percent judge only a bid run past (the walks\' slip 6)', () => {
    const costed: ResolvedJobBudget = { ...assumed, source: 'bid', glyph: '◆', directUsd: 3_000, components: { laborHours: 70, laborRate: null, laborUsd: 0, materialsUsd: 0, subsUsd: 0, otherUsd: 0 }, targetMarginPct: null, partial: { labor: true, materials: false, subs: false } }
    const noSpend = { teamUsd: 0, subUsd: 0, partsUsd: 0, totalUsd: 0 }
    // Before any hour, at 25% done: the strip used to read "0% of the bid's hours at 25% done · the book was heavy here".
    const fresh = buildCostsVerdict({ ...base, burn: { ...burn, percentDone: 25 }, spend: noSpend, teamHours: 0, teamPeople: 0, resolved: costed, bidLabel: '398' })
    expect(fresh.baseline).toMatchObject({ kind: 'bid', bidHours: 70, hoursShare: 0, read: null })
    expect(baselineReadWords(fresh.baseline, 25)).toBe('no hours in yet · the read waits on the first clocked hour')
    // The book baseline read the same before any hour.
    const book = buildCostsVerdict({ ...base, burn: { ...burn, percentDone: 25 }, spend: noSpend, teamHours: 0, teamPeople: 0, bidLabel: null, resolved: { ...costed, source: 'book', glyph: '≈' } })
    expect(book.baseline.kind).toBe('book')
    expect(baselineReadWords(book.baseline, 25)).toBe('no hours in yet · the read waits on the first clocked hour')
    // Hours in and no percent: nothing to judge against until the hours pass the whole bid.
    const noPct = buildCostsVerdict({ ...base, burn: { ...burn, percentDone: null }, teamHours: 7, teamPeople: 1, resolved: costed, bidLabel: '398', latestReportYmd: null, jobPct: null })
    expect(noPct.baseline.read).toBeNull()
    expect(baselineReadWords(noPct.baseline, null)).toBe("10% of the bid's hours · set a percent to read it against the work")
    const over = buildCostsVerdict({ ...base, burn: { ...burn, percentDone: null }, teamHours: 90, teamPeople: 2, resolved: costed, bidLabel: '398', latestReportYmd: null, jobPct: null })
    expect(over.baseline.read).toBe('over')
    expect(baselineReadWords(over.baseline, null)).toBe("129% of the bid's hours · the book was light here")
  })
  it('a book baseline at award reads as a guess with what it was computed from (punch list #234 PR 1a)', () => {
    const book: ResolvedJobBudget = { ...assumed, source: 'book', glyph: '≈', directUsd: 21_168, components: { laborHours: 470.4, laborRate: 45, laborUsd: 21_168, materialsUsd: 0, subsUsd: 0, otherUsd: 0 }, targetMarginPct: null, takenAt: '2026-11-01T15:00:00Z', takenBy: 'u1', partial: { labor: true, materials: false, subs: false } }
    const row = { kind: 'book', labor_hours: 470.4, labor_usd: 21_168, materials_usd: 0, subs_usd: 0, other_usd: 0, total_direct_usd: 21_168, completeness: { usable: false, book: { hours_per_thousand: 4.2, n: 12, price_usd: 112_000, scope: 'similar' } }, awarded_at: '2026-11-01T15:00:00Z', awarded_by: 'u1', awarded_kind: 'book', awarded_labor_hours: 470.4, awarded_labor_usd: 21_168, awarded_materials_usd: 0, awarded_total_direct_usd: 21_168, awarded_detail: {} }
    const w = buildCostsVerdict({ ...base, burn: { ...burn, percentDone: 50 }, priceUsd: 112_000, teamHours: 212, resolved: book, bidLabel: '917', budgetRow: row })
    expect(w.baseline).toMatchObject({ kind: 'book', bidHours: 470.4, read: 'near', book: { hoursPerThousand: 4.2, n: 12, priceUsd: 112_000, scope: 'similar' } })
    expect(w.baseline.award).toMatchObject({ kind: 'book', laborHours: 470.4, at: '2026-11-01T15:00:00Z' })
    expect(w.budgetLabel).toBe('≈ from the book')
    expect(w.sections.find((s) => s.key === 'labor')!.budgetWords).toBe('≈ the book')
    expect(baselineHeadWords(w.baseline)).toBe('≈ Baseline assumed from the book at award · 470 h')
    expect(baselineFrozenWords(w.baseline, (iso) => iso.slice(0, 10))).toBe('Frozen 2026-11-01 · 4.2 h per $1k × $112,000 · 12 similar projects · a guess, read as one')
    // The plan frozen beside it (PR 2) closes the line.
    const planned = buildCostsVerdict({ ...base, burn: { ...burn, percentDone: 50 }, priceUsd: 112_000, teamHours: 212, resolved: book, bidLabel: '917', budgetRow: { ...row, planned_finish: '2026-12-02', planned_source: 'assumed', planned_start: '2026-11-01', planned_detail: { working_days: 20, crew_hours_per_day: 24 } } })
    expect(planned.baseline.planned).toMatchObject({ finishYmd: '2026-12-02', source: 'assumed', startYmd: '2026-11-01' })
    expect(baselineFrozenWords(planned.baseline, (iso) => iso.slice(0, 10))).toBe('Frozen 2026-11-01 · 4.2 h per $1k × $112,000 · 12 similar projects · a guess, read as one · planned finish Dec 2, assumed (20 working days at 24 h a day)')
    expect(baselineReadWords(w.baseline, 50)).toBe("45% of the baseline's hours at 50% done · on the baseline")
    expect(baselineScoreWords(w.baseline)).toBe("The superintendent's line draws grey. The score skips this job until a bid or typed baseline replaces it.")
  })
  it('a typed baseline names its note and the book beside it; one taken after the award says what the award keeps', () => {
    const typed: ResolvedJobBudget = { ...assumed, source: 'typed', glyph: '✎', directUsd: 9_900, components: { laborHours: 220, laborRate: 45, laborUsd: 9_900, materialsUsd: 0, subsUsd: 0, otherUsd: 0 }, targetMarginPct: null, takenAt: '2026-10-20T15:00:00Z', takenBy: 'me', note: 'Repeat of the Lakeside building, same crew', partial: { labor: true, materials: false, subs: false } }
    const awardedTyped = { kind: 'typed', labor_hours: 220, labor_usd: 9_900, materials_usd: 0, subs_usd: 0, other_usd: 0, total_direct_usd: 9_900, awarded_at: '2026-10-20T15:00:00Z', awarded_kind: 'typed', awarded_labor_hours: 220, awarded_labor_usd: 9_900 }
    const w = buildCostsVerdict({ ...base, resolved: typed, budgetRow: awardedTyped })
    expect(w.baseline.kind).toBe('typed')
    expect(baselineHeadWords(w.baseline, 'me')).toBe('✎ Baseline typed at award by you · 220 h')
    expect(baselineFrozenWords(w.baseline, (iso) => iso.slice(0, 10), 262)).toBe('Frozen 2026-10-20 · "Repeat of the Lakeside building, same crew" · the book says 262 h')
    expect(baselineScoreWords(w.baseline)).toBe('Scores like a bid baseline. The name on it is the point.')
    // Refresh from bid after a book award: the live row is the bid's, the award stays the book's.
    const bidNow: ResolvedJobBudget = { ...typed, source: 'bid', glyph: '◆', note: null, takenAt: '2026-11-05T15:00:00Z' }
    const refreshed = buildCostsVerdict({ ...base, resolved: bidNow, bidLabel: '917', budgetRow: { ...awardedTyped, kind: 'bid', awarded_kind: 'book', awarded_labor_hours: 470 } })
    expect(baselineHeadWords(refreshed.baseline)).toBe('◆ Baseline from B917 · 220 h')
    expect(baselineFrozenWords(refreshed.baseline, (iso) => iso.slice(0, 10))).toBe("Taken 2026-11-05 · awarded on the book's 470 h, the score keeps that")
    // No row at all: no head, no frozen line.
    expect(baselineHeadWords(v.baseline)).toBe('')
    expect(baselineFrozenWords(v.baseline, (iso) => iso)).toBe('')
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

describe('v2.5043 · the margin the bid was priced at, beside the direct margin at completion', () => {
  const stamp = { pct: 31.42, revenueUsd: 123_600, costUsd: 84_765, uncostedUsd: 0, rateSet: true, bidVersionId: null, at: '2026-08-01T15:00:00Z' }
  it('says the priced margin and how far the job runs from it, in whole points', () => {
    // direct at completion 15.3% vs priced 31%: 15 − 31 = 16 points under
    expect(buildCostsVerdict({ ...base, priced: stamp }).priced).toEqual({ pctWords: '31%', vsWords: '16 pts under the price', partialWords: [] })
  })
  it('a stamp that reads high says why; no projection yet means no comparison', () => {
    const early = buildCostsVerdict({ ...base, burn: { ...burn, marginUsd: null, marginPct: null }, priced: { ...stamp, rateSet: false, uncostedUsd: 1_200 } })
    expect(early.priced).toEqual({ pctWords: '31%', vsWords: null, partialWords: ['no labor rate', '$1,200 on rows with no cost'] })
  })
  it('no stamp, no line', () => {
    expect(buildCostsVerdict(base).priced).toBeNull()
    expect(buildCostsVerdict({ ...base, priced: null }).priced).toBeNull()
  })
})
