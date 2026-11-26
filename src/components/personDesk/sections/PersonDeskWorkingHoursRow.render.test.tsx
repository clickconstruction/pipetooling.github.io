// @vitest-environment jsdom
/**
 * Render smoke for the Working hours row on a person's sheet (punch list #429): a dev or the controller sees each
 * line's hours as a press and changes a whole line at once; a half day on Wednesday is five presses; a change that
 * moves a salaried person's pay says so, starts this week and waits for a reason; the first time, a person on a set
 * week is asked for the start alone; taking the hours off a salaried person says pay goes back to the standard week
 * and waits for a reason; and anyone else reads the same lines with no press.
 */
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, settle } from '../../../test/renderSmokeMocks'
import type { PersonDeskViewer } from '../../../lib/people/personDeskGates'
import type { AvailableHoursAnswer } from '../../../lib/people/utilization'
import type { Segment, WeekDays } from '../../../lib/people/weekAvailability'
import type { WorkingHoursIo } from '../../../lib/people/workingHoursIo'
import { PersonDeskWorkingHoursRow } from './PersonDeskWorkingHoursRow'

// Wednesday Nov 25, 2026: this week's Sunday is Nov 22, next week's Nov 29.
const TODAY = '2026-11-25'
const weekdays = (...segs: Segment[]): WeekDays => [[], segs, segs, segs, segs, segs, []]
const set = (over: Partial<AvailableHoursAnswer> = {}): AvailableHoursAnswer => ({ user_id: 'u-wes', hours_per_week: 30, days: weekdays([360, 720]), effective_from: '2026-11-22', set_by: 'u-renee', set_at: '2026-11-23T15:00:00Z', kind: 'set', note: 'His hours from the day he started', ...over })

const controller = { role: 'controller', isDev: false, canAccessPay: true, canAccessHours: true, readOnly: false } as unknown as PersonDeskViewer
const owner = { role: 'master_technician', isDev: false, canAccessPay: true, canAccessHours: true, readOnly: false } as unknown as PersonDeskViewer
const SIX_HOUR_WEEK = { isSalary: true, paidWeek: [0, 6, 6, 6, 6, 6, 0] }
const EIGHT_HOUR_WEEK = { isSalary: true, paidWeek: [0, 8, 8, 8, 8, 8, 0] }

function makeIo(rows: AvailableHoursAnswer[]) {
  const save = vi.fn<WorkingHoursIo['save']>(async () => {})
  const io: WorkingHoursIo = { rows: async () => rows, names: async () => ({ 'u-renee': 'Renee Alder' }), save }
  return { io, save }
}
const row = (props: Partial<Parameters<typeof PersonDeskWorkingHoursRow>[0]>, rows: AvailableHoursAnswer[]) => {
  const made = makeIo(rows)
  renderWithProviders(<PersonDeskWorkingHoursRow userId="u-wes" displayName="Wes Calloway" viewer={controller} pay={SIX_HOUR_WEEK} lastReportEndYmd={null} changeKey={0} onChanged={() => {}} io={made.io} todayYmd={TODAY} {...props} />)
  return made
}
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const pick = (label: string, minute: number) => fireEvent.change(screen.getByLabelText(label), { target: { value: String(minute) } })

afterEach(cleanup)

describe('PersonDeskWorkingHoursRow', () => {
  it('draws days that share their hours as one line, with the week and who set it', async () => {
    row({}, [set()])
    await settle()
    const block = await screen.findByText('Mon to Fri')
    const lines = block.closest('.whLines') as HTMLElement
    expect(within(lines).getByRole('button', { name: 'Mon to Fri: 6:00 AM to 12:00 PM. Change' })).toBeTruthy()
    expect(within(lines).getByText('6 h a day')).toBeTruthy()
    expect(within(lines).getByRole('button', { name: 'Sat, Sun: Off. Change' })).toBeTruthy()
    expect(within(lines).getByText('five days')).toBeTruthy()
    expect(within(lines).getByText('30 h')).toBeTruthy()
    expect(lines.textContent).toContain('Sun Nov 22 set by Renee Alder')
    expect(screen.getByText(/Underlined values can be changed here/)).toBeTruthy()
  })

  it('moves a whole line at once: one save of the whole week, from next week, with no reason', async () => {
    const { save } = row({}, [set()])
    await settle()
    press('Mon to Fri: 6:00 AM to 12:00 PM. Change')
    expect((screen.getByRole('button', { name: 'Keep' }) as HTMLButtonElement).disabled).toBe(true)
    pick('Start', 420)
    pick('End', 780)
    press('Next week')
    expect(document.querySelector('[data-working-hours-comes-to]')?.textContent).toBe('Mon to Fri would be 7:00 AM to 1:00 PM, 6 h a day. The week would be 30 h.')
    expect(document.querySelector('[data-working-hours-pay]')?.textContent).toBe('Each day keeps its length, so pay does not move.')
    expect(screen.queryByLabelText('Why')).toBeNull()
    press('Keep')
    await settle()
    expect(save).toHaveBeenCalledWith({ userId: 'u-wes', days: weekdays([420, 780]), effectiveFrom: '2026-11-29', reason: null })
  })

  it('gives Wednesday a half day in five presses, and holds a pay change to this week with a reason', async () => {
    const { save } = row({ pay: EIGHT_HOUR_WEEK }, [set({ days: weekdays([420, 900]), hours_per_week: 40 })])
    await settle()
    press('Mon to Fri: 7:00 AM to 3:00 PM. Change')
    press('Give one day its own hours')
    press('Wed')
    // Wednesday sits on its own line while its field is open, and the other four stay together.
    expect(screen.getByText('Mon, Tue, Thu, Fri')).toBeTruthy()
    press('Half day')
    expect(document.querySelector('[data-working-hours-comes-to]')?.textContent).toBe('Wed would be 7:00 AM to 11:00 AM, 4 h. The week would be 36 h.')
    expect(document.querySelector('[data-working-hours-pay]')?.textContent).toBe('Wes is on a set week. Pay follows the hours, so the set week becomes 36 h.')
    expect((screen.getByRole('button', { name: 'Next week' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('A change in pay starts this week.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Keep' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Say why first. The reason goes on the pay log.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Why'), { target: { value: 'Half days on Wednesdays' } })
    press('Keep')
    await settle()
    expect(save).toHaveBeenCalledWith({
      userId: 'u-wes',
      days: [[], [[420, 900]], [[420, 900]], [[420, 660]], [[420, 900]], [[420, 900]], []],
      effectiveFrom: '2026-11-22',
      reason: 'Half days on Wednesdays',
    })
  })

  it('asks a person on a set week for the start alone the first time, so pay cannot move', async () => {
    const { save } = row({}, [])
    await settle()
    expect(await screen.findByText(/Not set yet\./)).toBeTruthy()
    expect(document.querySelector('[data-working-hours="none"]')?.textContent).toContain('Wes is on a set week of 6 h Mon to Fri.')
    press('Set working hours')
    pick('Each day starts at', 360)
    expect(document.querySelector('[data-working-hours-starter]')?.textContent).toContain('Each day would be 6:00 AM to 12:00 PM.')
    expect(screen.getByText('Each day keeps its length, so pay does not move.')).toBeTruthy()
    press('Set these hours')
    await settle()
    expect(save).toHaveBeenCalledWith({ userId: 'u-wes', days: weekdays([360, 720]), effectiveFrom: '2026-11-22', reason: null })
  })

  it('opens a plain first line for an hourly person', async () => {
    const { save } = row({ pay: { isSalary: false, paidWeek: [0, 8, 8, 8, 8, 8, 0] } }, [])
    await settle()
    await screen.findByText(/Not set yet\./)
    press('Set working hours')
    expect(document.querySelector('[data-working-hours-pay]')).toBeNull()
    press('Keep')
    await settle()
    expect(save).toHaveBeenCalledWith({ userId: 'u-wes', days: weekdays([420, 900]), effectiveFrom: '2026-11-22', reason: null })
  })

  it('shows the owner the same lines with no press, and who can change them', async () => {
    row({ viewer: owner }, [set()])
    await settle()
    await screen.findByText('Mon to Fri')
    expect(screen.queryByRole('button', { name: /Change$/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Take working hours off' })).toBeNull()
    expect(screen.getByText('6:00 AM to 12:00 PM').className).toBe('vipLocked')
    expect(screen.getByText('dev or controller')).toBeTruthy()
    expect(screen.getByText(/A dev or the controller sets working hours\./)).toBeTruthy()
  })

  it('says hours that are coming, and opens what they were before', async () => {
    row({ viewer: owner }, [set(), set({ days: weekdays([420, 780]), effective_from: '2026-11-29', set_at: '2026-11-24T15:00:00Z', note: null })])
    await settle()
    await screen.findByText('Mon to Fri')
    expect(document.querySelector('[data-working-hours-coming]')?.textContent).toBe('New from Sun Nov 29 7:00 AM to 1:00 PM Mon to Fri')
    press('Earlier hours')
    const earlier = document.querySelector('[data-working-hours-earlier]') as HTMLElement
    expect(earlier.textContent).toContain('From Sun Nov 22')
    expect(earlier.textContent).toContain('6:00 AM to 12:00 PM Mon to Fri. 30 h.')
    expect(earlier.textContent).toContain('by Renee Alder. His hours from the day he started')
  })

  it('keeps the field open and says the reason when the save is refused', async () => {
    const made = makeIo([set()])
    made.save.mockRejectedValueOnce(new Error('A dev or the controller sets working hours.'))
    renderWithProviders(<PersonDeskWorkingHoursRow userId="u-wes" displayName="Wes Calloway" viewer={controller} pay={SIX_HOUR_WEEK} lastReportEndYmd={null} changeKey={0} onChanged={() => {}} io={made.io} todayYmd={TODAY} />)
    await settle()
    press('Mon to Fri: 6:00 AM to 12:00 PM. Change')
    pick('Start', 420)
    pick('End', 780)
    press('Keep')
    await settle()
    expect((await screen.findByRole('alert')).textContent).toContain('A dev or the controller sets working hours.')
    expect(document.querySelector('[data-working-hours-field]')).toBeTruthy()
  })

  it('takes the hours off a salaried person: says pay goes back to the standard week, and waits for a reason', async () => {
    const { save } = row({}, [set()])
    await settle()
    press('Take working hours off')
    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain('Their set week on pay is 6 h Mon to Fri today. It goes back to the standard week, 8 h Mon to Fri.')
    expect(dialog.textContent).toContain('Say why. The reason goes on the pay log.')
    expect(dialog.textContent).not.toContain('stays as it is')
    const go = within(dialog).getByRole('button', { name: 'Take working hours off' }) as HTMLButtonElement
    expect(go.disabled).toBe(true)
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: ' Back on full days ' } })
    expect(go.disabled).toBe(false)
    fireEvent.click(go)
    await settle()
    expect(save).toHaveBeenCalledWith({ userId: 'u-wes', days: null, effectiveFrom: '2026-11-22', reason: 'Back on full days' })
    // The words land twice: the toast, and the row's own note (v2.8625).
    expect((await screen.findAllByText('Working hours taken off. Pay is back on the standard week.')).length).toBeGreaterThanOrEqual(2)
    expect(document.querySelector('[data-working-hours-saved]')?.textContent).toBe('Working hours taken off. Pay is back on the standard week.')
  })

  it('after a take-off the row reads Not set yet, says what it did, and still opens the earlier hours with the take-off last (punch list #429, v2.8625)', async () => {
    const state = { rows: [set()] as AvailableHoursAnswer[] }
    const save = vi.fn<WorkingHoursIo['save']>(async (input) => {
      state.rows = [...state.rows, set({ days: null, hours_per_week: 0, effective_from: input.effectiveFrom, set_at: '2026-11-25T16:00:00Z', note: input.reason })]
    })
    const io: WorkingHoursIo = { rows: async () => state.rows, names: async () => ({ 'u-renee': 'Renee Alder' }), save }
    renderWithProviders(<PersonDeskWorkingHoursRow userId="u-wes" displayName="Wes Calloway" viewer={controller} pay={SIX_HOUR_WEEK} lastReportEndYmd={null} changeKey={0} onChanged={() => {}} io={io} todayYmd={TODAY} />)
    await settle()
    press('Take working hours off')
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Back on full days' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Take working hours off' }))
    await settle()
    expect(await screen.findByText(/Not set yet\./)).toBeTruthy()
    expect(document.querySelector('[data-working-hours="none"]')).toBeTruthy()
    expect(document.querySelector('[data-working-hours-saved]')?.textContent).toBe('Working hours taken off. Pay is back on the standard week.')
    press('Earlier hours')
    const earlier = document.querySelector('[data-working-hours-earlier]') as HTMLElement
    const rowsText = Array.from(earlier.querySelectorAll('.whEarlierRow')).map((r) => r.textContent ?? '')
    expect(rowsText).toHaveLength(2)
    expect(rowsText[0]).toContain('Working hours taken off.')
    expect(rowsText[0]).toContain('Back on full days')
    expect(rowsText[1]).toContain('6:00 AM to 12:00 PM Mon to Fri. 30 h.')
  })

  it('a person whose hours were taken off before opens the earlier hours from the Not set yet row, and the owner reads the same', async () => {
    const takenOff = set({ days: null, hours_per_week: 0, effective_from: '2026-11-22', set_at: '2026-11-24T16:00:00Z', note: 'Back on full days' })
    row({ viewer: owner }, [set({ effective_from: '2026-11-15', set_at: '2026-11-16T15:00:00Z' }), takenOff])
    await settle()
    await screen.findByText(/Not set yet\./)
    expect(screen.queryByRole('button', { name: 'Set working hours' })).toBeNull()
    press('Earlier hours')
    const earlier = document.querySelector('[data-working-hours-earlier]') as HTMLElement
    expect(earlier.textContent).toContain('Working hours taken off.')
    expect(earlier.textContent).toContain('From Sun Nov 15')
    expect(document.querySelector('[data-working-hours-saved]')).toBeNull()
  })

  it('writes nothing when the take-off is cancelled', async () => {
    const { save } = row({}, [set()])
    await settle()
    press('Take working hours off')
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    await settle()
    expect(save).not.toHaveBeenCalled()
  })

  it('takes the hours off with no reason when pay has nothing to move', async () => {
    const { save } = row({ pay: EIGHT_HOUR_WEEK }, [set({ hours_per_week: 40, days: weekdays([420, 900]) })])
    await settle()
    press('Take working hours off')
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent).toContain('Their pay stays on the standard week, 8 h Mon to Fri.')
    expect(within(dialog).queryByRole('textbox')).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Take working hours off' }))
    await settle()
    expect(save).toHaveBeenCalledWith({ userId: 'u-wes', days: null, effectiveFrom: '2026-11-22', reason: null })
  })

  it('says a roster person with no login has none', async () => {
    row({ userId: null }, [])
    expect(screen.getByText(/Needs a login\./)).toBeTruthy()
  })
})
