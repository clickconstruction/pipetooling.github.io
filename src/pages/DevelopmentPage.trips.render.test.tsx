// @vitest-environment jsdom
/**
 * The Development page's seventh look (punch list #379, PR 3): Trips shows only on a site that has a trip or is
 * far from the shop. A site with neither keeps its six looks and one quiet door to its first trip, and a reader
 * outside the office door reads no trip at all. PR 5: the strip says when punches look like a trip, and an open
 * trip counts the page's History lines on its days. PR 8: What it cost for a dev from the reads the page already
 * makes, the Scoreboard's cut by trip, and the print's press. The number and the link: `?trip=` opens one trip,
 * a link to a trip that is gone says so, and a trip's name in History and on Plans by date opens it. The fetch
 * and the trips hook are mocked at their seams, so this holds the page's wiring. Every name here is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, within } from '@testing-library/react'
import DevelopmentPage from './DevelopmentPage'
import { LAND_ON_LOOK_MS } from '../hooks/useLandOnLook'
import type { SiteTripsState } from '../hooks/useSiteTrips'
import { writeFolds, writeMoneyView, writePlansView, writeScoreboardCut } from '../lib/developments/devicePrefs'
import type { DevelopmentPageData } from '../lib/developments/fetchDevelopmentPage'
import type { MemberJob } from '../lib/developments/overview'
import { newTripRecord, type TripRecord } from '../lib/trips/tripRecord'
import { makeUseAuthValue, renderWithProviders, settle } from '../test/renderSmokeMocks'

const authState: { current: Record<string, unknown> } = { current: { role: 'dev' } }
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => makeUseAuthValue(authState.current),
  useOptionalAuth: () => makeUseAuthValue(authState.current),
}))
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useParams: () => ({ id: 'dev-zz' }) }))

const served: { data: DevelopmentPageData | null } = { data: null }
vi.mock('../lib/developments/fetchDevelopmentPage', () => ({
  readHistoryBody: async () => '',
  readHistoryBodies: async () => new Map<string, string>(),
  fetchDevelopmentPage: async () => {
    if (!served.data) throw new Error('no data served')
    return served.data
  },
}))

const tripsState: { current: SiteTripsState; asked: Array<{ enabled: boolean; address: string | null }> } = { current: null as unknown as SiteTripsState, asked: [] }
vi.mock('../hooks/useSiteTrips', () => ({
  useSiteTrips: (args: { enabled: boolean; address: string | null }) => {
    tripsState.asked.push({ enabled: args.enabled, address: args.address })
    return args.enabled ? tripsState.current : { ...tripsState.current, records: null, shows: false }
  },
}))
const laborAsked: boolean[] = []
vi.mock('../hooks/useSiteLabor', () => ({
  useSiteLabor: (_ids: string[], enabled: boolean) => {
    laborAsked.push(enabled)
    return enabled ? { state: 'reading' } : undefined
  },
}))
// The site's costs (PR 8): whether the page asked for them, with nothing read.
const costsAsked: boolean[] = []
vi.mock('../hooks/useSiteCosts', () => ({
  useSiteCosts: (_ids: string[], enabled: boolean) => {
    costsAsked.push(enabled)
    return enabled ? { state: 'reading' } : undefined
  },
}))
// The Scoreboard's day ledger is the page's heaviest read: stood in for, so the board opens with no network.
vi.mock('../hooks/useSiteOverhead', () => ({
  useSiteOverhead: (_ids: string[], enabled: boolean) => (enabled ? { state: 'reading' } : { state: 'off' }),
}))

const lifts: TripRecord = { ...newTripRecord({ id: 't5', developmentId: 'dev-zz' }), purpose: 'Lift stations before the pour', people: [{ personId: null, userId: null, name: 'Luis', days: { '2026-10-30': 'road', '2026-10-31': 'site', '2026-11-01': 'road' } }] }
// The same trip with the number the database handed out.
const trip5: TripRecord = { ...lifts, tripNumber: 5 }
function trips(over: Partial<SiteTripsState>): SiteTripsState {
  return { records: [], failure: null, miles: null, sitePoint: null, sitePointKnown: true, shows: false, roster: [], punches: [], punchesFailed: false, dismissals: [], names: new Map(), askRoster: vi.fn(), reload: vi.fn(), save: vi.fn(async () => undefined), remove: vi.fn(async () => undefined), dismiss: vi.fn(async () => []), undismiss: vi.fn(async () => undefined), ...over }
}
function job(over: Partial<MemberJob> & { id: string }): MemberJob {
  return {
    hcp_number: '956', click_number: null, job_name: 'Rough-in', job_address: '12 Marsh Road, Tidewater, NC', customer_id: null, customer_name: null, gc_customer_id: null, development_id: 'dev-zz', bid_id: null,
    status: 'working', revenue: null, payments_made: null, last_work_date: '2026-10-20', last_bill_date: null, job_plans_link: null, created_at: '2026-09-02T00:00:00Z', updated_at: null, service_type_id: null, ...over,
  }
}
function data(): DevelopmentPageData {
  return {
    development: { id: 'dev-zz', name: 'ZZ Test Heron Point', gc_customer_id: null, city: null, notes: null, archived_at: null, created_at: '2026-08-01T00:00:00Z' },
    gcCustomer: null, customer: null, customers: [], historyEntries: [], customerContacts: [], inIt: { bids: [], jobs: [job({ id: 'j1' })] }, atAddress: { bids: [], jobs: [] }, requests: [], submissionEntries: [], bidChanges: [], statusEvents: [], invoices: [], payments: [], threadNotes: [], bidNotes: [], teamMembers: [],
    names: new Map(), paySpeed: null, twinUserIds: new Set<string>(),
  }
}

beforeEach(() => {
  window.localStorage.clear()
  tripsState.asked.length = 0
  laborAsked.length = 0
  costsAsked.length = 0
  served.data = data()
})
afterEach(() => {
  vi.clearAllMocks()
})

describe('DevelopmentPage: the Trips look', () => {
  it('a site with a trip gets the seventh look, its card, and the trip’s lines in History', async () => {
    authState.current = { role: 'dev' }
    tripsState.current = trips({ records: [lifts], shows: true, miles: 1180 })
    renderWithProviders(<DevelopmentPage />)
    await settle()
    await screen.findByTestId('development-counts')
    expect(screen.getAllByTestId('development-jump')).toHaveLength(7)
    expect(screen.getAllByTestId('development-jump')[6]!.textContent).toContain('Trips')
    expect(screen.getAllByTestId('development-jump')[6]!.textContent).toContain('1 trip')
    expect(document.getElementById('development-trips')).not.toBeNull()
    expect(screen.getByTestId('trips-look')).toBeTruthy()
    expect(screen.getByTestId('trips-band-days').textContent).toBe('1')
    expect(screen.queryByTestId('trips-first-door')).toBeNull()
    // The site's address is what the hook is asked to place, and the open look asks for the clock's days.
    expect(tripsState.asked[tripsState.asked.length - 1]).toEqual({ enabled: true, address: '12 Marsh Road, Tidewater, NC' })
    expect(laborAsked[laborAsked.length - 1]).toBe(true)
    expect(document.body.textContent).toContain('Luis left for ZZ Test Heron Point · Lift stations before the pour')
    expect(document.body.textContent).toContain('Luis is back · 1 day at the site')
  })

  it('a site with no trip and near the shop keeps six looks, and one door opens the sheet for its first trip', async () => {
    authState.current = { role: 'assistant' }
    tripsState.current = trips({ records: [], shows: false, miles: 12 })
    renderWithProviders(<DevelopmentPage />)
    await settle()
    await screen.findByTestId('development-counts')
    expect(screen.getAllByTestId('development-jump')).toHaveLength(6)
    expect(document.getElementById('development-trips')).toBeNull()
    expect(laborAsked[laborAsked.length - 1]).toBe(false)
    fireEvent.click(screen.getByTestId('trips-first-door').querySelector('button')!)
    expect(screen.getByRole('dialog', { name: 'A trip to ZZ Test Heron Point' })).toBeTruthy()
  })

  it('a reader outside the office door reads no trip: no look, no door, and the hook is not switched on', async () => {
    authState.current = { role: 'estimator' }
    tripsState.current = trips({ records: [lifts], shows: true, miles: 1180 })
    renderWithProviders(<DevelopmentPage />)
    await settle()
    await screen.findByTestId('development-counts')
    expect(tripsState.asked.every((a) => !a.enabled)).toBe(true)
    expect(screen.getAllByTestId('development-jump')).toHaveLength(6)
    expect(document.getElementById('development-trips')).toBeNull()
    expect(screen.queryByTestId('trips-first-door')).toBeNull()
  })

  it('says on the strip when punches look like a trip, and an open trip counts the History lines on its days', async () => {
    authState.current = { role: 'dev' }
    const at = (work_date: string) => ({ user_id: 'u-omar', work_date, clock_in_lat: 35.001, clock_in_lng: -76.601, clock_in_location_source: 'gps', arrived_lat: null, arrived_lng: null, arrived_location_source: null, clock_out_lat: null, clock_out_lng: null, clock_out_location_source: null, travel_started_at: null, arrived_at: null })
    tripsState.current = trips({ records: [lifts], shows: true, miles: 1180, sitePoint: { lat: 35, lng: -76.6 }, roster: [{ id: 'p-omar', name: 'Omar', userId: 'u-omar' }], punches: ['2026-09-08', '2026-09-09'].map(at) })
    // One line of the site's own on a day of the trip, beside the trip's two.
    served.data = { ...data(), inIt: { bids: [], jobs: [job({ id: 'j1', created_at: '2026-10-31T15:00:00Z' })] } }
    renderWithProviders(<DevelopmentPage />)
    await settle()
    await screen.findByTestId('development-counts')
    expect(screen.getAllByTestId('development-jump')[6]!.textContent).toContain('1 looks like a trip')
    // The hours are not read here, so the offer itself waits; the strip already counts it.
    expect(screen.queryByTestId('trips-offers')).toBeNull()
    fireEvent.click(screen.getByTestId('trip-row-press'))
    expect(screen.getByTestId('trip-shows-lines').textContent).toBe('1 line in History')
  })
})

describe('DevelopmentPage: landing on the Trips look, and the Trips lane on Plans by date (PR 6)', () => {
  const landings = () => {
    const seen: string[] = []
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(function (this: Element) {
      seen.push(this.id)
    })
    return { seen, spy }
  }
  const beat = () => act(async () => void (await new Promise((r) => setTimeout(r, LAND_ON_LOOK_MS + 40))))

  it('`?look=trips` opens the Trips look when it is folded and scrolls to it, once', async () => {
    authState.current = { role: 'dev' }
    tripsState.current = trips({ records: [lifts], shows: true, miles: 1180 })
    writeFolds('dev-zz', 'looks', new Set(['trips']))
    const { seen, spy } = landings()
    renderWithProviders(<DevelopmentPage />, { route: '/developments/dev-zz?look=trips' })
    await settle()
    await screen.findByTestId('development-counts')
    await beat()
    // The folded look is open again, and the page went to it.
    expect(screen.getByTestId('trips-look')).toBeTruthy()
    expect(seen).toEqual(['development-trips'])
    spy.mockRestore()
  })

  it('`?trip=` opens the Trips look when it is folded, opens that trip’s row and lands on the row, once', async () => {
    authState.current = { role: 'dev' }
    tripsState.current = trips({ records: [trip5], shows: true, miles: 1180 })
    writeFolds('dev-zz', 'looks', new Set(['trips']))
    const { seen, spy } = landings()
    renderWithProviders(<DevelopmentPage />, { route: '/developments/dev-zz?trip=t5' })
    await settle()
    await screen.findByTestId('development-counts')
    await beat()
    expect(screen.getByTestId('trips-look')).toBeTruthy()
    // One scroll, to the trip's own row, which wears the cards' margin under the pinned strip.
    expect(seen).toEqual(['development-trip-t5'])
    expect(document.getElementById('development-trip-t5')?.style.scrollMarginTop).toBe('var(--development-jump-offset, 72px)')
    expect(screen.getByTestId('trip-open-heading').textContent).toBe('Trip 5 · Oct 30 to Nov 1 · Lift stations before the pour')
    expect(screen.getByTestId('trips-strip-year').textContent).toBe('2026')
    expect(screen.queryByText('That trip is no longer here.')).toBeNull()
    // The reader closes the row and the page draws again: nothing scrolls a second time.
    fireEvent.click(screen.getByTestId('trip-row-press'))
    await beat()
    expect(seen).toEqual(['development-trip-t5'])
    spy.mockRestore()
  })

  it('a link to a trip that is not here lands on the look’s top with no row open, and says so once', async () => {
    authState.current = { role: 'dev' }
    tripsState.current = trips({ records: [trip5], shows: true, miles: 1180 })
    writeFolds('dev-zz', 'looks', new Set(['trips']))
    const { seen, spy } = landings()
    renderWithProviders(<DevelopmentPage />, { route: '/developments/dev-zz?trip=t-gone' })
    await settle()
    await screen.findByTestId('development-counts')
    await beat()
    expect(screen.getByTestId('trips-look')).toBeTruthy()
    expect(seen).toEqual(['development-trips'])
    expect(screen.queryByTestId('trip-open')).toBeNull()
    expect(screen.getAllByText('That trip is no longer here.')).toHaveLength(1)
    spy.mockRestore()
  })

  it('a trip’s lines in History lead with its number, and the door on a line opens that trip and lands on its row', async () => {
    authState.current = { role: 'dev' }
    tripsState.current = trips({ records: [trip5], shows: true, miles: 1180 })
    const { seen, spy } = landings()
    renderWithProviders(<DevelopmentPage />)
    await settle()
    await screen.findByTestId('development-counts')
    expect(document.body.textContent).toContain('Trip 5 out · ZZ Test Heron Point · Luis left for ZZ Test Heron Point')
    expect(document.body.textContent).toContain('Trip 5 back · ZZ Test Heron Point · Luis is back · 1 day at the site')
    expect(screen.queryByTestId('trip-open')).toBeNull()
    const doors = screen.getAllByTestId('history-trip-door')
    expect(doors.map((d) => d.textContent)).toEqual([' · Open Trip 5 ›', ' · Open Trip 5 ›'])
    fireEvent.click(doors[0]!.querySelector('button')!)
    await beat()
    expect(seen).toEqual(['development-trip-t5'])
    expect(screen.getByTestId('trip-open-heading').textContent).toBe('Trip 5 · Oct 30 to Nov 1 · Lift stations before the pour')
    spy.mockRestore()
  })

  it('a plain link lands nowhere, and a folded look stays folded', async () => {
    authState.current = { role: 'dev' }
    tripsState.current = trips({ records: [lifts], shows: true, miles: 1180 })
    writeFolds('dev-zz', 'looks', new Set(['trips']))
    const { seen, spy } = landings()
    renderWithProviders(<DevelopmentPage />, { route: '/developments/dev-zz' })
    await settle()
    await screen.findByTestId('development-counts')
    await beat()
    expect(screen.queryByTestId('trips-look')).toBeNull()
    expect(seen).toEqual([])
    spy.mockRestore()
  })

  it('Plans by date gains a Trips lane on a site with a trip, and the card of a bar opens that trip', async () => {
    authState.current = { role: 'dev' }
    tripsState.current = trips({ records: [trip5], shows: true, miles: 1180 })
    writePlansView('dev-zz', 'date')
    const { seen, spy } = landings()
    renderWithProviders(<DevelopmentPage />)
    await settle()
    const bar = await screen.findByTestId('pbd-mark-trip-t5')
    expect(bar.getAttribute('aria-label')).toBe('Trip 5 · Oct 30 to Nov 1 · Back · 1 day at the site · Luis · Lift stations before the pour')
    // A press on the bar pins its card, like every other mark; the page goes nowhere yet.
    fireEvent.click(bar)
    await beat()
    expect(seen).toEqual([])
    expect(screen.queryByTestId('trip-open')).toBeNull()
    fireEvent.click(within(screen.getByTestId('pbd-card')).getByRole('button', { name: 'Open Trip 5' }))
    await beat()
    expect(seen).toEqual(['development-trip-t5'])
    expect(screen.getByTestId('trip-open-heading').textContent).toBe('Trip 5 · Oct 30 to Nov 1 · Lift stations before the pour')
    spy.mockRestore()
  })

  it('Plans by date has no Trips lane on a site with no trip', async () => {
    authState.current = { role: 'dev' }
    tripsState.current = trips({ records: [], shows: false, miles: 12 })
    writePlansView('dev-zz', 'date')
    renderWithProviders(<DevelopmentPage />)
    await settle()
    await screen.findByTestId('development-counts')
    await settle()
    expect(screen.queryByTestId('pbd-mark-trip-t5')).toBeNull()
    expect(screen.queryByTestId('pbd-name-lane-trips')).toBeNull()
  })
})

describe('DevelopmentPage: what a trip cost, the Scoreboard cut by trip and the trip log (PR 8)', () => {
  it('a dev’s open trip says What it cost from the reads the page already makes, and the look offers the print', async () => {
    authState.current = { role: 'dev' }
    tripsState.current = trips({ records: [lifts], shows: true, miles: 1180 })
    renderWithProviders(<DevelopmentPage />)
    await settle()
    await screen.findByTestId('development-counts')
    expect(within(screen.getByTestId('trips-print')).getByRole('button', { name: 'Print the trip log' })).toBeTruthy()
    fireEvent.click(screen.getByTestId('trip-row-press'))
    // Neither read is in here: the table says so, and gives no sum.
    expect([...screen.getByTestId('trip-open-cost').querySelectorAll('tr')].map((tr) => tr.textContent)).toEqual(['The crew’s hoursreading the clock…', 'Card and bank charges in the daysreading the costs…', 'The trip—'])
    // The costs are asked for a dev as they always were, for the Jobs & bids table, and never a second time for the look.
    expect(costsAsked.every((enabled) => enabled)).toBe(true)
  })

  it('the office without the finance seats gets no cost on a trip and no cost read, and still prints the log', async () => {
    authState.current = { role: 'assistant' }
    tripsState.current = trips({ records: [lifts], shows: true, miles: 1180 })
    renderWithProviders(<DevelopmentPage />)
    await settle()
    await screen.findByTestId('development-counts')
    fireEvent.click(screen.getByTestId('trip-row-press'))
    expect(screen.getByTestId('trip-open')).toBeTruthy()
    expect(screen.queryByTestId('trip-open-cost')).toBeNull()
    expect(costsAsked.some((enabled) => enabled)).toBe(false)
    expect(screen.getByTestId('trips-print')).toBeTruthy()
  })

  it('the Scoreboard offers the cut by trip on a site with a trip, and draws its rows in place of the jobs', async () => {
    authState.current = { role: 'dev' }
    tripsState.current = trips({ records: [lifts], shows: true, miles: 1180 })
    writeMoneyView('dev-zz', 'scoreboard')
    renderWithProviders(<DevelopmentPage />)
    await settle()
    await screen.findByTestId('scoreboard-cuts')
    expect(screen.getByTestId('scoreboard-cut-job').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByTestId('scoreboard-cut-trip'))
    expect(screen.getByTestId('scoreboard-cut-trip').getAttribute('aria-pressed')).toBe('true')
    // The clock is still reading here, so the cut says so in place of rows.
    expect(screen.getByTestId('scoreboard-trip-pending').textContent).toBe('Reading the clock…')
    expect(screen.getByTestId('scoreboard-trip-note')).toBeTruthy()
  })

  it('a site with no trip has no trip chip, and a device that remembered the cut reads by job', async () => {
    authState.current = { role: 'dev' }
    tripsState.current = trips({ records: [], shows: false, miles: 12 })
    writeMoneyView('dev-zz', 'scoreboard')
    writeScoreboardCut('dev-zz', 'trip')
    renderWithProviders(<DevelopmentPage />)
    await settle()
    await screen.findByTestId('scoreboard-cuts')
    expect(screen.queryByTestId('scoreboard-cut-trip')).toBeNull()
    expect(screen.getByTestId('scoreboard-cut-job').getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByTestId('scoreboard-trip-pending')).toBeNull()
  })
})
