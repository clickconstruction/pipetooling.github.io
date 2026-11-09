import { describe, expect, it } from 'vitest'
import { awardedThisWeek, lineBudgetsReview, lineBudgetsReviewDetail, lineBudgetsReviewSettledWords, lineBudgetsReviewTitle, reviewLineWords, type ReviewFixtureSource, type ReviewJobSource } from './lineBudgetsReview'
import { DEFAULT_LINE_BUDGET_SETTINGS as S } from '../jobs/lineBudgets'

const now = '2026-11-07T18:00:00Z'
const job = (id: string, awarded: string | null, over: Partial<ReviewJobSource> = {}): ReviewJobSource => ({ id, hcp_number: '', click_number: id, job_name: `Job ${id}`, customer_name: null, revenue: 0, awarded_at: awarded, ...over })
const line = (id: string, job_id: string, name: string, price: number, over: Partial<ReviewFixtureSource> = {}): ReviewFixtureSource => ({ id, job_id, name, count: 1, line_unit_price: price, line_kind: 'work', ...over })

const jobs = [job('1042', '2026-11-05T12:00:00Z'), job('1050', '2026-11-06T12:00:00Z'), job('1031', '2026-10-20T12:00:00Z'), job('1060', null)]
const fixtures = [
  line('a', '1042', 'Rough In', 52_000, { budget_source: 'workbench', budget_labor_pct: 20, budget_materials_pct: 50 }),
  line('b', '1042', 'Water heater, 50 gal, added', 4_000),
  line('c', '1050', 'Mobilizations', 3_200),
  line('d', '1050', 'Supplemental crew week', 1_600),
  line('e', '1050', 'Permit and inspections', 600),
  line('f', '1050', 'Trim Set', 28_000, { budget_source: 'tuned', budget_labor_pct: 44, budget_materials_pct: 36 }),
  line('g', '1050', 'Top Out', 36_000, { budget_reviewed_at: '2026-11-06T13:00:00Z' }),
  line('h', '1050', 'Discount', -1_000, { line_kind: 'discount' }),
  line('i', '1031', 'Any old line', 9_000),
  line('j', '1060', 'Never awarded', 9_000),
]

describe('lineBudgetsReview (punch list #234 PR 1c)', () => {
  it('the window is seven days from the award', () => {
    expect(awardedThisWeek('2026-11-01T18:00:00Z', now)).toBe(true)
    expect(awardedThisWeek('2026-10-31T17:00:00Z', now)).toBe(false)
    expect(awardedThisWeek(null, now)).toBe(false)
    expect(awardedThisWeek('2026-11-08T00:00:00Z', now)).toBe(false)
  })
  it("keeps the assumed, unstamped lines on this week's projects, newest project first, biggest line first", () => {
    const r = lineBudgetsReview(jobs, fixtures, S, now)
    expect(r.lines.map((l) => l.fixtureId)).toEqual(['c', 'd', 'e', 'b'])
    expect(r.jobIds).toEqual(['1050', '1042'])
    expect(r.assumedUsd).toBe(9_400)
    expect(r.totalUsd).toBe(125_400)
    expect(r.settledLines).toBe(3)
    expect(lineBudgetsReviewTitle(r)).toBe('4 assumed lines on 2 projects awarded this week')
    expect(lineBudgetsReviewDetail(r)).toBe('$9,400 of $125,400 on the company split. Looks right stamps them with your name and leaves them assumed. Tune opens the job.')
    expect(lineBudgetsReviewSettledWords(r)).toBe('The other 3 lines on these 2 projects came from the workbench, were tuned, or were stamped, and need nothing.')
    expect(reviewLineWords(r.lines[3]!)).toBe('#1042 Job 1042 · Water heater, 50 gal, added · $4,000 · ≈ 45 / 35')
  })
  it('a read after the stamp, with nothing assumed left, names the settled lines without "these 0 projects" (the first walk\'s slip 1)', () => {
    const r = lineBudgetsReview([job('1', '2026-11-07T10:00:00Z')], [line('x', '1', 'Water heater', 500, { budget_reviewed_at: '2026-11-07T11:00:00Z' })], S, now)
    expect(r.lines).toEqual([])
    expect(r.jobIds).toEqual([])
    expect(r.settledLines).toBe(1)
    expect(lineBudgetsReviewSettledWords(r)).toBe("1 line on this week's projects came from the workbench, were tuned, or were stamped, and need nothing.")
  })
  it('one line, one project, nothing settled', () => {
    const r = lineBudgetsReview([job('1', '2026-11-07T10:00:00Z')], [line('x', '1', 'Water heater', 500)], S, now)
    expect(lineBudgetsReviewTitle(r)).toBe('1 assumed line on 1 project awarded this week')
    expect(lineBudgetsReviewSettledWords(r)).toBe('')
    expect(lineBudgetsReview([], [], S, now).lines).toEqual([])
  })
})
