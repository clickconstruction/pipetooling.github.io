// @vitest-environment jsdom
/**
 * People → Review → Scores (team scorecard, design spike 2026-11-15): the two numbers with their verdicts
 * and the hurdle, the jobs drill-down with a no-bill row flagged, the bids drill-down with the to-finish
 * list, the closeouts and the waiting proposals; the target's door to the Bid Board's Pricing rules. The kernels' suites hold the
 * arithmetic.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { buildHurdle } from '../../lib/scorecard/hurdle'
import { buildFieldScore } from '../../lib/scorecard/fieldScore'
import { buildEstimatorScore, type EstimatorBidInput } from '../../lib/scorecard/estimatorScore'
import type { ScorecardRead } from '../../lib/scorecard/loadScorecard'

let read: ScorecardRead | null = null
vi.mock('../../hooks/useScorecard', () => ({ useScorecard: () => ({ read, loading: false, error: null, reload: vi.fn() }) }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ role: 'dev', user: { id: 'dev' }, profileName: 'Dev' }) }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { PeopleScoresTab } from './PeopleScoresTab'

const hurdle = buildHurdle({ overheadUsd: 22_000, paidFieldHours: 1_000, windowDays: 56, setting: { targetProfitPerHourUsd: 25 } }) // $22 + $25 = $47/h
const bid = (over: Partial<EstimatorBidInput> & { bidId: string }): EstimatorBidInput => ({
  bidNumber: over.bidId.replace('b', ''),
  projectName: 'A project',
  customerName: 'A GC',
  estimatorName: 'Robert',
  accountManagerName: 'Micah',
  outcome: 'won',
  outcomeYmd: '2026-11-01',
  sentYmd: '2026-10-01',
  pricedRevenueUsd: 100_000,
  pricedCostUsd: 60_000,
  pricedUncostedUsd: 0,
  labor: { usable: true, rowsWithHours: 30, rowsTotal: 30, rateSet: true },
  awardedHours: 400,
  job: null,
  ...over,
})

function sample(): ScorecardRead {
  const field = buildFieldScore({
    burden: 1.2,
    hurdle,
    jobs: [
      { jobId: 'j1', label: '1007 SpaceX', status: 'working', paidHours: 520, laborUsdRaw: 14_000, earnedUsd: 90_000, materialsUsd: 56_000, subUsd: 8_500, totalBillUsd: 400_000 },
      { jobId: 'j2', label: '1091 Lift stations', status: 'working', paidHours: 139, laborUsdRaw: 4_100, earnedUsd: null, materialsUsd: 4_800, subUsd: 4_000, totalBillUsd: null },
    ],
  })
  const estimator = buildEstimatorScore({
    hurdle,
    fromYmd: '2026-09-21',
    toYmd: '2026-11-15',
    todayYmd: '2026-11-15',
    bids: [
      bid({ bidId: 'b501' }),
      bid({ bidId: 'b431', job: { jobId: 'j9', label: '#1050 Palmer', status: 'billed', finished: true, closedYmd: '2026-11-10', actualGrossProfitUsd: 33_000 } }),
      bid({ bidId: 'b580', labor: { usable: false, rowsWithHours: 4, rowsTotal: 33, rateSet: false } }),
      bid({ bidId: 'b545', outcome: null, outcomeYmd: null, sentYmd: '2026-10-30' }),
    ],
  })
  return { fromYmd: '2026-09-21', toYmd: '2026-11-15', todayYmd: '2026-11-15', windowDays: 56, burden: 1.2, setting: { targetProfitPerHourUsd: 25 }, hurdle, field, ownersByJob: new Map([['j1', [{ id: 'pat', name: 'Pat Sample' }]]]), estimator, pendingFieldHours: 0, actualsUnread: 0 }
}

installDomShims()
afterEach(cleanup)

describe('PeopleScoresTab', () => {
  it('draws the two numbers against the hurdle, and each drill-down opens on its press', () => {
    read = sample()
    renderWithProviders(<PeopleScoresTab />)
    // Field: (90,000 − 16,800 − 56,000 − 8,500) + (0 − 4,920 − 4,800 − 4,000) = −4,920 + ... over 659 h
    expect(screen.getByTestId('field-score-figure').textContent).toBe('−$8/h')
    expect(screen.getByTestId('field-score').textContent).toContain('hurdle $47/h')
    expect(screen.getByTestId('field-score').textContent).toContain('1 job has hours and no bill')
    // Estimating: 40,000 + 40,000 at award, −7,000 at the closeout
    expect(screen.getByTestId('estimator-score-figure').textContent).toBe('$73,000')
    expect(screen.getByTestId('estimator-score').textContent).toContain('1 priced bid needs the Labor tab finished')

    expect(screen.getByTestId('field-owners-line').textContent).toContain('Pat Sample $17/h on 520 h')
    fireEvent.click(screen.getByRole('button', { name: 'Open the 2 jobs' }))
    const ownerRows = screen.getAllByTestId('field-owner-row')
    expect(ownerRows).toHaveLength(2)
    expect(ownerRows[1]!.textContent).toContain('No superintendent')
    expect(ownerRows[1]!.textContent).toContain('1 with hours and no bill')
    const jobRows = screen.getAllByTestId('field-row')
    expect(jobRows).toHaveLength(2)
    expect(jobRows[1]!.textContent).toContain('Hours and no bill')

    fireEvent.click(screen.getByRole('button', { name: 'Open the bids' }))
    expect(screen.getByTestId('estimator-to-finish').textContent).toContain('B580')
    expect(screen.getByTestId('estimator-to-finish').textContent).toContain('open the Labor tab')
    expect(screen.getAllByTestId('estimator-row')).toHaveLength(2)
    expect(screen.getAllByTestId('closeout-row')).toHaveLength(1)
    expect(screen.getAllByTestId('waiting-row')).toHaveLength(1)
    expect(screen.getByTestId('scores-rule').textContent).toContain('Break-even is $22/h')
    // #360 PR 3: the target is set on the Bid Board's Pricing rules; the tab carries the door, not a form.
    expect(screen.queryByRole('button', { name: 'Save the target' })).toBeNull()
    expect(screen.getByTestId('scores-target-door').textContent).toBe('The owner sets the target on the Bid Board, under Pricing rules. Open Pricing rules')
    expect(screen.getByRole('link', { name: 'Open Pricing rules' }).getAttribute('href')).toBe('/bids?tab=bid-board&rules=1')
  })

  it('until the first judged bid, the estimating card is a coverage ramp', () => {
    const base = sample()
    read = {
      ...base,
      estimator: buildEstimatorScore({
        hurdle,
        fromYmd: '2026-09-21',
        toYmd: '2026-11-15',
        todayYmd: '2026-11-15',
        bids: [bid({ bidId: 'b580', labor: { usable: false, rowsWithHours: 4, rowsTotal: 33, rateSet: false } }), bid({ bidId: 'b545', outcome: null, outcomeYmd: null, sentYmd: '2026-10-30' })],
      }),
    }
    renderWithProviders(<PeopleScoresTab />)
    expect(screen.getByTestId('estimator-score-figure').textContent).toBe('1 of 2')
    expect(screen.getByTestId('estimator-score').textContent).toContain('1 can be judged; the score starts when one of them is awarded. 1 needs its Labor tab finished.')
  })

  it('nothing in the window says so', () => {
    read = { ...sample(), field: buildFieldScore({ burden: 1.2, hurdle, jobs: [] }), estimator: buildEstimatorScore({ hurdle, fromYmd: '2026-09-21', toYmd: '2026-11-15', todayYmd: '2026-11-15', bids: [] }) }
    renderWithProviders(<PeopleScoresTab />)
    expect(screen.getByText('Nothing to score in this window.')).toBeTruthy()
  })
})
