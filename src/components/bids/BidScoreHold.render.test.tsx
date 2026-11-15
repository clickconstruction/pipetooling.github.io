// @vitest-environment jsdom
/**
 * *Can't be scored* (team scorecard, punch list #360, PR 2): the Bid Board's chip and the line on the
 * Pricing workbench, its send window and the Cover Letter's Mark sent. A bid on the desk gets the door
 * to Labor; a bid that went out only says so.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import BidScoreHoldChip from './BidScoreHoldChip'
import BidScoreHoldLine from './BidScoreHoldLine'
import { bidScoreReadiness, laborCompleteness } from '../../lib/scorecard/scoreReadiness'

const row = (h: number) => ({ kind: 'fixture', rough_in_hrs_per_unit: h, top_out_hrs_per_unit: 0, trim_set_hrs_per_unit: 0 })
const holdOf = (sent: boolean) => {
  const r = bidScoreReadiness({ pricedRevenueUsd: 21000, pricedCostUsd: 9000, pricedUncostedUsd: 0, labor: laborCompleteness([row(1), row(0), row(0)], 80), sent })
  if (r.kind !== 'hold') throw new Error('expected a hold')
  return r
}

describe('BidScoreHoldChip', () => {
  it('on a bid still on the desk: a press that opens Labor and does not open the row', () => {
    const onOpenLabor = vi.fn()
    const onRow = vi.fn()
    render(
      <div onClick={onRow}>
        <BidScoreHoldChip hold={holdOf(false)} onOpenLabor={onOpenLabor} />
      </div>,
    )
    const chip = screen.getByTestId('bid-score-hold-chip')
    expect(chip.tagName).toBe('BUTTON')
    expect(chip.textContent).toBe('Can’t be scored')
    expect(chip.getAttribute('title')).toBe('Labor not estimated: 1 of 3 rows has hours. The cost has little or no labor in it, so this bid cannot be scored. Fill the hours on the Labor tab before it goes out.')
    fireEvent.click(chip)
    expect(onOpenLabor).toHaveBeenCalledTimes(1)
    expect(onRow).not.toHaveBeenCalled()
  })
  it('on a bid that went out: words only', () => {
    render(<BidScoreHoldChip hold={holdOf(true)} onOpenLabor={null} />)
    const chip = screen.getByTestId('bid-score-hold-chip')
    expect(chip.tagName).toBe('SPAN')
    expect(chip.getAttribute('title')).toContain('Its margin was kept when it was sent.')
  })
  it('nothing held, nothing drawn', () => {
    const { container } = render(<BidScoreHoldChip hold={null} />)
    expect(container.textContent).toBe('')
  })
})

describe('BidScoreHoldLine', () => {
  it('says the reason and the fix, with the door to Labor', () => {
    const onOpenLabor = vi.fn()
    render(<BidScoreHoldLine hold={holdOf(false)} onOpenLabor={onOpenLabor} />)
    expect(screen.getByTestId('bid-score-hold-line').textContent).toBe('Can’t be scored.Labor not estimated: 1 of 3 rows has hours. The cost has little or no labor in it, so this bid cannot be scored. Fill the hours on the Labor tab before it goes out.Open Labor')
    fireEvent.click(screen.getByRole('button', { name: 'Open Labor' }))
    expect(onOpenLabor).toHaveBeenCalledTimes(1)
  })
  it('no door where there is none to offer, and no line with nothing held', () => {
    const { container, rerender } = render(<BidScoreHoldLine hold={holdOf(false)} />)
    expect(screen.queryByRole('button')).toBeNull()
    rerender(<BidScoreHoldLine hold={null} />)
    expect(container.textContent).toBe('')
  })
})
