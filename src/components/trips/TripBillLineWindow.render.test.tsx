// @vitest-environment jsdom
/**
 * The Put on a bill window (punch list #391): the job, the amount, the line's name and the words under it; the
 * job total before and after from the function's own dry run; a button that names the act and its figure and
 * says why it is dead; and the dry run's refusal in the function's words. Every name and figure here is made up.
 */
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import type { TripBillLineReply } from '../../lib/trips/tripBillLine'
import { TripBillLineRefusal, type TripBillLinePress } from '../../lib/trips/tripBillLineIo'
import { newTripRecord, type TripRecord } from '../../lib/trips/tripRecord'
import { TRIP_BILL_PREVIEW_WAIT_MS, TripBillLineWindow } from './TripBillLineWindow'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

beforeAll(installDomShims)
beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
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
  people: ['Dana', 'Luis', 'Omar', 'Priya'].map((name) => ({ personId: null, userId: null, name, days: { '2026-11-02': 'road' as const, '2026-11-08': 'road' as const } })),
}
const JOBS = [
  { id: 'j1', label: 'J2101', name: 'Heron Point Clubhouse' },
  { id: 'j2', label: 'J2140', name: 'Heron Point Pool House' },
]
const reply = (over: Partial<TripBillLineReply> = {}): TripBillLineReply => ({ duplicate: false, dryRun: true, fixtureId: null, jobId: 'j1', revenueBefore: 184000, revenueAfter: 190800, ...over })

function draw(over: { record?: TripRecord; costWords?: string | null; preview?: (p: TripBillLinePress) => Promise<TripBillLineReply>; onAdd?: (p: Omit<TripBillLinePress, 'dryRun'>) => Promise<boolean>; busy?: boolean } = {}) {
  const spies = { preview: vi.fn(over.preview ?? (async () => reply())), onAdd: vi.fn(over.onAdd ?? (async () => true)), onClose: vi.fn() }
  renderWithProviders(<TripBillLineWindow record={over.record ?? TRIP} siteName="Heron Point" jobs={JOBS} todayYmd={TODAY} costWords={over.costWords} busy={over.busy ?? false} preview={spies.preview} onAdd={spies.onAdd} onClose={spies.onClose} />)
  return spies
}
const type = (testId: string, value: string) => fireEvent.change(screen.getByTestId(testId), { target: { value } })
const settle = () => act(() => vi.advanceTimersByTimeAsync(TRIP_BILL_PREVIEW_WAIT_MS + 5))
const addButton = () => screen.getByRole('button', { name: /^Add the line|^Adding the line/ }) as HTMLButtonElement

describe('TripBillLineWindow', () => {
  it('opens on the trip’s one job with the line’s name and words made, and a dead button that says to type the amount', () => {
    draw()
    expect(screen.getByTestId('trip-bill-title').textContent).toBe('Put Trip 14 on J2101’s lines')
    expect(screen.getByTestId('trip-bill-job').textContent).toBe('J2101 Heron Point Clubhouse')
    expect((screen.getByTestId('trip-bill-name') as HTMLInputElement).value).toBe('Trip 14, crew of 4, Nov 2 to 8')
    expect((screen.getByTestId('trip-bill-words') as HTMLTextAreaElement).value).toBe('Reset the riser the framers moved. Asked by Walt, by phone.')
    expect(addButton().textContent).toBe('Add the line')
    expect(addButton().disabled).toBe(true)
    expect(screen.getByTestId('trip-bill-foot').textContent).toBe('Type the amount.')
    expect(screen.getByTestId('trip-bill-totals').textContent).toContain('Pick the job and type the amount to see it before and after.')
    expect(screen.getByTestId('trip-bill-totals').textContent).toContain('Adds one line to the job. It goes out when a bill takes it.')
  })

  it('the amount puts its figure on the button, and the dry run says the job total before and after', async () => {
    const spies = draw()
    type('trip-bill-amount', '6,800.00')
    expect(addButton().textContent).toBe('Add the line · $6,800')
    expect(screen.getByTestId('trip-bill-totals').textContent).toContain('Reading the job total…')
    expect(spies.preview).not.toHaveBeenCalled()
    await settle()
    expect(spies.preview).toHaveBeenCalledTimes(1)
    expect(spies.preview.mock.calls[0]?.[0]).toMatchObject({ tripId: 't14', jobId: 'j1', amount: 6800, dryRun: true })
    expect(screen.getByTestId('trip-bill-totals').textContent).toContain('$184,000 → $190,800')
    expect(addButton().disabled).toBe(false)
    expect(screen.getByTestId('trip-bill-foot').textContent).toBe('Nothing is sent to anyone.')
  })

  it('typing waits before it asks, and asks once for the amount that settled', async () => {
    const spies = draw()
    type('trip-bill-amount', '6')
    type('trip-bill-amount', '68')
    type('trip-bill-amount', '6800')
    await settle()
    expect(spies.preview).toHaveBeenCalledTimes(1)
    expect(spies.preview.mock.calls[0]?.[0]).toMatchObject({ amount: 6800 })
  })

  it('the press sends the job, the amount, the name and the words as they stand, and closes', async () => {
    const spies = draw()
    type('trip-bill-amount', '6800.50')
    type('trip-bill-name', 'Trip 14, the riser reset')
    type('trip-bill-words', 'As Walt asked on the phone.')
    await settle()
    await act(async () => {
      fireEvent.click(addButton())
    })
    expect(spies.onAdd).toHaveBeenCalledWith({ tripId: 't14', jobId: 'j1', amount: 6800.5, name: 'Trip 14, the riser reset', words: 'As Walt asked on the phone.' })
    expect(spies.onClose).toHaveBeenCalledTimes(1)
  })

  it('stays open when the press did not add the line', async () => {
    const spies = draw({ onAdd: async () => false })
    type('trip-bill-amount', '6800')
    await settle()
    await act(async () => {
      fireEvent.click(addButton())
    })
    expect(spies.onAdd).toHaveBeenCalledTimes(1)
    expect(spies.onClose).not.toHaveBeenCalled()
  })

  it('a trip on two jobs: the office picks one, and the button stays dead until it does', async () => {
    const spies = draw({ record: { ...TRIP, jobIds: ['j1', 'j2'] } })
    expect(screen.getByTestId('trip-bill-title').textContent).toBe('Put Trip 14 on a job’s lines')
    type('trip-bill-amount', '6800')
    await settle()
    expect(spies.preview).not.toHaveBeenCalled()
    expect(addButton().disabled).toBe(true)
    expect(screen.getByTestId('trip-bill-foot').textContent).toBe('Pick one of the trip’s jobs.')
    type('trip-bill-job-pick', 'j2')
    expect(screen.getByTestId('trip-bill-title').textContent).toBe('Put Trip 14 on J2140’s lines')
    await settle()
    expect(spies.preview.mock.calls[0]?.[0]).toMatchObject({ jobId: 'j2' })
    expect(addButton().disabled).toBe(false)
  })

  it('a trip with no job named lists the site’s jobs', () => {
    draw({ record: { ...TRIP, jobIds: [] } })
    const pick = screen.getByTestId('trip-bill-job-pick') as HTMLSelectElement
    expect([...pick.options].map((o) => o.textContent)).toEqual(['Pick one of Heron Point’s jobs', 'J2101 Heron Point Clubhouse', 'J2140 Heron Point Pool House'])
    type('trip-bill-amount', '6800')
    expect(screen.getByTestId('trip-bill-foot').textContent).toBe('Pick one of Heron Point’s jobs.')
  })

  it('an amount that is not money, or no name, keeps the button dead and says which', async () => {
    const spies = draw()
    type('trip-bill-amount', 'lots')
    expect(screen.getByTestId('trip-bill-foot').textContent).toBe('The amount is dollars and cents, such as 6,800.00.')
    type('trip-bill-amount', '6800')
    type('trip-bill-name', '  ')
    await settle()
    expect(screen.getByTestId('trip-bill-foot').textContent).toBe('Give the line a name.')
    expect(addButton().disabled).toBe(true)
    fireEvent.click(addButton())
    expect(spies.onAdd).not.toHaveBeenCalled()
  })

  it('a dry run the function refuses says why in its words, and nothing can be added', async () => {
    const spies = draw({
      preview: async () => {
        throw new TripBillLineRefusal('This job is billed from Owner Billing on the GC desk. A trip’s line cannot go on its lines.')
      },
    })
    type('trip-bill-amount', '6800')
    await settle()
    expect(screen.getByTestId('trip-bill-foot').textContent).toBe('This job is billed from Owner Billing on the GC desk. A trip’s line cannot go on its lines.')
    expect(screen.getByTestId('trip-bill-totals').textContent).toContain('The total stays as it is.')
    expect(addButton().disabled).toBe(true)
    fireEvent.click(addButton())
    expect(spies.onAdd).not.toHaveBeenCalled()
  })

  it('a trip that already holds a line says so, and nothing can be added', async () => {
    draw({ preview: async () => reply({ duplicate: true, fixtureId: 'fx-1', revenueBefore: 190800, revenueAfter: 190800 }) })
    type('trip-bill-amount', '6800')
    await settle()
    expect(screen.getByTestId('trip-bill-foot').textContent).toBe('Trip 14 is already on a job’s lines. Nothing was added.')
    expect(addButton().disabled).toBe(true)
  })

  it('a dry run that did not read says so, and the press is still the office’s to make', async () => {
    draw({
      preview: async () => {
        throw new Error('Failed to fetch')
      },
    })
    type('trip-bill-amount', '6800')
    await settle()
    expect(screen.getByTestId('trip-bill-totals').textContent).not.toContain('→')
    expect(addButton().disabled).toBe(false)
  })

  it('shows What it cost under the amount only when it is handed in', () => {
    draw({ costWords: '$4,910' })
    expect(screen.getByTestId('trip-bill-cost').textContent).toBe('What it cost: $4,910 · shown to a dev or a controller only')
    cleanup()
    draw()
    expect(screen.queryByTestId('trip-bill-cost')).toBeNull()
  })

  it('holds the button while the press is on its way, and Cancel and Escape close', () => {
    const spies = draw({ busy: true })
    type('trip-bill-amount', '6800')
    expect(addButton().textContent).toBe('Adding the line…')
    expect(addButton().disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(spies.onClose).toHaveBeenCalledTimes(2)
  })
})
