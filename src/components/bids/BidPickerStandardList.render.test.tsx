// @vitest-environment jsdom
/**
 * Render smoke for the grouped bid picker: the Bid Board headings with counts in the board's
 * order, Lost folded until pressed, the fold remembered across a re-mount, every group open
 * while searching, empty groups gone, a row press handing back its bid — and the marks
 * (v2.4287): the circle marks and clears, the wash and the "marked …" words, the Marked
 * switch, H on a focused row, and the footer that clears. Hide robots: the ZZ bids gone from
 * every group, the line that counts them, a marked one kept.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders as render } from '../../test/renderSmokeMocks'
import { BID_PICKER_NO_MARKED_ROWS, BidPickerStandardList, setBidPickerGroupFolded } from './BidPickerStandardList'
import { resetBidMarksStoreForTests, setOnlyMarkedBids } from '../../lib/bids/bidMarksStore'
import { resetHideRobotsForTests, setHideRobotsOffered } from './HideRobotsToggle'
import { BidPickerSearchRow } from './BidPickerSearchRow'
import { resetBidMarkHoldsForTests } from '../../lib/bids/bidMarkHold'
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

/** The main (open-the-bid) buttons of a group, without the mark circles beside them. */
function rowButtons(groupKey: string): HTMLElement[] {
  const group = within(document.getElementById(`bid-picker-group-${groupKey}`) as HTMLElement)
  return group.getAllByRole('button').filter((b) => b.classList.contains('bid-mark-row-main'))
}

function rowWrap(bidId: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`(Mark|Clear the mark on) .*${bidId === 'u2' ? '488' : '500'}`) }).parentElement as HTMLElement
}

beforeEach(() => {
  window.localStorage.clear()
  // The module stores outlive the test: put every group back to its default, forget every mark.
  setBidPickerGroupFolded('lost', true)
  setBidPickerGroupFolded('archived', true)
  setBidPickerGroupFolded('unsent', false)
  window.localStorage.clear()
  resetBidMarksStoreForTests()
  resetBidMarkHoldsForTests()
  resetHideRobotsForTests()
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
    const rows = rowButtons('unsent')
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

  describe('marks (v2.4287)', () => {
    it('the circle marks the bid — the wash, the words, the footer — and clears it again; the bid never opens', () => {
      const onSelectBid = vi.fn()
      render(<BidPickerStandardList bids={ROWS} prefixMap={{}} onSelectBid={onSelectBid} />)
      const dot = screen.getByRole('button', { name: /^Mark 488/ })
      expect(dot.getAttribute('aria-pressed')).toBe('false')
      expect(rowWrap('u2').dataset.marked).toBeUndefined()
      expect(screen.queryByText(/^marked /)).toBeNull()
      fireEvent.click(dot)
      expect(screen.getByRole('button', { name: /^Clear the mark on 488/ }).getAttribute('aria-pressed')).toBe('true')
      expect(rowWrap('u2').dataset.marked).toBe('true')
      expect(rowWrap('u2').dataset.finished).toBeUndefined()
      expect(screen.getByText('marked today')).toBeTruthy()
      expect(screen.getByText('1 marked bid here')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: /^Clear the mark on 488/ }))
      expect(rowWrap('u2').dataset.marked).toBeUndefined()
      expect(screen.queryByText('1 marked bid here')).toBeNull()
      expect(onSelectBid).not.toHaveBeenCalled()
    })

    it('H on a focused row toggles its mark', () => {
      render(<BidPickerStandardList bids={ROWS} prefixMap={{}} onSelectBid={vi.fn()} />)
      const row = rowButtons('unsent')[0] as HTMLElement
      fireEvent.keyDown(row, { key: 'h' })
      expect(rowWrap('u1').dataset.marked).toBe('true')
      fireEvent.keyDown(row, { key: 'H' })
      expect(rowWrap('u1').dataset.marked).toBeUndefined()
    })

    it('the Marked switch keeps only marked rows and their headings, and says so when none is marked', () => {
      resetBidMarksStoreForTests({ u2: '2026-09-25T10:00:00.000Z', l1: '2026-09-20T10:00:00.000Z' })
      const { rerender } = render(<BidPickerStandardList bids={ROWS} prefixMap={{}} onSelectBid={vi.fn()} />)
      expect(headings()).toHaveLength(4)
      setOnlyMarkedBids(true)
      rerender(<BidPickerStandardList bids={ROWS} prefixMap={{}} onSelectBid={vi.fn()} />)
      expect(headings()).toEqual(['Unsent / Working Bids(1)▼', 'Lost(1)▶'])
      expect(rowButtons('unsent').map((r) => r.textContent)).toEqual([expect.stringContaining('488')])
      resetBidMarksStoreForTests()
      setOnlyMarkedBids(true)
      rerender(<BidPickerStandardList bids={ROWS} prefixMap={{}} onSelectBid={vi.fn()} />)
      expect(screen.getByText(BID_PICKER_NO_MARKED_ROWS)).toBeTruthy()
    })

    it('a mark on a lost or archived bid is finished: a dashed bar, and its own clear button beside Clear marks', () => {
      resetBidMarksStoreForTests({ u1: '2026-09-29T10:00:00.000Z', l1: '2026-09-20T10:00:00.000Z', a1: '2026-09-20T10:00:00.000Z' })
      render(<BidPickerStandardList bids={ROWS} prefixMap={{}} onSelectBid={vi.fn()} />)
      // Lost starts folded: its rows are in the DOM under `hidden`.
      const lostWrap = (screen.getByRole('button', { name: /^Clear the mark on 470/, hidden: true }).parentElement as HTMLElement)
      expect(lostWrap.dataset.finished).toBe('true')
      expect(rowWrap('u1').dataset.finished).toBeUndefined()
      expect(screen.getByText('3 marked bids here, 2 on bids that are won, lost or archived')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: /^Clear finished marks \(2\)/ }))
      expect(screen.getByText('1 marked bid here')).toBeTruthy()
      expect(screen.queryByRole('button', { name: /^Clear finished marks/ })).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Clear marks' }))
      expect(screen.queryByText(/marked bid/)).toBeNull()
      expect(rowWrap('u1').dataset.marked).toBeUndefined()
    })
  })
  describe('hide robots', () => {
    const WITH_ROBOTS: BidWithBuilder[] = [
      ...ROWS,
      bid({ id: 'z1', bid_number: '499', project_name: 'ZZ Shadow SPACEX BA02' }),
      bid({ id: 'z2', bid_number: '498', project_name: 'ZZ Twin MPH STAGE', bid_date_sent: '2026-09-20' }),
      bid({ id: 'z3', bid_number: '398', project_name: 'ZZ Test' }),
    ]

    it('not offered ("Only my bids" on), every bid shows and nothing is said, ticked or not', () => {
      render(<BidPickerStandardList bids={WITH_ROBOTS} prefixMap={{}} onSelectBid={vi.fn()} />)
      expect(headings().slice(0, 2)).toEqual(['Unsent / Working Bids(4)▼', 'Not yet won or lost(2)▼'])
      expect(screen.queryByTestId('bid-picker-hidden-robots')).toBeNull()
    })

    it('offered and ticked, the ZZ bids leave every group, a line counts them, and Show them unticks it', () => {
      setHideRobotsOffered(true)
      render(<BidPickerStandardList bids={WITH_ROBOTS} prefixMap={{}} onSelectBid={vi.fn()} />)
      expect(headings().slice(0, 2)).toEqual(['Unsent / Working Bids(2)▼', 'Not yet won or lost(1)▼'])
      expect(rowButtons('unsent').some((r) => (r.textContent ?? '').includes('ZZ'))).toBe(false)
      const line = screen.getByTestId('bid-picker-hidden-robots')
      expect(line.textContent).toBe('3 ZZ bids hidden.Show them')
      fireEvent.click(within(line).getByRole('button', { name: 'Show them' }))
      expect(headings()[0]).toBe('Unsent / Working Bids(4)▼')
      expect(screen.queryByTestId('bid-picker-hidden-robots')).toBeNull()
      expect(window.localStorage.getItem('bidPickerHideRobots')).toBe('0')
    })

    it('with the search row above it: turning "Only my bids" off hides the ZZ bids at once, and on again shows them', () => {
      const tree = (onlyMyBids: boolean) => (
        <>
          <BidPickerSearchRow query="" onQueryChange={vi.fn()} onlyMyBids={onlyMyBids} onOnlyMyBidsChange={vi.fn()} />
          <BidPickerStandardList bids={WITH_ROBOTS} prefixMap={{}} onSelectBid={vi.fn()} />
        </>
      )
      const { rerender } = render(tree(true))
      expect(headings()[0]).toBe('Unsent / Working Bids(4)▼')
      rerender(tree(false))
      expect(headings()[0]).toBe('Unsent / Working Bids(2)▼')
      expect(screen.getByTestId('bid-picker-hidden-robots').textContent).toContain('3 ZZ bids hidden.')
      fireEvent.click(screen.getByRole('switch', { name: /Hide robots/ }))
      expect(headings()[0]).toBe('Unsent / Working Bids(4)▼')
      fireEvent.click(screen.getByRole('switch', { name: /Hide robots/ }))
      rerender(tree(true))
      expect(headings()[0]).toBe('Unsent / Working Bids(4)▼')
      expect(screen.queryByTestId('bid-picker-hidden-robots')).toBeNull()
    })

    it('a ZZ bid you marked stays', () => {
      resetBidMarksStoreForTests({ z1: '2026-10-01T10:00:00.000Z' })
      setHideRobotsOffered(true)
      render(<BidPickerStandardList bids={WITH_ROBOTS} prefixMap={{}} onSelectBid={vi.fn()} />)
      expect(rowButtons('unsent').filter((r) => (r.textContent ?? '').includes('ZZ Shadow SPACEX'))).toHaveLength(1)
      expect(screen.getByTestId('bid-picker-hidden-robots').textContent).toContain('2 ZZ bids hidden.')
    })

    it('a list of nothing but ZZ bids shows the line alone', () => {
      setHideRobotsOffered(true)
      render(<BidPickerStandardList bids={WITH_ROBOTS.slice(-2)} prefixMap={{}} onSelectBid={vi.fn()} emptyMessage="No bids." />)
      expect(headings()).toEqual([])
      expect(screen.getByTestId('bid-picker-hidden-robots').textContent).toBe('2 ZZ bids hidden.Show them')
      expect(screen.queryByText('No bids.')).toBeNull()
    })
  })
})
