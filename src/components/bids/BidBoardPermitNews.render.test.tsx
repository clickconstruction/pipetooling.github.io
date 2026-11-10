// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { NewsBid } from '../../lib/research/bidPermitNews'
import type { SitePermitRow } from '../../lib/research/bidSitePanel'
import { ymdPlusDays } from '../../lib/research/permitResearch'
import { todayYmdInAppTz } from '../../utils/dateUtils'

const io = vi.hoisted(() => ({ loadPermitsByHouseNumber: vi.fn(), loadBidsOfCustomers: vi.fn() }))
vi.mock('../../lib/research/bidSiteIo', () => io)

import { BidBoardPermitNews } from './BidBoardPermitNews'
import { PermitChip } from './BidSitePermits'
import { useBidPermitNews } from '../../hooks/useBidPermitNews'

// Every name, address and number here is made up.
const RECENT = ymdPlusDays(todayYmdInAppTz(), -5)

function permit(over: Partial<SitePermitRow> = {}): SitePermitRow {
  return {
    id: 'p1', permit_number: 'COM-1', address: '4120 MILL ST', kind: 'building', stage: 'applied', permit_type: 'Commercial Project Application', work_type: 'Commercial project',
    project_name: 'MILL STREET LOFTS BLDG C', submitted_on: RECENT, issued_on: null, contact: 'Dana Whitlow', declared_value: null, area_sf: null, builder_key: 'danawhitlow', ...over,
  }
}
function bid(over: Partial<NewsBid> = {}): NewsBid {
  return { id: 'b1', bid_number: '512', project_name: 'Mill Street Lofts, Building C', address: '4120 Mill Street, San Antonio, TX 78215', outcome: null, bid_date_sent: null, last_contact: null, ...over }
}

/** The board's wiring in small: the hook, the strip and one row's chip. */
function Board({ bids, enabled, onOpen }: { bids: NewsBid[]; enabled: boolean; onOpen: (id: string) => void }) {
  const permitNews = useBidPermitNews(bids, enabled)
  return (
    <div>
      <BidBoardPermitNews news={permitNews.news} onOpenBid={onOpen} />
      {bids.map((b) => (
        <div key={b.id} data-testid={`row-${b.id}`}>
          {permitNews.chips.get(b.id) ? <PermitChip chip={permitNews.chips.get(b.id)!} /> : 'no chip'}
        </div>
      ))}
    </div>
  )
}

beforeEach(() => {
  io.loadPermitsByHouseNumber.mockReset().mockResolvedValue([
    permit(),
    permit({ id: 'p2', address: '88 HARBOR ST', kind: 'plumbing', permit_type: 'Plumbing General Permit', stage: 'issued', issued_on: '2026-03-01', project_name: null, contact: 'Lone Oak Plumbing' }),
  ])
})
afterEach(() => cleanup())

describe('permit news on the Bid Board', () => {
  const bids = [
    bid(),
    bid({ id: 'b2', bid_number: '501', project_name: 'Pecan Grove Pharmacy', address: '88 Harbor St, San Antonio, TX 78205', bid_date_sent: '2026-02-01' }),
    bid({ id: 'b3', bid_number: '498', project_name: 'Cedar Bend Clinic', address: '3798 Kyle Crossing Kyle, TX 78640' }),
    bid({ id: 'b4', bid_number: '470', project_name: 'Juniper Court Retail', address: '4120 Mill Street, San Antonio, TX', outcome: 'lost' }),
  ]

  it('asks once for the whole board, leads with another plumber’s permit, and opens the bid on the press', async () => {
    const onOpen = vi.fn()
    renderWithProviders(<Board bids={bids} enabled onOpen={onOpen} />)
    await waitFor(() => expect(screen.getByRole('region', { name: 'Permit news on your bids' })).toBeTruthy())
    expect(io.loadPermitsByHouseNumber).toHaveBeenCalledTimes(1)
    expect(io.loadPermitsByHouseNumber).toHaveBeenCalledWith('San Antonio', ['4120', '88'])
    const titles = screen.getAllByText(/^B5\d\d · /).map((e) => e.textContent)
    expect(titles).toEqual(['B501 · Pecan Grove Pharmacy', 'B512 · Mill Street Lofts, Building C'])
    expect(screen.getByText('A general plumbing permit was issued on this address Mar 1. It lists Lone Oak Plumbing. The bid is not yet won or lost.')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Open the bid' })[0]!)
    expect(onOpen).toHaveBeenCalledWith('b2')
    // The row's chip: what the city has, and nothing on a town not read or a decided bid.
    expect(screen.getByTestId('row-b2').textContent).toBe('Plumbing permit · another name')
    expect(screen.getByTestId('row-b1').textContent).toMatch(/^Applied /)
    expect(screen.getByTestId('row-b3').textContent).toBe('no chip')
    expect(screen.getByTestId('row-b4').textContent).toBe('no chip')
  })

  it('draws nothing when it is off, when the read is not on the database yet, and when the read fails', async () => {
    const off = renderWithProviders(<Board bids={bids} enabled={false} onOpen={() => {}} />)
    expect(screen.queryByRole('region', { name: 'Permit news on your bids' })).toBeNull()
    expect(io.loadPermitsByHouseNumber).not.toHaveBeenCalled()
    off.unmount()
    io.loadPermitsByHouseNumber.mockResolvedValueOnce(null)
    const waiting = renderWithProviders(<Board bids={bids} enabled onOpen={() => {}} />)
    await waitFor(() => expect(io.loadPermitsByHouseNumber).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('region', { name: 'Permit news on your bids' })).toBeNull()
    waiting.unmount()
    io.loadPermitsByHouseNumber.mockRejectedValueOnce(new Error('The network dropped.'))
    renderWithProviders(<Board bids={bids} enabled onOpen={() => {}} />)
    await waitFor(() => expect(io.loadPermitsByHouseNumber).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('row-b1').textContent).toBe('no chip')
  })

  it('folds a long list behind a press', () => {
    const news = Array.from({ length: 6 }, (_, i) => ({ bidId: `b${i}`, kind: 'applied' as const, title: `B60${i} · Sample ${i}`, words: 'A permit application was filed on this address Nov 1.', day: '2026-11-01' }))
    renderWithProviders(<BidBoardPermitNews news={news} onOpenBid={() => {}} />)
    expect(screen.getAllByRole('button', { name: 'Open the bid' })).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: 'See 2 more ›' }))
    expect(screen.getAllByRole('button', { name: 'Open the bid' })).toHaveLength(6)
  })
})
