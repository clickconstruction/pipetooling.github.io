// @vitest-environment jsdom
/**
 * Render smoke for the row above the bid picker (the bid-picker sweep): the box, the sort
 * switcher and "Only my bids" in that order; typing and the toggle report; the three paper
 * tabs' wording and their box's minimum width.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BidPickerSearchRow } from './BidPickerSearchRow'

function props(over: Partial<Parameters<typeof BidPickerSearchRow>[0]> = {}) {
  return { query: '', onQueryChange: vi.fn(), onlyMyBids: true, onOnlyMyBidsChange: vi.fn(), ...over }
}

afterEach(() => cleanup())

describe('BidPickerSearchRow', () => {
  it('draws the search box, the sort switcher and "Only my bids", in that order', () => {
    const { container } = render(<BidPickerSearchRow {...props()} />)
    const row = container.firstElementChild as HTMLElement
    expect(row.children).toHaveLength(3)
    expect(row.children[0]?.tagName).toBe('INPUT')
    expect(row.children[2]?.textContent).toContain('Only my bids')
    expect(screen.getByRole('switch', { name: /Only my bids/ }).getAttribute('aria-checked')).toBe('true')
  })

  it('an estimating tab says it matches a bid number, and its box has no minimum width', () => {
    render(<BidPickerSearchRow {...props()} />)
    const box = screen.getByPlaceholderText('Search bids (bid #, project name, or GC/Builder)...') as HTMLInputElement
    expect(box.style.minWidth).toBe('')
    expect(box.style.flex).toContain('1')
  })

  it('a paper tab searches the project and the GC only, and its box holds 200px', () => {
    render(<BidPickerSearchRow {...props({ searchesBidNumber: false })} />)
    const box = screen.getByPlaceholderText('Search bids (project name or GC/Builder)...') as HTMLInputElement
    expect(box.style.minWidth).toBe('200px')
  })

  it('shows the query it is handed and reports what is typed', () => {
    const onQueryChange = vi.fn()
    render(<BidPickerSearchRow {...props({ query: 'elm', onQueryChange })} />)
    const box = screen.getByRole('textbox') as HTMLInputElement
    expect(box.value).toBe('elm')
    fireEvent.change(box, { target: { value: 'elm st' } })
    expect(onQueryChange).toHaveBeenCalledWith('elm st')
  })

  it('"Only my bids" reports the other state each way', () => {
    const onOnlyMyBidsChange = vi.fn()
    const { rerender } = render(<BidPickerSearchRow {...props({ onOnlyMyBidsChange })} />)
    fireEvent.click(screen.getByRole('switch', { name: /Only my bids/ }))
    expect(onOnlyMyBidsChange).toHaveBeenLastCalledWith(false)
    rerender(<BidPickerSearchRow {...props({ onlyMyBids: false, onOnlyMyBidsChange })} />)
    fireEvent.click(screen.getByRole('switch', { name: /Only my bids/ }))
    expect(onOnlyMyBidsChange).toHaveBeenLastCalledWith(true)
  })
})
