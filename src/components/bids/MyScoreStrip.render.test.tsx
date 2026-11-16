// @vitest-environment jsdom
/**
 * Punch list #360 PR 5: the estimator's own row on the Bid Board and a closeout's chip. The strip reads the ramp
 * until a bid of theirs scores, then the dollars; the sheet lists their bids by what happened, with the door to
 * Labor on a bid to finish; a person with no bid in the window sees nothing. The chip names what the job moved.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildEstimatorScore, type EstimatorBidInput } from '../../lib/scorecard/estimatorScore'
import { buildHurdle } from '../../lib/scorecard/hurdle'
import { MY_SCORE_WORDS as W, closeoutChip } from '../../lib/scorecard/myScore'
import type { EstimatorScoresWire } from '../../lib/scorecard/scorecardWire'
import { installDomShims } from '../../test/renderSmokeMocks'
import BidCloseoutChip from './BidCloseoutChip'
import MyScoreStrip from './MyScoreStrip'

installDomShims()

const hurdle = buildHurdle({ overheadUsd: 12_000, paidFieldHours: 1_000, windowDays: 56, setting: { targetProfitPerHourUsd: 25 } })
const bid = (over: Partial<EstimatorBidInput>): EstimatorBidInput => ({
  bidId: 'b1',
  bidNumber: '512',
  projectName: 'Riverside Lofts',
  customerName: 'Seguin Ridge',
  estimatorName: 'Wendi',
  accountManagerName: null,
  outcome: 'won',
  outcomeYmd: '2026-11-01',
  sentYmd: '2026-10-10',
  pricedRevenueUsd: 100_000,
  pricedCostUsd: 80_000,
  pricedUncostedUsd: 0,
  labor: { usable: true, rowsWithHours: 10, rowsTotal: 10, rateSet: true },
  awardedHours: 400,
  job: null,
  ...over,
})
const wire = (bids: EstimatorBidInput[]): EstimatorScoresWire => ({
  view: 'mine',
  fromYmd: '2026-09-21',
  toYmd: '2026-11-15',
  todayYmd: '2026-11-15',
  windowDays: 56,
  hurdlePerHourUsd: 37,
  targetProfitPerHourUsd: 25,
  estimator: buildEstimatorScore({ bids, hurdle, fromYmd: '2026-09-21', toYmd: '2026-11-15', todayYmd: '2026-11-15' }),
  actualsUnread: 0,
})
const closed = { jobId: 'j1', label: '1042 Riverside', status: 'billed', finished: true, closedYmd: '2026-11-10', actualGrossProfitUsd: 22_300 }

afterEach(cleanup)

describe('MyScoreStrip', () => {
  it('the ramp, then the sheet: the hurdle as one figure and the bid to finish with its door to Labor', () => {
    const onOpenLabor = vi.fn()
    render(<MyScoreStrip read={wire([bid({ bidId: 'b9', bidNumber: '530', outcome: null, outcomeYmd: null, labor: { usable: false, rowsWithHours: 1, rowsTotal: 10, rateSet: true } }), bid({ bidId: 'b2', outcome: null, outcomeYmd: null })])} onOpenLabor={onOpenLabor} />)
    const strip = screen.getByTestId('my-score-strip')
    expect(strip.textContent).toBe('Your score1 of 2of your priced bids can be scored · 1 needs its Labor tab finished')
    fireEvent.click(strip)
    const sheet = within(screen.getByTestId('my-score-sheet'))
    expect(sheet.getByText('The hurdle is $37/h: a bid scores when its priced profit on each labor hour clears it.')).toBeTruthy()
    expect(sheet.getByText(W.finishHead)).toBeTruthy()
    fireEvent.click(sheet.getByRole('button', { name: W.openLabor }))
    expect(onOpenLabor).toHaveBeenCalledWith('b9')
    expect(screen.queryByTestId('my-score-sheet')).toBeNull()
  })

  it('once a bid of theirs has scored: the dollars, and the closed job in the sheet', () => {
    render(<MyScoreStrip read={wire([bid({}), bid({ bidId: 'b2', bidNumber: '498', outcomeYmd: '2026-10-01', job: closed })])} />)
    expect(screen.getByTestId('my-score-strip').textContent).toBe('Your score$42,300won above the hurdle on 2 bids · 1 job closed and moved it by +$2,300')
    fireEvent.click(screen.getByTestId('my-score-strip'))
    const sheet = within(screen.getByTestId('my-score-sheet'))
    expect(sheet.getByText('B512 Riverside Lofts · $20,000 at $50/h')).toBeTruthy()
    expect(sheet.getByText('B498 Riverside Lofts · Closed +$2,300')).toBeTruthy()
    expect(sheet.queryByRole('button', { name: W.openLabor })).toBeNull()
  })

  it('nothing for a person with no bid in the window, and nothing before the function answers', () => {
    const { container, rerender } = render(<MyScoreStrip read={wire([])} />)
    expect(container.textContent).toBe('')
    rerender(<MyScoreStrip read={null} />)
    expect(container.textContent).toBe('')
  })
})

describe('BidCloseoutChip', () => {
  it('names what the job moved, with the sentence in its hover', () => {
    const row = wire([bid({ job: closed })]).estimator.closeouts[0]!
    render(<BidCloseoutChip chip={closeoutChip(row)} />)
    const chip = screen.getByTestId('bid-closeout-chip')
    expect(chip.textContent).toBe('Closed +$2,300')
    expect(chip.getAttribute('title')).toBe('The job closed on 2026-11-10. It made $22,300 against the $20,000 the bid was priced to make. The estimating score moved by +$2,300.')
  })
  it('no chip, nothing drawn', () => {
    const { container } = render(<BidCloseoutChip chip={null} />)
    expect(container.textContent).toBe('')
  })
})
