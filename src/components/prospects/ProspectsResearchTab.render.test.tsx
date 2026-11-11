// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { ymdPlusDays, type ResearchPermitRow } from '../../lib/research/permitResearch'
import { reachDay } from '../../lib/research/permitReach'
import { todayYmdInAppTz } from '../../utils/dateUtils'

const io = vi.hoisted(() => ({
  loadResearchPermits: vi.fn(),
  loadLatestPull: vi.fn(),
  loadRecordsStart: vi.fn(),
  pullPermitsBack: vi.fn(),
  recordVerdict: vi.fn(),
  approachFromPermit: vi.fn(),
  loadLeadDecks: vi.fn(),
  pullPermitsNow: vi.fn(),
  loadContactHistory: vi.fn(),
  lookupCompany: vi.fn(),
  lookupParcel: vi.fn(),
  loadPermitFeedRow: vi.fn(),
  loadSitePermits: vi.fn(),
  loadBuilderPermits: vi.fn(),
  loadResearchers: vi.fn(),
  putBackPermit: vi.fn(),
  loadPermitHistory: vi.fn(),
  loadBuilders: vi.fn(),
  markBuilder: vi.fn(),
  saveBuilder: vi.fn(),
  loadPermitsOfBuilder: vi.fn(),
  loadPermitFunnel: vi.fn(),
}))
vi.mock('../../lib/research/permitResearchIo', () => io)
const siteIo = vi.hoisted(() => ({ loadAllNameAnswers: vi.fn(), loadCustomerNames: vi.fn(), loadRecentBidsWithCustomer: vi.fn(), loadPermitsByHouseNumber: vi.fn(), recordNameAnswer: vi.fn() }))
vi.mock('../../lib/research/bidSiteIo', () => siteIo)
const streetView = vi.hoisted(() => ({
  fetchStreetViewMetaWithMonth: vi.fn(),
  fetchStreetViewImageBlob: vi.fn(),
  fetchStreetViewMeta: vi.fn(),
  googleStreetViewPanoUrl: (lat: number, lng: number) => `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`,
}))
vi.mock('../../lib/fetchStreetViewPreview', () => streetView)
vi.mock('../../hooks/useOfficeAnchor', () => ({ useOfficeAnchor: () => null }))
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))
// The map canvases are lazy and heavy; a list of pin buttons drives the same callbacks (the Bid Board smoke's stand-in).
vi.mock('../map/PinsMapGoogleCanvas', () => ({ default: () => <div data-testid="google-canvas" /> }))
vi.mock('../map/PinsMapCanvas', () => ({
  default: (p: { pins: Array<{ id: string; title: string; color: string }>; onSelect: (id: string) => void }) => (
    <div data-testid="canvas">
      {p.pins.map((pin) => (
        <button key={pin.id} type="button" onClick={() => p.onSelect(pin.id)} data-color={pin.color}>
          pin {pin.title}
        </button>
      ))}
    </div>
  ),
}))

import { ProspectsResearchTab } from './ProspectsResearchTab'

/** The records in these tests start thirty days back, so every count says the day and not a year (punch list #307). */
const RECORDS_START = ymdPlusDays(todayYmdInAppTz(), -30)
const SINCE = `since ${reachDay(RECORDS_START, todayYmdInAppTz())}`

/** The tab opens on Skim since punch list #302; the ledger is one press away. */
async function openLedger() {
  renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
  fireEvent.click(await screen.findByRole('button', { name: 'Ledger' }))
  await waitFor(() => expect(screen.getByRole('button', { name: '100 SAMPLE ST' })).toBeTruthy())
}

function row(over: Partial<ResearchPermitRow> = {}): ResearchPermitRow {
  return {
    id: 'p1',
    city: 'San Antonio',
    source: 'sa-issued',
    permit_number: 'COM-BLG-PMT26-00000001',
    permit_type: 'Comm New Building Permit',
    stage: 'issued',
    residential: false,
    work_type: 'New commercial',
    project_name: null,
    address: '100 SAMPLE ST',
    zip: '78245',
    lat: 29.4,
    lng: -98.5,
    submitted_on: '2026-10-02',
    issued_on: '2026-11-06',
    filed_on: '2026-11-06',
    declared_value: 1_400_000,
    area_sf: 6200,
    contact: 'Ridgeway Builders',
    plumber: null,
    plumber_permit_on: null,
    verdict: null,
    verdict_reason: null,
    verdict_look_again_on: null,
    verdict_prospect_id: null,
    verdict_by: null,
    verdict_by_name: null,
    verdict_at: null,
    ...over,
  }
}

describe('ProspectsResearchTab (v2.6782, punch list #292)', () => {
  beforeEach(() => {
    installDomShims()
    // A worktree with a Maps key in .env.local would mount the Google canvas; the smoke drives the Leaflet stand-in.
    vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', '')
    io.loadResearchPermits.mockReset().mockResolvedValue([row(), row({ id: 'p2', address: '300 HOPKINS ST', plumber: 'Lone Star Plumbing Co.', plumber_permit_on: '2026-11-04' })])
    io.loadLatestPull.mockReset().mockResolvedValue({ ranAt: new Date().toISOString(), error: null })
    io.loadRecordsStart.mockReset().mockResolvedValue(RECORDS_START)
    io.pullPermitsBack.mockReset().mockResolvedValue(6412)
    // The answers table is not on the database unless a test says so: no look-alike chip.
    siteIo.loadAllNameAnswers.mockReset().mockResolvedValue(null)
    siteIo.loadCustomerNames.mockReset().mockResolvedValue([])
    siteIo.loadRecentBidsWithCustomer.mockReset().mockResolvedValue([])
    siteIo.loadPermitsByHouseNumber.mockReset().mockResolvedValue([])
    siteIo.recordNameAnswer.mockReset().mockResolvedValue(undefined)
    io.recordVerdict.mockReset().mockResolvedValue(undefined)
    io.approachFromPermit.mockReset().mockResolvedValue({ prospectId: 'lead-1', companyName: 'Ridgeway Builders', reused: false, deck: 'customer' })
    io.loadLeadDecks.mockReset().mockResolvedValue({})
    io.pullPermitsNow.mockReset().mockResolvedValue({ ok: true, feeds: [{ source: 'sa-issued', seen: 3, kept: 2, error: null }] })
    io.lookupCompany.mockReset().mockResolvedValue({ found: true, facts: { name: 'Ridgeway Builders', phone: '(210) 555-0199', website: 'https://example.com', address: '1 Office Park, San Antonio, TX 78201', kind: 'General contractor', maps_url: null, place_id: 'p', match: 'exact' }, error: null, cached: true, lookedUpAt: '2026-11-09T00:00:00Z' })
    io.lookupParcel.mockReset().mockResolvedValue({ found: true, facts: { prop_id: '1', situs: '100 SAMPLE ST', owner: 'SAMPLE HOLDINGS LLC', owner_address: 'PO BOX 1, SAN ANTONIO TX 78201', dba: null, land_value: 1, improvement_value: 2, total_value: 1_400_000, use_code: '205', year_built: '2001', building_sf: 6200, acres: 0.9, detail_url: 'https://bexar.trueautomation.com/clientdb/Property.aspx?cid=110&prop_id=1' }, error: null, cached: false, lookedUpAt: null })
    io.loadPermitFeedRow.mockReset().mockResolvedValue({ raw: { 'PERMIT TYPE': 'Comm New Building Permit', 'PERMIT #': 'COM-BLG-PMT26-00000001', 'DATE ISSUED': '2026-11-06T00:00:00', 'DECLARED VALUATION': '1400000.0', 'PRIMARY CONTACT': 'Ridgeway Builders', CD: 7, _id: 9 }, source: 'sa-issued', pulledAt: '2026-11-09T11:30:00Z', firstSeenAt: '2026-11-09T11:30:00Z', addressKey: '100 sample st' })
    const site = { permit_number: 'COM-BLG-PMT26-00000001', permit_type: 'Comm New Building Permit', kind: 'building', stage: 'issued', work_type: 'New commercial', submitted_on: '2026-10-02', issued_on: '2026-11-06', contact: 'Ridgeway Builders', address: '100 SAMPLE ST', declared_value: 1_400_000 }
    io.loadSitePermits.mockReset().mockResolvedValue([{ ...site, id: 'p1' }, { ...site, id: 's2', kind: 'other', work_type: 'Commercial site work', issued_on: '2026-10-21' }])
    io.loadBuilderPermits.mockReset().mockResolvedValue([{ ...site, id: 'p1' }, { ...site, id: 'b2', address: '77 KILN ST', issued_on: '2026-10-02' }, { ...site, id: 'b3', contact: 'Ridgeway Roofing', address: '5 ASTER RDG' }])
    streetView.fetchStreetViewMetaWithMonth.mockReset().mockResolvedValue({ lat: 29.4, lng: -98.5, month: '2024-03' })
    streetView.fetchStreetViewImageBlob.mockReset().mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }))
    URL.createObjectURL = vi.fn(() => 'blob:street-view')
    URL.revokeObjectURL = vi.fn()
    io.loadResearchers.mockReset().mockResolvedValue([])
    io.putBackPermit.mockReset().mockResolvedValue(undefined)
    io.loadPermitHistory.mockReset().mockResolvedValue([])
    io.loadBuilders.mockReset().mockResolvedValue([])
    io.markBuilder.mockReset().mockResolvedValue(undefined)
    io.saveBuilder.mockReset().mockResolvedValue(undefined)
    io.loadPermitsOfBuilder.mockReset().mockResolvedValue([])
    io.loadPermitFunnel.mockReset().mockResolvedValue(null)
    io.loadContactHistory.mockReset().mockResolvedValue(new Map([['ridgewaybuilders', { key: 'ridgewaybuilders', bids: 5, won: 3, last_bid_on: '2026-09-01', on_deck: false }]]))
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
  })

  it('draws the waiting rows with the plumber signal, and counts the taken row on its lens', async () => {
    await openLedger()
    expect(screen.getByText('none yet')).toBeTruthy()
    expect(screen.queryByText('300 HOPKINS ST')).toBeNull()
    expect(screen.getByText(/1 to skim · 0 investigating/)).toBeTruthy()
    expect(screen.getByText(/1 have a plumber/)).toBeTruthy()
    expect(io.loadResearchPermits).toHaveBeenCalledWith('San Antonio', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), false)
    // The hint under who pulled it, from our bid history with the name.
    await waitFor(() => expect(screen.getByText('warm')).toBeTruthy())
    expect(screen.getByText('warm').getAttribute('title')).toBe('we won 3 of 5 bids with this name')
  })

  it("Map draws the lens as pins; a pin opens the row's card with its Decide press", async () => {
    await openLedger()
    fireEvent.click(screen.getByRole('button', { name: 'Map' }))
    await waitFor(() => expect(screen.getByTestId('canvas')).toBeTruthy())
    const pin = screen.getByRole('button', { name: /pin 100 SAMPLE ST/ })
    expect(pin.getAttribute('data-color')).toBe('#2563eb')
    fireEvent.click(pin)
    expect(screen.getByText('Selected pin')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Decide…' })).toBeTruthy()
  })

  it('Has a plumber shows who wins what in the window', async () => {
    await openLedger()
    fireEvent.change(screen.getByLabelText('Showing'), { target: { value: 'taken' } })
    expect(screen.getByText(/Who wins what in San Antonio/)).toBeTruthy()
    expect(screen.getByText('Lone Star Plumbing Co. · 1')).toBeTruthy()
  })

  it('opens the sheet on Decide…, refuses an empty reason, then keeps a Pursue with the lead it made', async () => {
    await openLedger()
    fireEvent.click(screen.getByRole('button', { name: 'Decide…' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Pursue · make the lead' }))
    expect(io.recordVerdict).not.toHaveBeenCalled()
    expect(screen.getByText('Say why in a line. The next estimator reads it.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Why'), { target: { value: 'Our size, and we have won with them.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Pursue · make the lead' }))
    await waitFor(() => expect(io.recordVerdict).toHaveBeenCalled())
    expect(io.approachFromPermit).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }), 'gc', 'u1', {})
    expect(io.recordVerdict).toHaveBeenCalledWith(expect.objectContaining({ permitId: 'p1', verdict: 'approach', prospectId: 'lead-1', userId: 'u1' }))
  })

  it('shows the Has a plumber lens with the feed-read row and its Decide anyway', async () => {
    await openLedger()
    fireEvent.change(screen.getByLabelText('Showing'), { target: { value: 'taken' } })
    expect(screen.getByText('300 HOPKINS ST')).toBeTruthy()
    expect(screen.getByText('Lone Star Plumbing Co.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Decide anyway' })).toBeTruthy()
  })

  it('Pull now runs the feed and reads again', async () => {
    await openLedger()
    const before = io.loadResearchPermits.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Pull now' }))
    await waitFor(() => expect(io.pullPermitsNow).toHaveBeenCalled())
    await waitFor(() => expect(io.loadResearchPermits.mock.calls.length).toBeGreaterThan(before))
  })

  it('says what fills an empty ledger before the first pull', async () => {
    io.loadResearchPermits.mockResolvedValue([])
    io.loadLatestPull.mockResolvedValue({ ranAt: null, error: null })
    renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ledger' }))
    await waitFor(() => expect(screen.getByText('No permits yet.')).toBeTruthy())
    expect(screen.getByText(/Not pulled yet/)).toBeTruthy()
  })

  it("the name opens the card with Google's facts and the county's owner, and Pursue carries them onto the lead", async () => {
    await openLedger()
    fireEvent.click(screen.getByRole('button', { name: 'Ridgeway Builders' }))
    await waitFor(() => expect(screen.getByText('(210) 555-0199')).toBeTruthy())
    expect(screen.getByText('SAMPLE HOLDINGS LLC')).toBeTruthy()
    expect(io.lookupCompany).toHaveBeenCalledWith('Ridgeway Builders', 'San Antonio', false)
    expect(io.lookupParcel).toHaveBeenCalledWith('100 SAMPLE ST', 'San Antonio', false)
    fireEvent.click(screen.getByRole('button', { name: 'Pursue with these facts…' }))
    expect(screen.getByText(/The lead carries the phone, the website, the office address, the owner of record/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Why'), { target: { value: 'Found the phone; calling Monday.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Pursue · make the lead' }))
    await waitFor(() => expect(io.approachFromPermit).toHaveBeenCalled())
    expect(io.approachFromPermit).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }), 'gc', 'u1', expect.objectContaining({ phone: '(210) 555-0199', website: 'https://example.com', ownerOfRecord: 'SAMPLE HOLDINGS LLC' }))
  })

  it('the address opens The building: the county, every field the city sent, the permits on the address, and a Google search', async () => {
    await openLedger()
    fireEvent.click(screen.getByRole('button', { name: '100 SAMPLE ST' }))
    await waitFor(() => expect(screen.getByText('SAMPLE HOLDINGS LLC')).toBeTruthy())
    expect(screen.getByRole('dialog').textContent).toContain('The building')
    expect(io.loadPermitFeedRow).toHaveBeenCalledWith('p1')
    expect(io.loadSitePermits).toHaveBeenCalledWith('San Antonio', 'COM-BLG-PMT26-00000001', '100 sample st')
    expect(io.lookupParcel).toHaveBeenCalledWith('100 SAMPLE ST', 'San Antonio', false)
    // The Google press is a link to a search for the address, in a new tab.
    const google = screen.getByRole('link', { name: 'Search Google for 100 SAMPLE ST' })
    expect(google.getAttribute('href')).toBe('https://www.google.com/search?q=%22100%20SAMPLE%20ST%22%20San%20Antonio%20TX%2078245')
    expect(google.getAttribute('target')).toBe('_blank')
    // Every permit on the address, and whether a plumbing permit is among them.
    await waitFor(() => expect(screen.getByText('The feed holds 2 permits on this address. A plumbing permit is not among them yet.')).toBeTruthy())
    expect(screen.getByText('Commercial site work')).toBeTruthy()
    // The feed's own row sits behind one press: five columns, the row id left out.
    fireEvent.click(screen.getByRole('button', { name: 'Show all 6 fields the city sent' }))
    expect(screen.getByText('Declared value')).toBeTruthy()
    expect(screen.getByText('$1,400,000')).toBeTruthy()
    expect(screen.getByText('Cd')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open the county clerk’s records' }).getAttribute('href')).toBe('https://bexar.tx.publicsearch.us/')
    // Pulled by opens the Who card on the same permit.
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Ridgeway Builders' }))
    await waitFor(() => expect(screen.getByText('(210) 555-0199')).toBeTruthy())
  })

  it("the Who card lists the name's other permits and searches Google for the company; the ledger carries the same press", async () => {
    await openLedger()
    expect(screen.getByRole('link', { name: 'Search Google for Ridgeway Builders' }).getAttribute('href')).toBe('https://www.google.com/search?q=%22Ridgeway%20Builders%22%20San%20Antonio%20TX')
    fireEvent.click(screen.getByRole('button', { name: 'Ridgeway Builders' }))
    await waitFor(() => expect(screen.getByText(`This name is on 1 other permit we can see ${SINCE}.`)).toBeTruthy())
    expect(io.loadRecordsStart).toHaveBeenCalledWith('San Antonio')
    expect(io.loadBuilderPermits).toHaveBeenCalledWith('San Antonio', 'ridgeway', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
    expect(screen.getByText(/77 KILN ST/)).toBeTruthy()
    expect(screen.queryByText(/5 ASTER RDG/)).toBeNull()
    expect(screen.getByText('Google the company')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open the state’s search' }).getAttribute('href')).toBe('https://comptroller.texas.gov/taxes/franchise/account-status/search')
  })

  describe('the skim (punch list #302)', () => {
    it('opens on one heavy read, not two: the ledger reads its rows only when it is opened', async () => {
      renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
      await waitFor(() => expect(screen.getByRole('button', { name: 'Skim 1' })).toBeTruthy())
      // The every-permit read, once. The ledger's windowed read has not run, and the Pulled line read on its own.
      expect(io.loadResearchPermits).toHaveBeenCalledTimes(1)
      expect(io.loadResearchPermits).toHaveBeenCalledWith('San Antonio', '2000-01-01', false)
      expect(io.loadLatestPull).toHaveBeenCalledWith('San Antonio')
      fireEvent.click(screen.getByRole('button', { name: 'Ledger' }))
      await waitFor(() => expect(io.loadResearchPermits).toHaveBeenCalledTimes(2))
      expect(io.loadResearchPermits).toHaveBeenLastCalledWith('San Antonio', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), false)
    })

    it('opens on one card, best first, and holds an answer until the next one so Undo can take it back', async () => {
      renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
      await waitFor(() => expect(screen.getByRole('button', { name: 'Skim 1' })).toBeTruthy())
      // The row with a plumbing permit never enters the deck; the one that waits says why it leads.
      expect(screen.getByText('No plumber yet · a builder we won with · $1.4M')).toBeTruthy()
      expect(screen.queryByText('300 HOPKINS ST')).toBeNull()
      expect(io.loadResearchPermits).toHaveBeenCalledWith('San Antonio', '2000-01-01', false)
      // The county's owner of record fills the Property line for the top card.
      await waitFor(() => expect(screen.getByRole('button', { name: 'SAMPLE HOLDINGS LLC' })).toBeTruthy())

      fireEvent.click(screen.getByRole('button', { name: 'Investigate' }))
      expect(screen.getByText('Nothing waiting on a skim.')).toBeTruthy()
      expect(screen.getByText('Marked to investigate.')).toBeTruthy()
      expect(io.recordVerdict).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
      expect(screen.getByRole('button', { name: 'Skim 1' })).toBeTruthy()
      expect(io.recordVerdict).not.toHaveBeenCalled()

      // A pass offers its reasons in the bar; the answer is written when the deck is left.
      fireEvent.click(screen.getByRole('button', { name: 'Pass' }))
      expect(screen.getByText('Passed. Why?')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Too far' }))
      expect(io.recordVerdict).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Ledger' }))
      await waitFor(() => expect(io.recordVerdict).toHaveBeenCalledTimes(1))
      expect(io.recordVerdict).toHaveBeenCalledWith({ permitId: 'p1', verdict: 'not_for_us', reason: 'Passed on the skim: too far.', lookAgainOn: null, prospectId: null, userId: 'u1', reasonCode: 'too_far', forUserId: null })
    })

    it('answers by arrow key on a desk, and Dig in opens the kept ones', async () => {
      renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
      await waitFor(() => expect(screen.getByRole('button', { name: 'Skim 1' })).toBeTruthy())
      fireEvent.keyDown(window, { key: 'ArrowRight' })
      expect(screen.getByText('Nothing waiting on a skim.')).toBeTruthy()
      expect(screen.getByText('You answered 1 just now: 1 to investigate, 0 passed. The next pull is tomorrow at 5:30 AM.')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Dig in · 1 to investigate' }))
      await waitFor(() => expect(io.recordVerdict).toHaveBeenCalledWith(expect.objectContaining({ permitId: 'p1', verdict: 'look', reason: 'Marked to investigate on the skim.' })))
      // The kept permit is on the Kept list at once, and the strip counts it.
      await waitFor(() => expect(screen.getByText(/^Marked to investigate by /)).toBeTruthy())
      expect(screen.getByRole('button', { name: 'Investigating 1' }).getAttribute('aria-pressed')).toBe('true')
      expect(screen.getByRole('button', { name: 'Skim 0' })).toBeTruthy()
    })

    it('the Property line opens The building with Keep and Pass at its foot', async () => {
      renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
      await waitFor(() => expect(screen.getByRole('button', { name: 'SAMPLE HOLDINGS LLC' })).toBeTruthy())
      fireEvent.click(screen.getByRole('button', { name: 'SAMPLE HOLDINGS LLC' }))
      const dialog = await screen.findByRole('dialog')
      expect(dialog.textContent).toContain('The building')
      expect(within(dialog).queryByRole('button', { name: 'Decide…' })).toBeNull()
      fireEvent.click(within(dialog).getByRole('button', { name: 'Investigate' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(screen.getByText('Marked to investigate.')).toBeTruthy()
    })

    it('draws a street view with its month and a map with the miles across the top of the card', async () => {
      renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
      await waitFor(() => expect(screen.getByText('Street view · Mar 2024')).toBeTruthy())
      expect(streetView.fetchStreetViewMetaWithMonth).toHaveBeenCalledWith('100 SAMPLE ST, San Antonio, TX, 78245')
      const street = screen.getByRole('link', { name: 'Open Street View in Google, in a new tab' })
      expect(street.getAttribute('href')).toContain('map_action=pano')
      expect(street.querySelector('img')?.getAttribute('src')).toBe('blob:street-view')
      // The map is a still of tiles with the permit in its middle, and a door to Google Maps.
      const map = screen.getAllByRole('link', { name: 'Open the site in Google Maps, in a new tab' }).pop() as HTMLElement
      expect(map.getAttribute('href')).toContain('google.com/maps/search')
      expect(map.querySelector('img')?.getAttribute('src')).toMatch(/^https:\/\/tile\.openstreetmap\.org\/11\//)
    })

    it('shows satellite, and says so, where there is no street view', async () => {
      streetView.fetchStreetViewMetaWithMonth.mockResolvedValue(null)
      renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
      await waitFor(() => expect(screen.getByText('No street view · satellite')).toBeTruthy())
      expect(streetView.fetchStreetViewImageBlob).not.toHaveBeenCalled()
      expect(document.querySelector('img[src*="World_Imagery"]')).toBeTruthy()
    })

    it('a write that fails names the permit, says why, and puts the card back', async () => {
      io.recordVerdict.mockRejectedValueOnce({ message: 'new row violates row-level security policy' })
      renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
      await waitFor(() => expect(screen.getByRole('button', { name: 'Skim 1' })).toBeTruthy())
      fireEvent.click(screen.getByRole('button', { name: 'Pass' }))
      fireEvent.click(screen.getByRole('button', { name: 'Map' }))
      await waitFor(() => expect(io.recordVerdict).toHaveBeenCalledTimes(1))
      fireEvent.click(screen.getByRole('button', { name: /^Skim/ }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Skim 1' })).toBeTruthy())
    })
  })

  describe('the four places, builders and the count (punch list #302, PR 6 to 8)', () => {
    const kept = () => row({ id: 'k1', address: '77 KILN ST', permit_number: 'COM-2', verdict: 'look', verdict_reason: 'Kept on the skim.', verdict_by: 'u1', verdict_by_name: 'Eve', verdict_at: '2026-11-08T15:00:00Z', builder_key: 'ridgewaybuilders', builder_mark: 'good', builder_mark_reason: 'Pays on time.', builder_mark_by_name: 'Eve', builder_permits: 4, builder_open: 2 })
    const passed = (over: Partial<ResearchPermitRow> = {}) => row({ id: 'c1', address: '60 MILLRACE ROW', permit_number: 'COM-3', contact: 'Tall Pine Development', verdict: 'not_for_us', verdict_reason: 'Passed on the skim: too far.', verdict_reason_code: 'too_far', verdict_by_name: 'Eve', verdict_at: '2026-11-09T15:00:00Z', ...over })

    it('the strip counts the four places, and the deck shows a mark and hands a keep to a person', async () => {
      io.loadResearchPermits.mockResolvedValue([row({ builder_mark: 'good', builder_mark_reason: 'Pays on time.', builder_mark_by_name: 'Eve', builder_permits: 4, builder_open: 2 }), kept(), passed()])
      io.loadResearchers.mockResolvedValue([{ id: 'u1', name: 'Eve' }, { id: 'u2', name: 'Sam' }])
      renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
      await waitFor(() => expect(screen.getByRole('button', { name: 'Skim 1' })).toBeTruthy())
      expect(screen.getByRole('button', { name: 'Investigating 1' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Closed 1' })).toBeTruthy()
      expect(screen.getByText('Good')).toBeTruthy()
      await waitFor(() => expect(screen.getByText(`4 permits ${SINCE}. 2 have no plumber yet.`)).toBeTruthy())
      // The mark lifts the card and says so.
      expect(screen.getByText('No plumber yet · a builder marked Good · a builder we won with')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Investigate' }))
      await waitFor(() => expect(screen.getByText('Investigating. Who?')).toBeTruthy())
      fireEvent.click(screen.getByRole('button', { name: 'Sam' }))
      // The strip is the one count: the held keep has left Skim and reads on Kept before it is written.
      expect(screen.getByRole('button', { name: 'Skim 0' })).toBeTruthy()
      expect(io.recordVerdict).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Investigating 2' }))
      await waitFor(() => expect(io.recordVerdict).toHaveBeenCalledWith(expect.objectContaining({ permitId: 'p1', verdict: 'look', forUserId: 'u2' })))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Investigating 2' })).toBeTruthy())
      expect(screen.getByText(/Marked to investigate by Eve for Sam/)).toBeTruthy()
    })

    describe('more than one city (punch list #292, revision 4)', () => {
      it('the picker lists Austin, reads its permits, pulls it by name, and says whose county keeps the record', async () => {
        window.localStorage.removeItem('permits.lastCity')
        io.loadResearchPermits.mockImplementation(async (city: string) => (city === 'Austin' ? [row({ id: 'a1', city: 'Austin', address: '100 SAMPLE LN', permit_number: '2026-000001 BP' })] : []))
        io.lookupParcel.mockResolvedValue({ found: false, facts: null, error: null, cached: true, lookedUpAt: null })
        renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
        const picker = (await screen.findByLabelText('City')) as HTMLSelectElement
        expect([...picker.options].map((o) => o.value)).toEqual(['San Antonio', 'Austin', 'New Braunfels', 'San Marcos', 'Seguin'])
        fireEvent.change(picker, { target: { value: 'Austin' } })
        await waitFor(() => expect(io.loadResearchPermits).toHaveBeenCalledWith('Austin', '2000-01-01', false))
        expect(await screen.findByText('100 SAMPLE LN, 78245')).toBeTruthy()
        await waitFor(() => expect(screen.getByText('Travis County’s record is not read here yet. Its appraisal district has it.')).toBeTruthy())
        // The browser remembers the city, and Pull now pulls the one on screen.
        expect(window.localStorage.getItem('permits.lastCity')).toBe('Austin')
        fireEvent.click(screen.getByRole('button', { name: 'Pull now' }))
        await waitFor(() => expect(io.pullPermitsNow).toHaveBeenCalledWith('Austin'))
        window.localStorage.removeItem('permits.lastCity')
      })
    })

    describe('Find a permit, and the map of what is closed', () => {
      const byCity = (city: string): ResearchPermitRow[] =>
        city === 'San Antonio'
          ? [row(), passed({ verdict_by: 'u2', verdict_by_name: 'Sam' })]
          : city === 'Austin'
            ? [row({ id: 'a1', city: 'Austin', address: '900 LAMAR SAMPLE BLVD', permit_number: '2026-000900 BP', contact: 'Hill Country Builders', project_name: 'Lamar Clinic' })]
            : []

      it('finds a permit on any list and in any city, says where it sits, and opens it', async () => {
        io.loadResearchPermits.mockImplementation(async (city: string) => byCity(city))
        renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
        fireEvent.click(await screen.findByRole('button', { name: 'Find a permit' }))
        const box = screen.getByRole('searchbox', { name: 'Find a permit' })
        // The other cities are read when the search opens.
        await waitFor(() => expect(io.loadResearchPermits).toHaveBeenCalledWith('Austin', '2000-01-01', false))

        // A street in the city on screen: the passed permit, with its place and its last move.
        fireEvent.change(box, { target: { value: 'millrace' } })
        expect(await screen.findByText('Closed · passed')).toBeTruthy()
        expect(screen.getByText('Sam passed, Nov 9: too far')).toBeTruthy()
        expect(await screen.findByText('1 found')).toBeTruthy()
        // A pass can be turned around from the result.
        expect(screen.getByRole('button', { name: 'Investigate' })).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Put back' })).toBeTruthy()

        // A city and a builder: the permit in the other city, still waiting on its skim.
        fireEvent.change(box, { target: { value: 'austin hill country' } })
        expect(await screen.findByText(/900 LAMAR SAMPLE BLVD, Austin/)).toBeTruthy()
        expect(screen.getByText('Waiting on a skim')).toBeTruthy()
        expect(screen.queryByText('Closed · passed')).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: /^Lamar Clinic/ }))
        const sheet = await screen.findByRole('dialog')
        expect(within(sheet).getByText('900 LAMAR SAMPLE BLVD')).toBeTruthy()
      })

      it('looks in one city when asked, and says so when nothing matches', async () => {
        io.loadResearchPermits.mockImplementation(async (city: string) => byCity(city))
        renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
        fireEvent.click(await screen.findByRole('button', { name: 'Find a permit' }))
        fireEvent.click(screen.getByRole('button', { name: 'San Antonio only' }))
        fireEvent.change(screen.getByRole('searchbox', { name: 'Find a permit' }), { target: { value: 'lamar' } })
        expect(await screen.findByText('No permits match ‘lamar’.')).toBeTruthy()
        fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }))
        expect((screen.getByRole('searchbox', { name: 'Find a permit' }) as HTMLInputElement).value).toBe('')
      })

      it('a city that cannot be read is named, and the others are still searched', async () => {
        io.loadResearchPermits.mockImplementation(async (city: string) => {
          if (city === 'Seguin') throw new Error('the read timed out')
          return byCity(city)
        })
        renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
        fireEvent.click(await screen.findByRole('button', { name: 'Find a permit' }))
        expect(await screen.findByText(/Seguin could not be read: .*the read timed out.* The other cities are searched\./)).toBeTruthy()
        fireEvent.change(screen.getByRole('searchbox', { name: 'Find a permit' }), { target: { value: 'lamar' } })
        expect(await screen.findByText(/900 LAMAR SAMPLE BLVD, Austin/)).toBeTruthy()
      })

      it('Closed can be read on a map, where a pin opens the permit with Investigate and Put back', async () => {
        io.loadResearchPermits.mockResolvedValue([passed({ verdict_by: 'u2', verdict_by_name: 'Sam' })])
        renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
        fireEvent.click(await screen.findByRole('button', { name: 'Closed 1' }))
        fireEvent.click(await screen.findByRole('button', { name: 'On a map' }))
        // The list gives way to the map, with the same permits as pins.
        fireEvent.click(await screen.findByRole('button', { name: /^pin / }))
        expect(await screen.findByRole('button', { name: 'Investigate' })).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Put back' })).toBeTruthy()
        fireEvent.click(screen.getByRole('button', { name: 'List' }))
        expect(await screen.findByText('Passed on the skim: too far.')).toBeTruthy()
      })
    })

    describe('the second look at what someone else passed', () => {
      const samPassed = () => passed({ verdict_by: 'u2', verdict_by_name: 'Sam' })

      it('deals what someone else passed, says who and why, and a second pass closes it for good', async () => {
        io.loadResearchPermits.mockResolvedValue([samPassed()])
        renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
        fireEvent.click(await screen.findByRole('button', { name: 'Second look: 1 passed by someone else' }))
        expect(screen.getByText(/^Passed by Sam, .*: too far$/)).toBeTruthy()
        expect(screen.getByText('60 MILLRACE ROW, 78245')).toBeTruthy()

        fireEvent.click(screen.getByRole('button', { name: 'Pass' }))
        expect(screen.getByText('Passed again. Why?')).toBeTruthy()
        expect(screen.getByText('Nothing waiting on a second look.')).toBeTruthy()
        // The chip is the count: the card left the deck, and a pass moves nothing between the places.
        expect(screen.getByRole('button', { name: 'Second look: 0 passed by someone else' })).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Closed 1' })).toBeTruthy()
        expect(io.recordVerdict).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'Not our work' }))
        fireEvent.click(screen.getByRole('button', { name: 'Closed 1' }))
        await waitFor(() => expect(io.recordVerdict).toHaveBeenCalledWith(expect.objectContaining({ permitId: 'c1', verdict: 'not_for_us', reason: 'Passed on a second look: not our work.', reasonCode: 'sl_not_our_work' })))
        // Two people have said no: it waits on nobody's second look now, and off the deck the segment is gone.
        await waitFor(() => expect(screen.queryByRole('button', { name: /^Second look:/ })).toBeNull())
      })

      it('a keep sends it to Kept under the second person, and Undo takes it back first', async () => {
        io.loadResearchPermits.mockResolvedValue([samPassed()])
        renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
        fireEvent.click(await screen.findByRole('button', { name: 'Second look: 1 passed by someone else' }))
        fireEvent.click(screen.getByRole('button', { name: 'Investigate' }))
        expect(screen.getByRole('button', { name: 'Investigating 1' })).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Closed 0' })).toBeTruthy()
        fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
        expect(screen.getByRole('button', { name: 'Second look: 1 passed by someone else' })).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Closed 1' })).toBeTruthy()
        expect(io.recordVerdict).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'Investigate' }))
        fireEvent.click(screen.getByRole('button', { name: 'Investigating 1' }))
        await waitFor(() => expect(io.recordVerdict).toHaveBeenCalledWith(expect.objectContaining({ permitId: 'c1', verdict: 'look', reason: 'Marked to investigate on a second look, after Sam passed.', reasonCode: null })))
        await waitFor(() => expect(screen.getByText(/^Marked to investigate by /)).toBeTruthy())
      })

      it('my own pass and a permit passed twice wait on nothing, and the caught-up skim offers the deck', async () => {
        io.loadResearchPermits.mockResolvedValue([passed({ verdict_by: 'u1' }), passed({ id: 'c2', permit_number: 'COM-4', verdict_by: 'u2', verdict_reason_code: 'sl_none', verdict_reason: 'Passed on a second look.' })])
        renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
        // Nothing waits, so Skim stands alone on the strip: no grey segment beside it.
        await screen.findByRole('button', { name: 'Skim 0' })
        expect(screen.queryByRole('button', { name: /^Second look:/ })).toBeNull()
        cleanup()

        io.loadResearchPermits.mockResolvedValue([samPassed()])
        renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
        expect(await screen.findByText('Nothing waiting on a skim.')).toBeTruthy()
        fireEvent.click(screen.getByRole('button', { name: 'Second look · 1 someone else passed' }))
        expect(screen.getByText(/^Passed by Sam/)).toBeTruthy()
      })
    })

    it('a kept permit opens with the close-out: Not pursuing takes one tap of why', async () => {
      io.loadResearchPermits.mockResolvedValue([kept()])
      io.loadPermitHistory.mockResolvedValue([{ id: 'e1', verdict: 'look', reason: 'Kept on the skim.', reason_code: null, decided_at: '2026-11-08T15:00:00Z', by_name: 'Eve', for_name: null, pursue_for: null }])
      renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
      fireEvent.click(await screen.findByRole('button', { name: 'Investigating 1' }))
      fireEvent.click(await screen.findByRole('button', { name: 'New commercial, 6,200 sq ft' }))
      const sheet = await screen.findByRole('dialog')
      await waitFor(() => expect(within(sheet).getByText('What we did')).toBeTruthy())
      await waitFor(() => expect(within(sheet).getByText('Eve chose to investigate, Nov 8')).toBeTruthy())
      fireEvent.click(within(sheet).getByRole('button', { name: 'Not pursuing…' }))
      // The press says what it will do, and rests until a reason is picked.
      const rest = screen.getByRole('button', { name: 'Pick a reason' })
      fireEvent.click(rest)
      expect(io.recordVerdict).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Could not reach anyone' }))
      fireEvent.click(screen.getByRole('button', { name: 'Not pursuing · could not reach anyone' }))
      await waitFor(() => expect(io.recordVerdict).toHaveBeenCalledWith(expect.objectContaining({ permitId: 'k1', verdict: 'not_for_us', reason: 'Not pursuing: could not reach anyone.', reasonCode: 'np_no_answer' })))
    })

    it('Pursue says what it is for and who follows up, and makes the lead', async () => {
      io.loadResearchPermits.mockResolvedValue([kept()])
      io.loadResearchers.mockResolvedValue([{ id: 'u1', name: 'Eve' }, { id: 'u2', name: 'Sam' }])
      renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
      fireEvent.click(await screen.findByRole('button', { name: 'Investigating 1' }))
      fireEvent.click(await screen.findByRole('button', { name: 'New commercial, 6,200 sq ft' }))
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Pursue…' }))
      fireEvent.click(screen.getByRole('button', { name: 'Their next jobs' }))
      fireEvent.click(screen.getByRole('button', { name: 'Sam' }))
      expect(screen.getByText('A lead goes on the Customers deck with the permit in its notes. A lead of the same name is reused.')).toBeTruthy()
      fireEvent.change(screen.getByLabelText('They are'), { target: { value: 'owner' } })
      expect(screen.getByText('A lead goes on the Jobs to GC deck with the permit as a job on it. A lead of the same name is reused.')).toBeTruthy()
      fireEvent.change(screen.getByLabelText('They are'), { target: { value: 'gc' } })
      fireEvent.click(screen.getByRole('button', { name: 'Pursue · hand to Sam' }))
      await waitFor(() => expect(io.approachFromPermit).toHaveBeenCalledWith(expect.objectContaining({ id: 'k1' }), 'gc', 'u1', {}))
      expect(await screen.findByText('Lead made: Ridgeway Builders, on the Customers deck.')).toBeTruthy()
      await waitFor(() => expect(io.recordVerdict).toHaveBeenCalledWith(expect.objectContaining({ permitId: 'k1', verdict: 'approach', reason: 'Pursued for their next jobs.', prospectId: 'lead-1', pursueFor: 'next_jobs', forUserId: 'u2' })))
    })

    it('a pursued permit opens its lead on the deck the lead sits on', async () => {
      io.loadResearchPermits.mockResolvedValue([{ ...kept(), id: 'q1', verdict: 'approach', verdict_prospect_id: 'lead-c' }, { ...kept(), id: 'q2', address: '9 KILN ST', permit_number: 'COM-9', verdict: 'approach', verdict_prospect_id: 'lead-g' }])
      io.loadLeadDecks.mockResolvedValue({ 'lead-c': 'customer', 'lead-g': 'gc_lead' })
      renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
      fireEvent.click(await screen.findByRole('button', { name: 'Pursuing 2' }))
      await waitFor(() => expect(io.loadLeadDecks).toHaveBeenCalledWith(['lead-c', 'lead-g']))
      await waitFor(() => expect(screen.getAllByRole('link', { name: 'the lead' }).map((a) => a.getAttribute('href'))).toEqual(['/prospects?tab=follow-up&kind=customers&prospect_id=lead-c', '/prospects?tab=follow-up&kind=gc-leads&prospect_id=lead-g']))
    })

    it('Closed finds a passed permit by its street and puts it back', async () => {
      io.loadResearchPermits.mockResolvedValue([kept(), passed()])
      renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
      fireEvent.click(await screen.findByRole('button', { name: 'Closed 1' }))
      await waitFor(() => expect(screen.getByText('Passed on the skim: too far.')).toBeTruthy())
      fireEvent.change(screen.getByLabelText('Search closed permits'), { target: { value: 'kiln' } })
      expect(screen.getByText('No closed permits match ‘kiln’.')).toBeTruthy()
      fireEvent.change(screen.getByLabelText('Search closed permits'), { target: { value: 'millrace' } })
      fireEvent.click(screen.getByRole('button', { name: 'Put back' }))
      await waitFor(() => expect(io.putBackPermit).toHaveBeenCalledWith('c1', 'u1'))
    })

    describe('anyone moves a pass to Kept, and every card says who moved what and when', () => {
      it('a passed row has Keep for anyone, the one who passed included, and the words say whose pass it was', async () => {
        io.loadResearchPermits.mockResolvedValue([passed({ verdict_by: 'u1' })])
        renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
        fireEvent.click(await screen.findByRole('button', { name: 'Closed 1' }))
        fireEvent.click(await screen.findByRole('button', { name: 'Investigate' }))
        await waitFor(() => expect(io.recordVerdict).toHaveBeenCalledWith(expect.objectContaining({ permitId: 'c1', verdict: 'look', reason: 'Marked to investigate from Passed, after Eve passed.' })))
      })

      it('a permit passed twice can still be kept from the list, and one a plumber has cannot', async () => {
        io.loadResearchPermits.mockResolvedValue([passed({ verdict_reason_code: 'sl_none', verdict_reason: 'Passed on a second look.' })])
        renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
        fireEvent.click(await screen.findByRole('button', { name: 'Closed 1' }))
        expect(await screen.findByRole('button', { name: 'Investigate' })).toBeTruthy()
        cleanup()

        io.loadResearchPermits.mockResolvedValue([passed({ plumber_permit_on: '2026-11-08' })])
        renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
        fireEvent.click(await screen.findByRole('button', { name: 'Closed 1' }))
        fireEvent.click(await screen.findByRole('button', { name: /^Has a plumber/ }))
        await screen.findByText('60 MILLRACE ROW · Tall Pine Development')
        expect(screen.queryByRole('button', { name: 'Investigate' })).toBeNull()
      })

      const twoMoves = [
        { id: 'e2', verdict: 'back', reason: 'Put back on the skim.', reason_code: null, decided_at: '2026-11-09T16:00:00Z', by_name: 'Eve', for_name: null, pursue_for: null },
        { id: 'e1', verdict: 'not_for_us', reason: 'Passed on the skim: too far.', reason_code: 'too_far', decided_at: '2026-11-08T16:00:00Z', by_name: 'Sam', for_name: null, pursue_for: null },
      ]

      it('a skim card that was moved before says so, newest first, and its sheet holds the same lines', async () => {
        io.loadPermitHistory.mockResolvedValue(twoMoves)
        renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
        expect(await screen.findByText('Eve put it back on the skim, Nov 9')).toBeTruthy()
        expect(screen.getByText('Sam passed, Nov 8: too far')).toBeTruthy()
        expect(screen.getByText('History')).toBeTruthy()
        expect(io.loadPermitHistory).toHaveBeenCalledWith('p1')
        fireEvent.click(screen.getByRole('button', { name: 'SAMPLE HOLDINGS LLC' }))
        const sheet = await screen.findByRole('dialog')
        await waitFor(() => expect(within(sheet).getByText('Sam passed, Nov 8: too far')).toBeTruthy())
        expect(within(sheet).getByText('What we did')).toBeTruthy()
      })

      it('a card nobody has answered draws no history row, and its sheet says nobody has', async () => {
        renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
        await waitFor(() => expect(screen.getByRole('button', { name: 'SAMPLE HOLDINGS LLC' })).toBeTruthy())
        expect(screen.queryByText('History')).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: 'SAMPLE HOLDINGS LLC' }))
        const sheet = await screen.findByRole('dialog')
        await waitFor(() => expect(within(sheet).getByText('Nobody has answered this permit yet.')).toBeTruthy())
      })

      it('a second-look card leaves out the pass its amber line says and shows what came before', async () => {
        io.loadResearchPermits.mockResolvedValue([passed({ verdict_by: 'u2', verdict_by_name: 'Sam' })])
        io.loadPermitHistory.mockResolvedValue([
          { id: 'e3', verdict: 'not_for_us', reason: 'Passed on the skim: too far.', reason_code: 'too_far', decided_at: '2026-11-09T15:00:00Z', by_name: 'Sam', for_name: null, pursue_for: null },
          { id: 'e2', verdict: 'back', reason: 'Put back on the skim.', reason_code: null, decided_at: '2026-11-08T15:00:00Z', by_name: 'Eve', for_name: null, pursue_for: null },
        ])
        renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
        fireEvent.click(await screen.findByRole('button', { name: 'Second look: 1 passed by someone else' }))
        expect(await screen.findByText('Eve put it back on the skim, Nov 8')).toBeTruthy()
        expect(screen.getByText('Before')).toBeTruthy()
        expect(screen.queryByText('Sam passed, Nov 9: too far')).toBeNull()
      })
    })

    it('Builders lists who is building, and a mark needs its reason', async () => {
      io.loadBuilders.mockResolvedValue([
        { key: 'tallpinedevelopment', name: null, sample_contact: 'Tall Pine Development', kind: null, customer_id: null, mark: null, mark_reason: null, mark_by_name: null, mark_at: null, permits: 5, open: 1, last_permit_on: '2026-11-08', plumber: 'Copperline Mechanical', plumber_jobs: 4, bids: 0, won: 0, last_bid_on: null },
        { key: 'ridgewaybuilders', name: null, sample_contact: 'Dana Whitlock, Ridgeway Builders', kind: 'gc', customer_id: null, mark: 'good', mark_reason: 'Pays on time.', mark_by_name: 'Eve', mark_at: '2026-03-03T15:00:00Z', permits: 4, open: 2, last_permit_on: '2026-11-06', plumber: 'Blue Heron Plumbing', plumber_jobs: 2, bids: 5, won: 3, last_bid_on: '2026-06-01' },
      ])
      renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
      fireEvent.click(await screen.findByRole('button', { name: 'Builders' }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Tall Pine Development' })).toBeTruthy())
      expect(screen.getByRole('button', { name: '3 or more permits and never bid 1' })).toBeTruthy()
      expect(screen.getByText('5 priced, 3 won')).toBeTruthy()
      expect(screen.getByText('Copperline Mechanical on 4')).toBeTruthy()
      // Every count says how far back it can see: the line over the list, the column, the sheet.
      await waitFor(() => expect(screen.getByText(`San Antonio's records here start ${SINCE.replace('since ', '')}. Every count is what we can see since then.`)).toBeTruthy())
      expect(screen.getByRole('columnheader', { name: `Permits ${SINCE}` })).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Tall Pine Development' }))
      const sheet = await screen.findByRole('dialog')
      expect(within(sheet).getByText(new RegExp(`^5 permits ${SINCE}, 1 with no plumber yet`))).toBeTruthy()
      expect(within(sheet).getByText(`Their permits ${SINCE}`)).toBeTruthy()
      fireEvent.click(within(sheet).getByRole('button', { name: 'Avoid' }))
      fireEvent.click(within(sheet).getByRole('button', { name: 'Mark as Avoid' }))
      expect(io.markBuilder).not.toHaveBeenCalled()
      expect(within(sheet).getByText('Say why in a line. Every estimator reads it on the card.')).toBeTruthy()
      fireEvent.change(within(sheet).getByLabelText('Why, in a line'), { target: { value: 'Slow pay on the Millrace job.' } })
      fireEvent.click(within(sheet).getByRole('button', { name: 'Mark as Avoid' }))
      await waitFor(() => expect(io.markBuilder).toHaveBeenCalledWith('tallpinedevelopment', 'avoid', 'Slow pay on the Millrace job.', 'u1'))
    })

    it('lists the names that look like a customer behind a chip, and ties one on the press', async () => {
      io.loadBuilders.mockResolvedValue([
        { key: 'tallpinedevelopmentgroup', name: null, sample_contact: 'Tall Pine Development Group LLC', kind: null, customer_id: null, mark: null, mark_reason: null, mark_by_name: null, mark_at: null, permits: 5, open: 1, last_permit_on: '2026-11-08', plumber: null, plumber_jobs: 0, bids: 0, won: 0, last_bid_on: null },
        { key: 'copperlinemechanical', name: null, sample_contact: 'Copperline Mechanical', kind: null, customer_id: null, mark: null, mark_reason: null, mark_by_name: null, mark_at: null, permits: 3, open: 0, last_permit_on: '2026-11-01', plumber: null, plumber_jobs: 0, bids: 0, won: 0, last_bid_on: null },
      ])
      siteIo.loadAllNameAnswers.mockResolvedValue({ rows: [], me: 'u1' })
      siteIo.loadCustomerNames.mockResolvedValue([{ id: 'c7', name: 'Tall Pine Development' }, { id: 'c8', name: 'Larkspur Dental' }])
      renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
      fireEvent.click(await screen.findByRole('button', { name: 'Builders' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Looks like a customer 1' }))
      expect(await screen.findByText('One name begins the other')).toBeTruthy()
      expect(screen.getByText('Tall Pine Development', { selector: 'strong' })).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Same company' }))
      await waitFor(() => expect(siteIo.recordNameAnswer).toHaveBeenCalledWith({ builderKey: 'tallpinedevelopmentgroup', customerId: 'c7', answer: 'works_for', scope: 'all', permitId: null, name: 'Tall Pine Development Group LLC' }))
    })

    it('draws no look-alike chip before the answers table is on the database', async () => {
      io.loadBuilders.mockResolvedValue([{ key: 'tallpinedevelopment', name: null, sample_contact: 'Tall Pine Development', kind: null, customer_id: null, mark: null, mark_reason: null, mark_by_name: null, mark_at: null, permits: 5, open: 1, last_permit_on: '2026-11-08', plumber: null, plumber_jobs: 0, bids: 0, won: 0, last_bid_on: null }])
      renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
      fireEvent.click(await screen.findByRole('button', { name: 'Builders' }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Tall Pine Development' })).toBeTruthy())
      expect(screen.queryByRole('button', { name: /^Looks like a customer/ })).toBeNull()
    })

    it('draws no Read back press while the read back is held, and still says where the records start', async () => {
      io.loadBuilders.mockResolvedValue([{ key: 'tallpinedevelopment', name: null, sample_contact: 'Tall Pine Development', kind: null, customer_id: null, mark: null, mark_reason: null, mark_by_name: null, mark_at: null, permits: 5, open: 1, last_permit_on: '2026-11-08', plumber: null, plumber_jobs: 0, bids: 0, won: 0, last_bid_on: null }])
      renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
      fireEvent.click(await screen.findByRole('button', { name: 'Builders' }))
      await waitFor(() => expect(screen.getByText(/records here start/)).toBeTruthy())
      expect(screen.queryByRole('button', { name: /^Read back to / })).toBeNull()
      expect(io.pullPermitsBack).not.toHaveBeenCalled()
    })

    it('claims no span when no pull is on record, and a year once the records reach one', async () => {
      io.loadRecordsStart.mockResolvedValue(null)
      io.loadResearchPermits.mockResolvedValue([row({ builder_permits: 4, builder_open: 2 })])
      const first = renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
      await waitFor(() => expect(screen.getByText('4 permits we can see. 2 have no plumber yet.')).toBeTruthy())
      first.unmount()
      io.loadRecordsStart.mockResolvedValue(ymdPlusDays(todayYmdInAppTz(), -800))
      renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
      await waitFor(() => expect(screen.getByText('4 permits in the last year. 2 have no plumber yet.')).toBeTruthy())
    })

    it('says Builders is not open yet before the database change is in, and shows the count once it answers', async () => {
      io.loadBuilders.mockResolvedValue(null)
      io.loadPermitFunnel.mockResolvedValue({ since: '2026-11-01', arrived: 212, skimmed: 198, kept: 31, passed: 160, pursuing: 7, has_plumber: 0, bid: 3, won: 1, by_person: [{ name: 'Sam', n: 120 }], pass_reasons: [{ code: 'too_far', n: 22 }], pursue_for: [{ code: 'next_jobs', n: 3 }] })
      renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
      await waitFor(() => expect(screen.getByText('198')).toBeTruthy())
      expect(screen.getByText('Sam 120')).toBeTruthy()
      expect(screen.getByText('their next jobs 3')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Builders' }))
      await waitFor(() => expect(screen.getByText(/Builders opens once tonight’s database change is in/)).toBeTruthy())
    })
  })
})
