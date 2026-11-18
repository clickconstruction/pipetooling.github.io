// @vitest-environment jsdom
/**
 * The Development page's seventh look (punch list #379, PR 3): Trips shows only on a site that has a trip or is
 * far from the shop. A site with neither keeps its six looks and one quiet door to its first trip, and a reader
 * outside the office door reads no trip at all. PR 5: the strip says when punches look like a trip, and an open
 * trip counts the page's History lines on its days. The fetch and the trips hook are mocked at their seams, so
 * this holds the page's wiring. Every name here is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import DevelopmentPage from './DevelopmentPage'
import type { SiteTripsState } from '../hooks/useSiteTrips'
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

const lifts: TripRecord = { ...newTripRecord({ id: 't5', developmentId: 'dev-zz' }), purpose: 'Lift stations before the pour', people: [{ personId: null, userId: null, name: 'Luis', days: { '2026-10-30': 'road', '2026-10-31': 'site', '2026-11-01': 'road' } }] }
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
