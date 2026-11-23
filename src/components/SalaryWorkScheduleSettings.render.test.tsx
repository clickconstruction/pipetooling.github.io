// @vitest-environment jsdom
/**
 * The Workday schedule window and who sets the usual day (punch list #429): a dev or the controller changes it and
 * saves it; everyone else reads it with its fields off, keeps the custom schedule for one date, and their save
 * writes that date and never the usual day. The database holds the same rule on the table. Made-up people only.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { SalaryWorkScheduleSettings } from './SalaryWorkScheduleSettings'
import { renderWithProviders, settle } from '../test/renderSmokeMocks'

const state = vi.hoisted(() => ({ role: 'controller', template: true, writes: [] as string[] }))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u-viewer' }, role: state.role }),
  useOptionalAuth: () => ({ user: { id: 'u-viewer' }, role: state.role }),
}))
vi.mock('../lib/people/availabilityIo', () => ({ defaultAvailabilityIo: () => ({ listAnswers: () => Promise.resolve([]) }) }))
vi.mock('../lib/salaryScheduleSync', () => ({
  denverWorkDateToday: () => '2026-11-23',
  syncSalaryClockSessionsForUserDay: () => Promise.resolve({ error: null }),
  removeSalaryScheduleForUser: () => Promise.resolve({ error: null }),
}))
vi.mock('../lib/supabase', async () => {
  const { APP_CALENDAR_TZ } = await vi.importActual<typeof import('../utils/dateUtils')>('../utils/dateUtils')
  const TEMPLATE = { user_id: 'u-hal', timezone: APP_CALENDAR_TZ, exclude_weekends: true, mode: 'continuous', segment_a_start_local: '07:00:00', segment_a_duration_minutes: 480, segment_b_start_local: null, segment_b_duration_minutes: null, use_split_focus: false }
  function builder(table: string): Record<string, unknown> {
    const b: Record<string, unknown> = {}
    for (const op of ['select', 'eq', 'is', 'in', 'limit', 'order']) b[op] = () => b
    const write = (op: string) => () => {
      state.writes.push(`${op} ${table}`)
      return b
    }
    b.upsert = write('upsert')
    b.delete = write('delete')
    const row = () => (table === 'people_pay_config' ? { is_salary: true } : table === 'salary_work_schedule_templates' && state.template ? TEMPLATE : null)
    b.maybeSingle = () => Promise.resolve({ data: row(), error: null })
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(ok)
    return b
  }
  return { supabase: { from: (table: string) => builder(table) } }
})

const mount = () => renderWithProviders(<SalaryWorkScheduleSettings userId="u-hal" userPayName="ZZ Test Hal" canEditPastDayOverrides={false} />)
const usualDay = () => document.querySelector('fieldset') as HTMLFieldSetElement

describe('the Workday schedule window', () => {
  beforeEach(() => {
    state.role = 'controller'
    state.template = true
    state.writes = []
  })

  it('the controller changes the usual day and saves it', async () => {
    mount()
    await settle()
    await screen.findByText('Save schedule')
    expect(usualDay().disabled).toBe(false)
    expect(document.querySelector('[data-standing-schedule-locked]')).toBeNull()
    fireEvent.click(screen.getByText('Save schedule'))
    await waitFor(() => expect(state.writes).toContain('upsert salary_work_schedule_templates'))
  })

  it('an owner reads the usual day with its fields off, and saves one date without writing it', async () => {
    state.role = 'master_technician'
    mount()
    await settle()
    await screen.findByText('Save this date')
    expect(usualDay().disabled).toBe(true)
    expect(document.querySelector('[data-standing-schedule-locked]')?.textContent).toBe('A dev or the controller sets the usual day. It is shown here as it stands. A custom schedule for one date is still yours to save below.')
    // The custom schedule for one date sits outside the fields that are off.
    const custom = screen.getByLabelText(/Custom schedule for this date/) as HTMLInputElement
    expect(usualDay().contains(custom)).toBe(false)
    expect(custom.disabled).toBe(false)
    fireEvent.click(custom)
    fireEvent.click(screen.getByText('Save this date'))
    await waitFor(() => expect(state.writes).toContain('upsert salary_work_schedule_day_overrides'))
    expect(state.writes).not.toContain('upsert salary_work_schedule_templates')
  })

  it('a salaried person with no usual day is told who sets one', async () => {
    state.role = 'helpers'
    state.template = false
    mount()
    await settle()
    await screen.findByText('Save this date')
    expect(document.querySelector('[data-standing-schedule-locked]')?.textContent).toContain('No usual day is saved yet. A dev or the controller sets it.')
  })
})
