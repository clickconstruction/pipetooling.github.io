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
// Every write the two outcome windows could make goes through one of these: the bid's own row or a GC's packet.
const writes = vi.hoisted(() => ({ from: vi.fn(), setGcPacketOutcome: vi.fn() }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub()
  return { supabase: { ...stub, from: (table: string) => { writes.from(table); return stub.from() } } }
})
vi.mock('../../lib/bids/gcPacketOutcome', () => ({ setGcPacketOutcome: writes.setGcPacketOutcome }))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'estimator' })
})

import { BidBoardPermitNews } from './BidBoardPermitNews'
import { BidBoardNewsMarkLost } from './BidBoardNewsMarkLost'
import type { GcPacket } from '../../lib/bids/gcPackets'
import { PermitChip } from './PermitChip'
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

/** The board's wiring in small: the hook, the strip with the board's outcome window, and one row's chip. */
function Board({ bids, enabled, onOpen, packetsByBid, onChanged }: { bids: NewsBid[]; enabled: boolean; onOpen: (id: string) => void; packetsByBid?: Record<string, GcPacket[]>; onChanged?: () => void }) {
  const permitNews = useBidPermitNews(bids, enabled)
  return (
    <div>
      <BidBoardPermitNews
        news={permitNews.news}
        onOpenBid={onOpen}
        renderMarkLost={(bidId, close) => <BidBoardNewsMarkLost bid={{ id: bidId, outcome: null }} packets={packetsByBid?.[bidId]} onChanged={onChanged ?? (() => {})} onClose={close} />}
      />
      {bids.map((b) => (
        <div key={b.id} data-testid={`row-${b.id}`}>
          {permitNews.chips.get(b.id) ? <PermitChip chip={permitNews.chips.get(b.id)!} /> : 'no chip'}
        </div>
      ))}
    </div>
  )
}

function gcPacket(over: Partial<GcPacket>): GcPacket {
  return { key: 'gc-1', gcId: 'gc-1', name: 'Ridgeway Builders', versions: [{ id: 'v1', name: 'Base', customer_id: 'gc-1', sort_order: 0 }], sentOn: '2026-02-01', sentValue: null, outcome: null, ...over }
}

beforeEach(() => {
  writes.from.mockReset()
  writes.setGcPacketOutcome.mockReset().mockResolvedValue({ error: null, autoLost: [], bidOutcomeSet: null })
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
    const titles = screen.getAllByText(/^5\d\d · /).map((e) => e.textContent)
    expect(titles).toEqual(['501 · Pecan Grove Pharmacy', '512 · Mill Street Lofts, Building C'])
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

  it('offers Mark lost… on a sent bid’s plumbing line alone, opens the quick lost capture under it, and writes nothing until a pick', async () => {
    renderWithProviders(<Board bids={bids} enabled onOpen={() => {}} />)
    await waitFor(() => expect(screen.getByRole('region', { name: 'Permit news on your bids' })).toBeTruthy())
    // Two lines, one press: the sent bid with another plumber's permit. The application's line has none.
    expect(screen.getAllByRole('button', { name: 'Open the bid' })).toHaveLength(2)
    const markLost = screen.getAllByRole('button', { name: 'Mark lost…' })
    expect(markLost).toHaveLength(1)
    expect(screen.queryByText('Mark lost — why?')).toBeNull()
    fireEvent.click(markLost[0]!)
    // The window the board already has for a bid with one GC: the note, the six reasons, and its own Cancel.
    expect(screen.getByText('Mark lost — why?')).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'What they said' })).toBeTruthy()
    expect(markLost[0]!.getAttribute('aria-expanded')).toBe('true')
    expect(writes.from).not.toHaveBeenCalled()
    expect(writes.setGcPacketOutcome).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Mark lost — why?')).toBeNull()
    expect(writes.from).not.toHaveBeenCalled()
    // The press folds the window it opened.
    fireEvent.click(markLost[0]!)
    fireEvent.click(markLost[0]!)
    expect(screen.queryByText('Mark lost — why?')).toBeNull()
  })

  it('opens the row’s own GC lines for a bid tracked per GC, and writes that GC’s packet only on the pick', async () => {
    const onChanged = vi.fn()
    const packets = [gcPacket({}), gcPacket({ key: 'gc-2', gcId: 'gc-2', name: 'Hartwell Interiors', versions: [{ id: 'v2', name: 'Base', customer_id: 'gc-2', sort_order: 1 }] })]
    renderWithProviders(<Board bids={bids} enabled onOpen={() => {}} packetsByBid={{ b2: packets }} onChanged={onChanged} />)
    await waitFor(() => expect(screen.getByRole('region', { name: 'Permit news on your bids' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Mark lost…' }))
    const group = screen.getByRole('group', { name: 'Lost with which GC?' })
    expect(group.textContent).toContain('Nothing is saved until you pick.')
    // Never the bid-level capture on such a bid: the bid's outcome rolls up from its GCs.
    expect(screen.queryByText('Mark lost — why?')).toBeNull()
    expect(writes.setGcPacketOutcome).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Outcome with Hartwell Interiors: waiting' }))
    expect(writes.setGcPacketOutcome).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('option', { name: 'lost' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect(writes.setGcPacketOutcome).toHaveBeenCalledTimes(1)
    expect(writes.setGcPacketOutcome.mock.calls[0]![0]).toMatchObject({ bidId: 'b2', versionIds: ['v2'], outcome: 'lost', previousOutcome: null, actor: { path: 'board' } })
    expect(writes.from).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('group', { name: 'Lost with which GC?' })).toBeNull()
  })

  it('offers no Mark lost… when the board passes no window, and closes the window when the bid’s line leaves', () => {
    const line = { bidId: 'b9', kind: 'plumbing' as const, title: '501 · Pecan Grove Pharmacy', words: 'A general plumbing permit was issued on this address Mar 1. It lists Lone Oak Plumbing. The bid is not yet won or lost.', day: '2026-03-01', markLost: true }
    const bare = renderWithProviders(<BidBoardPermitNews news={[line]} onOpenBid={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Mark lost…' })).toBeNull()
    bare.unmount()
    const other = { ...line, bidId: 'b8', kind: 'applied' as const, title: '512 · Mill Street Lofts, Building C', markLost: false }
    const strip = (news: (typeof line | typeof other)[]) => <BidBoardPermitNews news={news} onOpenBid={() => {}} renderMarkLost={(bidId) => <div data-testid="window">{bidId}</div>} />
    const drawn = renderWithProviders(strip([line, other]))
    fireEvent.click(screen.getByRole('button', { name: 'Mark lost…' }))
    expect(screen.getByTestId('window').textContent).toBe('b9')
    // The bid was decided: its line is gone, and so is the window. When the line comes back the window stays shut.
    drawn.rerender(strip([other]))
    expect(screen.queryByTestId('window')).toBeNull()
    drawn.rerender(strip([line, other]))
    expect(screen.queryByTestId('window')).toBeNull()
  })

  it('folds a long list behind a press', () => {
    const news = Array.from({ length: 6 }, (_, i) => ({ bidId: `b${i}`, kind: 'applied' as const, title: `60${i} · Sample ${i}`, words: 'A permit application was filed on this address Nov 1.', day: '2026-11-01', markLost: false }))
    renderWithProviders(<BidBoardPermitNews news={news} onOpenBid={() => {}} />)
    expect(screen.getAllByRole('button', { name: 'Open the bid' })).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: 'See 2 more ›' }))
    expect(screen.getAllByRole('button', { name: 'Open the bid' })).toHaveLength(6)
  })
})
