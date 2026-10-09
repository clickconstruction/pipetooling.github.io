// @vitest-environment jsdom
/**
 * The Costs verdict's priced line (Burn against the bid, piece 1, v2.5043): under the margin at
 * completion, the margin the linked bid was priced at and how far the job runs from it. The
 * kernel's suite holds the arithmetic; this pins the wiring.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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

const renderVerdict = (priced: Parameters<typeof buildCostsVerdict>[0]['priced']) =>
  render(<JobCostsVerdict verdict={buildCostsVerdict({ ...base, priced })} canWrite budget={budget} linkedBid={{ id: 'b66', bid_number: '66', project_name: 'Mission Hill Park' }} onOpenBidCounts={null} doorway={null} kept={kept} jobFinished={false} />)

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
