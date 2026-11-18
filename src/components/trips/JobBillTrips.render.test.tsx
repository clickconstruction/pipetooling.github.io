// @vitest-environment jsdom
/**
 * Extra trips not on a bill, the strip under a job's Line Items: the trips it lists, **Put on a bill** through the
 * small window to the press and the form's callback, a refusal in the function's words, **+ Trip** with the job
 * picked and the billing on Extra, and what it says when nothing waits or nothing read. Heron Point's made-up trips.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import type { JobBillTripsIo } from '../../hooks/useJobBillTrips'
import type { TripBillLine, TripBillLineReply } from '../../lib/trips/tripBillLine'
import { TripBillLineRefusal, type TripBillLinePress } from '../../lib/trips/tripBillLineIo'
import { newTripRecord, type TripRecord } from '../../lib/trips/tripRecord'
import { JobBillTrips } from './JobBillTrips'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

beforeAll(installDomShims)
afterEach(cleanup)

const TODAY = '2026-11-18'
const trip = (id: string, tripNumber: number, day: string, over: Partial<TripRecord> = {}): TripRecord => ({
  ...newTripRecord({ id, developmentId: 'd1' }),
  tripNumber,
  purpose: 'Reset the riser the framers moved',
  askedBy: 'them',
  askedWho: 'Walt',
  askedHow: 'by phone',
  billing: 'extra',
  jobIds: ['j1'],
  people: [{ personId: null, userId: null, name: 'Luis', days: { [day]: 'site' } }],
  ...over,
})
const BACK = trip('t3', 3, '2026-11-09')
const PLANNED = trip('t9', 9, '2026-12-01', { purpose: 'Set the lodge fixtures' })
const reply = (over: Partial<TripBillLineReply> = {}): TripBillLineReply => ({ dryRun: false, duplicate: false, fixtureId: 'fx-new', jobId: 'j1', revenueBefore: 184_000, revenueAfter: 190_800, ...over }) as TripBillLineReply

function draw(over: { records?: TripRecord[]; lines?: Map<string, TripBillLine>; role?: string; io?: Partial<JobBillTripsIo>; putOnLine?: (press: TripBillLinePress) => Promise<TripBillLineReply> } = {}) {
  const io: JobBillTripsIo = {
    readTrips: vi.fn(async () => over.records ?? [BACK, PLANNED]),
    readLines: vi.fn(async () => over.lines ?? new Map()),
    readRoster: vi.fn(async () => [{ id: 'p-luis', name: 'Luis', userId: 'u-luis' }]),
    save: vi.fn(async () => undefined),
    ...over.io,
  }
  const putOnLine = vi.fn(over.putOnLine ?? (async (press: TripBillLinePress) => reply({ dryRun: press.dryRun })))
  const onLineAdded = vi.fn(async () => undefined)
  renderWithProviders(<JobBillTrips job={{ id: 'j1', label: 'J2101', name: 'Heron Point Clubhouse' }} developmentId="d1" siteName="Heron Point" role={over.role ?? 'assistant'} todayYmd={TODAY} onLineAdded={onLineAdded} io={io} putOnLine={putOnLine} />)
  return { io, putOnLine, onLineAdded }
}

describe('JobBillTrips', () => {
  it('lists the job’s Extra trips with no line, the press on the one that has gone out', async () => {
    const { io } = draw()
    const rows = await screen.findAllByTestId('job-bill-trip')
    expect(io.readTrips).toHaveBeenCalledWith('d1')
    expect(io.readLines).toHaveBeenCalledWith(['t3', 't9'])
    expect(screen.getByTestId('job-bill-trips-head').textContent).toBe('Extra trips not on a bill · 1')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.textContent).toContain('Trip 3 · Nov 9')
    expect(rows[0]?.textContent).toContain('Luis · Extra · not billed yet')
    expect(within(rows[0] as HTMLElement).getByRole('button', { name: 'Put on a bill' })).toBeTruthy()
    expect(within(rows[1] as HTMLElement).getByTestId('job-bill-trip-held').textContent).toBe('It can go on a bill once it has gone out.')
    expect(within(rows[1] as HTMLElement).queryByRole('button', { name: 'Put on a bill' })).toBeNull()
  })

  it('Put on a bill opens the window on this job, adds the line and tells the form its id', async () => {
    const { putOnLine, onLineAdded, io } = draw()
    const rows = await screen.findAllByTestId('job-bill-trip')
    fireEvent.click(within(rows[0] as HTMLElement).getByRole('button', { name: 'Put on a bill' }))
    const win = await screen.findByTestId('trip-bill-window')
    expect(within(win).getByTestId('trip-bill-title').textContent).toBe('Put Trip 3 on J2101’s lines')
    expect(within(win).getByTestId('trip-bill-job').textContent).toContain('J2101')
    fireEvent.change(within(win).getByTestId('trip-bill-amount'), { target: { value: '6800' } })
    await waitFor(() => expect(within(win).getByTestId('trip-bill-totals').textContent).toContain('$190,800'))
    fireEvent.click(within(win).getByRole('button', { name: 'Add the line · $6,800' }))
    await waitFor(() => expect(onLineAdded).toHaveBeenCalledWith('fx-new'))
    const real = putOnLine.mock.calls.map((c) => c[0]).filter((p) => !p.dryRun)
    expect(real).toHaveLength(1)
    expect(real[0]).toMatchObject({ tripId: 't3', jobId: 'j1', amount: 6800, dryRun: false })
    expect(await screen.findByText('Trip 3 is on J2101’s lines.')).toBeTruthy()
    await waitFor(() => expect(screen.queryByTestId('trip-bill-window')).toBeNull())
    // The trips and their lines are read again, so the trip leaves the strip once its line is known.
    await waitFor(() => expect(io.readTrips).toHaveBeenCalledTimes(2))
  })

  it('a refusal says the function’s words, adds nothing and tells the form nothing', async () => {
    const { onLineAdded } = draw({ putOnLine: async (press) => (press.dryRun ? reply({ dryRun: true }) : Promise.reject(new TripBillLineRefusal('Putting a trip on a bill is for the office.'))) })
    const rows = await screen.findAllByTestId('job-bill-trip')
    fireEvent.click(within(rows[0] as HTMLElement).getByRole('button', { name: 'Put on a bill' }))
    const win = await screen.findByTestId('trip-bill-window')
    fireEvent.change(within(win).getByTestId('trip-bill-amount'), { target: { value: '6800' } })
    await waitFor(() => expect(within(win).getByTestId('trip-bill-totals').textContent).toContain('$190,800'))
    fireEvent.click(within(win).getByRole('button', { name: 'Add the line · $6,800' }))
    expect(await screen.findByText('Putting a trip on a bill is for the office.')).toBeTruthy()
    expect(onLineAdded).not.toHaveBeenCalled()
    expect(screen.getByTestId('trip-bill-window')).toBeTruthy()
  })

  it('+ Trip opens the sheet with this job picked and the billing on Extra, and saves through the hook', async () => {
    const { io } = draw({ records: [] })
    await screen.findByTestId('job-bill-trips-none')
    fireEvent.click(screen.getByRole('button', { name: '+ Trip' }))
    const sheet = await screen.findByTestId('trip-sheet')
    await waitFor(() => expect(io.readRoster).toHaveBeenCalledTimes(1))
    fireEvent.click(within(sheet).getByTestId('trip-add-typed'))
    fireEvent.change(within(sheet).getByTestId('trip-typed-name'), { target: { value: 'Priya' } })
    fireEvent.keyDown(within(sheet).getByTestId('trip-typed-name'), { key: 'Enter' })
    fireEvent.change(within(sheet).getByTestId('trip-first-day'), { target: { value: '2026-11-10' } })
    fireEvent.change(within(sheet).getByTestId('trip-last-day'), { target: { value: '2026-11-11' } })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save the trip' }))
    await waitFor(() => expect(io.save).toHaveBeenCalledTimes(1))
    const saved = (io.save as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as TripRecord
    expect(saved).toMatchObject({ developmentId: 'd1', jobIds: ['j1'], billing: 'extra' })
    expect(saved.people.map((p) => p.name)).toEqual(['Priya'])
    expect(await screen.findByText('The trip is saved.')).toBeTruthy()
  })

  it('reads the trips again each time the form saves its lines, so a trip whose line was removed is offered again', async () => {
    const lines = new Map<string, TripBillLine>([['t3', { fixtureId: 'fx-1', tripId: 't3', jobId: 'j1', amount: 6800, invoiceStatus: null }]])
    const io: JobBillTripsIo = { readTrips: vi.fn(async () => [BACK]), readLines: vi.fn(async () => new Map(lines)), readRoster: vi.fn(async () => []), save: vi.fn(async () => undefined) }
    const ui = (linesSaved: string) => <JobBillTrips job={{ id: 'j1', label: 'J2101', name: 'Heron Point Clubhouse' }} developmentId="d1" siteName="Heron Point" role="assistant" todayYmd={TODAY} onLineAdded={vi.fn()} linesSaved={linesSaved} io={io} putOnLine={vi.fn()} />
    const view = renderWithProviders(ui('idle'))
    await screen.findByTestId('job-bill-trips-none')
    expect(io.readTrips).toHaveBeenCalledTimes(1)
    // The line is removed in the form, and the form saves.
    lines.clear()
    view.rerender(ui('saving'))
    expect(io.readTrips).toHaveBeenCalledTimes(1)
    view.rerender(ui('saved'))
    expect(await screen.findByTestId('job-bill-trip')).toBeTruthy()
    expect(io.readTrips).toHaveBeenCalledTimes(2)
  })

  it('says nothing is waiting when no Extra trip is, and still offers + Trip', async () => {
    draw({ records: [trip('t1', 1, '2026-11-02', { billing: 'inside' })] })
    expect((await screen.findByTestId('job-bill-trips-none')).textContent).toBe('Nothing waiting on a bill.')
    expect(screen.getByTestId('job-bill-trips-head').textContent).toBe('Extra trips not on a bill')
    expect(screen.getByRole('button', { name: '+ Trip' })).toBeTruthy()
  })

  it('leaves out a trip that already holds a line', async () => {
    draw({ records: [BACK], lines: new Map([['t3', { fixtureId: 'fx-1', tripId: 't3', jobId: 'j1', amount: 6800, invoiceStatus: null }]]) })
    await screen.findByTestId('job-bill-trips-none')
    expect(screen.queryAllByTestId('job-bill-trip')).toHaveLength(0)
  })

  it('a primary sees the trip and no press', async () => {
    draw({ role: 'primary', records: [BACK] })
    const row = await screen.findByTestId('job-bill-trip')
    expect(within(row).getByTestId('job-bill-trip-held').textContent).toBe('The office or a leader puts it on a bill.')
    expect(within(row).queryByRole('button', { name: 'Put on a bill' })).toBeNull()
  })

  it('says the trips did not read, and lists none', async () => {
    draw({ io: { readTrips: vi.fn(async () => Promise.reject(new Error('lost signal'))) } })
    expect((await screen.findByTestId('job-bill-trips-failed')).textContent).toBe('The site’s trips did not read. Reload to try again.')
    expect(screen.queryAllByTestId('job-bill-trip')).toHaveLength(0)
    cleanup()
    draw({ io: { readLines: vi.fn(async () => Promise.reject(new Error('closed'))) } })
    expect(await screen.findByTestId('job-bill-trips-failed')).toBeTruthy()
  })
})
