// @vitest-environment jsdom
/**
 * The window behind Split in two (v2.7891): the days it offers, the day it picks first, both trips drawn before the
 * press, the press, and what it says of a trip on a bill. Every name here is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { newTripRecord, type TripRecord } from '../../lib/trips/tripRecord'
import { TripSplitWindow } from './TripSplitWindow'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(cleanup)

const TODAY = '2026-11-18'
const TRIP: TripRecord = {
  ...newTripRecord({ id: 't3', developmentId: 'd1' }),
  tripNumber: 3,
  billing: 'extra',
  people: [
    { personId: null, userId: 'u-luis', name: 'Luis', days: { '2026-11-10': 'site', '2026-11-11': 'site' } },
    { personId: null, userId: 'u-dana', name: 'Dana', days: { '2026-11-09': 'road', '2026-11-10': 'site', '2026-11-11': 'site', '2026-11-14': 'site', '2026-11-15': 'road' } },
  ],
}
const STRAIGHT: TripRecord = { ...TRIP, people: [{ personId: null, userId: null, name: 'Omar', days: { '2026-11-09': 'road', '2026-11-10': 'site', '2026-11-11': 'road' } }] }

function draw(over: Partial<Parameters<typeof TripSplitWindow>[0]> = {}) {
  const onSplit = vi.fn()
  const onClose = vi.fn()
  renderWithProviders(<TripSplitWindow record={TRIP} todayYmd={TODAY} onBill={false} busy={false} onSplit={onSplit} onClose={onClose} {...over} />)
  return { onSplit, onClose }
}
const days = () => screen.getAllByTestId('trip-split-day')
const confirm = () => within(screen.getByTestId('trip-split-confirm')).getByRole('button') as HTMLButtonElement

describe('TripSplitWindow', () => {
  it('names the trip, and offers every day but the first with who was on it', () => {
    draw()
    expect(screen.getByRole('dialog', { name: 'Split Trip 3 in two' })).toBeTruthy()
    expect(screen.getByTestId('trip-split-title').textContent).toBe('Split Trip 3 in two')
    expect(days().map((d) => d.getAttribute('data-day'))).toEqual(['2026-11-10', '2026-11-11', '2026-11-14', '2026-11-15'])
    expect(days()[0]?.textContent).toBe('Nov 10Dana, Luis')
    expect(days()[2]?.textContent).toBe('Nov 14Danaafter 2 days at home')
    expect(screen.getByRole('radiogroup', { name: 'The second trip starts on' })).toBeTruthy()
  })

  it('picks the day after the longest stretch at home, and draws both trips before the press', () => {
    const { onSplit } = draw()
    expect(days().map((d) => d.getAttribute('data-picked'))).toEqual(['no', 'no', 'yes', 'no'])
    expect(screen.getByTestId('trip-split-first').textContent).toBe('Trip 3 · Nov 9 to 11Dana, Luis · 3 days')
    expect(screen.getByTestId('trip-split-second').textContent).toBe('A new trip · Nov 14 to 15Dana · 2 days')
    expect(confirm().textContent).toBe('Split into two trips')
    expect(confirm().disabled).toBe(false)
    fireEvent.click(confirm())
    expect(onSplit).toHaveBeenCalledWith('2026-11-14')
  })

  it('redraws both trips for another day, and splits at that one', () => {
    const { onSplit } = draw()
    fireEvent.click(within(days()[1]!).getByRole('radio'))
    expect(screen.getByTestId('trip-split-first').textContent).toBe('Trip 3 · Nov 9 to 10Dana, Luis · 2 days')
    expect(screen.getByTestId('trip-split-second').textContent).toBe('A new trip · Nov 11 to 15Dana, Luis · 3 days')
    fireEvent.click(confirm())
    expect(onSplit).toHaveBeenCalledWith('2026-11-11')
  })

  it('picks no day on a trip with no day at home in the middle, with the press dead until one is picked', () => {
    const { onSplit } = draw({ record: STRAIGHT })
    expect(days().every((d) => d.getAttribute('data-picked') === 'no')).toBe(true)
    expect(screen.getByTestId('trip-split-pick-first').textContent).toBe('Pick the day the second trip starts.')
    expect(screen.queryByTestId('trip-split-halves')).toBeNull()
    expect(confirm().disabled).toBe(true)
    fireEvent.click(confirm())
    expect(onSplit).not.toHaveBeenCalled()
    fireEvent.click(within(days()[1]!).getByRole('radio'))
    expect(confirm().disabled).toBe(false)
    expect(screen.getByTestId('trip-split-second').textContent).toBe('A new trip · Nov 11Omar · 1 day')
  })

  it('says a trip on a bill keeps its line, and says nothing of a bill otherwise', () => {
    draw({ onBill: true })
    expect(screen.getByTestId('trip-split-bill-note').textContent).toBe('Trip 3 is on a bill. Its line stays with Trip 3, and the new trip starts with no billing said.')
    cleanup()
    draw()
    expect(screen.queryByTestId('trip-split-bill-note')).toBeNull()
    expect(screen.getByText('Both trips keep what it was for, who asked, how it went and the jobs. No clock row, bill or cost changes.')).toBeTruthy()
    expect(screen.getByText('A split has no undo. To take one back, delete the new trip and add its days to the first with Change.')).toBeTruthy()
  })

  it('holds the press while the split is on its way, and closes on Cancel, the × and Escape', () => {
    const busy = draw({ busy: true })
    expect(confirm().disabled).toBe(true)
    expect(confirm().textContent).toBe('Splitting the trip…')
    fireEvent.click(screen.getByText('Cancel'))
    fireEvent.click(screen.getByLabelText('Close'))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(busy.onClose).toHaveBeenCalledTimes(3)
    expect(busy.onSplit).not.toHaveBeenCalled()
  })
})
