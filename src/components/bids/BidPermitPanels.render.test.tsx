// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { GcBid, SitePermitRow } from '../../lib/research/bidSitePanel'

const io = vi.hoisted(() => ({ loadPermitsByHouseNumber: vi.fn(), loadBidsOfCustomers: vi.fn(), loadNameAnswers: vi.fn(), recordNameAnswer: vi.fn(), loadBuilderKinds: vi.fn(), onNameAnswered: vi.fn() }))
const research = vi.hoisted(() => ({ loadRecordsStart: vi.fn(), loadPermitsOfBuilder: vi.fn(), loadResearchers: vi.fn(), saveBuilder: vi.fn() }))
const mobile = vi.hoisted(() => ({ value: false }))
vi.mock('../../lib/research/bidSiteIo', () => io)
vi.mock('../../lib/research/permitResearchIo', () => research)
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => mobile.value }))

import { BidSitePermits } from './BidSitePermits'
import { BidGcPermits } from './BidGcPermits'
import type { NameAnswerRow } from '../../lib/research/nameAnswers'

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
  // The answers table is not on the database unless a test says so: nothing is asked.
  io.loadNameAnswers.mockReset().mockResolvedValue(null)
  io.recordNameAnswer.mockReset().mockResolvedValue(undefined)
  io.loadBuilderKinds.mockReset().mockResolvedValue(new Map())
  io.onNameAnswered.mockReset().mockReturnValue(() => {})
  research.loadPermitsOfBuilder.mockReset().mockResolvedValue([])
  research.loadResearchers.mockReset().mockResolvedValue([{ id: 'u1', name: 'Eve' }, { id: 'u2', name: 'Sam' }])
  research.saveBuilder.mockReset().mockResolvedValue(undefined)
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
    expect(screen.getByText('Permits are read for San Antonio and Austin only.')).toBeTruthy()
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
    // Each city read is named, with the day its records start once that is known.
    expect(screen.getByText('San Antonio')).toBeTruthy()
    expect(screen.getByText('Austin')).toBeTruthy()
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

describe('the answer on a name', () => {
  const SITE = { address: '4120 Mill Street, San Antonio, TX 78215', projectName: 'Mill Street Lofts, Building C', bidValue: '' }
  const other = (id: string, address: string) => ({ id, permit_number: id, permit_type: 'Comm Remodel Permit', kind: 'building', stage: 'issued', work_type: 'Commercial remodel', submitted_on: null, issued_on: '2026-08-04', contact: 'Dana Whitlow', address, declared_value: null })
  const tie = (over: Partial<NameAnswerRow> = {}): NameAnswerRow => ({ id: 'a1', builder_key: 'danawhitlow', customer_id: 'c1', answer: 'works_for', scope: 'all', permit_id: 'p1', name: 'Dana Whitlow', answered_by: 'u2', answered_at: '2026-11-09T18:00:00Z', ...over })

  it('asks once under the permit that looks like this job, and shows the other permits before it ties any', async () => {
    io.loadNameAnswers.mockResolvedValue({ rows: [], me: 'u1' })
    research.loadPermitsOfBuilder.mockResolvedValue([other('p1', '4120 MILL ST'), other('p7', '310 ALDER ROW'), other('p8', '88 HARBOR ST')])
    renderWithProviders(<BidSitePermits {...SITE} customerIds={['c1', 'c2']} customerName="Ridgeway Builders" />)
    expect(await screen.findByText('The city lists Dana Whitlow on this permit.')).toBeTruthy()
    expect(io.loadNameAnswers).toHaveBeenCalledWith(['c1', 'c2'])
    fireEvent.click(screen.getByRole('button', { name: 'Works for Ridgeway Builders' }))
    expect(await screen.findByText('Dana Whitlow works for Ridgeway Builders. The city lists Dana Whitlow on 2 other permits we can see.')).toBeTruthy()
    expect(screen.getByText('Commercial remodel · 310 ALDER ROW')).toBeTruthy()
    expect(io.recordNameAnswer).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Show all 2 under Ridgeway Builders' }))
    await waitFor(() => expect(io.recordNameAnswer).toHaveBeenCalledWith({ builderKey: 'danawhitlow', customerId: 'c1', answer: 'works_for', scope: 'all', permitId: 'p1', name: 'Dana Whitlow' }))
  })

  it('ties this permit only, on the second press', async () => {
    io.loadNameAnswers.mockResolvedValue({ rows: [], me: 'u1' })
    research.loadPermitsOfBuilder.mockResolvedValue([other('p7', '310 ALDER ROW')])
    renderWithProviders(<BidSitePermits {...SITE} customerIds={['c1']} customerName="Ridgeway Builders" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Works for Ridgeway Builders' }))
    fireEvent.click(await screen.findByRole('button', { name: 'This permit only' }))
    await waitFor(() => expect(io.recordNameAnswer).toHaveBeenCalledWith(expect.objectContaining({ answer: 'works_for', scope: 'this_permit', permitId: 'p1' })))
  })

  it('takes someone else with what they are, and not sure with nothing more', async () => {
    io.loadNameAnswers.mockResolvedValue({ rows: [], me: 'u1' })
    const first = renderWithProviders(<BidSitePermits {...SITE} customerIds={['c1']} customerName="Ridgeway Builders" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Someone else…' }))
    fireEvent.click(screen.getByRole('button', { name: 'The owner' }))
    await waitFor(() => expect(io.recordNameAnswer).toHaveBeenCalledWith(expect.objectContaining({ answer: 'someone_else', scope: null })))
    await waitFor(() => expect(research.saveBuilder).toHaveBeenCalledWith('danawhitlow', 'Dana Whitlow', 'owner', 'u1'))
    first.unmount()
    io.recordNameAnswer.mockClear()
    renderWithProviders(<BidSitePermits {...SITE} customerIds={['c1']} customerName="Ridgeway Builders" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Not sure' }))
    await waitFor(() => expect(io.recordNameAnswer).toHaveBeenCalledWith(expect.objectContaining({ answer: 'not_sure', scope: null })))
    expect(research.saveBuilder).toHaveBeenCalledTimes(1)
  })

  it('shows a settled answer with whose word it is, and takes it back on Undo', async () => {
    io.loadNameAnswers.mockResolvedValue({ rows: [tie()], me: 'u1' })
    research.loadPermitsOfBuilder.mockResolvedValue([other('p7', '310 ALDER ROW')])
    renderWithProviders(<BidSitePermits {...SITE} customerIds={['c1']} customerName="Ridgeway Builders" />)
    expect(await screen.findByText('Works for Ridgeway Builders')).toBeTruthy()
    expect(await screen.findByText('Tied on Sam’s word, Nov 9. Dana Whitlow works for Ridgeway Builders. 1 other permit now shows under Ridgeway Builders.')).toBeTruthy()
    expect(screen.queryByText('The city lists Dana Whitlow on this permit.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(io.recordNameAnswer).toHaveBeenCalledWith(expect.objectContaining({ answer: 'taken_back', builderKey: 'danawhitlow' })))
  })

  it('asks nothing with no GC on the bid, before the table is on the database, or of the GC’s own name', async () => {
    io.loadNameAnswers.mockResolvedValue({ rows: [], me: 'u1' })
    const noGc = renderWithProviders(<BidSitePermits {...SITE} />)
    await screen.findByText('Looks like this job')
    expect(screen.queryByTestId('bid-name-question')).toBeNull()
    noGc.unmount()
    io.loadNameAnswers.mockResolvedValue(null)
    const absent = renderWithProviders(<BidSitePermits {...SITE} customerIds={['c1']} customerName="Ridgeway Builders" />)
    await screen.findByText('Looks like this job')
    await waitFor(() => expect(io.loadNameAnswers).toHaveBeenCalled())
    expect(screen.queryByTestId('bid-name-question')).toBeNull()
    absent.unmount()
    io.loadNameAnswers.mockResolvedValue({ rows: [], me: 'u1' })
    renderWithProviders(<BidSitePermits {...SITE} customerIds={['c1']} customerName="Dana Whitlow" />)
    expect(await screen.findByText('Their own name')).toBeTruthy()
    expect(screen.queryByText('Do you know who that is?')).toBeNull()
  })

  it('lists the names tied to the GC under its jobs, with what each is listed on, and takes one back', async () => {
    io.loadBidsOfCustomers.mockResolvedValue([bid()])
    io.loadNameAnswers.mockResolvedValue({ rows: [tie({ answered_by: 'u1' })], me: 'u1' })
    research.loadPermitsOfBuilder.mockImplementation(async (_city: string, key: string) => (key === 'danawhitlow' ? [other('p7', '310 ALDER ROW'), other('p8', '88 HARBOR ST')] : []))
    renderWithProviders(<BidGcPermits customerIds={['c1']} customerName="Ridgeway Builders" currentBidId="b1" />)
    expect(await screen.findByText('Other permits under names tied to them')).toBeTruthy()
    expect(await screen.findByText('Works for them · your word, Nov 9')).toBeTruthy()
    expect(screen.getByText('Their own name')).toBeTruthy()
    expect(screen.getByText('Listed on no permit we can see')).toBeTruthy()
    expect(screen.getByText('Listed on 2 permits we can see')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'See them ›' }))
    expect(screen.getByText('Commercial remodel · 88 HARBOR ST')).toBeTruthy()
    expect(screen.getByText('A name on a permit is the contact the city lists. It is not always the builder.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Take back' }))
    await waitFor(() => expect(io.recordNameAnswer).toHaveBeenCalledWith({ builderKey: 'danawhitlow', customerId: 'c1', answer: 'taken_back', scope: null, permitId: null, name: 'Dana Whitlow' }))
  })
})
