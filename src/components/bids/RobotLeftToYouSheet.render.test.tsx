// @vitest-environment jsdom
/**
 * The left-to-you sheet (v2.5751, punch list #142): the mark, the two sentences and the one
 * button, Let the robot back in, which hands back the bid.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { RobotLeftToYouSheet } from './RobotLeftToYouSheet'
import { ROBOT_LEFT_SHEET_SENTENCES } from '../../lib/bids/robotLeftToYou'
import type { Bid } from '../../types/bids'

const bid = { id: 'h510', bid_number: '510', project_name: 'AutoZone New Braunfels', robot_opt_out: true } as unknown as Bid

describe('RobotLeftToYouSheet', () => {
  it('closed with no bid', () => {
    const { container } = render(<RobotLeftToYouSheet bid={null} onClose={() => {}} onLetBackIn={() => {}} />)
    expect(container.innerHTML).toBe('')
  })

  it('draws the mark, names the bid, says what each state means, and the button hands the bid back', () => {
    const onLetBackIn = vi.fn()
    const onClose = vi.fn()
    render(<RobotLeftToYouSheet bid={bid} onClose={onClose} onLetBackIn={onLetBackIn} />)
    // first paint
    const dialog = screen.getByRole('dialog', { name: 'Left to you' })
    expect(dialog.querySelector('[data-testid="robot-left-mark"]')?.textContent).toBe('you')
    expect(screen.getByTestId('robot-left-label').textContent).toBe('b510 · AutoZone New Braunfels')
    const words = screen.getByTestId('robot-left-words').querySelectorAll('p')
    expect([...words].map((p) => p.textContent)).toEqual([...ROBOT_LEFT_SHEET_SENTENCES])
    // The window leaves room for an iPhone's status bar, as the other robot sheets do.
    expect(dialog.getAttribute('style')).toContain('padding: calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem')
    fireEvent.click(screen.getByRole('button', { name: 'Let the robot back in' }))
    expect(onLetBackIn).toHaveBeenCalledWith(bid)
    // Two ways out, the × and the Close button; both close.
    const closes = screen.getAllByRole('button', { name: 'Close' })
    expect(closes.length).toBe(2)
    for (const c of closes) fireEvent.click(c)
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
