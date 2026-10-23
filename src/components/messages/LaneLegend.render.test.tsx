// @vitest-environment jsdom
/**
 * Render smoke for the card behind the ? on Messages' bar (punch list #151 PR 3): the six lanes with their sentences,
 * in the strip's order, and Close.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { LaneLegend } from './LaneLegend'

afterEach(cleanup)

describe('LaneLegend', () => {
  it('lists the six lanes with what each holds, and Close closes it', () => {
    const onClose = vi.fn()
    render(<LaneLegend onClose={onClose} />)
    const card = screen.getByRole('region', { name: 'What each lane holds' })
    expect(within(card).getByText('New').nextElementSibling?.textContent).toBe('What came in and still needs sorting. Its row opens the thread, with the sort at the top.')
    expect(within(card).getByText('Needs you').nextElementSibling?.textContent).toBe('A note with a day comes back here that morning. A portal row is a customer who wrote on their page.')
    expect(within(card).getByText('Went out').nextElementSibling?.textContent).toMatch(/^Every text and email we sent in the last 7 days/)
    expect(card.querySelectorAll('span').length).toBe(12)
    fireEvent.click(within(card).getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
