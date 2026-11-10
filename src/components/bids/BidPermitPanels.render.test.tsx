// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { GcBid, SitePermitRow } from '../../lib/research/bidSitePanel'

const io = vi.hoisted(() => ({ loadPermitsByHouseNumber: vi.fn(), loadBidsOfCustomers: vi.fn() }))
const research = vi.hoisted(() => ({ loadRecordsStart: vi.fn() }))
const mobile = vi.hoisted(() => ({ value: false }))
vi.mock('../../lib/research/bidSiteIo', () => io)
vi.mock('../../lib/research/permitResearchIo', () => research)
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => mobile.value }))

import { BidSitePermits } from './BidSitePermits'
import { BidGcPermits } from './BidGcPermits'

// Every name, address and number here is made up.
function permit(over: Partial<SitePermitRow> = {}): SitePermitRow {
  return {
    id: 'p1', permit_number: 'COM-1', address: '4120 MILL ST', kind: 'building', stage: 'applied', permit_type: 'Commercial Project Application', work_type: 'Commercial project',
    project_name: 'MILL STREET LOFTS BLDG C', submitted_on: '2026-09-11', issued_on: null, contact: 'Dana Whitlow', declared_value: 6_400_000, area_sf: 38_000, builder_key: 'danawhitlow', ...over,
  }
}
const irrigation = permit({ id: 'p3', kind: 'plumbing', permit_type: 'Plumbing Irrigation Permit', work_type: 'Plumbing Irrigation', stage: 'issued', issued_on: '2026-10-02', project_name: null, contact: 'Greenline Irrigation', declared_value: null, area_sf: null })
const neighbour = permit({ id: 'p9', address: '4120 MILLER RD', project_name: 'SOMETHING ELSE' })

function bid(over: Partial<GcBid> = {}): GcBid {
  return { id: 'b1', bid_number: '512', project_name: 'Mill Street Lofts, Building C', address: '4120 Mill Street, San Antonio, TX 78215', outcome: null, bid_date_sent: null, ...over }
}

beforeEach(() => {
  mobile.value = false
  io.loadPermitsByHouseNumber.mockReset().mockResolvedValue([permit(), irrigation, neighbour])
  io.loadBidsOfCustomers.mockReset().mockResolvedValue([bid()])
  research.loadRecordsStart.mockReset().mockResolvedValue(null)
})
afterEach(() => cleanup())

describe('BidSitePermits', () => {
  it('says what the city has on the address, beside the bid’s own value, and lists every permit on it', async () => {
    renderWithProviders(<BidSitePermits address="4120 Mill Street, San Antonio, TX 78215" projectName="Mill Street Lofts, Building C" bidValue="412000" />)
    await waitFor(() => expect(screen.getByText(/^The city has a permit application on this address\./)).toBeTruthy())
    expect(io.loadPermitsByHouseNumber).toHaveBeenCalledWith('San Antonio', ['4120'])
    expect(screen.getByText(/No general plumbing permit seen on it\.$/)).toBeTruthy()
    expect(screen.getByText('$6,400,000')).toBeTruthy()
    expect(screen.getByText('6.4% of the declared value')).toBeTruthy()
    // The neighbour on another street with the same number is not on this site.
    expect(screen.getByText('2 permits we can see on 4120 Mill Street')).toBeTruthy()
    expect(screen.getByText('Looks like this job')).toBeTruthy()
    expect(screen.getByText('the city lists Greenline Irrigation · not a general plumbing permit')).toBeTruthy()
    expect(screen.getByText('Source: City of San Antonio building permits. They run 2 to 3 days behind.')).toBeTruthy()
  })

  it('says none seen, with the day the records start, when nothing is on the address', async () => {
    io.loadPermitsByHouseNumber.mockResolvedValue([neighbour])
    research.loadRecordsStart.mockResolvedValue('2020-03-04')
    renderWithProviders(<BidSitePermits address="4120 Mill Street, San Antonio, TX 78215" projectName="Mill Street Lofts" bidValue="" />)
    await waitFor(() => expect(screen.getByText('No permit seen on 4120 Mill Street since Mar 4, 2020.')).toBeTruthy())
    expect(screen.getByText('The city’s records run 2 to 3 days behind. A site outside the city limits files elsewhere.')).toBeTruthy()
  })

  it('says a town is not read, and asks the table for nothing', async () => {
    renderWithProviders(<BidSitePermits address="3798 Kyle Crossing Kyle, TX 78640" projectName="Cedar Bend Clinic" bidValue="" />)
    expect(await screen.findByText('No permit records for Kyle.')).toBeTruthy()
    expect(screen.getByText('Permits are read for San Antonio only.')).toBeTruthy()
    expect(io.loadPermitsByHouseNumber).not.toHaveBeenCalled()
  })

  it('says why an address cannot be looked up', async () => {
    renderWithProviders(<BidSitePermits address="Loop 1604 at Oak Hollow" projectName="Oak Hollow Retail" bidValue="" />)
    expect(await screen.findByText('This bid’s address has no street number, so permits cannot be looked up.')).toBeTruthy()
    expect(screen.getByText('It reads: Loop 1604 at Oak Hollow.')).toBeTruthy()
  })

  it('names the reason when the read fails, and waits on the database before the push', async () => {
    io.loadPermitsByHouseNumber.mockRejectedValueOnce(new Error('The network dropped.'))
    const first = renderWithProviders(<BidSitePermits address="4120 Mill Street, San Antonio, TX" projectName="Mill Street Lofts" bidValue="" />)
    expect(await screen.findByText(/The network dropped\./)).toBeTruthy()
    first.unmount()
    io.loadPermitsByHouseNumber.mockResolvedValueOnce(null)
    renderWithProviders(<BidSitePermits address="4120 Mill Street, San Antonio, TX" projectName="Mill Street Lofts" bidValue="" />)
    expect(await screen.findByText('The city’s permits on this address show here once the database change is in.')).toBeTruthy()
  })

  it('draws nothing on a robot’s copy of a bid', () => {
    const { container } = renderWithProviders(<BidSitePermits address="4120 Mill Street, San Antonio, TX" projectName="ZZ Shadow MILL STREET LOFTS" bidValue="" />)
    expect(container.querySelector('[data-testid="bid-site-permits"]')).toBeNull()
  })
})

describe('BidGcPermits', () => {
  const bids = [
    bid(),
    bid({ id: 'b2', bid_number: '501', project_name: 'Pecan Grove Pharmacy', address: '88 Harbor St, San Antonio, TX 78205', bid_date_sent: '2026-10-14' }),
    bid({ id: 'b5', bid_number: '455', project_name: 'Cedar Bend Clinic', address: '3798 Kyle Crossing Kyle, TX 78640', outcome: 'won', bid_date_sent: '2026-07-01' }),
  ]

  it('lists the jobs we priced for the GC with what the city shows on each, and what the count is out of', async () => {
    io.loadBidsOfCustomers.mockResolvedValue(bids)
    renderWithProviders(<BidGcPermits customerIds={['c1', 'c2']} customerName="Ridgeway Builders" currentBidId="b1" />)
    expect(screen.getByText('What we can see about Ridgeway Builders')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('Of the 2 sites we can see, 1 has a permit. No general plumbing permit under another name seen.')).toBeTruthy())
    expect(io.loadBidsOfCustomers).toHaveBeenCalledWith(['c1', 'c2'])
    expect(io.loadPermitsByHouseNumber).toHaveBeenCalledWith('San Antonio', ['4120', '88'])
    expect(screen.getByText('San Antonio only')).toBeTruthy()
    expect(screen.getByText('2 of your 3 bids with them')).toBeTruthy()
    expect(screen.getByText('B512 · Mill Street Lofts, Building C')).toBeTruthy()
    expect(screen.getByText('This bid · no general plumbing permit seen')).toBeTruthy()
    expect(screen.getByText('Sent Oct 14 · no permit seen on the address')).toBeTruthy()
    expect(screen.getByText('1 more bid with them is in Kyle. No permit records are read there.')).toBeTruthy()
  })

  it('folds the jobs behind a press on a phone', async () => {
    mobile.value = true
    io.loadBidsOfCustomers.mockResolvedValue(bids)
    renderWithProviders(<BidGcPermits customerIds={['c1']} customerName="Ridgeway Builders" currentBidId="b1" />)
    const press = await screen.findByRole('button', { name: 'See the 2 jobs ›' })
    expect(screen.queryByText('B512 · Mill Street Lofts, Building C')).toBeNull()
    fireEvent.click(press)
    expect(screen.getByText('B512 · Mill Street Lofts, Building C')).toBeTruthy()
  })

  it('says so when none of the bids is where permits are read', async () => {
    io.loadBidsOfCustomers.mockResolvedValue([bids[2]!])
    renderWithProviders(<BidGcPermits customerIds={['c1']} customerName="Ridgeway Builders" currentBidId={null} />)
    expect(await screen.findByText('None of your bids with them is on a street address in a city whose permits are read.')).toBeTruthy()
    expect(io.loadPermitsByHouseNumber).not.toHaveBeenCalled()
  })

  it('waits on the database before the push, and names the reason when a read fails', async () => {
    io.loadPermitsByHouseNumber.mockResolvedValueOnce(null)
    const first = renderWithProviders(<BidGcPermits customerIds={['c1']} customerName="Ridgeway Builders" currentBidId={null} />)
    expect(await screen.findByText('The jobs you priced for them show here once the database change is in.')).toBeTruthy()
    first.unmount()
    io.loadBidsOfCustomers.mockRejectedValueOnce(new Error('The network dropped.'))
    renderWithProviders(<BidGcPermits customerIds={['c1']} customerName="Ridgeway Builders" currentBidId={null} />)
    expect(await screen.findByText(/The network dropped\./)).toBeTruthy()
  })
})
