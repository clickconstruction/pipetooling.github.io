// @vitest-environment jsdom
/**
 * Render smoke for Job Mode's My Time card: the picture of the time added up, the quiet line that asks an hourly
 * person their hours and asks a salaried person nothing, the week it hands Job Mode's This week square, a read
 * that fails, and the read made again when the clock changes.
 */
import { act, cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { UpdateFocusOpenerBridgeProvider, useUpdateFocusOpenerBridge } from '../../contexts/UpdateFocusOpenerBridgeContext'
import { MY_TIME_WEEKS, buildMyTimeWeeks, type MyTimeSession } from '../../lib/dashboard/myTimeWeeks'
import { myTimeThisWeekHours } from '../../lib/dashboard/myTimeWeeksIo'
import { topRowHoursValue } from '../../lib/jobMode/topRow'
import { localAvailabilityIo } from '../../lib/people/availabilityIo'
import { payWeeksEndingAt } from '../../lib/people/utilization'
import { DashboardMyTimeCard, MY_TIME_CARD_ANCHOR } from './DashboardMyTimeCard'
import { JOB_MODE_HOURS_ANCHOR } from '../jobMode/JobModeTopRow'

// Wednesday Nov 25, 2026, 2:30 PM Central.
const TODAY = '2026-11-25'
const NOW = Date.parse('2026-11-25T20:30:00Z')
const at = (day: string, hm: string) => {
  const [h, m] = hm.split(':').map(Number)
  return new Date(Date.parse(`${day}T00:00:00Z`) + ((h ?? 0) + 6) * 3600_000 + (m ?? 0) * 60_000).toISOString()
}
const punch = (day: string, inHm: string, outHm: string): MyTimeSession => ({ work_date: day, clocked_in_at: at(day, inHm), clocked_out_at: at(day, outHm) })
const build = (sessions: MyTimeSession[]) => buildMyTimeWeeks({ weeks: payWeeksEndingAt(TODAY, MY_TIME_WEEKS), sessions, todayYmd: TODAY, nowMs: NOW })

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('DashboardMyTimeCard', () => {
  it('draws the picture under its own title, at the anchor Job Mode scrolls to', async () => {
    renderWithProviders(<DashboardMyTimeCard userId="u-me" displayName="Isiah" isSalary={false} read={async () => build([punch('2026-11-23', '08:00', '13:45')])} io={localAvailabilityIo()} />)
    await settle()
    const card = await screen.findByTestId('my-time-card')
    expect(card.id).toBe(JOB_MODE_HOURS_ANCHOR)
    expect(MY_TIME_CARD_ANCHOR).toBe(JOB_MODE_HOURS_ANCHOR)
    expect(screen.getByRole('heading', { name: 'My Time' })).toBeTruthy()
    expect(screen.getByLabelText('This week: 5 h 45 m')).toBeTruthy()
    expect(await screen.findByText('How many hours a week can you work?')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Set hours' })).toBeTruthy()
  })

  it('asks a salaried person nothing', async () => {
    renderWithProviders(<DashboardMyTimeCard userId="u-me" displayName="Isiah" isSalary read={async () => build([punch('2026-11-23', '08:00', '16:00')])} io={localAvailabilityIo()} />)
    await settle()
    expect(await screen.findByLabelText('This week: 8 h')).toBeTruthy()
    expect(screen.queryByTestId('my-time-can-work')).toBeNull()
    expect(screen.queryByRole('button', { name: /Set hours|Change/ })).toBeNull()
  })

  it('hands Job Mode the week its own figure prints, and zero for a week with nothing', async () => {
    const onWeek = vi.fn()
    const first = renderWithProviders(<DashboardMyTimeCard userId="u-me" displayName="Isiah" isSalary onWeek={onWeek} read={async () => build([punch('2026-11-23', '08:00', '12:30'), punch('2026-11-24', '13:00', '14:15')])} />)
    await settle()
    expect(await screen.findByLabelText('This week: 5 h 45 m')).toBeTruthy()
    expect(onWeek).toHaveBeenLastCalledWith(5.8)
    expect(topRowHoursValue(onWeek.mock.lastCall?.[0])).toBe('5.8 h')
    first.unmount()
    renderWithProviders(<DashboardMyTimeCard userId="u-me" displayName="Isiah" isSalary onWeek={onWeek} read={async () => build([])} />)
    await settle()
    expect(await screen.findByLabelText('This week: 0 m')).toBeTruthy()
    expect(onWeek).toHaveBeenLastCalledWith(0)
    expect(myTimeThisWeekHours([])).toBe(0)
  })

  it('draws nothing and hands on no number when the read fails', async () => {
    const onWeek = vi.fn()
    renderWithProviders(
      <DashboardMyTimeCard
        userId="u-me"
        displayName="Isiah"
        isSalary
        onWeek={onWeek}
        read={async () => {
          throw new Error('no signal')
        }}
      />,
    )
    await settle()
    expect(onWeek).toHaveBeenLastCalledWith(null)
    expect(screen.queryByTestId('my-time-card')).toBeNull()
  })

  it('reads the week again when the clock changes, so a day worked on an open page is counted', async () => {
    let sessions = [punch('2026-11-23', '06:00', '07:00')]
    const onWeek = vi.fn()
    let tell = () => {}
    const Teller = () => {
      tell = useUpdateFocusOpenerBridge().notifySessionChanged
      return null
    }
    const read = async () => build(sessions)
    renderWithProviders(
      <UpdateFocusOpenerBridgeProvider>
        <Teller />
        <DashboardMyTimeCard userId="u-me" displayName="Isiah" isSalary onWeek={onWeek} read={read} />
      </UpdateFocusOpenerBridgeProvider>,
    )
    await settle()
    expect(await screen.findByLabelText('This week: 1 h')).toBeTruthy()
    expect(onWeek).toHaveBeenLastCalledWith(1)
    // The person clocks out after the day: the clock says so, and the card reads the week again.
    sessions = [punch('2026-11-23', '06:00', '07:00'), punch('2026-11-23', '07:00', '14:30')]
    act(() => tell())
    await settle()
    expect(await screen.findByLabelText('This week: 8 h 30 m')).toBeTruthy()
    expect(onWeek).toHaveBeenLastCalledWith(8.5)
  })
})
