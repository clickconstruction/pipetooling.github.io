// @vitest-environment jsdom
/**
 * The Trips card (punch list #379, PR 3): it draws the look only on a site that shows it, opens the sheet for
 * the site's first trip from the page's own door, saves through the hook, and deletes with a question and an
 * undo. PR 5: it offers a run of punches no trip covers as Looks like a trip, opens the sheet filled from them,
 * remembers Not a trip with an undo, and counts What shows it. PR 8: What it cost for a dev or a controller from
 * the reads the page already makes, and Print the trip log, which files the page that printed. The number
 * and the link: a trip is deleted and put back by its number, a link opens one trip's row once the trips are
 * read, a link to a trip that is gone says so once, and Copy link copies the trip's address. Every name and
 * every dollar here is made up.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { EMPTY_CARD_CHARGE_EXCLUSIONS } from '../../../supabase/functions/_shared/cardChargeAllocationFilter'
import type { SiteTripsState } from '../../hooks/useSiteTrips'
import { jobCostsFromRows, type SiteCostRows, type SiteCostsRead } from '../../lib/developments/siteCosts'
import type { SiteLaborRead } from '../../lib/developments/siteLabor'
import type { DeletedTrip } from '../../lib/trips/tripDeleted'
import { newTripRecord, type TripRecord } from '../../lib/trips/tripRecord'
import { DevelopmentTripsCard, tripBackWords, tripNameWords, type TripLogPrint } from './DevelopmentTripsCard'
import type { TripOpenSignal } from './DevelopmentTripsLook'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

// The print (PR 8): the page that would print and where it would be filed, with no window opened.
const printed = vi.hoisted(() => ({ html: [] as string[], filings: [] as unknown[], open: true }))
vi.mock('../../lib/sent/sentCopiesIo', () => ({
  printAndFile: (html: string, filing: unknown) => {
    printed.html.push(html)
    printed.filings.push(filing)
    return printed.open
  },
}))

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  printed.html.length = 0
  printed.filings.length = 0
  printed.open = true
})

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
const punch = { user_id: 'u-luis', work_date: '2026-10-31', clock_in_lat: 35.001, clock_in_lng: -76.601, clock_in_location_source: 'gps', arrived_lat: null, arrived_lng: null, arrived_location_source: null, clock_out_lat: null, clock_out_lng: null, clock_out_location_source: null, travel_started_at: null, arrived_at: null }

function state(over: Partial<SiteTripsState> = {}): SiteTripsState {
  return {
    records: [lifts], failure: null, miles: 1180.4, sitePoint: { lat: 35, lng: -76.6 }, sitePointKnown: true, shows: true, deleted: [], deletedKnown: true, deletedFailed: false,
    roster: [{ id: 'p-luis', name: 'Luis', userId: 'u-luis' }, { id: 'p-dana', name: 'Dana', userId: null }], punches: [punch], punchesFailed: false, dismissals: [], names: new Map(),
    askRoster: vi.fn(), reload: vi.fn(), save: vi.fn(async () => undefined), remove: vi.fn(async () => undefined), dismiss: vi.fn(async () => []), undismiss: vi.fn(async () => undefined), ...over,
  }
}
const NO_DAYS: string[] = []
type Asked = { askedTripId?: string | null; openTrip?: TripOpenSignal | null }
function draw(trips: SiteTripsState, addSignal = 0, laborRead: SiteLaborRead | undefined = LABOR, more: { historyDays?: string[]; onOffers?: (count: number) => void; seesCosts?: boolean; costsRead?: SiteCostsRead; print?: TripLogPrint; open?: boolean } & Asked = {}) {
  const lines: string[] = []
  const ui = (signal: number, now: SiteTripsState = trips, asked: Asked = more, open = more.open ?? true) => (
    <DevelopmentTripsCard
      anchorId="development-trips"
      developmentId="d1"
      siteName="Heron Point"
      trips={now}
      laborRead={laborRead}
      jobs={[{ id: 'j1', label: 'J2101', name: 'Rough-in' }]}
      todayYmd={TODAY}
      phone={false}
      foldFor={(line) => {
        lines.push(line)
        return { open, onToggle: () => {}, line }
      }}
      addSignal={signal}
      historyDays={more.historyDays ?? NO_DAYS}
      onOffers={more.onOffers}
      seesCosts={more.seesCosts}
      costsRead={more.costsRead}
      print={more.print}
      askedTripId={asked.askedTripId}
      openTrip={asked.openTrip}
    />
  )
  const view = renderWithProviders(ui(addSignal))
  return { bump: (signal: number) => view.rerender(ui(signal)), again: (now: SiteTripsState, asked: Asked = more, open = true) => view.rerender(ui(addSignal, now, asked, open)), lines }
}

// Omar punched in at the site on four days in September, and no trip covers them.
const OMAR = { id: 'p-omar', name: 'Omar', userId: 'u-omar' }
const omarPunches = ['2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11'].map((work_date) => ({ ...punch, user_id: 'u-omar', work_date }))
const withOmar = (over: Partial<SiteTripsState> = {}): SiteTripsState => state({ roster: [{ id: 'p-luis', name: 'Luis', userId: 'u-luis' }, OMAR], punches: [punch, ...omarPunches], ...over })
const OFFER_WORDS = 'Looks like a trip. Omar punched in at Heron Point on 4 days, Sep 8 to 11. No trip covers those days.'

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

  it('names a trip by its days when it was made before numbers', () => {
    expect(tripNameWords(lifts, TODAY)).toBe('the trip of Oct 30 to Nov 1')
    expect(tripNameWords(newTripRecord({ id: 'e', developmentId: 'd1' }), TODAY)).toBe('this trip')
    expect(tripBackWords(lifts, TODAY)).toBe('The trip is back.')
  })

  it('names a trip by its number, in the delete’s question, its toast and the Undo’s', async () => {
    const trip5: TripRecord = { ...lifts, tripNumber: 5 }
    expect(tripNameWords(trip5, TODAY)).toBe('Trip 5, Oct 30 to Nov 1')
    expect(tripBackWords(trip5, TODAY)).toBe('Trip 5 is back.')
    const trips = state({ records: [trip5] })
    draw(trips)
    expect(screen.getByTestId('trip-row-number').textContent).toBe('Trip 5')
    fireEvent.click(screen.getByTestId('trip-row-press'))
    expect(screen.getByTestId('trip-open-heading').textContent).toBe('Trip 5 · Oct 30 to Nov 1 · Lift stations before the pour')
    fireEvent.click(screen.getByTestId('trip-delete'))
    expect(screen.getByRole('alertdialog').textContent).toContain('Delete Trip 5, Oct 30 to Nov 1?')
    fireEvent.click(screen.getByText('Delete this trip', { selector: '[role="alertdialog"] button' }))
    expect(await screen.findByText('Deleted Trip 5, Oct 30 to Nov 1. No clock row changed.')).toBeTruthy()
    fireEvent.click(await screen.findByText('Undo'))
    // The same record goes back, its number with it, so the database can give the number back.
    await waitFor(() => expect(trips.save).toHaveBeenCalledWith(trip5))
    expect(await screen.findByText('Trip 5 is back.')).toBeTruthy()
  })

  it('opens the trip a link named, once the trips are read, and only once a link', () => {
    const { again } = draw(state({ records: null }), 0, LABOR, { askedTripId: 't5' })
    expect(screen.queryByTestId('trip-open')).toBeNull()
    again(state())
    expect(screen.getByTestId('trip-open')).toBeTruthy()
    expect(screen.getByTestId('trips-strip-year').textContent).toBe('2026')
    // The reader closes the row; a later read of the trips does not open it again.
    fireEvent.click(screen.getByTestId('trip-row-press'))
    expect(screen.queryByTestId('trip-open')).toBeNull()
    again(state())
    expect(screen.queryByTestId('trip-open')).toBeNull()
    expect(screen.queryByText('That trip is no longer here.')).toBeNull()
  })

  it('keeps the trip a link named until a folded look is opened', () => {
    const { again } = draw(state(), 0, LABOR, { askedTripId: 't5', open: false })
    expect(screen.queryByTestId('trips-look')).toBeNull()
    again(state(), { askedTripId: 't5' }, true)
    expect(screen.getByTestId('trip-open')).toBeTruthy()
  })

  it('says once, quietly, that a linked trip is no longer here, and opens no row', async () => {
    const { again } = draw(state(), 0, LABOR, { askedTripId: 't-gone' })
    expect(await screen.findByText('That trip is no longer here.')).toBeTruthy()
    expect(screen.queryByTestId('trip-open')).toBeNull()
    expect(screen.getByTestId('trips-look')).toBeTruthy()
    again(state())
    expect(screen.getAllByText('That trip is no longer here.')).toHaveLength(1)
  })

  it('says a linked trip is no longer here on a site with no Trips look too', async () => {
    draw(state({ records: [], shows: false }), 0, LABOR, { askedTripId: 't-gone' })
    expect(await screen.findByText('That trip is no longer here.')).toBeTruthy()
    expect(document.getElementById('development-trips')).toBeNull()
  })

  it('opens a trip from a press on the page, and again on the next press', () => {
    const { again } = draw(state())
    expect(screen.queryByTestId('trip-open')).toBeNull()
    again(state(), { openTrip: { id: 't5', n: 1 } })
    expect(screen.getByTestId('trip-open')).toBeTruthy()
    fireEvent.click(screen.getByTestId('trip-row-press'))
    again(state(), { openTrip: { id: 't5', n: 1 } })
    expect(screen.queryByTestId('trip-open')).toBeNull()
    again(state(), { openTrip: { id: 't5', n: 2 } })
    expect(screen.getByTestId('trip-open')).toBeTruthy()
  })

  it('copies the link that opens one trip, and says so', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    draw(state())
    fireEvent.click(screen.getByTestId('trip-row-press'))
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://clicktooling.com/developments/d1?trip=t5'))
    expect(await screen.findByText('Link copied.')).toBeTruthy()
  })

  it('shows the link to copy by hand when the clipboard is closed', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async () => Promise.reject(new Error('denied'))) }, configurable: true })
    draw(state())
    fireEvent.click(screen.getByTestId('trip-row-press'))
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(await screen.findByText('Copy this link: https://clicktooling.com/developments/d1?trip=t5')).toBeTruthy()
  })

  it('offers a run of punches at the site that no trip covers, says so in its one line, and tells the page how many', () => {
    const onOffers = vi.fn()
    const { lines } = draw(withOmar(), 0, LABOR, { onOffers })
    expect(screen.getAllByTestId('trips-offer').map((o) => o.textContent)).toEqual([`${OFFER_WORDS}Make it a tripNot a trip`])
    expect(lines[lines.length - 1]).toBe('1 trip · 1 looks like a trip')
    expect(onOffers).toHaveBeenLastCalledWith(1)
  })

  it('offers nothing for days a trip covers, and tells the page none', () => {
    const onOffers = vi.fn()
    draw(state(), 0, LABOR, { onOffers })
    expect(screen.queryByTestId('trips-offers')).toBeNull()
    expect(onOffers).toHaveBeenLastCalledWith(0)
  })

  it('offers nothing while the hours are not read, on a site with no point, or while Not a trip is not read', () => {
    const reading = draw(withOmar(), 0, { state: 'reading' })
    expect(screen.queryByTestId('trips-offers')).toBeNull()
    // The punches are in, so the one line still counts it: the fold says it before the hours are read.
    expect(reading.lines[reading.lines.length - 1]).toBe('1 trip · 1 looks like a trip')
    cleanup()
    draw(withOmar({ sitePoint: null }))
    expect(screen.queryByTestId('trips-offers')).toBeNull()
    cleanup()
    const { lines } = draw(withOmar({ dismissals: null }))
    expect(screen.queryByTestId('trips-offers')).toBeNull()
    expect(lines[lines.length - 1]).toBe('1 trip')
  })

  it('passes over days somebody said were not a trip', () => {
    draw(withOmar({ dismissals: [{ id: 'x1', development_id: 'd1', job_id: null, person_id: 'p-omar', user_id: 'u-omar', person_name: 'Omar', first_day: '2026-09-08', last_day: '2026-09-11' }] }))
    expect(screen.queryByTestId('trips-offers')).toBeNull()
  })

  it('names a login with no roster row from the names read, and Someone until then', () => {
    const noRow = { roster: [{ id: 'p-luis', name: 'Luis', userId: 'u-luis' }] }
    draw(withOmar(noRow))
    expect(screen.getByTestId('trips-offer').textContent).toContain('Someone punched in at Heron Point on 4 days')
    cleanup()
    draw(withOmar({ ...noRow, names: new Map([['u-omar', 'Omar']]) }))
    expect(screen.getByTestId('trips-offer').textContent).toContain('Omar punched in at Heron Point on 4 days')
  })

  it('Make it a trip opens the sheet filled from the punches, and saves nothing until Save', async () => {
    const trips = withOmar()
    draw(trips)
    fireEvent.click(screen.getByText('Make it a trip'))
    const sheet = screen.getByTestId('trip-sheet')
    expect(sheet.textContent).toContain('Omar')
    expect(trips.save).not.toHaveBeenCalled()
    expect(trips.dismiss).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Save the trip'))
    await waitFor(() => expect(trips.save).toHaveBeenCalled())
    const saved = (trips.save as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as TripRecord
    expect(saved).toMatchObject({ developmentId: 'd1', people: [{ personId: 'p-omar', userId: 'u-omar', name: 'Omar', days: { '2026-09-08': 'site', '2026-09-09': 'site', '2026-09-10': 'site', '2026-09-11': 'site' } }] })
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('closing the sheet opened from an offer keeps nothing, and the offer stays', () => {
    const trips = withOmar()
    draw(trips)
    fireEvent.click(screen.getByText('Make it a trip'))
    fireEvent.click(screen.getByLabelText('Close'))
    expect(screen.queryByTestId('trip-sheet')).toBeNull()
    expect(trips.save).not.toHaveBeenCalled()
    expect(screen.getByTestId('trips-offer')).toBeTruthy()
  })

  it('Not a trip remembers one row a person, and Undo takes the same rows back', async () => {
    const row = { development_id: 'd1', job_id: null, person_id: 'p-omar', user_id: 'u-omar', person_name: 'Omar', first_day: '2026-09-08', last_day: '2026-09-11' }
    const trips = withOmar({ dismiss: vi.fn(async () => [{ id: 'x1', ...row }]) })
    draw(trips)
    fireEvent.click(screen.getByText('Not a trip'))
    await waitFor(() => expect(trips.dismiss).toHaveBeenCalledWith([row]))
    expect(await screen.findByText('Not a trip: Omar, Sep 8 to 11. Those days are not offered again. No clock row changed.')).toBeTruthy()
    expect(trips.save).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Undo'))
    await waitFor(() => expect(trips.undismiss).toHaveBeenCalledWith(['x1']))
  })

  it('names the reason when Not a trip is not remembered', async () => {
    const trips = withOmar({ dismiss: vi.fn(async () => Promise.reject(new Error('Not a trip is said by the office or a leader.'))) })
    draw(trips)
    fireEvent.click(screen.getByText('Not a trip'))
    await waitFor(() => expect(screen.getByText('Not a trip is said by the office or a leader.')).toBeTruthy())
    expect(screen.queryByText('Undo')).toBeNull()
  })

  it('says what shows an open trip: its punches at the site, its stamps and the History lines on its days', () => {
    const stamped = { ...punch, travel_started_at: '2026-10-31T12:05:00Z', arrived_at: '2026-10-31T12:40:00Z' }
    draw(state({ punches: [stamped, { ...punch, work_date: '2026-10-12' }] }), 0, LABOR, { historyDays: ['2026-10-30', '2026-10-31', '2026-10-31', '2026-09-01'] })
    fireEvent.click(screen.getByTestId('trip-row-press'))
    expect(screen.getByTestId('trip-open-shows').textContent).toBe('What shows it1 punch at the site2 On my way and I’m here stamps3 lines in History')
    expect(screen.getByTestId('trip-shows-punches').getAttribute('data-tone')).toBe('green')
    expect(screen.getByTestId('trip-shows-lines').getAttribute('data-tone')).toBe('plain')
  })
  // ---- PR 8: What it cost, and Print the trip log ---------------------------------------------

  // Luis's wages by day, and three card lines on the site's job: one the day before the trip, two inside its days.
  const PAID: SiteLaborRead = { state: 'read', labor: { ...(LABOR as Extract<SiteLaborRead, { state: 'read' }>).labor, byJobId: new Map([['j1', { jobId: 'j1', hours: 14, costUsd: 700, days: 2, people: [{ personName: 'Luis', personId: 'p-luis', userId: 'u-luis', hours: 14, costUsd: 700, days: 2, leadDays: 0, byWorkDate: [{ ymd: '2026-10-31', hours: 10, costUsd: 500 }, { ymd: '2026-10-12', hours: 4, costUsd: 200 }] }] }]]) } }
  const tx = (posted_at: string, amount: number) => ({ posted_at, counterparty_name: 'A made-up fuel stop', amount })
  const COST_ROWS: SiteCostRows = {
    jobIds: ['j1'],
    invoiceAmounts: [],
    cardAlloc: [
      { job_id: 'j1', id: 'a0', mercury_transaction_id: 'tx0', amount: -90, mercury_transactions: tx('2026-10-29', -90) },
      { job_id: 'j1', id: 'a1', mercury_transaction_id: 'tx1', amount: -120, mercury_transactions: tx('2026-10-30', -120) },
      { job_id: 'j1', id: 'a2', mercury_transaction_id: 'tx2', amount: -60, mercury_transactions: tx('2026-11-01', -60) },
    ],
    cardExclusions: EMPTY_CARD_CHARGE_EXCLUSIONS,
    tally: [],
    otherCharges: [],
    sheets: [],
    items: [],
    settings: [],
  }
  const COSTS: SiteCostsRead = { state: 'read', byJobId: jobCostsFromRows(COST_ROWS), rows: COST_ROWS }
  const PRINT: TripLogPrint = { customerName: 'Northgate Builders', customerId: 'cust-1', printedBy: 'Dana' }

  it('says What it cost to a dev or a controller: the wages of the trip’s hours and the card and bank charges dated in its days', () => {
    draw(state(), 0, PAID, { seesCosts: true, costsRead: COSTS })
    fireEvent.click(screen.getByTestId('trip-row-press'))
    // Luis's Oct 31 is on the trip and his Oct 12 is not; the Oct 29 charge is the day before the trip.
    expect([...screen.getByTestId('trip-open-cost').querySelectorAll('tr')].map((tr) => tr.textContent)).toEqual(['The crew’s hours$500', 'Card and bank charges in the days · 2 charges$180', 'The trip$680'])
  })

  it('hands a reader who may not see costs nothing, even with the cost rows on the page', () => {
    draw(state(), 0, PAID, { seesCosts: false, costsRead: COSTS })
    fireEvent.click(screen.getByTestId('trip-row-press'))
    expect(screen.queryByTestId('trip-open-cost')).toBeNull()
    expect(document.getElementById('development-trips')?.textContent).not.toContain('$')
  })

  it('says which read is still out: the costs, or the clock', () => {
    draw(state(), 0, PAID, { seesCosts: true, costsRead: { state: 'reading' } })
    fireEvent.click(screen.getByTestId('trip-row-press'))
    expect(screen.getByTestId('trip-cost-cards').textContent).toBe('Card and bank charges in the daysreading the costs…')
    expect(screen.getByTestId('trip-cost-total').textContent).toBe('The trip—')
    cleanup()
    draw(state(), 0, { state: 'reading' }, { seesCosts: true, costsRead: COSTS })
    fireEvent.click(screen.getByTestId('trip-row-press'))
    expect(screen.getByTestId('trip-cost-labor').textContent).toBe('The crew’s hoursreading the clock…')
    expect(screen.getByTestId('trip-cost-cards').textContent).toBe('Card and bank charges in the days · 2 charges$180')
    cleanup()
    draw(state(), 0, PAID, { seesCosts: true, costsRead: { state: 'failed', reason: 'the read did not finish' } })
    fireEvent.click(screen.getByTestId('trip-row-press'))
    expect(screen.getByTestId('trip-cost-cards').textContent).toBe('Card and bank charges in the daysthe costs did not read')
  })

  it('prints the trip log: one light page with the site, the customer and each trip, no dollar on it, filed under the site', () => {
    draw(state(), 0, PAID, { seesCosts: true, costsRead: COSTS, print: PRINT })
    fireEvent.click(screen.getByRole('button', { name: 'Print the trip log' }))
    expect(printed.html).toHaveLength(1)
    const page = printed.html[0]!
    expect(page).toContain('<html lang="en" data-theme="light">')
    expect(page).toContain('<h1>Heron Point · trip log</h1><span>Northgate Builders</span>')
    expect(page).toContain('by Dana')
    expect(page).toContain('<h2>Oct 30 to Nov 1, 2026 · Back</h2>')
    expect(page).toContain('<dt>What for</dt><dd>Lift stations before the pour</dd>')
    expect(page).toContain('Luis: 1 day at the site, 2 on the road')
    expect(page).toContain('<dt>Hours</dt><dd>At the site 10 h')
    expect(page).toContain('1 trip gone out · 1 day at the site · At the site 10 h')
    // A dev printed it, and still no dollar is on the paper.
    expect(page).not.toContain('$')
    expect(printed.filings).toEqual([{ kind: 'trip_log', title: 'Trip log · Heron Point', customerId: 'cust-1', source: { table: 'developments', id: 'd1' } }])
    expect(screen.queryByTestId('trips-print-note')).toBeNull()
  })

  it('says the print window was blocked, and leaves the hours off the page with the reason while the clock is not read', () => {
    printed.open = false
    draw(state({ punches: null }), 0, LABOR, { print: PRINT })
    fireEvent.click(screen.getByRole('button', { name: 'Print the trip log' }))
    expect(screen.getByTestId('trips-print-note').textContent).toBe('The print window was blocked. Allow pop-ups for this site and press again.')
    expect(printed.html[0]).not.toContain('<dt>Hours</dt>')
    expect(printed.html[0]).toContain('The clock was still being read when this was printed, so the hours are not on this page.')
  })

  it('offers no print when the page hands it no head for the paper', () => {
    draw(state())
    expect(screen.queryByTestId('trips-print')).toBeNull()
  })
})

describe('DevelopmentTripsCard: deleted trips', () => {
  const walk: TripRecord = { ...newTripRecord({ id: 't3', developmentId: 'd1' }), tripNumber: 3, purpose: 'Reset the riser the framers moved', people: [{ personId: null, userId: null, name: 'Priya', days: { '2026-11-09': 'site', '2026-11-11': 'site' } }] }
  const gone: DeletedTrip = { record: walk, deletedAt: '2026-11-16T18:00:00.000Z', deletedByName: 'Dana Office', jobsGone: 0 }

  it('lists the site’s deleted trips under the rows, in a fold, with who deleted each', () => {
    draw(state({ deleted: [gone] }))
    expect(screen.getByTestId('trips-deleted-fold').textContent).toContain('Deleted trips · 1')
    fireEvent.click(screen.getByTestId('trips-deleted-fold'))
    const row = screen.getByTestId('trips-deleted-row')
    expect(row.textContent).toContain('Trip 3 · Nov 9 to 11')
    expect(row.textContent).toContain('Priya · Deleted Nov 16 by Dana Office · kept until Feb 14')
  })

  it('Put back saves the trip again as it was, and says it is back', async () => {
    const trips = state({ deleted: [gone] })
    draw(trips)
    fireEvent.click(screen.getByTestId('trips-deleted-fold'))
    fireEvent.click(screen.getByRole('button', { name: 'Put back' }))
    await waitFor(() => expect(trips.save).toHaveBeenCalledWith(walk))
    expect(await screen.findByText('Trip 3 is back.')).toBeTruthy()
    expect(trips.remove).not.toHaveBeenCalled()
  })

  it('a put back that fails says its reason and saves nothing else', async () => {
    const trips = state({ deleted: [gone], save: vi.fn(async () => Promise.reject({ message: 'Training mode is read-only.', code: '42501' })) })
    draw(trips)
    fireEvent.click(screen.getByTestId('trips-deleted-fold'))
    fireEvent.click(screen.getByRole('button', { name: 'Put back' }))
    await waitFor(() => expect(trips.save).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/could not be put back|read-only|access/i)).toBeTruthy()
    expect(screen.queryByText('Trip 3 is back.')).toBeNull()
  })

  it('the delete’s question says where the trip waits after its minute of Undo', () => {
    draw(state())
    fireEvent.click(screen.getByTestId('trip-row-press'))
    fireEvent.click(screen.getByTestId('trip-delete'))
    expect(screen.getByRole('alertdialog').textContent).toContain('You can undo it for a minute. After that it waits under Deleted trips for 90 days.')
  })

  it('says the deleted trips did not read, in the fold’s place', () => {
    draw(state({ deletedFailed: true }))
    expect(screen.getByTestId('trips-deleted-failed')).toBeTruthy()
    expect(screen.queryByTestId('trips-deleted-fold')).toBeNull()
  })
})
