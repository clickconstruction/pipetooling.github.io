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

const abraham = { users: { name: 'Abraham' } }
const taunya = { users: { name: 'Taunya' } }
const SESSIONS = [
  sess('2026-09-15', 'u1', 30, { job_ledger_id: 'job-1', ...abraham }),
  sess('2026-09-15', 'u2', 8, { job_ledger_id: OFFICE, ...taunya }),
  sess('2026-09-16', 'u2', 2, { bid_id: 'bid-1', ...taunya }),
  sess('2026-10-02', 'u1', 6, { job_ledger_id: 'job-1', approved_at: null, ...abraham }),
  sess('2026-10-02', 'u2', 3, { ...taunya }),
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

  it('lists who made up the newest finished period, and a clicked row’s period after that', async () => {
    renderWithProviders(<ManHoursCard officeJobLedgerId={OFFICE} officeJobLoading={false} />)

    const who = await screen.findByRole('region', { name: 'Who made up September 2026' })
    const rows = within(who)
      .getAllByRole('row')
      .slice(1)
      .map((r) => within(r).getAllByRole('cell').map((c) => c.textContent))
    // Person · Field · Office · Bids · Not on a job · Total
    expect(rows).toEqual([
      ['Abraham', '30', '—', '—', '—', '30'],
      ['Taunya', '—', '8', '2', '—', '10'],
    ])
    // A finished month with nothing waiting and nothing off a job has no doors.
    expect(within(who).queryByRole('link')).toBeNull()

    const oct = screen.getByText('October 2026').closest('tr') as HTMLElement
    fireEvent.click(oct)
    expect(oct.getAttribute('aria-selected')).toBe('true')
    const octWho = screen.getByRole('region', { name: 'Who made up October 2026' })
    expect(within(octWho).getByText('2 people so far')).toBeTruthy()
    expect(within(octWho).getByRole('link', { name: 'Approve waiting hours · 6 h' }).getAttribute('href')).toBe('/people?tab=hours&approvals=1')
    expect(within(octWho).getByRole('link', { name: 'Match hours to a job · 3 h' }).getAttribute('href')).toBe('/people?tab=hours&match=1')
  })

  it('picks a period from a bar, and a week can move the day table', async () => {
    const onShowWeek = vi.fn()
    renderWithProviders(<ManHoursCard officeJobLedgerId={OFFICE} officeJobLoading={false} onShowWeek={onShowWeek} />)
    await screen.findByText('September 2026')
    // Months have no day-table door: the table holds one week.
    expect(screen.queryByRole('button', { name: 'Show these days in the table below' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Week' }))
    // The pick starts over on a new zoom: the newest finished week.
    expect(screen.getByRole('region', { name: 'Who made up Week of Sep 27' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /^Week of Sep 13: field 30 h/ }))
    const who = screen.getByRole('region', { name: 'Who made up Week of Sep 13' })
    fireEvent.click(within(who).getByRole('button', { name: 'Show these days in the table below' }))
    expect(onShowWeek).toHaveBeenCalledWith('2026-09-13')
  })

  it('stands the who list beside the picture on a wide card, and under the table on a narrow one', async () => {
    const position = async (width: number) => {
      const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width } as DOMRect)
      const { unmount } = renderWithProviders(<ManHoursCard officeJobLedgerId={OFFICE} officeJobLoading={false} />)
      const who = await screen.findByRole('region', { name: 'Who made up September 2026' })
      const table = screen.getByText('October 2026').closest('table') as HTMLElement
      const result = { layout: who.getAttribute('data-layout'), beforeTable: Boolean(who.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING) }
      unmount()
      rect.mockRestore()
      return result
    }
    expect(await position(1200)).toEqual({ layout: 'side', beforeTable: true })
    expect(await position(700)).toEqual({ layout: 'below', beforeTable: false })
  })

  it('drops a row’s chips under its name on a phone-width card', async () => {
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 359 } as DOMRect)
    renderWithProviders(<ManHoursCard officeJobLedgerId={OFFICE} officeJobLoading={false} />)
    const chip = await screen.findByText('so far')
    // The chips sit in their own block inside the pinned name cell.
    expect(chip.parentElement?.tagName).toBe('DIV')
    expect((chip.closest('td') as HTMLElement).style.position).toBe('sticky')
    rect.mockRestore()
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
