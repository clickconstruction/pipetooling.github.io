// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { GcBid, SitePermitRow } from '../../lib/research/bidSitePanel'

const io = vi.hoisted(() => ({ loadPermitsByHouseNumber: vi.fn(), loadBidsOfCustomers: vi.fn(), loadNameAnswers: vi.fn(), recordNameAnswer: vi.fn(), loadBuilderKinds: vi.fn(), onNameAnswered: vi.fn(), loadPermitsOfName: vi.fn() }))
const research = vi.hoisted(() => ({ loadRecordsStart: vi.fn(), loadPermitsOfBuilder: vi.fn(), loadResearchers: vi.fn(), saveBuilder: vi.fn(), loadBuilders: vi.fn() }))
const mobile = vi.hoisted(() => ({ value: false }))
// The names that are us on a plumbing permit (Settings → Company): none unless a test says so.
const names = vi.hoisted(() => ({ loadOurNames: vi.fn(), onOurNamesChanged: vi.fn(), changeOurNames: vi.fn() }))
vi.mock('../../lib/research/bidSiteIo', () => io)
vi.mock('../../lib/research/ourNamesIo', () => names)
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
  research.loadBuilders.mockReset().mockResolvedValue([])
  io.loadPermitsOfName.mockReset().mockResolvedValue([])
  names.loadOurNames.mockReset().mockResolvedValue({ names: [], companyName: null })
  names.onOurNamesChanged.mockReset().mockReturnValue(() => {})
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

  it('reads a general plumbing permit under one of our names as ours, on the verdict and on its row', async () => {
    const ours = permit({ id: 'p4', kind: 'plumbing', permit_type: 'Plumbing General Permit', work_type: 'Plumbing General', stage: 'issued', issued_on: '2026-06-02', project_name: null, contact: 'BLUE HERON PLUMBING', declared_value: null, area_sf: null })
    io.loadPermitsByHouseNumber.mockResolvedValue([permit(), irrigation, ours])
    names.loadOurNames.mockResolvedValue({ names: [], companyName: 'Blue Heron Plumbing, LLC' })
    renderWithProviders(<BidSitePermits address="4120 Mill Street, San Antonio, TX 78215" projectName="Mill Street Lofts, Building C" bidValue="" />)
    await waitFor(() => expect(screen.getByText(/A general plumbing permit on this address lists us, as BLUE HERON PLUMBING\. Issued Jun 2\.$/)).toBeTruthy())
    // One row carries the chip: the irrigation permit lists someone else.
    expect(screen.getAllByText('Ours')).toHaveLength(1)
    expect(screen.getByText('the city lists BLUE HERON PLUMBING')).toBeTruthy()
  })

  it('reads the same permit as the name the city lists while no name is ours', async () => {
    const theirs = permit({ id: 'p4', kind: 'plumbing', permit_type: 'Plumbing General Permit', work_type: 'Plumbing General', stage: 'issued', issued_on: '2026-06-02', project_name: null, contact: 'BLUE HERON PLUMBING', declared_value: null, area_sf: null })
    io.loadPermitsByHouseNumber.mockResolvedValue([permit(), theirs])
    renderWithProviders(<BidSitePermits address="4120 Mill Street, San Antonio, TX 78215" projectName="Mill Street Lofts, Building C" bidValue="" />)
    await waitFor(() => expect(screen.getByText(/A general plumbing permit is on this address\. The city lists BLUE HERON PLUMBING\.$/)).toBeTruthy())
    expect(screen.queryByText('Ours')).toBeNull()
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
    expect(screen.getByText('Permits are read for San Antonio, Austin, New Braunfels, San Marcos and Seguin only.')).toBeTruthy()
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
    // The cities the GC's bids sit in are named, each with the day its records start once that is known.
    expect(screen.getByText('San Antonio')).toBeTruthy()
    expect(screen.getByText('2 of your 3 bids with them')).toBeTruthy()
    expect(screen.getByText('512 · Mill Street Lofts, Building C')).toBeTruthy()
    expect(screen.getByText('This bid · no general plumbing permit seen')).toBeTruthy()
    expect(screen.getByText('Sent Oct 14 · no permit seen on the address')).toBeTruthy()
    expect(screen.getByText('1 more bid with them is in Kyle. No permit records are read there.')).toBeTruthy()
  })

  it('draws Ours on a job whose general plumbing permit lists us, and counts it apart from another name', async () => {
    io.loadBidsOfCustomers.mockResolvedValue(bids)
    io.loadPermitsByHouseNumber.mockResolvedValue([
      permit(),
      permit({ id: 'p5', address: '88 HARBOR ST', kind: 'plumbing', permit_type: 'Plumbing General Permit', work_type: 'Plumbing General', stage: 'issued', issued_on: '2026-06-02', project_name: null, contact: 'Marco Vale', declared_value: null, area_sf: null }),
    ])
    names.loadOurNames.mockResolvedValue({ names: ['Marco Vale'], companyName: null })
    renderWithProviders(<BidGcPermits customerIds={['c1']} customerName="Ridgeway Builders" currentBidId="b1" />)
    await waitFor(() => expect(screen.getByText('Of the 2 sites we can see, 2 have a permit. No general plumbing permit under another name seen. A general plumbing permit lists us on 1.')).toBeTruthy())
    expect(screen.getByText('Ours')).toBeTruthy()
    expect(screen.getByText('Sent Oct 14 · a general plumbing permit, Jun 2, lists us')).toBeTruthy()
    expect(screen.queryByText('Plumbing permit · another name')).toBeNull()
  })

  it('folds the jobs behind a press on a phone', async () => {
    mobile.value = true
    io.loadBidsOfCustomers.mockResolvedValue(bids)
    renderWithProviders(<BidGcPermits customerIds={['c1']} customerName="Ridgeway Builders" currentBidId="b1" />)
    const press = await screen.findByRole('button', { name: 'See the 2 jobs ›' })
    expect(screen.queryByText('512 · Mill Street Lofts, Building C')).toBeNull()
    fireEvent.click(press)
    expect(screen.getByText('512 · Mill Street Lofts, Building C')).toBeTruthy()
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

  it('asks Same company? when the name on the permit begins the GC’s own, and ties through the same preview', async () => {
    io.loadNameAnswers.mockResolvedValue({ rows: [], me: 'u1' })
    io.loadPermitsByHouseNumber.mockResolvedValue([permit({ contact: 'Ridgeway Builders of Texas LLC', builder_key: 'ridgewaybuildersoftexas' })])
    research.loadPermitsOfBuilder.mockResolvedValue([other('p7', '310 ALDER ROW')])
    renderWithProviders(<BidSitePermits {...SITE} customerIds={['c1']} customerName="Ridgeway Builders" />)
    expect(await screen.findByText('The city lists Ridgeway Builders of Texas LLC on this permit. Your customer is Ridgeway Builders.')).toBeTruthy()
    expect(screen.getByText('Same company?')).toBeTruthy()
    expect(screen.getByText('Asked because one name begins the other. Asked once.')).toBeTruthy()
    expect(screen.queryByText('Do you know who that is?')).toBeNull()
    // The same three answers, and nothing tied until the list is shown.
    expect(screen.getByRole('button', { name: 'Not them…' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Not sure' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Same company' }))
    expect(await screen.findByText('Ridgeway Builders of Texas LLC is the same company as Ridgeway Builders. The city lists Ridgeway Builders of Texas LLC on 1 other permit we can see.')).toBeTruthy()
    expect(io.recordNameAnswer).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Show all 1 under Ridgeway Builders' }))
    await waitFor(() => expect(io.recordNameAnswer).toHaveBeenCalledWith({ builderKey: 'ridgewaybuildersoftexas', customerId: 'c1', answer: 'works_for', scope: 'all', permitId: 'p1', name: 'Ridgeway Builders of Texas LLC' }))
  })

  it('takes a No on the likely grade with what they are, as any other name', async () => {
    io.loadNameAnswers.mockResolvedValue({ rows: [], me: 'u1' })
    io.loadPermitsByHouseNumber.mockResolvedValue([permit({ contact: 'Ridgeway Builders of Texas LLC', builder_key: 'ridgewaybuildersoftexas' })])
    renderWithProviders(<BidSitePermits {...SITE} customerIds={['c1']} customerName="Ridgeway Builders" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Not them…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Another GC' }))
    await waitFor(() => expect(io.recordNameAnswer).toHaveBeenCalledWith(expect.objectContaining({ builderKey: 'ridgewaybuildersoftexas', answer: 'someone_else', scope: null })))
    await waitFor(() => expect(research.saveBuilder).toHaveBeenCalledWith('ridgewaybuildersoftexas', 'Ridgeway Builders of Texas LLC', 'gc', 'u1'))
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

describe('Find their names on permits', () => {
  const builder = (key: string, name: string, permits: number) => ({ key, name: null, sample_contact: name, kind: null, customer_id: null, mark: null, mark_reason: null, mark_by_name: null, mark_at: null, permits, open: 0, last_permit_on: '2026-11-03', plumber: null, plumber_jobs: 0, bids: 0, won: 0, last_bid_on: null })

  async function openSheet() {
    io.loadBidsOfCustomers.mockResolvedValue([bid()])
    io.loadNameAnswers.mockResolvedValue({ rows: [], me: 'u1' })
    // The permit on the bid's own address is listed under the longer name.
    io.loadPermitsByHouseNumber.mockResolvedValue([permit({ contact: 'Ridgeway Builders of Texas LLC', builder_key: 'ridgewaybuilderstexas' })])
    research.loadBuilders.mockImplementation(async (city: string) => (city === 'San Antonio' ? [builder('ridgewaybuilderstexas', 'Ridgeway Builders of Texas LLC', 7), builder('ridgewayroofing', 'Ridgeway Roofing Co', 11), builder('hartwellinteriors', 'Hartwell Interiors', 4), builder('ridgewaybuilders', 'Ridgeway Builders', 2)] : []))
    renderWithProviders(<BidGcPermits customerIds={['c1']} customerName="Ridgeway Builders" currentBidId="b1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Find their names on permits ›' }))
    return await screen.findByRole('dialog', { name: 'Find Ridgeway Builders on permits' })
  }

  it('suggests the names that may be them, the one on an address we bid first, and never their own name', async () => {
    const sheet = await openSheet()
    await waitFor(() => expect(within(sheet).getByText('1 permit on addresses you bid to them')).toBeTruthy())
    expect(within(sheet).getByText('One name begins the other')).toBeTruthy()
    expect(within(sheet).getByText('Shares the word Ridgeway')).toBeTruthy()
    expect(within(sheet).getAllByRole('button', { name: 'Same company' })).toHaveLength(2)
    expect(within(sheet).queryByText('Hartwell Interiors')).toBeNull()
  })

  it('ties the same company on the press, and keeps a No', async () => {
    const sheet = await openSheet()
    const ties = await within(sheet).findAllByRole('button', { name: 'Same company' })
    fireEvent.click(ties[0]!)
    await waitFor(() => expect(io.recordNameAnswer).toHaveBeenCalledWith({ builderKey: 'ridgewaybuilderstexas', customerId: 'c1', answer: 'works_for', scope: 'all', permitId: null, name: 'Ridgeway Builders of Texas LLC' }))
    fireEvent.click(within(sheet).getAllByRole('button', { name: 'Not them' })[1]!)
    await waitFor(() => expect(io.recordNameAnswer).toHaveBeenCalledWith({ builderKey: 'ridgewayroofing', customerId: 'c1', answer: 'someone_else', scope: null, permitId: null, name: 'Ridgeway Roofing Co' }))
  })

  it('compares ours with the city’s and marks the address they share', async () => {
    io.loadPermitsOfName.mockResolvedValue([{ id: 'p1', city: 'San Antonio', address: '4120 MILL ST', zip: '78215', contact: 'Paula Kemp, Ridgeway Builders of Texas LLC', work_type: 'Commercial project', permit_type: 'Commercial Project Application', kind: 'building', stage: 'applied', issued_on: null, submitted_on: '2026-09-11' }])
    const sheet = await openSheet()
    fireEvent.click((await within(sheet).findAllByRole('button', { name: 'Compare ›' }))[0]!)
    expect(await within(sheet).findByText('Addresses you bid to them')).toBeTruthy()
    expect(io.loadPermitsOfName).toHaveBeenCalledWith('ridgewaybuilderstexas')
    expect(within(sheet).getByText('4120 Mill Street')).toBeTruthy()
    expect(within(sheet).getByText('Ridgeway Builders of Texas LLC · with Paula Kemp (1)')).toBeTruthy()
    // The zip is on both sides: ours and the city's.
    expect(within(sheet).getAllByText(/78215 \(1\)/)).toHaveLength(2)
  })

  it('searches every name on permits', async () => {
    const sheet = await openSheet()
    fireEvent.change(within(sheet).getByLabelText('Search every name on permits'), { target: { value: 'hart' } })
    expect(await within(sheet).findByText('Hartwell Interiors')).toBeTruthy()
    fireEvent.change(within(sheet).getByLabelText('Search every name on permits'), { target: { value: 'zzz' } })
    expect(await within(sheet).findByText('No name on permits begins with those words.')).toBeTruthy()
  })
})
