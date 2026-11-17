// @vitest-environment jsdom
/**
 * A bid's schedule window (punch list #367): the two dates and the tick, the quiet words beside them, what
 * is missing once the row is touched, the save that names the act and is dead until there is something to
 * save, and Remove the schedule on a bid that has one.
 */
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import type { BidScheduleColumns } from '../../lib/bids/bidSchedule'
import { BidScheduleSheet } from './BidScheduleSheet'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

beforeAll(installDomShims)
afterEach(cleanup)

const none = { start: '', end: '', noEnd: false }
const whole = { start: '2025-07-01', end: '2026-12-31', noEnd: false }

describe('BidScheduleSheet', () => {
  it('opens on the bid’s schedule with its length and where it stands, and saves nothing until something changed', () => {
    renderWithProviders(<BidScheduleSheet bidLabel="B9001" current={whole} today="2026-11-16" busy={false} onSave={() => undefined} onClose={() => undefined} />)
    expect(screen.getByRole('dialog', { name: 'B9001’s schedule' })).toBeTruthy()
    expect((screen.getByLabelText('The day the schedule starts') as HTMLInputElement).value).toBe('2025-07-01')
    expect(screen.getByTestId('bid-schedule-words').textContent).toBe('18 months · 45 days left')
    expect((screen.getByTestId('bid-schedule-save') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('bid-schedule-remove')).toBeTruthy()
  })

  it('saves a start and an end as the three columns', () => {
    const saved: BidScheduleColumns[] = []
    renderWithProviders(<BidScheduleSheet bidLabel="B9001" current={none} today="2026-11-16" busy={false} onSave={(c) => saved.push(c)} onClose={() => undefined} />)
    expect(screen.queryByTestId('bid-schedule-remove')).toBeNull()
    fireEvent.change(screen.getByLabelText('The day the schedule starts'), { target: { value: '2025-07-01' } })
    expect(screen.getByTestId('bid-schedule-problem').textContent).toBe('Type the day the schedule ends, or tick No end date.')
    expect((screen.getByTestId('bid-schedule-save') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('The day the schedule ends'), { target: { value: '2026-12-31' } })
    expect(screen.queryByTestId('bid-schedule-problem')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Save the schedule' }))
    expect(saved).toEqual([{ schedule_start: '2025-07-01', schedule_end: '2026-12-31', schedule_open_ended: false }])
  })

  it('refuses an end before the start with its reason', () => {
    renderWithProviders(<BidScheduleSheet bidLabel="B9001" current={whole} today="2026-11-16" busy={false} onSave={() => undefined} onClose={() => undefined} />)
    fireEvent.change(screen.getByLabelText('The day the schedule ends'), { target: { value: '2025-06-01' } })
    expect(screen.getByTestId('bid-schedule-problem').textContent).toBe('The end is before the start.')
    expect((screen.getByTestId('bid-schedule-save') as HTMLButtonElement).disabled).toBe(true)
  })

  it('the tick makes a schedule with no end date, and Remove the schedule clears all three', () => {
    const saved: BidScheduleColumns[] = []
    renderWithProviders(<BidScheduleSheet bidLabel="B9001" current={whole} today="2026-11-16" busy={false} onSave={(c) => saved.push(c)} onClose={() => undefined} />)
    fireEvent.click(screen.getByLabelText('No end date'))
    expect((screen.getByLabelText('The day the schedule ends') as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByTestId('bid-schedule-words').textContent).toBe('no end date')
    fireEvent.click(screen.getByRole('button', { name: 'Save the schedule' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove the schedule' }))
    expect(saved).toEqual([
      { schedule_start: '2025-07-01', schedule_end: null, schedule_open_ended: true },
      { schedule_start: null, schedule_end: null, schedule_open_ended: false },
    ])
  })

  it('Escape closes it', () => {
    let closed = 0
    renderWithProviders(<BidScheduleSheet bidLabel="B9001" current={none} today="2026-11-16" busy={false} onSave={() => undefined} onClose={() => (closed += 1)} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(closed).toBe(1)
  })
})
