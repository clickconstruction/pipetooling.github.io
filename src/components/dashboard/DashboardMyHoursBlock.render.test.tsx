// @vitest-environment jsdom
/**
 * Render smoke for My Time's Your hours block: with no answer it asks and offers Set hours; with a
 * drawn answer it reads the week back in words, offers Change and draws the bars; a salaried person
 * reads their own set week, with nothing recorded too, and has no press. The week it hands Job Mode's
 * This week square is the week its own line prints, and both are read again when the clock changes.
 */
import { act, cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { UpdateFocusOpenerBridgeProvider, useUpdateFocusOpenerBridge } from '../../contexts/UpdateFocusOpenerBridgeContext'
import { topRowHoursValue } from '../../lib/jobMode/topRow'
import { buildUtilizationBoard, type AvailableHoursAnswer, type UtilizationPerson, type UtilizationSession } from '../../lib/people/utilization'
import { DEFAULT_WEEK } from '../../lib/people/weekAvailability'
import { localAvailabilityIo } from '../../lib/people/availabilityIo'

const person: UtilizationPerson = { id: 'u-me', name: 'Isiah Reyes', role: 'helpers', isSalary: false, recordsHoursButSalary: false }
let answers: AvailableHoursAnswer[] = []
let sessions: UtilizationSession[] = []
/** A closed punch on the Sunday the mock calls today, so it falls in this week. */
const punch = (from: string, to: string): UtilizationSession => ({ user_id: 'u-me', work_date: '2026-11-08', clocked_in_at: `2026-11-08T${from}:00-06:00`, clocked_out_at: `2026-11-08T${to}:00-06:00`, approved_at: null, rejected_at: null, revoked_at: null, origin: 'user_punch' })

// The read builds the board from what the block hands it, so the week the block passes is the week the board reads.
vi.mock('../../lib/people/fetchUtilizationBoard', () => ({
  fetchMyUtilization: async (args: { isSalary: boolean; salariedWeek?: readonly number[] | null }) => {
    const me = { ...person, isSalary: args.isSalary, salariedWeek: args.salariedWeek ?? null }
    const board = buildUtilizationBoard({ todayYmd: '2026-11-08', nowMs: Date.parse('2026-11-08T15:00:00-06:00'), people: [me], sessions, answers })
    return { board, people: [me], startYmd: '2026-09-20', endYmd: '2026-11-14' }
  },
}))

const { DashboardMyHoursBlock } = await import('./DashboardMyHoursBlock')

afterEach(() => {
  cleanup()
  answers = []
  sessions = []
})

describe('DashboardMyHoursBlock', () => {
  it('asks for the hours and offers Set hours when nobody has answered', async () => {
    renderWithProviders(<DashboardMyHoursBlock userId="u-me" displayName="Isiah" role="helpers" isSalary={false} io={localAvailabilityIo()} />)
    await settle()
    expect(await screen.findByText('How many hours a week can you work?')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Set hours' })).toBeTruthy()
    expect(screen.getByText(/the office assumes 40 h/)).toBeTruthy()
  })

  it('reads a drawn week back in words and offers Change', async () => {
    answers = [{ user_id: 'u-me', hours_per_week: 40, days: DEFAULT_WEEK, effective_from: '2026-11-01', set_by: 'u-me', set_at: '2026-11-01T10:00:00Z' }]
    renderWithProviders(<DashboardMyHoursBlock userId="u-me" displayName="Isiah" role="helpers" isSalary={false} io={localAvailabilityIo()} />)
    await settle()
    expect(await screen.findByText('You can work 40 h a week.')).toBeTruthy()
    expect(screen.getByText('Mon–Fri 7a–3p. Off Sat and Sun.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Change' })).toBeTruthy()
    expect(screen.getByRole('img', { name: /8 weeks of hours/ })).toBeTruthy()
  })

  it('reads the default week for a salaried person whose pay sets none, and offers no press', async () => {
    answers = [{ user_id: 'u-me', hours_per_week: 40, days: null, effective_from: '2026-11-01', set_by: 'u-me', set_at: '2026-11-01T10:00:00Z' }]
    renderWithProviders(<DashboardMyHoursBlock userId="u-me" displayName="Isiah" role="helpers" isSalary io={localAvailabilityIo()} />)
    await settle()
    expect(await screen.findByText('Salaried: your week is 40 h.')).toBeTruthy()
    expect(screen.getByText('8 h Mon to Fri')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Set hours|Change/ })).toBeNull()
  })

  it('reads a salaried person’s own week, with nothing on the clock yet', async () => {
    // No answer and no sessions: the board leaves the person out, and the block still says their own week.
    renderWithProviders(<DashboardMyHoursBlock userId="u-me" displayName="Isiah" role="helpers" isSalary salariedWeek={[0, 6, 6, 6, 6, 6, 0]} io={localAvailabilityIo()} />)
    await settle()
    expect(await screen.findByText('Salaried: your week is 30 h.')).toBeTruthy()
    expect(screen.getByText('6 h Mon to Fri')).toBeTruthy()
    expect(screen.getByText('Nothing on the clock yet these weeks.')).toBeTruthy()
    expect(screen.queryByText(/40 h/)).toBeNull()
    expect(screen.queryByRole('button', { name: /Set hours|Change/ })).toBeNull()
  })

  it('hands Job Mode the week its own line prints', async () => {
    sessions = [punch('08:00', '12:30'), punch('13:00', '14:15')]
    const onWeek = vi.fn()
    renderWithProviders(<DashboardMyHoursBlock userId="u-me" displayName="Isiah" role="helpers" isSalary={false} framed onWeek={onWeek} io={localAvailabilityIo()} />)
    await settle()
    expect(await screen.findByText(/This week 5\.8 of 40 h so far\./)).toBeTruthy()
    expect(onWeek).toHaveBeenLastCalledWith(5.8)
    // The square's own words for that number are the line's number.
    expect(topRowHoursValue(onWeek.mock.lastCall?.[0])).toBe('5.8 h')
  })

  it('hands Job Mode no number with no row to read, and zero for an answer with nothing on the clock', async () => {
    const onWeek = vi.fn()
    const first = renderWithProviders(<DashboardMyHoursBlock userId="u-me" displayName="Isiah" role="helpers" isSalary={false} framed onWeek={onWeek} io={localAvailabilityIo()} />)
    await settle()
    expect(await screen.findByText('How many hours a week can you work?')).toBeTruthy()
    expect(onWeek).toHaveBeenLastCalledWith(null)
    first.unmount()
    answers = [{ user_id: 'u-me', hours_per_week: 38, days: null, effective_from: '2026-11-01', set_by: 'u-me', set_at: '2026-11-01T10:00:00Z' }]
    renderWithProviders(<DashboardMyHoursBlock userId="u-me" displayName="Isiah" role="helpers" isSalary={false} framed onWeek={onWeek} io={localAvailabilityIo()} />)
    await settle()
    expect(await screen.findByText('You can work 38 h a week.')).toBeTruthy()
    expect(onWeek).toHaveBeenLastCalledWith(0)
  })

  it('reads the week again when the clock changes, so a day worked on an open page is counted', async () => {
    sessions = [punch('06:00', '07:00')]
    const onWeek = vi.fn()
    let tell = () => {}
    const Teller = () => {
      tell = useUpdateFocusOpenerBridge().notifySessionChanged
      return null
    }
    renderWithProviders(
      <UpdateFocusOpenerBridgeProvider>
        <Teller />
        <DashboardMyHoursBlock userId="u-me" displayName="Isiah" role="helpers" isSalary={false} framed onWeek={onWeek} io={localAvailabilityIo()} />
      </UpdateFocusOpenerBridgeProvider>,
    )
    await settle()
    expect(await screen.findByText(/This week 1 of 40 h so far\./)).toBeTruthy()
    expect(onWeek).toHaveBeenLastCalledWith(1)
    // The person clocks out after the day: the clock says so, and the card reads the week again.
    sessions = [punch('06:00', '07:00'), punch('07:00', '14:30')]
    act(() => tell())
    await settle()
    expect(await screen.findByText(/This week 8\.5 of 40 h so far\./)).toBeTruthy()
    expect(onWeek).toHaveBeenLastCalledWith(8.5)
  })

  it('reads a salaried person’s own week off the board when they are on it', async () => {
    answers = [{ user_id: 'u-me', hours_per_week: 40, days: null, effective_from: '2026-11-01', set_by: 'u-me', set_at: '2026-11-01T10:00:00Z' }]
    renderWithProviders(<DashboardMyHoursBlock userId="u-me" displayName="Isiah" role="helpers" isSalary salariedWeek={[0, 8, 8, 8, 8, 4, 0]} io={localAvailabilityIo()} />)
    await settle()
    expect(await screen.findByText('Salaried: your week is 36 h.')).toBeTruthy()
    expect(screen.getByText('8 h Mon to Thu, 4 h Fri')).toBeTruthy()
  })
})
