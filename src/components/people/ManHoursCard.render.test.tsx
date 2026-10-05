// @vitest-environment jsdom
/**
 * Render smoke for People → Overhead's Man hours card: the month rows with
 * their chips, the Week switch, the load failure with Try again, and the line
 * that says no Office job is set.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { ManHoursSession } from '../../lib/manHours/manHoursByPeriod'

const H = vi.hoisted(() => ({ load: vi.fn(async (): Promise<unknown[]> => []) }))

vi.mock('../../lib/manHours/loadManHoursSessions', () => ({ loadManHoursSessions: H.load }))
vi.mock('../../utils/dateUtils', async (original) => ({
  ...(await original<typeof import('../../utils/dateUtils')>()),
  todayYmdInAppTz: () => '2026-10-04',
}))

import { ManHoursCard } from './ManHoursCard'

const OFFICE = 'job-office'

function sess(day: string, userId: string, hours: number, over: Partial<ManHoursSession> = {}): ManHoursSession {
  const start = new Date(`${day}T14:00:00.000Z`).getTime()
  return {
    user_id: userId,
    work_date: day,
    clocked_in_at: new Date(start).toISOString(),
    clocked_out_at: new Date(start + hours * 3600000).toISOString(),
    job_ledger_id: null,
    bid_id: null,
    approved_at: `${day}T23:00:00.000Z`,
    rejected_at: null,
    revoked_at: null,
    ...over,
  }
}

const SESSIONS = [
  sess('2026-09-15', 'u1', 30, { job_ledger_id: 'job-1' }),
  sess('2026-09-15', 'u2', 8, { job_ledger_id: OFFICE }),
  sess('2026-09-16', 'u2', 2, { bid_id: 'bid-1' }),
  sess('2026-10-02', 'u1', 6, { job_ledger_id: 'job-1', approved_at: null }),
]

beforeEach(() => {
  H.load.mockReset()
  H.load.mockImplementation(async () => SESSIONS)
})
afterEach(cleanup)

describe('ManHoursCard', () => {
  it('shows a row per month with each side, the office share, and the chips on the open month', async () => {
    renderWithProviders(<ManHoursCard officeJobLedgerId={OFFICE} officeJobLoading={false} />)

    const sep = (await screen.findByText('September 2026')).closest('tr') as HTMLElement
    const cells = within(sep).getAllByRole('cell').map((c) => c.textContent)
    // Period · Field · Office · Bids · Not on a job · Total · Office share · Per week · People
    expect(cells).toEqual(['September 2026from Sep 15', '30', '8', '2', '—', '40', '25%', '18', '2'])

    const oct = screen.getByText('October 2026').closest('tr') as HTMLElement
    expect(within(oct).getByText('so far')).toBeTruthy()
    expect(within(oct).getByText('6 h waiting')).toBeTruthy()
    expect(screen.getByText(/Hours start Sep 15, 2026, the first day on the clock\./)).toBeTruthy()
    // The headline reads the newest finished month; with one month on record there is nothing to compare.
    expect(screen.getByText('September 2026:').parentElement?.textContent).toBe('September 2026: 40 hours. Office share 25%.')
    expect(screen.getByRole('img', { name: /^Hours per period/ })).toBeTruthy()
  })

  it('switches to pay weeks and drops the Per week column', async () => {
    renderWithProviders(<ManHoursCard officeJobLedgerId={OFFICE} officeJobLoading={false} />)
    await screen.findByText('September 2026')

    fireEvent.click(screen.getByRole('button', { name: 'Week' }))

    expect(screen.getByRole('button', { name: 'Week' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Week of Sep 13')).toBeTruthy()
    expect(screen.getByText('Week of Oct 4')).toBeTruthy()
    expect(screen.queryByRole('columnheader', { name: 'Per week' })).toBeNull()
  })

  it('waits for the Office job before it shows a number', async () => {
    renderWithProviders(<ManHoursCard officeJobLedgerId={null} officeJobLoading />)
    await settle()
    expect(H.load).toHaveBeenCalled()
    expect(screen.getByText('Loading…')).toBeTruthy()
    expect(screen.queryByText('September 2026')).toBeNull()
  })

  it('says so when no Office job is set, and counts that time as field', async () => {
    renderWithProviders(<ManHoursCard officeJobLedgerId={null} officeJobLoading={false} />)
    const sep = (await screen.findByText('September 2026')).closest('tr') as HTMLElement
    expect(within(sep).getAllByRole('cell')[1]?.textContent).toBe('38')
    expect(screen.getByText(/No Office job is set, so no time counts as office\./)).toBeTruthy()
  })

  it('reports a failed load and loads again on Try again', async () => {
    H.load.mockImplementationOnce(async () => {
      throw new Error('network down')
    })
    renderWithProviders(<ManHoursCard officeJobLedgerId={OFFICE} officeJobLoading={false} />)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Man hours did not load.')

    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('September 2026')).toBeTruthy()
    expect(H.load).toHaveBeenCalledTimes(2)
  })
})
