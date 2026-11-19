// @vitest-environment jsdom
/**
 * The desk's Pay & schedule card as one form (the owner's mockup, 2026-11-18): a person paid by the hour is put on
 * a set week from the form and saved once, the dates and the pay row together; a person on a set week reads with
 * their days and what the week comes to; a week with no hours names itself and leaves Save dead.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PayConfigFacts } from '../../../lib/people/personDeskFacts'
import type { PersonDeskViewer } from '../../../lib/people/personDeskGates'
import type { PersonKey } from '../../../lib/people/personKey'

type Call = { table: string; method: string; args: unknown[] }
const h = vi.hoisted(() => ({
  calls: [] as Array<{ table: string; method: string; args: unknown[] }>,
  facts: null as unknown,
  dates: { start_date: null as string | null, end_date: null as string | null },
  toast: vi.fn(),
  sync: vi.fn(async () => ({ error: null })),
}))

vi.mock('../../../lib/supabase', () => {
  const answers: Record<string, unknown> = {
    user_time_off: { data: [], error: null },
    pay_stubs: { data: [{ period_start: '2026-08-09', period_end: '2026-08-15', paid_at: null }], error: null },
    person_offsets: { count: 0, error: null },
    employment_stints: { data: [], error: null },
  }
  const from = (table: string) => {
    let wrote = false
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'gte', 'order', 'limit', 'is', 'in']) {
      q[m] = (...args: unknown[]) => {
        h.calls.push({ table, method: m, args })
        return q
      }
    }
    for (const m of ['update', 'upsert']) {
      q[m] = (...args: unknown[]) => {
        wrote = true
        h.calls.push({ table, method: m, args })
        return q
      }
    }
    q.maybeSingle = () => Promise.resolve({ data: table === 'people' ? h.dates : null, error: null })
    q.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(wrote ? { data: null, error: null } : (answers[table] ?? { data: [], error: null })).then(resolve, reject)
    return q
  }
  return { supabase: { from, rpc: vi.fn(async () => ({ data: { ok: true }, error: null })) } }
})
vi.mock('../../../contexts/ToastContext', () => ({ useToastContext: () => ({ showToast: h.toast }) }))
vi.mock('../../../contexts/ConfirmDialogContext', () => ({ useConfirmDialog: () => vi.fn(async () => true) }))
vi.mock('../../../lib/people/personDeskFacts', () => ({ loadPayConfigFacts: vi.fn(async () => h.facts) }))
vi.mock('../../../lib/salaryScheduleSync', () => ({ denverWorkDateToday: () => '2026-11-18', syncSalaryClockSessionsForUserDay: h.sync }))
vi.mock('../../pay/PersonOffsetFormModal', () => ({ PersonOffsetFormModal: () => null }))
vi.mock('../../SalaryWorkScheduleSettings', () => ({ SalaryWorkScheduleSettings: () => null }))

import { PersonDeskPaySection } from './PersonDeskPaySection'

const viewer = { role: 'assistant', isDev: false, canAccessPay: true, canAccessHours: true, readOnly: false } as unknown as PersonDeskViewer
const personKey = { payName: 'Rosa Sample', personId: 'p-rosa', userId: 'u-rosa', displayName: 'Rosa Sample' } as unknown as PersonKey
const HOURLY: PayConfigFacts = { exists: true, hourlyWage: 10, officeWage: null, isSalary: false, recordHoursButSalary: false, salariedWeek: [0, 8, 8, 8, 8, 8, 0] }
const SET_WEEK: PayConfigFacts = { exists: true, hourlyWage: 10, officeWage: null, isSalary: true, recordHoursButSalary: true, salariedWeek: [0, 6, 6, 6, 6, 6, 0] }

const writes = () => h.calls.filter((c: Call) => c.method === 'update' || c.method === 'upsert')
const show = () => render(<PersonDeskPaySection personKey={personKey} viewer={viewer} changeKey={0} onChanged={() => {}} />)

beforeEach(() => {
  h.calls.length = 0
  h.toast.mockClear()
  h.sync.mockClear()
  h.dates = { start_date: null, end_date: null }
})
afterEach(() => cleanup())

describe('PersonDeskPaySection', () => {
  it('a person on a set week reads with their days, the week’s pay and the wage', async () => {
    h.facts = SET_WEEK
    h.dates = { start_date: '2026-11-16', end_date: null }
    show()
    expect(await screen.findByText('A set week')).toBeTruthy()
    expect(screen.getByText('6 h Mon to Fri · $300.00 a week')).toBeTruthy()
    expect(screen.getByText('$10.00 / h')).toBeTruthy()
    expect(screen.getByText('Still clocks in and out')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Workday schedule…' })).toBeTruthy()
  })

  it('by the hour to a set week: the form works out the wage, says what changes, and saves the dates and the pay row once', async () => {
    h.facts = HOURLY
    show()
    expect(await screen.findByText('By the hour')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Edit pay setup' }))
    fireEvent.click(screen.getByRole('button', { name: 'A set week' }))
    fireEvent.click(screen.getByRole('button', { name: '6 h, five days' }))
    expect((screen.getByLabelText('Monday hours') as HTMLInputElement).value).toBe('6')
    expect((screen.getByLabelText('Saturday hours') as HTMLInputElement).value).toBe('0')
    // No weekly pay yet: the one field to fix is named, and Save is dead.
    expect(screen.getByRole('alert').textContent).toBe('Enter the weekly pay')
    expect((screen.getByRole('button', { name: 'Save pay setup' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Weekly pay'), { target: { value: '300' } })
    expect(screen.getByText('works out to $10.00 an hour')).toBeTruthy()
    expect(screen.getByText('30 h')).toBeTruthy()
    expect(screen.getByText('$60.00')).toBeTruthy()
    expect(document.querySelector('[data-pay-setup-summary]')?.textContent).toBe('Was by the hour at $10.00. Now $300.00 a week, 6 h Mon to Fri.')
    // No start date, and the last pay report ended Aug 15: thirteen weeks would show as owed.
    expect(screen.getByText('No start date. Payroll will show 13 earlier weeks with no pay report as owed. Set the day the set week starts.')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-11-16' } })
    expect(screen.queryByText(/No start date/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Save pay setup' }))
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith('Pay setup saved', 'success'))
    expect(writes()).toEqual([
      { table: 'people', method: 'update', args: [{ start_date: '2026-11-16', end_date: null }] },
      {
        table: 'people_pay_config',
        method: 'upsert',
        args: [
          { person_name: 'Rosa Sample', person_id: 'p-rosa', hourly_wage: 10, office_hourly_wage: null, is_salary: true, record_hours_but_salary: true, salaried_week_hours: [0, 6, 6, 6, 6, 6, 0] },
          { onConflict: 'person_name' },
        ],
      },
    ])
    expect(h.sync).toHaveBeenCalledWith('u-rosa', '2026-11-18')
    // The form closes on a save.
    await waitFor(() => expect(document.querySelector('[data-pay-setup-form]')).toBeNull())
  })

  it('a day changed by hand moves the week, the wage and the line; a week with no hours is named and cannot be saved', async () => {
    h.facts = SET_WEEK
    h.dates = { start_date: '2026-11-16', end_date: null }
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Edit pay setup' }))
    // It opens on what is stored: nothing to save yet.
    expect((screen.getByLabelText('Weekly pay') as HTMLInputElement).value).toBe('300')
    expect(document.querySelector('[data-pay-setup-summary]')?.textContent).toBe('No change.')
    expect((screen.getByRole('button', { name: 'Save pay setup' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Friday hours'), { target: { value: '4' } })
    expect(screen.getByText('28 h')).toBeTruthy()
    expect(document.querySelector('[data-pay-setup-summary]')?.textContent).toBe('Was $300.00 a week, 6 h Mon to Fri. Now $299.88 a week, 6 h Mon to Thu, 4 h Fri.')
    expect(screen.getByText('$10.71 an hour over 28 hours comes to $299.88 a week, not $300.00. A wage is kept to the cent.')).toBeTruthy()

    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) fireEvent.change(screen.getByLabelText(`${day} hours`), { target: { value: '0' } })
    expect(screen.getByRole('alert').textContent).toBe('Give at least one day its hours')
    expect((screen.getByRole('button', { name: 'Save pay setup' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(document.querySelector('[data-pay-setup-form]')).toBeNull()
    expect(writes()).toEqual([])
  })
})
