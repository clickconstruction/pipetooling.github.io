// @vitest-environment jsdom
/**
 * Render smoke for the pace strip (punch list #242, PR 1): the real days as presses, the
 * stages as pieces with a bar where each ends and the bar's card on hover, the expected
 * hours as a mark only when short of the budget, the chip and the legend.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { PaceStrip } from './PaceStrip'
import { superintendentLine } from '../../lib/jobs/superintendentLine'

const days = [
  { ymd: '2026-10-20', hours: 24 },
  { ymd: '2026-10-21', hours: 24 },
  { ymd: '2026-10-22', hours: 32 },
]
const stages = [
  { name: 'Rough In', hours: 56, laborUsd: 2538, pctDone: 40 },
  { name: 'Top Out', hours: 84, laborUsd: 3800, pctDone: null },
  { name: 'Trim Set', hours: 60, laborUsd: 2700, pctDone: null },
]
// 60% done on 80 of 200 h: ahead.
const line = superintendentLine({ pctDone: 60, hoursUsed: 80, hoursBudget: 200, budgetSource: 'bid', money: { spentUsd: 50, budgetUsd: 100 }, plannedFinishYmd: null, checklist: { answered: 0, asked: 0 }, certifiedPct: null, laborDays: days })

describe('PaceStrip', () => {
  it('draws each real day as a press, the stages as pieces with an end bar each, and the legend', () => {
    const onDay = vi.fn()
    render(<PaceStrip line={line} hoursBudget={200} days={days} stages={stages} targetHours={150} onDay={onDay} />)
    expect(screen.getAllByTestId('pace-day')).toHaveLength(3)
    expect(screen.getAllByTestId('pace-stage')).toHaveLength(3)
    // A bar where each stage ends, none after the last.
    expect(screen.getAllByTestId('pace-stage-end')).toHaveLength(2)
    expect(screen.getByTitle('expected 150 h')).toBeTruthy()
    expect(screen.getByText('+2 d')).toBeTruthy()
    expect(screen.getByText(/done 60%/)).toBeTruthy()
    expect(screen.getByText(/hours 40% · 3 days, tap one/)).toBeTruthy()
    expect(screen.getByText(/3 stages, hover one/)).toBeTruthy()
    expect(screen.getByText(/money 50%/)).toBeTruthy()
    fireEvent.click(screen.getAllByTestId('pace-day')[2]!)
    expect(onDay).toHaveBeenCalledWith('2026-10-22')
  })

  it('opens the stage\'s card off the cursor at its end bar', () => {
    render(<PaceStrip line={line} hoursBudget={200} days={days} stages={stages} />)
    expect(screen.queryByTestId('stage-end-card')).toBeNull()
    fireEvent.mouseEnter(screen.getAllByTestId('pace-stage-end')[0]!, { clientX: 100, clientY: 100 })
    const card = screen.getByTestId('stage-end-card')
    expect(card.textContent).toContain('End of Rough In')
    expect(card.textContent).toContain('stage 1 of 3')
    expect(card.textContent).toContain('Budget to reach here')
    expect(card.textContent).toContain('56 h · $2,538')
    // 80 h in by Oct 22 passed the 56 h mark on Oct 22 (24 + 24 + 32).
    expect(card.textContent).toContain('The crew passed here on Oct 22, 80 h in.')
    fireEvent.mouseLeave(screen.getAllByTestId('pace-stage-end')[0]!)
    expect(screen.queryByTestId('stage-end-card')).toBeNull()
  })

  it('draws the expected hours only when they are short of the budget, and no dividers under two stages', () => {
    const { rerender } = render(<PaceStrip line={line} hoursBudget={200} days={days} targetHours={200} stages={[stages[0]!]} />)
    expect(screen.queryByTitle('expected 200 h')).toBeNull()
    expect(screen.queryAllByTestId('pace-stage')).toHaveLength(0)
    rerender(<PaceStrip line={line} hoursBudget={200} days={days} targetHours={120} stages={stages} stageWords />)
    expect(screen.getByTitle('expected 120 h')).toBeTruthy()
    // The large view names each stage under its piece.
    expect(screen.getByTestId('pace-stage-words').textContent).toContain('Rough In')
    expect(screen.getByTestId('pace-stage-words').textContent).toContain('40%')
  })

  it('falls back to one fill with no days and reads the days used at the crew day', () => {
    const plain = superintendentLine({ pctDone: 50, hoursUsed: 100, hoursBudget: 200, budgetSource: 'assumed', money: null, plannedFinishYmd: null, checklist: { answered: 0, asked: 0 }, certifiedPct: null })
    render(<PaceStrip line={plain} hoursBudget={200} />)
    expect(screen.queryAllByTestId('pace-day')).toHaveLength(0)
    expect(screen.getByText('on pace')).toBeTruthy()
    // One day reads in the singular.
    render(<PaceStrip line={plain} hoursBudget={200} days={[{ ymd: '2026-10-20', hours: 100 }]} />)
    expect(screen.getByText(/1 day, tap one/)).toBeTruthy()
    expect(screen.getByText(/hours 50% · 4 d at 24 h\?/)).toBeTruthy()
  })
})
