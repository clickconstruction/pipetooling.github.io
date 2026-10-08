// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { BidTabTable, GcBidTabs } from './GcBidTabs'
import { bidTabRows } from '../../lib/gc/bids'
import { boardStateFromRows, type BoardRows } from '../../lib/gc/boardRows'
import { clinicBoardRows } from '../../lib/gc/boardTestRows'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

/** The clinic's sitework with both companies quoting: Lonestar $52,000, Hillside $60,000. */
function rows(over: Partial<BoardRows> = {}): BoardRows {
  const base = clinicBoardRows()
  return {
    ...base,
    invites: base.invites.map((i) => (i.id === 'i2' ? { ...i, status: 'bid' } : i)),
    quotes: [
      ...base.quotes,
      { id: 'q2', invite_id: 'i2', amount: 60000, based_on_rev: 0, submitted_on: '2026-10-06', includes: { s1: 'yes', s2: 'yes' }, note: '', good_for_days: null, alternates: [], quote_file: '', exclusions: null, created_at: '2026-10-06T10:00:00Z' },
    ],
    ...over,
  }
}

const sent = (r: BoardRows): BoardRows => ({ ...r, boardDates: { p1: { ...r.boardDates.p1!, our_bid_sent_on: '2026-10-07' } } })

function open(r: BoardRows, share = vi.fn(() => Promise.resolve())) {
  const state = boardStateFromRows(r)
  render(<GcBidTabs state={state} project={state.projects[0]!} share={share} />)
  return { share, panel: document.querySelector('[data-gc-bid-tabs="p1"]') as HTMLElement }
}

describe('GcBidTabs', () => {
  it('waits for our bid: the tab shows, and sharing it does not', () => {
    const { panel } = open(rows())
    expect(within(panel).getByText('Bid tabs open once our bid is in.')).toBeTruthy()
    expect(within(panel).getByText('waits for our bid')).toBeTruthy()
    expect((within(panel).getByRole('button', { name: 'Share with the 2 who quoted' }) as HTMLButtonElement).disabled).toBe(true)
    expect(within(panel).getByText(/No tab for Concrete: a tab needs two quotes/)).toBeTruthy()
  })

  it('once our bid is in, shares the tab low to high without names', async () => {
    const { share, panel } = open(sent(rows()))
    const tab = within(panel).getByText('Sitework').closest('[data-gc-bid-tab]')!.parentElement as HTMLElement
    const lines = within(tab).getAllByRole('row').slice(1).map((r) => r.textContent)
    expect(lines[0]).toMatch(/^1Lonestar Earthworks\s*\$52,000low/)
    expect(lines[1]).toMatch(/^2Hillside Excavation\s*\$60,00015\.4%/)
    fireEvent.click(within(panel).getByRole('button', { name: 'Share with the 2 who quoted' }))
    await waitFor(() => expect(share).toHaveBeenCalledWith('k1', false))
  })

  it('a shared tab says the day, who opened it, and can show the names', async () => {
    const { share, panel } = open(sent(rows({ bidTabs: [{ package_id: 'k1', shared_on: '2026-10-08', show_names: false }], bidTabViews: [{ package_id: 'k1', company_id: 'hillside', seen_on: '2026-10-08' }] })))
    expect(within(panel).getByText('shared Oct 8')).toBeTruthy()
    expect(within(panel).getByText('opened')).toBeTruthy()
    expect(within(panel).getByText('not opened yet')).toBeTruthy()
    expect(within(panel).getByText(/The other rows read "Another company"/)).toBeTruthy()
    fireEvent.click(within(panel).getByRole('checkbox', { name: 'Show company names to each other' }))
    await waitFor(() => expect(share).toHaveBeenCalledWith('k1', true))
  })

  it('a company reads its own row marked, and the others without names', () => {
    const state = boardStateFromRows(sent(rows()))
    render(<BidTabTable rows={bidTabRows(state, state.projects[0]!.packages[0]!)} viewerId="hillside" showNames={false} />)
    expect(screen.getByText('Another company')).toBeTruthy()
    expect(screen.getByText(/Hillside Excavation/).textContent).toMatch(/\(you\)/)
    expect(screen.queryByText('Lonestar Earthworks')).toBeNull()
  })
})
