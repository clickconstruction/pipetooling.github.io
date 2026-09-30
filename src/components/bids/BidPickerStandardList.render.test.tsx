// @vitest-environment jsdom
/**
 * Render smoke for the grouped bid picker: the Bid Board headings with counts in the board's
 * order, Lost folded until pressed, the fold remembered across a re-mount, every group open
 * while searching, empty groups gone, and a row press handing back its bid.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders as render } from '../../test/renderSmokeMocks'
import { BidPickerStandardList, setBidPickerGroupFolded } from './BidPickerStandardList'
import type { BidWithBuilder } from '../../types/bidWithBuilder'

function bid(over: Partial<BidWithBuilder> & { id: string; bid_number: string }): BidWithBuilder {
  return {
    project_name: `Project ${over.bid_number}`,
    address: '1 Main St',
    outcome: null,
    bid_date_sent: null,
    bid_due_date: null,
    bid_value: null,
    working_board_archived_at: null,
    service_type_id: null,
    customers: null,
    bids_gc_builders: null,
    ...over,
  } as unknown as BidWithBuilder
}

const ROWS: BidWithBuilder[] = [
  bid({ id: 'u1', bid_number: '500' }),
  bid({ id: 'u2', bid_number: '488' }),
  bid({ id: 'p1', bid_number: '487', bid_date_sent: '2026-09-26' }),
  bid({ id: 'l1', bid_number: '470', outcome: 'lost', bid_date_sent: '2026-08-28' }),
  bid({ id: 'l2', bid_number: '466', outcome: 'lost', bid_date_sent: '2026-08-21' }),
  bid({ id: 'a1', bid_number: '441', working_board_archived_at: '2026-07-20T00:00:00Z' }),
]

function headings(): string[] {
  return screen.getAllByRole('button', { expanded: undefined }).filter((b) => b.id.startsWith('bid-picker-group-')).map((b) => b.textContent ?? '')
}

beforeEach(() => {
  window.localStorage.clear()
  // The module store outlives the test: put every group back to its default.
  setBidPickerGroupFolded('lost', true)
  setBidPickerGroupFolded('archived', true)
  setBidPickerGroupFolded('unsent', false)
  window.localStorage.clear()
})
afterEach(() => cleanup())

describe('BidPickerStandardList', () => {
  it('draws the board headings with counts in the board order, and skips empty groups', () => {
    render(<BidPickerStandardList bids={ROWS} prefixMap={{}} onSelectBid={vi.fn()} />)
    expect(headings()).toEqual([
      'Unsent / Working Bids(2)▼',
      'Not yet won or lost(1)▼',
      'Lost(2)▶',
      'Archived (Unsent/Working)(1)▶',
    ])
  })

  it('Lost starts folded; pressing its heading opens it, and the fold is remembered', () => {
    const { unmount } = render(<BidPickerStandardList bids={ROWS} prefixMap={{}} onSelectBid={vi.fn()} />)
    const lost = screen.getByRole('button', { name: /^Lost/ })
    expect(lost.getAttribute('aria-expanded')).toBe('false')
    // The folded rows stay in the DOM under `hidden`, so a fold is a hidden panel, not a missing one.
    expect((document.getElementById('bid-picker-group-lost') as HTMLElement).hidden).toBe(true)
    fireEvent.click(lost)
    expect(screen.getByRole('button', { name: /^Lost/ }).getAttribute('aria-expanded')).toBe('true')
    expect((document.getElementById('bid-picker-group-lost') as HTMLElement).hidden).toBe(false)
    expect(screen.getByText(/Project 470/)).toBeTruthy()
    unmount()
    render(<BidPickerStandardList bids={ROWS} prefixMap={{}} onSelectBid={vi.fn()} />)
    expect(screen.getByRole('button', { name: /^Lost/ }).getAttribute('aria-expanded')).toBe('true')
    expect(JSON.parse(window.localStorage.getItem('bidPickerFolds') ?? '{}')).toMatchObject({ lost: false })
  })

  it('while searching every group is open and a heading press changes nothing', () => {
    render(<BidPickerStandardList bids={ROWS} prefixMap={{}} onSelectBid={vi.fn()} searching />)
    const lost = screen.getByRole('button', { name: /^Lost/ })
    expect(lost.getAttribute('aria-expanded')).toBe('true')
    expect((document.getElementById('bid-picker-group-lost') as HTMLElement).hidden).toBe(false)
    expect(screen.getByText(/Project 466/)).toBeTruthy()
    fireEvent.click(lost)
    expect(screen.getByRole('button', { name: /^Lost/ }).getAttribute('aria-expanded')).toBe('true')
    expect(window.localStorage.getItem('bidPickerFolds')).toBeNull()
  })

  it('rows sort by the picker view inside a group, and a row press hands back its bid', () => {
    const onSelectBid = vi.fn()
    render(<BidPickerStandardList bids={ROWS} prefixMap={{}} onSelectBid={onSelectBid} />)
    const unsent = within(document.getElementById('bid-picker-group-unsent') as HTMLElement)
    const rows = unsent.getAllByRole('button')
    expect(rows.map((r) => r.textContent)).toEqual([expect.stringContaining('500'), expect.stringContaining('488')])
    fireEvent.click(rows[1] as HTMLElement)
    expect(onSelectBid).toHaveBeenCalledWith(expect.objectContaining({ id: 'u2' }))
  })

  it('the Counts tally leads each row inside its group', () => {
    render(<BidPickerStandardList bids={ROWS} prefixMap={{}} onSelectBid={vi.fn()} countBadges={{ u1: 12 }} />)
    const unsent = within(document.getElementById('bid-picker-group-unsent') as HTMLElement)
    expect(unsent.getByTitle('12 fixtures & tie-ins counted').textContent).toBe('12')
    expect(unsent.getByTitle('No counts yet').textContent).toBe('—')
  })

  it('an empty list shows the host message, or nothing', () => {
    const { container, rerender } = render(<BidPickerStandardList bids={[]} prefixMap={{}} onSelectBid={vi.fn()} emptyMessage="No bids match your search." />)
    expect(screen.getByText('No bids match your search.')).toBeTruthy()
    rerender(<BidPickerStandardList bids={[]} prefixMap={{}} onSelectBid={vi.fn()} />)
    expect(container.textContent).toBe('')
  })
})
