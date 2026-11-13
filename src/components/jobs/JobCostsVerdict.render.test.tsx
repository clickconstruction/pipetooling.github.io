// @vitest-environment jsdom
/**
 * The Costs verdict's priced line (Burn against the bid, piece 1, v2.5043): under the margin at
 * completion, the margin the linked bid was priced at and how far the job runs from it. The
 * kernel's suite holds the arithmetic; this pins the wiring.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { JobCostsVerdict } from './JobCostsVerdict'
import { buildCostsVerdict } from '../../lib/jobs/jobCostsVerdict'
import type { JobBurnModel } from '../../lib/jobs/jobBurn'
import type { ResolvedJobBudget } from '../../lib/jobs/jobBudget'
import type { JobBudgetState } from '../../hooks/useJobBudget'
import type { JobBaselineState } from '../../hooks/useJobBaseline'

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
const base = { burn, priceUsd: 123_600, spend: { teamUsd: 32_814, subUsd: 1_409, partsUsd: 46_376, totalUsd: 80_599 }, teamHours: 959, teamPeople: 13, resolved: assumed, bidLabel: '66', latestReportYmd: '2026-09-04', jobPct: 90, todayYmd: '2026-09-12' }
const budget = { loading: false, busy: false, error: null, row: null, candidates: [], linkedBreakdown: null, reload: vi.fn(), linkAndSnapshot: vi.fn(), setTyped: vi.fn(), clear: vi.fn() } as unknown as JobBudgetState
const kept = { loading: false, loaded: true, busy: false, error: null, row: null, rows: [], keepNow: vi.fn(), reload: vi.fn() } as unknown as JobBaselineState

afterEach(cleanup)

const renderVerdict = (priced: Parameters<typeof buildCostsVerdict>[0]['priced']) =>
  render(<JobCostsVerdict verdict={buildCostsVerdict({ ...base, priced })} canWrite budget={budget} linkedBid={{ id: 'b66', bid_number: '66', project_name: 'Mission Flat Park' }} onOpenBidCounts={null} doorway={null} kept={kept} jobFinished={false} />)

describe("JobCostsVerdict · the second walk's slips (punch list #234)", () => {
  const costed: ResolvedJobBudget = { ...assumed, source: 'bid', glyph: '◆', directUsd: 3_000, components: { laborHours: 70, laborRate: null, laborUsd: 0, materialsUsd: 0, subsUsd: 0, otherUsd: 0 }, targetMarginPct: null, partial: { labor: true, materials: false, subs: false } }
  const noSpend = { teamUsd: 0, subUsd: 0, partsUsd: 0, totalUsd: 0 }
  const awardedRow = { job_id: 'j', kind: 'bid', bid_id: 'b398', labor_hours: 70, labor_rate: 29.01, labor_usd: 2_031, materials_usd: 0, subs_usd: 0, other_usd: 0, total_direct_usd: 2_031, completeness: { rows_total: 6, rows_with_hours: 6, rate_set: true, usable: true }, taken_at: '2026-11-08T18:00:00Z', taken_by: null, note: null, awarded_at: '2026-11-08T18:00:00Z', awarded_kind: 'bid', awarded_labor_hours: 70, awarded_labor_usd: 2_031, awarded_materials_usd: 0, awarded_total_direct_usd: 2_031, awarded_detail: {}, awarded_by: null }
  const noRate = { bid_id: 'b398', bid_number: '398', project_name: 'ZZ Test', bid_value: 56_343, agreed_value: null, has_estimate: true, labor_hours: 70, labor_rate: null, labor_usd: 0, materials_usd: 0, subs_usd: 0, other_usd: 0, total_direct_usd: 0, completeness: { rows_total: 6, rows_with_hours: 6, rate_set: false, materials_source: 'none', usable: false } }
  const bid398 = { id: 'b398', bid_number: '398', project_name: 'ZZ Test' }

  it('withholds Clear on an awarded row and says the award is written once (slip 11); a row not yet awarded keeps it', () => {
    const clear = vi.fn()
    const b = { ...budget, clear, row: awardedRow } as unknown as JobBudgetState
    const v = buildCostsVerdict({ ...base, burn: { ...burn, percentDone: 25 }, spend: noSpend, teamHours: 0, teamPeople: 0, resolved: costed, bidLabel: '398', budgetRow: awardedRow })
    const r = render(<JobCostsVerdict verdict={v} canWrite budget={b} linkedBid={bid398} onOpenBidCounts={null} doorway={null} kept={kept} jobFinished={false} isProject />)
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
    expect(screen.getByTestId('baseline-clear-withheld').textContent).toContain('Frozen at award · written once')
    // Slip 6: before any hour the strip waits instead of judging the baseline heavy.
    expect(screen.getByTestId('baseline-strip-bid').textContent).toContain('no hours in yet · the read waits on the first clocked hour')
    expect(screen.getByTestId('baseline-strip-bid').textContent).not.toContain('heavy')
    r.unmount()
    render(<JobCostsVerdict verdict={buildCostsVerdict({ ...base, resolved: costed, bidLabel: '398' })} canWrite budget={budget} linkedBid={bid398} onOpenBidCounts={null} doorway={null} kept={kept} jobFinished={false} />)
    expect(screen.getByRole('button', { name: 'Clear' })).toBeTruthy()
  })

  it("reads a bid with hours on every row and no rate as usable at the company rate, and names the real reason when it is not (slip 8)", () => {
    const award = vi.fn()
    const b = { ...budget, award, linkedBreakdown: noRate } as unknown as JobBudgetState
    const v = buildCostsVerdict({ ...base, spend: noSpend, teamHours: 0, teamPeople: 0, bidLabel: '398' })
    const r = render(<JobCostsVerdict verdict={v} canWrite budget={b} linkedBid={bid398} onOpenBidCounts={null} doorway={null} kept={kept} jobFinished={false} isProject bookRateUsd={45} />)
    const strip = screen.getByTestId('baseline-strip-none')
    expect(strip.textContent).not.toContain('sent without hours')
    expect(strip.textContent).toContain('This job has no baseline yet — bid B398 has hours on its Labor rows and is not taken yet.')
    const take = screen.getByRole('button', { name: "Take B398's estimate · 70 h" })
    expect(take.title).toContain("company's $45 rate")
    take.click()
    expect(award).toHaveBeenCalledWith(expect.objectContaining({ p_source: 'bid', p_bid_id: 'b398', p_labor_rate: 45 }))
    r.unmount()
    // No company rate either: the reason is the rate, in words, and no press.
    render(<JobCostsVerdict verdict={v} canWrite budget={b} linkedBid={bid398} onOpenBidCounts={null} doorway={null} kept={kept} jobFinished={false} isProject bookRateUsd={null} />)
    expect(screen.getByTestId('baseline-strip-none').textContent).toContain('This job has no baseline yet — B398 has hours on its Labor rows but no labor rate.')
    expect(screen.queryByRole('button', { name: /Take B398's estimate/ })).toBeNull()
  })

  it('a bid with no Labor rows says so on the amber strip (slip 7)', () => {
    const b = { ...budget, linkedBreakdown: { ...noRate, labor_hours: 0, completeness: { rows_total: 0, rows_with_hours: 0, rate_set: true, materials_source: 'none', usable: false } } } as unknown as JobBudgetState
    render(<JobCostsVerdict verdict={buildCostsVerdict({ ...base, spend: noSpend, teamHours: 0, teamPeople: 0, bidLabel: '398' })} canWrite budget={b} linkedBid={bid398} onOpenBidCounts={null} doorway={null} kept={kept} jobFinished={false} bookRateUsd={45} />)
    const strip = screen.getByTestId('baseline-strip-none')
    expect(strip.textContent).toContain('This job has no baseline yet — B398 has no Labor rows yet.')
    expect(strip.textContent).toContain('B398 has no Labor rows yet. Add them on its Labor tab and take it again.')
  })
})

describe('JobCostsVerdict · the priced line (v2.5043)', () => {
  it('reads the margin the bid was priced at beside the direct margin at completion', () => {
    renderVerdict({ pct: 31.42, revenueUsd: 123_600, costUsd: 84_765, uncostedUsd: 0, rateSet: true, bidVersionId: null, at: '2026-08-01T15:00:00Z' })
    expect(screen.getByTestId('verdict-priced').textContent).toBe('The bid was priced at 31% direct · this job runs 16 pts under the price')
  })
  it('says why a stamp reads high', () => {
    renderVerdict({ pct: 72, revenueUsd: 123_600, costUsd: 34_600, uncostedUsd: 1_200, rateSet: false, bidVersionId: null, at: null })
    expect(screen.getByTestId('verdict-priced').textContent).toBe('The bid was priced at 72% direct · this job runs 57 pts under the price · it reads high: no labor rate, $1,200 on rows with no cost')
  })
  it('no stamp, no line', () => {
    renderVerdict(null)
    expect(screen.queryByTestId('verdict-priced')).toBeNull()
  })
})
