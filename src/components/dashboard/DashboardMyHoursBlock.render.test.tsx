// @vitest-environment jsdom
/**
 * Render smoke for My Time's Your hours block: with no answer it asks and offers Set hours; with a
 * drawn answer it reads the week back in words, offers Change and draws the bars; a salaried person
 * reads their own set week, with nothing recorded too, and has no press.
 */
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { buildUtilizationBoard, type AvailableHoursAnswer, type UtilizationPerson } from '../../lib/people/utilization'
import { DEFAULT_WEEK } from '../../lib/people/weekAvailability'
import { localAvailabilityIo } from '../../lib/people/availabilityIo'

const person: UtilizationPerson = { id: 'u-me', name: 'Isiah Reyes', role: 'helpers', isSalary: false, recordsHoursButSalary: false }
let answers: AvailableHoursAnswer[] = []

// The read builds the board from what the block hands it, so the week the block passes is the week the board reads.
vi.mock('../../lib/people/fetchUtilizationBoard', () => ({
  fetchMyUtilization: async (args: { isSalary: boolean; salariedWeek?: readonly number[] | null }) => {
    const me = { ...person, isSalary: args.isSalary, salariedWeek: args.salariedWeek ?? null }
    const board = buildUtilizationBoard({ todayYmd: '2026-11-08', nowMs: Date.parse('2026-11-08T15:00:00-06:00'), people: [me], sessions: [], answers })
    return { board, people: [me], startYmd: '2026-09-20', endYmd: '2026-11-14' }
  },
}))

const { DashboardMyHoursBlock } = await import('./DashboardMyHoursBlock')

afterEach(() => {
  cleanup()
  answers = []
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

  it('reads a salaried person’s own week off the board when they are on it', async () => {
    answers = [{ user_id: 'u-me', hours_per_week: 40, days: null, effective_from: '2026-11-01', set_by: 'u-me', set_at: '2026-11-01T10:00:00Z' }]
    renderWithProviders(<DashboardMyHoursBlock userId="u-me" displayName="Isiah" role="helpers" isSalary salariedWeek={[0, 8, 8, 8, 8, 4, 0]} io={localAvailabilityIo()} />)
    await settle()
    expect(await screen.findByText('Salaried: your week is 36 h.')).toBeTruthy()
    expect(screen.getByText('8 h Mon to Thu, 4 h Fri')).toBeTruthy()
  })
})
