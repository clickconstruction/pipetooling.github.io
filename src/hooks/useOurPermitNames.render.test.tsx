// @vitest-environment jsdom
/**
 * Render smoke for the Bid Board's wiring of the names that are us on a plumbing permit (punch list #307):
 * the names are read once, the board's news hook takes them, and a general plumbing permit under one reads
 * "Plumbing permit · ours" with its own news line, never "another name". A save on Settings reads the list
 * again; a failed read leaves the board as it was before the list existed. Every name here is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../test/renderSmokeMocks'
import type { NewsBid } from '../lib/research/bidPermitNews'
import type { SitePermitRow } from '../lib/research/bidSitePanel'
import { ymdPlusDays } from '../lib/research/permitResearch'
import { todayYmdInAppTz } from '../utils/dateUtils'

const io = vi.hoisted(() => ({ loadPermitsByHouseNumber: vi.fn(), loadBidsOfCustomers: vi.fn() }))
const names = vi.hoisted(() => ({ loadOurNames: vi.fn(), onOurNamesChanged: vi.fn(), changeOurNames: vi.fn() }))
vi.mock('../lib/research/bidSiteIo', () => io)
vi.mock('../lib/research/ourNamesIo', () => names)

import { BidBoardPermitNews } from '../components/bids/BidBoardPermitNews'
import { PermitChip } from '../components/bids/PermitChip'
import { useBidPermitNews } from './useBidPermitNews'
import { useOurPermitNames } from './useOurPermitNames'

const RECENT = ymdPlusDays(todayYmdInAppTz(), -5)

const building: SitePermitRow = {
  id: 'p1', permit_number: 'COM-1', address: '4120 MILL ST', kind: 'building', stage: 'applied', permit_type: 'Commercial Project Application', work_type: 'Commercial project',
  project_name: 'MILL STREET LOFTS BLDG C', submitted_on: RECENT, issued_on: null, contact: 'Dana Whitlow', declared_value: null, area_sf: null, builder_key: 'danawhitlow',
}
const plumbing: SitePermitRow = { ...building, id: 'p2', permit_number: 'PLB-1', kind: 'plumbing', permit_type: 'Plumbing General Permit', work_type: 'Plumbing General', stage: 'issued', submitted_on: null, issued_on: RECENT, project_name: null, contact: 'BLUE HERON PLUMBING', builder_key: 'blueheronplumbing' }
const bid: NewsBid = { id: 'b1', bid_number: '512', project_name: 'Mill Street Lofts, Building C', address: '4120 Mill Street, San Antonio, TX 78215', outcome: null, bid_date_sent: null, last_contact: null }

/** The board's wiring in small, as `BidsBidBoardTab` has it: the names, the news hook, the strip and one row's chip. */
function Board({ enabled = true }: { enabled?: boolean }) {
  const ourNames = useOurPermitNames(enabled)
  const permitNews = useBidPermitNews([bid], enabled, ourNames)
  return (
    <div>
      <BidBoardPermitNews news={permitNews.news} onOpenBid={() => {}} />
      <div data-testid="row">{permitNews.chips.get(bid.id) ? <PermitChip chip={permitNews.chips.get(bid.id)!} /> : 'no chip'}</div>
    </div>
  )
}

let saved: (() => void) | null = null

beforeEach(() => {
  saved = null
  io.loadPermitsByHouseNumber.mockReset().mockResolvedValue([building, plumbing])
  names.loadOurNames.mockReset().mockResolvedValue({ names: [], companyName: null })
  names.onOurNamesChanged.mockReset().mockImplementation((fn: () => void) => {
    saved = fn
    return () => {
      saved = null
    }
  })
})
afterEach(() => cleanup())

describe('the Bid Board and the names that are us', () => {
  it('reads our own plumbing permit as ours, with its own news line', async () => {
    names.loadOurNames.mockResolvedValue({ names: ['Blue Heron Plumbing'], companyName: null })
    renderWithProviders(<Board />)
    await waitFor(() => expect(screen.getByTestId('row').textContent).toBe('Plumbing permit · ours'))
    expect(screen.getByText(/^A general plumbing permit that lists us was issued on this address .*, as BLUE HERON PLUMBING\. The bid is not sent yet\.$/)).toBeTruthy()
    expect(screen.queryByText(/It lists BLUE HERON PLUMBING\./)).toBeNull()
  })

  it('reads the same permit as another name until a name is added, then reads the list again', async () => {
    renderWithProviders(<Board />)
    await waitFor(() => expect(screen.getByTestId('row').textContent).toBe('Plumbing permit · another name'))
    expect(screen.getByText(/It lists BLUE HERON PLUMBING\./)).toBeTruthy()
    // A save on Settings → Company tells the board.
    names.loadOurNames.mockResolvedValue({ names: [], companyName: 'Blue Heron Plumbing, LLC' })
    expect(saved).toBeTypeOf('function')
    act(() => saved?.())
    await waitFor(() => expect(screen.getByTestId('row').textContent).toBe('Plumbing permit · ours'))
    expect(names.loadOurNames).toHaveBeenCalledTimes(2)
  })

  it('leaves the board as it was when the names cannot be read, and reads nothing when the news is off', async () => {
    names.loadOurNames.mockRejectedValue(new Error('The network dropped.'))
    const first = renderWithProviders(<Board />)
    await waitFor(() => expect(screen.getByTestId('row').textContent).toBe('Plumbing permit · another name'))
    first.unmount()
    names.loadOurNames.mockClear()
    renderWithProviders(<Board enabled={false} />)
    expect(screen.getByTestId('row').textContent).toBe('no chip') // first paint
    expect(names.loadOurNames).not.toHaveBeenCalled()
  })
})
