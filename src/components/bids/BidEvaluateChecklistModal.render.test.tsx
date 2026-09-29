// @vitest-environment jsdom
/**
 * Render smoke for the Bid window's Go/no-go checklist (punch list #51, PR 5): the five
 * questions in order with their lines, ticks that are the window's own and start empty on every
 * opening, and both ways out.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BidEvaluateChecklistModal } from './BidEvaluateChecklistModal'

afterEach(() => cleanup())

const TITLES = ['LOCATION', 'PAYMENT TERMS', 'BID DOCUMENTS', 'COMPETITION', 'STRENGTHS']
const boxes = () => TITLES.map((t) => screen.getByRole('checkbox', { name: t }) as HTMLInputElement)

describe('BidEvaluateChecklistModal', () => {
  it('asks the five questions, in order, each with its lines', () => {
    render(<BidEvaluateChecklistModal onClose={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Go/no-go checklist' })).toBeTruthy()
    expect(screen.getAllByRole('checkbox').map((b) => b.closest('label')?.textContent)).toEqual(TITLES)
    expect(screen.getByText("Do we know we're getting paid?")).toBeTruthy()
    expect(screen.getByText('Does this project play to our strengths?')).toBeTruthy()
  })

  it('ticks are its own, and a new opening starts empty', () => {
    const { unmount } = render(<BidEvaluateChecklistModal onClose={vi.fn()} />)
    expect(boxes().map((b) => b.checked)).toEqual([false, false, false, false, false])
    fireEvent.click(boxes()[1]!)
    fireEvent.click(boxes()[4]!)
    expect(boxes().map((b) => b.checked)).toEqual([false, true, false, false, true])
    fireEvent.click(boxes()[1]!)
    expect(boxes().map((b) => b.checked)).toEqual([false, false, false, false, true])
    unmount()
    render(<BidEvaluateChecklistModal onClose={vi.fn()} />)
    expect(boxes().every((b) => !b.checked)).toBe(true)
  })

  it('× and Close both close it', () => {
    const onClose = vi.fn()
    render(<BidEvaluateChecklistModal onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: '×' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
