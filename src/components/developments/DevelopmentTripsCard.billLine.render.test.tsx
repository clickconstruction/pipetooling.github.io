// @vitest-environment jsdom
/**
 * Put on a bill on the Trips card (punch list #391): the card reads the lines the site's trips hold, opens the
 * window from the press, adds the line through the function, says so, reads the lines and the trips again, and
 * asks the page to open the job on Bill with the line picked. A refusal is said in the function's own words and
 * the window stays. A trip that already holds a line is told so. Every name and figure here is made up.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import type { SiteTripsState } from '../../hooks/useSiteTrips'
import type { TripBillLine, TripBillLineReply } from '../../lib/trips/tripBillLine'
import type { TripBillLinePress } from '../../lib/trips/tripBillLineIo'
import { newTripRecord, type TripRecord } from '../../lib/trips/tripRecord'
import { DevelopmentTripsCard } from './DevelopmentTripsCard'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
// The lines read: what each read answers, and how often it was asked.
const read = vi.hoisted(() => ({ lines: new Map<string, unknown>(), calls: 0, fail: false }))
vi.mock('../../lib/trips/tripBillLineIo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/trips/tripBillLineIo')>()),
  readTripBillLines: async () => {
    read.calls += 1
    if (read.fail) throw new Error('closed')
    return new Map(read.lines)
  },
}))
beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  read.lines = new Map()
  read.calls = 0
  read.fail = false
})

const TODAY = '2026-11-18'
const TRIP: TripRecord = {
  ...newTripRecord({ id: 't14', developmentId: 'd1' }),
  tripNumber: 14,
  purpose: 'Reset the riser the framers moved',
  askedBy: 'them',
  askedWho: 'Walt',
  askedHow: 'by phone',
  billing: 'extra',
  jobIds: ['j1'],
  people: [{ personId: null, userId: null, name: 'Dana', days: { '2026-11-02': 'road', '2026-11-03': 'site', '2026-11-08': 'road' } }],
}
const LINE: TripBillLine = { fixtureId: 'fx-1', tripId: 't14', jobId: 'j1', amount: 6800, invoiceStatus: null }
const reply = (over: Partial<TripBillLineReply> = {}): TripBillLineReply => ({ duplicate: false, dryRun: false, fixtureId: 'fx-new', jobId: 'j1', revenueBefore: 184000, revenueAfter: 190800, ...over })

function state(over: Partial<SiteTripsState> = {}): SiteTripsState {
  return {
    records: [TRIP], failure: null, miles: 1180.4, sitePoint: { lat: 35, lng: -76.6 }, sitePointKnown: true, shows: true,
    roster: [], punches: [], punchesFailed: false, dismissals: [], names: new Map(),
    askRoster: vi.fn(), reload: vi.fn(), save: vi.fn(async () => undefined), remove: vi.fn(async () => undefined), dismiss: vi.fn(async () => []), undismiss: vi.fn(async () => undefined), ...over,
  }
}
function draw(over: { billIo?: (p: TripBillLinePress) => Promise<TripBillLineReply>; role?: string | null; trips?: SiteTripsState; noDoor?: boolean } = {}) {
  const trips = over.trips ?? state()
  const spies = { billIo: vi.fn(over.billIo ?? (async (p: TripBillLinePress) => reply({ dryRun: p.dryRun, fixtureId: p.dryRun ? null : 'fx-new' }))), onOpenJobOnBill: vi.fn() }
  renderWithProviders(
    <DevelopmentTripsCard
      anchorId="development-trips"
      developmentId="d1"
      siteName="Heron Point"
      trips={trips}
      laborRead={undefined}
      jobs={[{ id: 'j1', label: 'J2101', name: 'Heron Point Clubhouse' }]}
      todayYmd={TODAY}
      phone={false}
      foldFor={(line) => ({ open: true, onToggle: () => {}, line })}
      addSignal={0}
      historyDays={[]}
      billRole={over.role === undefined ? 'assistant' : over.role}
      onOpenJobOnBill={over.noDoor ? undefined : spies.onOpenJobOnBill}
      billIo={spies.billIo}
    />,
  )
  return { ...spies, trips }
}
const openTrip = () => {
  fireEvent.click(screen.getByTestId('trip-row-press'))
  return screen.getByTestId('trip-open')
}
/** Open the trip, press Put on a bill, type the amount and wait for the job total. */
async function openWindowWith(amount: string) {
  await waitFor(() => expect(screen.getByTestId('trip-row-billing').textContent).toBe('Extra · not billed yet'))
  fireEvent.click(within(within(openTrip()).getByTestId('trip-put-on-bill')).getByRole('button'))
  fireEvent.change(screen.getByTestId('trip-bill-amount'), { target: { value: amount } })
  await waitFor(() => expect(screen.getByTestId('trip-bill-totals').textContent).toContain('$184,000 → $190,800'))
}
const addButton = () => screen.getByRole('button', { name: /^Add the line/ })

describe('DevelopmentTripsCard — Put on a bill', () => {
  it('reads the lines the site’s trips hold, and says where each trip’s money stands', async () => {
    read.lines = new Map([['t14', LINE]])
    draw()
    await waitFor(() => expect(screen.getByTestId('trip-row-billing').textContent).toBe('Extra · on J2101’s lines, on no bill yet'))
    expect(read.calls).toBe(1)
  })

  it('the press opens the window, adds the line, says so, reads again and opens the job on Bill with the line picked', async () => {
    const { billIo, onOpenJobOnBill, trips } = draw()
    await openWindowWith('6800')
    expect(screen.getByTestId('trip-bill-title').textContent).toBe('Put Trip 14 on J2101’s lines')
    fireEvent.click(addButton())
    expect(await screen.findByText('Trip 14 is on J2101’s lines.')).toBeTruthy()
    const real = billIo.mock.calls.map((c) => c[0]).filter((p) => !p.dryRun)
    expect(real).toEqual([{ tripId: 't14', jobId: 'j1', amount: 6800, name: 'Trip 14, 1 person, Nov 2 to 8', words: 'Reset the riser the framers moved. Asked by Walt, by phone.', dryRun: false }])
    expect(onOpenJobOnBill).toHaveBeenCalledTimes(1)
    expect(onOpenJobOnBill.mock.calls[0]?.slice(0, 2)).toEqual(['j1', ['fx-new']])
    // The picked job may have joined the trip's jobs, and the trip now holds a line: both are read again.
    expect(trips.reload).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(read.calls).toBe(2))
    await waitFor(() => expect(screen.queryByTestId('trip-bill-window')).toBeNull())
  })

  it('when the Job window saves, the lines are read again', async () => {
    read.lines = new Map([['t14', LINE]])
    const { onOpenJobOnBill } = draw()
    await waitFor(() => expect(screen.getByTestId('trip-row-billing').textContent).toContain('on J2101’s lines'))
    fireEvent.click(within(within(openTrip()).getByTestId('trip-bill-door')).getByRole('button', { name: 'Open J2101 on Bill' }))
    expect(onOpenJobOnBill.mock.calls[0]?.slice(0, 2)).toEqual(['j1', ['fx-1']])
    // The line was billed in the Job window: its save calls back, and the chip reads through to the bill.
    read.lines = new Map([['t14', { ...LINE, invoiceStatus: 'ready_to_bill' }]])
    ;(onOpenJobOnBill.mock.calls[0]?.[2] as () => void)()
    await waitFor(() => expect(screen.getByTestId('trip-row-billing').textContent).toBe('Extra · on a bill, not sent'))
  })

  it('a refusal is said in the function’s own words, the window stays, and no job is opened', async () => {
    const { TripBillLineRefusal } = await import('../../lib/trips/tripBillLineIo')
    const { onOpenJobOnBill } = draw({
      billIo: async (p) => {
        if (p.dryRun) return reply({ dryRun: true, fixtureId: null })
        throw new TripBillLineRefusal('Only a trip marked Extra goes on a bill. Change the trip’s billing to Extra first.')
      },
    })
    await openWindowWith('6800')
    fireEvent.click(addButton())
    expect(await screen.findByText('Only a trip marked Extra goes on a bill. Change the trip’s billing to Extra first.')).toBeTruthy()
    expect(screen.getByTestId('trip-bill-window')).toBeTruthy()
    expect(onOpenJobOnBill).not.toHaveBeenCalled()
  })

  it('a press that finds the trip already holds a line says nothing was added, and opens that line', async () => {
    const { onOpenJobOnBill } = draw({ billIo: async (p) => (p.dryRun ? reply({ dryRun: true, fixtureId: null }) : reply({ duplicate: true, fixtureId: 'fx-1', revenueBefore: 190800 })) })
    await openWindowWith('6800')
    fireEvent.click(addButton())
    expect(await screen.findByText('Trip 14 is already on J2101’s lines. Nothing was added.')).toBeTruthy()
    expect(onOpenJobOnBill.mock.calls[0]?.slice(0, 2)).toEqual(['j1', ['fx-1']])
  })

  it('a primary, who sees the look, gets no press', async () => {
    draw({ role: 'primary' })
    await waitFor(() => expect(screen.getByTestId('trip-row-billing').textContent).toBe('Extra · not billed yet'))
    expect(within(openTrip()).queryByTestId('trip-put-on-bill')).toBeNull()
  })

  it('when the lines are closed to the reader, the trip says its own billing word and no press is offered', async () => {
    read.fail = true
    draw()
    await waitFor(() => expect(read.calls).toBe(1))
    expect(screen.getByTestId('trip-row-billing').textContent).toBe('Extra')
    expect(within(openTrip()).queryByTestId('trip-put-on-bill')).toBeNull()
  })

  it('reads no line on a site whose look does not show', () => {
    draw({ trips: state({ shows: false }) })
    expect(read.calls).toBe(0)
  })
})
