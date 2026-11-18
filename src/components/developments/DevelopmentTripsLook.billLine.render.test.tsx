// @vitest-environment jsdom
/**
 * Put on a bill on the Trips look (punch list #391): the press on an open Extra trip that has gone out, for the
 * roles that may change a job's lines; the door to the line in the press's place; and the billing chip that says
 * where the trip's money stands, read from its line and the bill that took it. Heron Point's made-up trips.
 */
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import type { TripBillLine } from '../../lib/trips/tripBillLine'
import { newTripRecord, NO_TRIP_PEOPLE, type TripRecord } from '../../lib/trips/tripRecord'
import { buildTripsLook } from '../../lib/trips/tripsLook'
import { DevelopmentTripsLook } from './DevelopmentTripsLook'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

beforeAll(installDomShims)
afterEach(cleanup)

const TODAY = '2026-11-18'
const trip = (id: string, tripNumber: number, days: Record<string, 'ready' | 'road' | 'site'>, over: Partial<TripRecord> = {}): TripRecord => ({
  ...newTripRecord({ id, developmentId: 'd1' }),
  tripNumber,
  purpose: 'Reset the riser the framers moved',
  people: [{ personId: null, userId: null, name: 'Dana', days }],
  ...over,
})
// t14 is back and Extra. t9 is back and inside the price. t20 is Extra and still planned.
const BACK = { '2026-11-02': 'road', '2026-11-03': 'site', '2026-11-08': 'road' } as const
const RECORDS = [trip('t14', 14, BACK, { billing: 'extra', jobIds: ['j1'] }), trip('t9', 9, { '2026-10-12': 'site' }, { billing: 'inside' }), trip('t20', 20, { '2026-12-01': 'site' }, { billing: 'extra' })]
const line = (over: Partial<TripBillLine> = {}): TripBillLine => ({ fixtureId: 'fx-1', tripId: 't14', jobId: 'j1', amount: 6800, invoiceStatus: null, ...over })

function draw(over: { records?: TripRecord[]; billLines?: Map<string, TripBillLine> | null; billRole?: string | null; canWrite?: boolean; noPresses?: boolean; phone?: boolean } = {}) {
  const presses = { onAdd: vi.fn(), onChange: vi.fn(), onDelete: vi.fn(), onReload: vi.fn(), onPutOnBill: vi.fn(), onOpenBillLine: vi.fn() }
  const model = buildTripsLook({ records: over.records ?? RECORDS, index: NO_TRIP_PEOPLE, hours: [], todayYmd: TODAY })
  renderWithProviders(
    <DevelopmentTripsLook
      model={model}
      hoursState="read"
      noSitePoint={false}
      failure={null}
      todayYmd={TODAY}
      phone={over.phone ?? false}
      jobLabel={(id) => (id === 'j1' ? 'J2101 Heron Point Clubhouse' : null)}
      jobShort={(id) => (id === 'j1' ? 'J2101' : null)}
      canWrite={over.canWrite ?? true}
      billLines={over.billLines === undefined ? new Map() : over.billLines}
      billRole={over.billRole === undefined ? 'assistant' : over.billRole}
      onAdd={presses.onAdd}
      onChange={presses.onChange}
      onDelete={presses.onDelete}
      onReload={presses.onReload}
      onPutOnBill={over.noPresses ? undefined : presses.onPutOnBill}
      onOpenBillLine={over.noPresses ? undefined : presses.onOpenBillLine}
    />,
  )
  return presses
}
/** Open one trip's row, by its number, and hand back the open trip. */
function openTrip(number: number): HTMLElement {
  const row = screen.getAllByTestId('trip-row').find((r) => within(r).queryByTestId('trip-row-number')?.textContent === `Trip ${number}`)
  if (!row) throw new Error(`no row for Trip ${number}`)
  fireEvent.click(within(row).getByTestId('trip-row-press'))
  return within(row).getByTestId('trip-open')
}
const rowChip = (number: number): HTMLElement => {
  const row = screen.getAllByTestId('trip-row').find((r) => within(r).queryByTestId('trip-row-number')?.textContent === `Trip ${number}`)
  if (!row) throw new Error(`no row for Trip ${number}`)
  return within(row).getByTestId('trip-row-billing')
}

describe('DevelopmentTripsLook — Put on a bill', () => {
  it('an Extra trip that is back shows the press beside Change, and the press hands over the trip', () => {
    const presses = draw()
    const open = openTrip(14)
    const press = within(within(open).getByTestId('trip-put-on-bill')).getByRole('button', { name: 'Put on a bill' })
    expect(within(open).getByRole('button', { name: 'Change' })).toBeTruthy()
    fireEvent.click(press)
    expect(presses.onPutOnBill).toHaveBeenCalledTimes(1)
    expect((presses.onPutOnBill.mock.calls[0]?.[0] as TripRecord).id).toBe('t14')
  })

  it('reads Extra · not billed yet on the row and on the open trip', () => {
    draw()
    expect(rowChip(14).textContent).toBe('Extra · not billed yet')
    expect(rowChip(14).getAttribute('data-standing')).toBe('not_billed')
    expect(within(openTrip(14)).getByTestId('trip-open-billing').textContent).toBe('Extra · not billed yet')
  })

  it('shows no press on a trip inside the price, or on an Extra trip still planned', () => {
    draw()
    expect(within(openTrip(9)).queryByTestId('trip-put-on-bill')).toBeNull()
    expect(rowChip(9).textContent).toBe('Inside the price')
    cleanup()
    draw()
    expect(within(openTrip(20)).queryByTestId('trip-put-on-bill')).toBeNull()
  })

  it('shows no press to a primary, who reads every trip, or to anyone with no role handed in', () => {
    draw({ billRole: 'primary' })
    expect(within(openTrip(14)).queryByTestId('trip-put-on-bill')).toBeNull()
    cleanup()
    draw({ billRole: null })
    expect(within(openTrip(14)).queryByTestId('trip-put-on-bill')).toBeNull()
  })

  it('a trip that holds a line shows the door in the press’s place, with the line’s figure', () => {
    const presses = draw({ billLines: new Map([['t14', line()]]) })
    expect(rowChip(14).textContent).toBe('Extra · on J2101’s lines, on no bill yet')
    const open = openTrip(14)
    expect(within(open).queryByTestId('trip-put-on-bill')).toBeNull()
    expect(within(open).getByTestId('trip-open-billing').textContent).toBe('Extra · on J2101’s lines, on no bill yet $6,800 · line')
    fireEvent.click(within(within(open).getByTestId('trip-bill-door')).getByRole('button', { name: 'Open J2101 on Bill' }))
    expect(presses.onOpenBillLine).toHaveBeenCalledTimes(1)
    expect(presses.onOpenBillLine.mock.calls[0]?.[1]).toMatchObject({ fixtureId: 'fx-1', jobId: 'j1' })
  })

  it('the door is there for a primary too: it opens the job, it adds nothing', () => {
    draw({ billLines: new Map([['t14', line()]]), billRole: 'primary' })
    expect(within(openTrip(14)).getByTestId('trip-bill-door')).toBeTruthy()
  })

  it('reads through the line to the bill that took it: on a bill, billed, paid', () => {
    for (const [status, words, kind] of [
      ['ready_to_bill', 'Extra · on a bill, not sent', 'on_bill'],
      ['billed', 'Extra · billed', 'billed'],
      ['paid', 'Extra · paid', 'paid'],
    ] as const) {
      draw({ billLines: new Map([['t14', line({ invoiceStatus: status })]]) })
      expect(rowChip(14).textContent).toBe(words)
      expect(rowChip(14).getAttribute('data-standing')).toBe(kind)
      cleanup()
    }
  })

  it('a trip moved off Extra still reads its line and keeps its door, and shows no press', () => {
    draw({ records: [trip('t14', 14, BACK, { billing: 'inside', jobIds: ['j1'] })], billLines: new Map([['t14', line()]]) })
    expect(rowChip(14).textContent).toBe('Inside the price · on J2101’s lines, on no bill yet')
    const open = openTrip(14)
    expect(within(open).getByTestId('trip-bill-door')).toBeTruthy()
    expect(within(open).queryByTestId('trip-put-on-bill')).toBeNull()
  })

  it('with the lines not read, or closed to the reader, a trip says its own billing word and offers no press', () => {
    draw({ billLines: null })
    expect(rowChip(14).textContent).toBe('Extra')
    const open = openTrip(14)
    expect(within(open).queryByTestId('trip-put-on-bill')).toBeNull()
    expect(within(open).queryByTestId('trip-bill-door')).toBeNull()
    expect(within(open).queryByTestId('trip-open-billing')).toBeNull()
  })

  it('a look handed no presses draws neither the press nor the door', () => {
    draw({ noPresses: true })
    expect(within(openTrip(14)).queryByTestId('trip-put-on-bill')).toBeNull()
    cleanup()
    draw({ noPresses: true, billLines: new Map([['t14', line()]]) })
    expect(within(openTrip(14)).queryByTestId('trip-bill-door')).toBeNull()
    expect(rowChip(14).textContent).toBe('Extra · on J2101’s lines, on no bill yet')
  })

  it('on a phone the press and the chip are still there', () => {
    draw({ phone: true })
    expect(rowChip(14).textContent).toBe('Extra · not billed yet')
    expect(within(openTrip(14)).getByTestId('trip-put-on-bill')).toBeTruthy()
  })
})
