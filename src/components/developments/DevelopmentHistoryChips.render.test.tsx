// @vitest-environment jsdom
/**
 * The History look's Show chips (v2.6199): a phone keeps the seven in one row that scrolls sideways
 * with the piece chip under it; the desk wraps them. Made-up pieces; nothing is real.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HISTORY_CHIPS } from '../../lib/developments/history'
import { DevelopmentHistoryChips } from './DevelopmentHistoryTools'

afterEach(cleanup)

const PIECE = { jobId: 'j1', bidId: null, label: 'JP1098' }

describe('DevelopmentHistoryChips', () => {
  it('on a phone the chips sit in one sideways-scrolling strip and the piece chip sits under it', () => {
    const onChip = vi.fn()
    render(<DevelopmentHistoryChips chip="all" onChip={onChip} piece={PIECE} onClearPiece={() => {}} phone />)
    const strip = screen.getByTestId('history-chips-strip')
    expect(strip.style.overflowX).toBe('auto')
    expect(strip.style.flexWrap).toBe('')
    const chips = HISTORY_CHIPS.map((c) => screen.getByTestId(`history-chip-${c.key}`))
    expect(chips).toHaveLength(7)
    for (const chip of chips) {
      expect(strip.contains(chip)).toBe(true)
      expect(chip.style.flexShrink).toBe('0')
    }
    const piece = screen.getByTestId('history-piece-chip')
    expect(strip.contains(piece)).toBe(false)
    expect(screen.getByTestId('history-chips').contains(piece)).toBe(true)
    fireEvent.click(screen.getByTestId('history-chip-plans'))
    expect(onChip).toHaveBeenCalledWith('plans')
  })

  it('on the desk the chips wrap in one row with the piece chip at the end', () => {
    render(<DevelopmentHistoryChips chip="money" onChip={() => {}} piece={PIECE} onClearPiece={() => {}} />)
    const row = screen.getByTestId('history-chips')
    expect(row.style.flexWrap).toBe('wrap')
    expect(screen.queryByTestId('history-chips-strip')).toBeNull()
    expect(row.contains(screen.getByTestId('history-piece-chip'))).toBe(true)
    expect(screen.getByTestId('history-chip-money').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('history-chip-all').getAttribute('aria-pressed')).toBe('false')
  })
})
