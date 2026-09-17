// @vitest-environment jsdom
/**
 * Render smoke for the Price book drawer (Pricing decomposition PR 4): the ★ on the book
 * feeding the bid, browse-only chips with Use as the explicit switch (v2.2396), the two
 * captions — the bid's own frozen copy vs a shared book with no copy yet (v2.2444) — the
 * amber door across with its two verbs, and the entries table in both price modes.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  BidsPriceBookDrawer,
  type PriceBookDrawerBooks,
  type PriceBookDrawerDoors,
  type PriceBookDrawerEntries,
  type PriceBookDrawerOffer,
} from './BidsPriceBookDrawer'
import type { PriceBookEntryWithFixture, PriceBookVersion } from '../../lib/bids/bidPricingEngineTypes'

const version = (id: string, name: string, o: Record<string, unknown> = {}) =>
  ({ id, name, bid_id: null, is_robot: false, sort_order: 0, ...o }) as unknown as PriceBookVersion
const entry = (id: string, name: string, prices: [number, number, number]) =>
  ({
    id,
    version_id: 't1',
    fixture_type_id: 'f1',
    fixture_types: { name },
    rough_in_price: prices[0],
    top_out_price: prices[1],
    trim_set_price: prices[2],
    total_price: prices[0] + prices[1] + prices[2],
  }) as unknown as PriceBookEntryWithFixture

function parts(over: { books?: Partial<PriceBookDrawerBooks>; entries?: Partial<PriceBookDrawerEntries>; offer?: Partial<PriceBookDrawerOffer>; doors?: Partial<PriceBookDrawerDoors> } = {}) {
  const books: PriceBookDrawerBooks = {
    templates: [version('t1', 'Default'), version('t2', 'WENDI')],
    bidPricings: [version('p1', 'Default', { bid_id: 'b1' })],
    selectedPricingVersionId: 'p1',
    browsedTemplateId: 't1',
    currentTemplateId: 't1',
    defaultTemplateId: 't2',
    expanded: false,
    onExpandedChange: vi.fn(),
    switchBusy: false,
    onBrowse: vi.fn(),
    onUseOnBid: vi.fn(async () => {}),
    ...over.books,
  }
  const entries: PriceBookDrawerEntries = {
    rows: [entry('e1', 'Toilet', [100, 50, 25]), entry('e2', 'Lavatory', [80, 0, 20])],
    search: '',
    onSearchChange: vi.fn(),
    displayMode: 'combined',
    onDisplayModeChange: vi.fn(),
    ...over.entries,
  }
  const offer: PriceBookDrawerOffer = { pending: null, applying: false, onApply: vi.fn(), onDismiss: vi.fn(), ...over.offer }
  const doors: PriceBookDrawerDoors = { onAddBook: vi.fn(), onEditBook: vi.fn(), onAddEntry: vi.fn(), onEditEntry: vi.fn(), onClose: vi.fn(), ...over.doors }
  return { books, entries, offer, doors }
}

describe('BidsPriceBookDrawer', () => {
  it('names the browsed book, stars the one feeding the bid, and every door reports', () => {
    const p = parts()
    render(<BidsPriceBookDrawer {...p} />)
    expect(screen.getByText('Price book — Default')).toBeTruthy()
    expect(screen.getByText('★ Default')).toBeTruthy()
    // collapsed: only the browsed chip, no Add book, no Use line on the bid's own book
    expect(screen.queryByRole('button', { name: 'WENDI' })).toBeNull()
    expect(screen.queryByText('Add book')).toBeNull()
    expect(screen.queryByText(/on this bid$/)).toBeNull()
    expect(screen.getByText(/Your default for new bids/).textContent).toContain('WENDI')
    expect(screen.getByText(/This bid prices from/).textContent).toContain('its own copy')
    fireEvent.click(screen.getByText('Add entry'))
    expect(p.doors.onAddEntry).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getAllByTitle('Edit')[0]!)
    expect(p.doors.onEditEntry).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }))
    fireEvent.click(screen.getByLabelText('Close the price book'))
    expect(p.doors.onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTitle('Show all price books'))
    expect(p.books.onExpandedChange).toHaveBeenCalledWith(true)
  })

  it('expanded, a chip only browses; Use is the explicit switch and collapses the row after', async () => {
    const p = parts({ books: { expanded: true, browsedTemplateId: 't2' } })
    render(<BidsPriceBookDrawer {...p} />)
    expect(screen.getByText('Price book — WENDI')).toBeTruthy()
    fireEvent.click(screen.getByText('★ Default'))
    expect(p.books.onBrowse).toHaveBeenCalledWith('t1')
    expect(p.books.onUseOnBid).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTitle('Rename this book'))
    expect(p.doors.onEditBook).toHaveBeenCalledWith(expect.objectContaining({ id: 't2' }))
    fireEvent.click(screen.getByText('Add book'))
    expect(p.doors.onAddBook).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Use WENDI on this bid'))
    expect(p.books.onUseOnBid).toHaveBeenCalledWith('t2')
    await Promise.resolve()
    expect(p.books.onExpandedChange).toHaveBeenCalledWith(false)
  })

  it('with no copy yet, the caption says the shared book prices the bid as it stands today', () => {
    render(<BidsPriceBookDrawer {...parts({ books: { selectedPricingVersionId: 't1', bidPricings: [] } })} />)
    expect(screen.getByText(/This bid has no copy yet/).textContent).toContain('Default')
    expect(screen.queryByText(/This bid prices from/)).toBeNull()
  })

  it('the door across: an update offer carries the bid total and both verbs report', () => {
    const p = parts({
      offer: { pending: { offer: { kind: 'update', bidEntryId: 'x', fixtureName: 'Toilet', bidTotal: 175, bookTotal: 190 }, siblingPricingCount: 2 } },
    })
    render(<BidsPriceBookDrawer {...p} />)
    expect(screen.getByRole('status').textContent).toContain('2 more price options on this bid hold the same')
    fireEvent.click(screen.getByText('Use $190.00 on this bid'))
    expect(p.offer.onApply).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Leave this bid alone'))
    expect(p.offer.onDismiss).toHaveBeenCalledTimes(1)
  })

  it('the entries table: combined shows one price, stage shows three with a dash for zero; the search filters', () => {
    const { unmount } = render(<BidsPriceBookDrawer {...parts()} />)
    expect(screen.getByText('$175.00')).toBeTruthy()
    expect(screen.queryByRole('columnheader', { name: 'Rough In' })).toBeNull()
    unmount()
    render(<BidsPriceBookDrawer {...parts({ entries: { displayMode: 'stage', search: 'lav' } })} />)
    expect(screen.getByRole('columnheader', { name: 'Rough In' })).toBeTruthy()
    expect(screen.queryByText('Toilet')).toBeNull()
    expect(screen.getByText('$80.00')).toBeTruthy()
    expect(screen.getByText('—')).toBeTruthy()
  })
})
