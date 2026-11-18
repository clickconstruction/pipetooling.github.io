// @vitest-environment jsdom
/**
 * The Trips look (punch list #379, PR 3): the band, the bar, the year strip, a row a trip that opens in place,
 * the chips, and what it says while the hours are not read. Heron Point's made-up trips.
 */
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { addDays, type TripDayKind } from '../../lib/trips/tripDays'
import type { TripHourRow } from '../../lib/trips/tripHours'
import { newTripRecord, NO_TRIP_PEOPLE, type TripRecord } from '../../lib/trips/tripRecord'
import { buildTripsLook } from '../../lib/trips/tripsLook'
import { DevelopmentTripsLook, TRIPS_HOURS_WORDS, TRIPS_NO_POINT_WORDS, type TripsHoursState } from './DevelopmentTripsLook'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

beforeAll(installDomShims)
afterEach(cleanup)

const TODAY = '2026-11-17'
function days(first: string, letters: string): Record<string, TripDayKind> {
  const kind: Record<string, TripDayKind> = { g: 'ready', r: 'road', s: 'site' }
  const out: Record<string, TripDayKind> = {}
  ;[...letters].forEach((c, i) => {
    const k = kind[c]
    if (k) out[addDays(first, i)] = k
  })
  return out
}
const trip = (id: string, first: string, people: Array<[string, string]>, over: Partial<TripRecord> = {}): TripRecord => ({ ...newTripRecord({ id, developmentId: 'd1' }), people: people.map(([name, letters]) => ({ personId: null, userId: null, name, days: days(first, letters) })), ...over })
const hour = (name: string, ymd: string, hours: number, place: TripHourRow['place'], jobId = 'j1'): TripHourRow => ({ personKey: `n:${name.toLowerCase()}`, ymd, hours, place, jobId })

const RECORDS = [
  trip('t1', '2026-02-13', [['Dana', 'grrssrr'], ['Luis', 'xrrssrr']], { purpose: 'Rough-in, first try', askedBy: 'them', askedWho: 'Ray, the site super', askedHow: 'by phone, Feb 11', billing: 'extra', outcome: 'Turned around. The slab was not ready.' }),
  trip('t5', '2026-10-29', [['Luis', 'grssxsr'], ['Priya', 'xrssssr']], { purpose: 'Lift stations before the pour', askedBy: 'us', billing: 'inside', jobIds: ['j1'], outcome: 'Did the work.' }),
  trip('t6', '2026-12-01', [['Dana', 'rsssr']], { purpose: 'Trim-out, lodge first floor' }),
]
const HOURS: TripHourRow[] = [hour('Luis', '2026-10-29', 6, 'elsewhere'), hour('Luis', '2026-10-31', 10, 'site'), hour('Luis', '2026-11-03', 10, 'none'), hour('Priya', '2026-10-31', 10.5, 'site'), hour('Dana', '2026-10-12', 4, 'elsewhere')]

function draw(over: { records?: TripRecord[]; hours?: TripHourRow[] | null; hoursState?: TripsHoursState; noSitePoint?: boolean; phone?: boolean; canWrite?: boolean } = {}) {
  const presses = { onAdd: vi.fn(), onChange: vi.fn(), onDelete: vi.fn(), onReload: vi.fn() }
  const hours = over.hours === undefined ? HOURS : over.hours
  const model = buildTripsLook({ records: over.records ?? RECORDS, index: NO_TRIP_PEOPLE, hours, todayYmd: TODAY })
  renderWithProviders(
    <DevelopmentTripsLook model={model} hoursState={over.hoursState ?? (hours ? 'read' : 'reading')} noSitePoint={over.noSitePoint ?? false} failure={null} todayYmd={TODAY} phone={over.phone ?? false} jobLabel={(id) => (id === 'j1' ? 'J2101 Rough-in: lodge and bunkhouse' : null)} canWrite={over.canWrite ?? true} {...presses} />,
  )
  return presses
}

describe('DevelopmentTripsLook', () => {
  it('answers the owner’s question first: the hours on the site, and how many were at the site', () => {
    draw()
    expect(screen.getByTestId('trips-band-trips').textContent).toBe('2')
    expect(screen.getByTestId('trips-band').textContent).toContain('and 1 planned')
    expect(screen.getByTestId('trips-band-days').textContent).toBe('6')
    expect(screen.getByTestId('trips-band-hours').textContent).toBe('40.5')
    expect(screen.getByTestId('trips-band-site').textContent).toBe('20.5 h')
    expect(screen.getByTestId('trips-band').textContent).toContain('51% of the hours')
    expect(screen.getByTestId('trips-band-away').textContent).toBe('20 h')
    expect(screen.getByTestId('trips-band').textContent).toContain('road 0 · ready 6 · home 4 · no place 10')
  })

  it('draws one bar of the same hours, in its five figures, with a legend', () => {
    draw()
    const bar = screen.getAllByTestId('trip-hours-bar')[0]!
    expect([...bar.querySelectorAll('i')].map((i) => i.getAttribute('data-bucket'))).toEqual(['site', 'ready', 'noPlace', 'home'])
    expect(screen.getAllByTestId('trip-legend')[0]!.textContent).toBe('At the siteOn the roadGetting readyNo place on the punchAt home for the site')
  })

  it('places the year’s trips on the strip, and a bar opens its trip', () => {
    draw()
    expect(screen.getByTestId('trips-strip-year').textContent).toBe('2026')
    const bars = screen.getAllByTestId('trips-strip-bar')
    expect(bars).toHaveLength(3)
    fireEvent.click(bars[0]!)
    expect(screen.getByTestId('trip-open').textContent).toContain('Feb 13 to 19 · Rough-in, first try')
  })

  it('lists a row a trip, newest first, with its days, who went, its hours and its billing', () => {
    draw()
    const rows = screen.getAllByTestId('trip-row')
    expect(rows.map((r) => r.getAttribute('data-standing'))).toEqual(['planned', 'back', 'back'])
    expect(rows[0]!.textContent).toContain('Dec 1 to 5')
    expect(within(rows[0]!).getByTestId('trip-row-hours').textContent).toBe('not yet')
    expect(rows[1]!.textContent).toContain('Back · 4 days at the site')
    expect(rows[1]!.textContent).toContain('Luis, Priya · asked by us')
    expect(within(rows[1]!).getByTestId('trip-row-hours').textContent).toBe('36.5 h · 20.5 at the site')
    expect(rows[1]!.textContent).toContain('Inside the price')
    expect(rows[2]!.textContent).toContain('asked by Ray, the site super')
    expect(within(rows[1]!).getByTestId('trip-day-dots').querySelectorAll('i')).toHaveLength(7)
  })

  it('opens a trip in place: what was typed, and what is counted from its days', () => {
    const presses = draw()
    fireEvent.click(screen.getAllByTestId('trip-row-press')[1]!)
    const open = screen.getByTestId('trip-open')
    expect(open.textContent).toContain('Oct 29 to Nov 4 · Lift stations before the pour')
    expect(within(open).getByTestId('trip-open-asked').textContent).toBe('Us')
    expect(open.textContent).toContain('Did the work.')
    expect(open.textContent).toContain('J2101 Rough-in: lodge and bunkhouse · 36.5 h')
    expect(open.textContent).toContain('part of the job’s price, not billed apart')
    const counted = within(open).getByTestId('trip-open-counted')
    expect([...counted.querySelectorAll('tr')].map((tr) => tr.textContent)).toEqual(['At the site20.5 h4 days', 'On the road0 h2 days', 'Getting ready6 h1 day', 'No place on the punch10 h', 'The trip36.5 h7 days'])
    expect(within(open).getAllByTestId('trip-open-person').map((p) => p.textContent)).toEqual(['Luis10 h no place on the punch26 h', 'Priya10.5 h'])
    fireEvent.click(within(open).getByText('Change'))
    expect(presses.onChange.mock.calls[0]?.[0]).toMatchObject({ id: 't5' })
    fireEvent.click(within(open).getByTestId('trip-delete'))
    expect(presses.onDelete.mock.calls[0]?.[0]).toMatchObject({ id: 't5' })
  })

  it('a tap on a day of an open trip opens the sheet to change it', () => {
    const presses = draw()
    fireEvent.click(screen.getAllByTestId('trip-row-press')[1]!)
    fireEvent.click(within(screen.getByTestId('trip-open-days')).getAllByRole('button')[0]!)
    expect(presses.onChange).toHaveBeenCalledTimes(1)
  })

  it('says in amber when a trip that went has no punch at the site', () => {
    draw()
    fireEvent.click(screen.getAllByTestId('trip-row-press')[2]!)
    expect(screen.getByTestId('trip-open-no-punch').textContent).toBe('No punch at the site on this trip’s days. The days stand as painted.')
  })

  it('narrows the rows by a chip, each chip with its count', () => {
    draw()
    expect(screen.getByTestId('trips-filter-all').textContent).toBe('All 3')
    expect(screen.getByTestId('trips-filter-them').textContent).toBe('Asked by them 1')
    fireEvent.click(screen.getByTestId('trips-filter-extra'))
    expect(screen.getAllByTestId('trip-row')).toHaveLength(1)
    fireEvent.click(screen.getByTestId('trips-filter-them'))
    expect(screen.getAllByTestId('trip-row')[0]!.textContent).toContain('Rough-in, first try')
  })

  it('offers + Trip, and with no trip yet says what adds the first', () => {
    const presses = draw({ records: [] })
    expect(screen.queryByTestId('trips-strip')).toBeNull()
    expect(screen.queryByTestId('trips-rows')).toBeNull()
    expect(document.querySelector('[data-empty-state]')?.textContent).toBe('No trips yet. + Trip adds the first.')
    fireEvent.click(screen.getAllByText('+ Trip')[0]!)
    expect(presses.onAdd).toHaveBeenCalledTimes(1)
  })

  it('says why the hours are not there yet, and still draws the trips and their days', () => {
    draw({ hours: null, hoursState: 'closed' })
    expect(screen.getByTestId('trips-hours-wait').textContent).toBe(TRIPS_HOURS_WORDS.closed)
    expect(screen.getByTestId('trips-band-hours').textContent).toBe('—')
    expect(screen.getByTestId('trips-band-days').textContent).toBe('6')
    expect(screen.getAllByTestId('trip-row')).toHaveLength(3)
  })

  it('says when the site has no point to check a punch against', () => {
    draw({ noSitePoint: true })
    expect(screen.getByTestId('trips-no-point').textContent).toBe(TRIPS_NO_POINT_WORDS)
  })

  it('on a phone stacks a row and keeps every figure', () => {
    draw({ phone: true })
    expect(screen.getAllByTestId('trip-row')).toHaveLength(3)
    expect(screen.getByTestId('trips-band-site').textContent).toBe('20.5 h')
  })
})
