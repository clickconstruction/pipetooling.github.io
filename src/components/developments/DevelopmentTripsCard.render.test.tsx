// @vitest-environment jsdom
/**
 * The Trips card (punch list #379, PR 3): it draws the look only on a site that shows it, opens the sheet for
 * the site's first trip from the page's own door, saves through the hook, and deletes with a question and an
 * undo. Every name here is made up.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import type { SiteTripsState } from '../../hooks/useSiteTrips'
import type { SiteLaborRead } from '../../lib/developments/siteLabor'
import { newTripRecord, type TripRecord } from '../../lib/trips/tripRecord'
import { DevelopmentTripsCard, tripNameWords } from './DevelopmentTripsCard'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

beforeAll(installDomShims)
afterEach(cleanup)

const TODAY = '2026-11-17'
const lifts: TripRecord = { ...newTripRecord({ id: 't5', developmentId: 'd1' }), purpose: 'Lift stations before the pour', people: [{ personId: 'p-luis', userId: 'u-luis', name: 'Luis', days: { '2026-10-30': 'road', '2026-10-31': 'site', '2026-11-01': 'road' } }] }
const LABOR: SiteLaborRead = {
  state: 'read',
  labor: {
    byJobId: new Map([['j1', { jobId: 'j1', hours: 14, costUsd: 0, days: 2, people: [{ personName: 'Luis', personId: 'p-luis', userId: 'u-luis', hours: 14, costUsd: 0, days: 2, leadDays: 0, byWorkDate: [{ ymd: '2026-10-31', hours: 10, costUsd: 0 }, { ymd: '2026-10-12', hours: 4, costUsd: 0 }] }] }]]),
    siteDays: 2,
    people: 1,
    daysKnown: true,
  },
}
const punch = { user_id: 'u-luis', work_date: '2026-10-31', clock_in_lat: 35.001, clock_in_lng: -76.601, clock_in_location_source: 'gps', arrived_lat: null, arrived_lng: null, arrived_location_source: null, clock_out_lat: null, clock_out_lng: null, clock_out_location_source: null }

function state(over: Partial<SiteTripsState> = {}): SiteTripsState {
  return {
    records: [lifts], failure: null, miles: 1180.4, sitePoint: { lat: 35, lng: -76.6 }, sitePointKnown: true, shows: true,
    roster: [{ id: 'p-luis', name: 'Luis', userId: 'u-luis' }, { id: 'p-dana', name: 'Dana', userId: null }], punches: [punch], punchesFailed: false,
    askRoster: vi.fn(), reload: vi.fn(), save: vi.fn(async () => undefined), remove: vi.fn(async () => undefined), ...over,
  }
}
function draw(trips: SiteTripsState, addSignal = 0, laborRead: SiteLaborRead | undefined = LABOR) {
  const ui = (signal: number) => <DevelopmentTripsCard anchorId="development-trips" developmentId="d1" siteName="Heron Point" trips={trips} laborRead={laborRead} jobs={[{ id: 'j1', label: 'J2101', name: 'Rough-in' }]} todayYmd={TODAY} phone={false} foldFor={(line) => ({ open: true, onToggle: () => {}, line })} addSignal={signal} />
  const view = renderWithProviders(ui(addSignal))
  return { bump: (signal: number) => view.rerender(ui(signal)) }
}

describe('DevelopmentTripsCard', () => {
  it('draws the look with the site’s hours laid over the trip, and how far the site is', () => {
    draw(state())
    expect(document.getElementById('development-trips')?.textContent).toContain('1,180 miles from the shop')
    expect(screen.getByTestId('trips-band-hours').textContent).toBe('14')
    expect(screen.getByTestId('trips-band-site').textContent).toBe('10 h')
    expect(screen.getByTestId('trips-band').textContent).toContain('home 4')
  })

  it('reads the hours as no place while there is no punch at the site', () => {
    draw(state({ punches: [] }))
    expect(screen.getByTestId('trips-band-site').textContent).toBe('0 h')
    expect(screen.getByTestId('trips-band').textContent).toContain('no place 10')
  })

  it('says the clock is being read until the hours, the roster and the punches are all in', () => {
    draw(state({ punches: null }))
    expect(screen.getByTestId('trips-hours-wait').textContent).toBe('Reading the clock…')
  })

  it('draws no card on a site that does not show the look, and opens the sheet from the page’s door', () => {
    const trips = state({ records: [], shows: false, miles: 12 })
    const { bump } = draw(trips)
    expect(document.getElementById('development-trips')).toBeNull()
    expect(screen.queryByTestId('trip-sheet')).toBeNull()
    bump(1)
    expect(screen.getByTestId('trip-sheet')).toBeTruthy()
    expect(trips.askRoster).toHaveBeenCalled()
  })

  it('saves a new trip through the hook, under an id made here', async () => {
    const trips = state()
    draw(trips)
    fireEvent.click(screen.getAllByText('+ Trip')[0]!)
    fireEvent.change(screen.getByTestId('trip-add-person'), { target: { value: 'p-dana' } })
    fireEvent.click(screen.getByText('Save the trip'))
    await waitFor(() => expect(trips.save).toHaveBeenCalled())
    const saved = (trips.save as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as TripRecord
    expect(saved).toMatchObject({ developmentId: 'd1', people: [{ personId: 'p-dana', name: 'Dana' }] })
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/)
    await waitFor(() => expect(screen.queryByTestId('trip-sheet')).toBeNull())
  })

  it('names the reason and keeps the sheet when the save fails', async () => {
    const trips = state({ save: vi.fn(async () => Promise.reject(new Error('A trip is saved by the office or a leader.'))) })
    draw(trips)
    fireEvent.click(screen.getAllByText('+ Trip')[0]!)
    fireEvent.change(screen.getByTestId('trip-add-person'), { target: { value: 'p-dana' } })
    fireEvent.click(screen.getByText('Save the trip'))
    await waitFor(() => expect(screen.getByText('A trip is saved by the office or a leader.')).toBeTruthy())
    expect(screen.getByTestId('trip-sheet')).toBeTruthy()
  })

  it('deletes after one question by name, and Undo saves the same trip again', async () => {
    const trips = state()
    draw(trips)
    fireEvent.click(screen.getByTestId('trip-row-press'))
    fireEvent.click(screen.getByTestId('trip-delete'))
    expect(screen.getByRole('alertdialog').textContent).toContain('Delete the trip of Oct 30 to Nov 1?')
    expect(screen.getByRole('alertdialog').textContent).toContain('No clock row, bill or cost changes.')
    expect(trips.remove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Delete this trip', { selector: '[role="alertdialog"] button' }))
    await waitFor(() => expect(trips.remove).toHaveBeenCalledWith('t5'))
    fireEvent.click(await screen.findByText('Undo'))
    await waitFor(() => expect(trips.save).toHaveBeenCalledWith(lifts))
  })

  it('names a trip by its days', () => {
    expect(tripNameWords(lifts, TODAY)).toBe('the trip of Oct 30 to Nov 1')
    expect(tripNameWords(newTripRecord({ id: 'e', developmentId: 'd1' }), TODAY)).toBe('this trip')
  })
})
