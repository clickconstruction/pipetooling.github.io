// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import type { ResearchPermitRow } from '../../lib/research/permitResearch'

const io = vi.hoisted(() => ({
  loadResearchPermits: vi.fn(),
  loadLatestPull: vi.fn(),
  recordVerdict: vi.fn(),
  approachFromPermit: vi.fn(),
  pullPermitsNow: vi.fn(),
  loadContactHistory: vi.fn(),
  lookupCompany: vi.fn(),
  lookupParcel: vi.fn(),
  loadPermitFeedRow: vi.fn(),
  loadSitePermits: vi.fn(),
  loadBuilderPermits: vi.fn(),
}))
vi.mock('../../lib/research/permitResearchIo', () => io)
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
    io.recordVerdict.mockReset().mockResolvedValue(undefined)
    io.approachFromPermit.mockReset().mockResolvedValue({ prospectId: 'lead-1', companyName: 'Ridgeway Builders', reused: false })
    io.pullPermitsNow.mockReset().mockResolvedValue({ ok: true, feeds: [{ source: 'sa-issued', seen: 3, kept: 2, error: null }] })
    io.lookupCompany.mockReset().mockResolvedValue({ found: true, facts: { name: 'Ridgeway Builders', phone: '(210) 555-0199', website: 'https://example.com', address: '1 Office Park, San Antonio, TX 78201', kind: 'General contractor', maps_url: null, place_id: 'p', match: 'exact' }, error: null, cached: true, lookedUpAt: '2026-11-09T00:00:00Z' })
    io.lookupParcel.mockReset().mockResolvedValue({ found: true, facts: { prop_id: '1', situs: '100 SAMPLE ST', owner: 'SAMPLE HOLDINGS LLC', owner_address: 'PO BOX 1, SAN ANTONIO TX 78201', dba: null, land_value: 1, improvement_value: 2, total_value: 1_400_000, use_code: '205', year_built: '2001', building_sf: 6200, acres: 0.9, detail_url: 'https://bexar.trueautomation.com/clientdb/Property.aspx?cid=110&prop_id=1' }, error: null, cached: false, lookedUpAt: null })
    io.loadPermitFeedRow.mockReset().mockResolvedValue({ raw: { 'PERMIT TYPE': 'Comm New Building Permit', 'PERMIT #': 'COM-BLG-PMT26-00000001', 'DATE ISSUED': '2026-11-06T00:00:00', 'DECLARED VALUATION': '1400000.0', 'PRIMARY CONTACT': 'Ridgeway Builders', CD: 7, _id: 9 }, source: 'sa-issued', pulledAt: '2026-11-09T11:30:00Z', firstSeenAt: '2026-11-09T11:30:00Z', addressKey: '100 sample st' })
    const site = { permit_number: 'COM-BLG-PMT26-00000001', permit_type: 'Comm New Building Permit', kind: 'building', stage: 'issued', work_type: 'New commercial', submitted_on: '2026-10-02', issued_on: '2026-11-06', contact: 'Ridgeway Builders', address: '100 SAMPLE ST', declared_value: 1_400_000 }
    io.loadSitePermits.mockReset().mockResolvedValue([{ ...site, id: 'p1' }, { ...site, id: 's2', kind: 'other', work_type: 'Commercial site work', issued_on: '2026-10-21' }])
    io.loadBuilderPermits.mockReset().mockResolvedValue([{ ...site, id: 'p1' }, { ...site, id: 'b2', address: '77 KILN ST', issued_on: '2026-10-02' }, { ...site, id: 'b3', contact: 'Ridgeway Roofing', address: '5 ASTER RDG' }])
    io.loadContactHistory.mockReset().mockResolvedValue(new Map([['ridgewaybuilders', { key: 'ridgewaybuilders', bids: 5, won: 3, last_bid_on: '2026-09-01', on_deck: false }]]))
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
  })

  it('draws the waiting rows with the plumber signal, and counts the taken row on its lens', async () => {
    renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
    await waitFor(() => expect(screen.getByText('100 SAMPLE ST')).toBeTruthy())
    expect(screen.getByText('none yet')).toBeTruthy()
    expect(screen.queryByText('300 HOPKINS ST')).toBeNull()
    expect(screen.getByText(/1 wait on a look/)).toBeTruthy()
    expect(screen.getByText(/1 already have a plumber/)).toBeTruthy()
    expect(io.loadResearchPermits).toHaveBeenCalledWith('San Antonio', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), false)
    // The hint under who pulled it, from our bid history with the name.
    await waitFor(() => expect(screen.getByText('warm')).toBeTruthy())
    expect(screen.getByText('warm').getAttribute('title')).toBe('we won 3 of 5 bids with this name')
  })

  it("Map draws the lens as pins; a pin opens the row's card with its Decide press", async () => {
    renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
    await waitFor(() => expect(screen.getByText('100 SAMPLE ST')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Map' }))
    await waitFor(() => expect(screen.getByTestId('canvas')).toBeTruthy())
    const pin = screen.getByRole('button', { name: /pin 100 SAMPLE ST/ })
    expect(pin.getAttribute('data-color')).toBe('#2563eb')
    fireEvent.click(pin)
    expect(screen.getByText('Selected pin')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Decide…' })).toBeTruthy()
  })

  it('Already have a plumber shows who wins what in the window', async () => {
    renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
    await waitFor(() => expect(screen.getByText('100 SAMPLE ST')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Showing'), { target: { value: 'taken' } })
    expect(screen.getByText(/Who wins what in San Antonio/)).toBeTruthy()
    expect(screen.getByText('Lone Star Plumbing Co. · 1')).toBeTruthy()
  })

  it('opens the sheet on Decide…, refuses an empty reason, then keeps an Approach with the lead it made', async () => {
    renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
    await waitFor(() => expect(screen.getByText('100 SAMPLE ST')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Decide…' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Approach them · make the lead' }))
    expect(io.recordVerdict).not.toHaveBeenCalled()
    expect(screen.getByText('Say why in a line. The next estimator reads it.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Why'), { target: { value: 'Our size, and we have won with them.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Approach them · make the lead' }))
    await waitFor(() => expect(io.recordVerdict).toHaveBeenCalled())
    expect(io.approachFromPermit).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }), 'gc', 'u1', {})
    expect(io.recordVerdict).toHaveBeenCalledWith(expect.objectContaining({ permitId: 'p1', verdict: 'approach', prospectId: 'lead-1', userId: 'u1' }))
  })

  it('shows the Already have a plumber lens with the feed-read row and its Decide anyway', async () => {
    renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
    await waitFor(() => expect(screen.getByText('100 SAMPLE ST')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Showing'), { target: { value: 'taken' } })
    expect(screen.getByText('300 HOPKINS ST')).toBeTruthy()
    expect(screen.getByText('Lone Star Plumbing Co.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Decide anyway' })).toBeTruthy()
  })

  it('Pull now runs the feed and reads again', async () => {
    renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
    await waitFor(() => expect(screen.getByText('100 SAMPLE ST')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Pull now' }))
    await waitFor(() => expect(io.pullPermitsNow).toHaveBeenCalled())
    await waitFor(() => expect(io.loadResearchPermits).toHaveBeenCalledTimes(2))
  })

  it('says what fills an empty ledger before the first pull', async () => {
    io.loadResearchPermits.mockResolvedValue([])
    io.loadLatestPull.mockResolvedValue({ ranAt: null, error: null })
    renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
    await waitFor(() => expect(screen.getByText('No permits yet.')).toBeTruthy())
    expect(screen.getByText(/Not pulled yet/)).toBeTruthy()
  })

  it("the name opens the card with Google's facts and the county's owner, and Approach them carries them onto the lead", async () => {
    renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
    await waitFor(() => expect(screen.getByText('100 SAMPLE ST')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Ridgeway Builders' }))
    await waitFor(() => expect(screen.getByText('(210) 555-0199')).toBeTruthy())
    expect(screen.getByText('SAMPLE HOLDINGS LLC')).toBeTruthy()
    expect(io.lookupCompany).toHaveBeenCalledWith('Ridgeway Builders', 'San Antonio', false)
    expect(io.lookupParcel).toHaveBeenCalledWith('100 SAMPLE ST', 'San Antonio', false)
    fireEvent.click(screen.getByRole('button', { name: 'Approach them with these facts…' }))
    expect(screen.getByText(/The lead carries the phone, the website, the office address, the owner of record/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Why'), { target: { value: 'Found the phone; calling Monday.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Approach them · make the lead' }))
    await waitFor(() => expect(io.approachFromPermit).toHaveBeenCalled())
    expect(io.approachFromPermit).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }), 'gc', 'u1', expect.objectContaining({ phone: '(210) 555-0199', website: 'https://example.com', ownerOfRecord: 'SAMPLE HOLDINGS LLC' }))
  })

  it('the address opens The building: the county, every field the city sent, the permits on the address, and a Google search', async () => {
    renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
    await waitFor(() => expect(screen.getByText('100 SAMPLE ST')).toBeTruthy())
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
    renderWithProviders(<ProspectsResearchTab authUserId="u1" />)
    await waitFor(() => expect(screen.getByText('100 SAMPLE ST')).toBeTruthy())
    expect(screen.getByRole('link', { name: 'Search Google for Ridgeway Builders' }).getAttribute('href')).toBe('https://www.google.com/search?q=%22Ridgeway%20Builders%22%20San%20Antonio%20TX')
    fireEvent.click(screen.getByRole('button', { name: 'Ridgeway Builders' }))
    await waitFor(() => expect(screen.getByText('This name pulled 1 other permit in the last 365 days.')).toBeTruthy())
    expect(io.loadBuilderPermits).toHaveBeenCalledWith('San Antonio', 'ridgeway', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
    expect(screen.getByText(/77 KILN ST/)).toBeTruthy()
    expect(screen.queryByText(/5 ASTER RDG/)).toBeNull()
    expect(screen.getByText('Google the company')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open the state’s search' }).getAttribute('href')).toBe('https://comptroller.texas.gov/taxes/franchise/account-status/search')
  })
})
