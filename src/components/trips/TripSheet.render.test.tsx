// @vitest-environment jsdom
/**
 * The trip sheet (punch list #379, PR 3): three questions, painted days, and everything else under More.
 * Every name here is made up.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { newTripRecord, type TripRecord } from '../../lib/trips/tripRecord'
import { TripSheet } from './TripSheet'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

beforeAll(installDomShims)
afterEach(cleanup)

const TODAY = '2026-11-17'
const ROSTER = [
  { id: 'p-dana', name: 'Dana', userId: 'u-dana' },
  { id: 'p-luis', name: 'Luis', userId: null },
]
const JOBS = [{ id: 'j1', label: 'J2101', name: 'Rough-in: lodge and bunkhouse' }]

function draw(record: TripRecord = newTripRecord({ id: 't-new', developmentId: 'd1' }), isNew = true) {
  const onSave = vi.fn(async (_: TripRecord) => true)
  const onClose = vi.fn()
  renderWithProviders(<TripSheet record={record} isNew={isNew} siteName="Heron Point" roster={ROSTER} jobs={JOBS} todayYmd={TODAY} busy={false} onSave={onSave} onClose={onClose} />)
  return { onSave, onClose }
}
const kindsOf = (testId: string) => [...screen.getByTestId(testId).querySelectorAll('button')].map((b) => b.getAttribute('data-kind'))

describe('TripSheet', () => {
  it('opens on today painted At the site, and will not save with nobody on it', () => {
    draw()
    expect(screen.getByRole('dialog', { name: 'A trip to Heron Point' })).toBeTruthy()
    expect(kindsOf('trip-paint-days')).toEqual(['site'])
    expect(screen.getByTestId('trip-sheet-foot').textContent).toBe('Add who went.')
    expect((screen.getByText('Save the trip') as HTMLButtonElement).disabled).toBe(true)
  })

  it('one person and one day is a whole trip', async () => {
    const { onSave, onClose } = draw()
    fireEvent.change(screen.getByTestId('trip-add-person'), { target: { value: 'p-dana' } })
    expect(screen.getByTestId('trip-sheet-foot').textContent).toBe('Saves as Out now. Nothing is sent to anyone.')
    fireEvent.click(screen.getByText('Save the trip'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ id: 't-new', developmentId: 'd1', people: [{ personId: 'p-dana', userId: 'u-dana', name: 'Dana', days: { [TODAY]: 'site' } }] })
  })

  it('paints the picked days, and a tap turns a day’s kind', async () => {
    const { onSave } = draw()
    fireEvent.change(screen.getByTestId('trip-add-person'), { target: { value: 'p-luis' } })
    fireEvent.change(screen.getByTestId('trip-first-day'), { target: { value: '2026-12-01' } })
    fireEvent.change(screen.getByTestId('trip-last-day'), { target: { value: '2026-12-03' } })
    expect(kindsOf('trip-paint-days')).toEqual(['site', 'site', 'site'])
    const squares = screen.getByTestId('trip-paint-days').querySelectorAll('button')
    fireEvent.click(squares[0]!)
    fireEvent.click(squares[2]!)
    fireEvent.click(squares[2]!)
    expect(kindsOf('trip-paint-days')).toEqual(['road', 'site', 'ready'])
    expect(screen.getByTestId('trip-sheet-foot').textContent).toBe('Saves as Planned. Nothing is sent to anyone.')
    fireEvent.click(screen.getByText('Save the trip'))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0]?.[0].people[0]?.days).toEqual({ '2026-12-01': 'road', '2026-12-02': 'site', '2026-12-03': 'ready' })
  })

  it('adds someone not in the app by name, and takes a person off with a press on their chip', () => {
    draw()
    fireEvent.click(screen.getByTestId('trip-add-typed'))
    fireEvent.change(screen.getByTestId('trip-typed-name'), { target: { value: 'Walt (sub)' } })
    fireEvent.click(screen.getByText('Add'))
    fireEvent.change(screen.getByTestId('trip-add-person'), { target: { value: 'p-dana' } })
    expect(screen.getAllByTestId('trip-person-chip').map((c) => c.textContent)).toEqual(['Walt (sub) ✕', 'Dana ✕'])
    fireEvent.click(screen.getAllByTestId('trip-person-chip')[0]!)
    expect(screen.getAllByTestId('trip-person-chip').map((c) => c.textContent)).toEqual(['Dana ✕'])
  })

  it('keeps the rest under More: who asked, the jobs, the billing and how it went', async () => {
    const { onSave } = draw()
    fireEvent.change(screen.getByTestId('trip-add-person'), { target: { value: 'p-dana' } })
    fireEvent.change(screen.getByTestId('trip-purpose'), { target: { value: 'Trim-out, lodge first floor' } })
    expect(screen.queryByTestId('trip-asked-them')).toBeNull()
    fireEvent.click(screen.getByTestId('trip-more'))
    fireEvent.click(screen.getByTestId('trip-asked-them'))
    fireEvent.change(screen.getByTestId('trip-asked-who'), { target: { value: 'Ray, the site super' } })
    fireEvent.change(screen.getByTestId('trip-asked-how'), { target: { value: 'by email, Nov 12' } })
    fireEvent.change(screen.getByTestId('trip-add-job'), { target: { value: 'j1' } })
    fireEvent.click(screen.getByTestId('trip-billing-extra'))
    fireEvent.change(screen.getByTestId('trip-outcome'), { target: { value: 'Did the work.' } })
    fireEvent.click(screen.getByText('Save the trip'))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ purpose: 'Trim-out, lodge first floor', askedBy: 'them', askedWho: 'Ray, the site super', askedHow: 'by email, Nov 12', jobIds: ['j1'], billing: 'extra', outcome: 'Did the work.' })
  })

  it('opens a kept trip as it is, More open, and gives one person days of their own', async () => {
    const kept: TripRecord = { ...newTripRecord({ id: 't5', developmentId: 'd1' }), purpose: 'Lift stations before the pour', askedBy: 'us', people: [{ personId: 'p-dana', userId: 'u-dana', name: 'Dana', days: { '2026-10-30': 'road', '2026-10-31': 'site' } }, { personId: 'p-luis', userId: null, name: 'Luis', days: { '2026-10-30': 'road', '2026-10-31': 'site' } }] }
    const { onSave } = draw(kept, false)
    expect((screen.getByTestId('trip-purpose') as HTMLInputElement).value).toBe('Lift stations before the pour')
    expect(screen.getByTestId('trip-asked-us').getAttribute('aria-checked')).toBe('true')
    expect(kindsOf('trip-paint-days')).toEqual(['road', 'site'])
    fireEvent.click(screen.getByText('Give one person their own days ›'))
    const luis = screen.getAllByTestId('trip-person-days')[1]!
    fireEvent.click(within(luis).getAllByRole('button')[0]!)
    fireEvent.click(screen.getByText('Save the trip'))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0]?.[0].people.map((p) => p.days['2026-10-30'])).toEqual(['road', 'ready'])
  })

  it('closes on Cancel and on Escape, saving nothing', () => {
    const { onSave, onClose } = draw()
    fireEvent.click(screen.getByText('Cancel'))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(onSave).not.toHaveBeenCalled()
  })
})
