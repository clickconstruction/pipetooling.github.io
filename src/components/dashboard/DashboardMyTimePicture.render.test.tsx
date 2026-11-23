// @vitest-environment jsdom
/**
 * Render smoke for My Time's picture: the week's time as one figure, a column a day, a column a week. It counts
 * and grades nothing, so no quota, percent or band word is drawn. A stopped day is marked and named. A press on a
 * week or an arrow asks for that week, and a day is a press only when the section says the person may open it.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MY_TIME_WEEKS, buildMyTimeWeeks, type MyTimeSession } from '../../lib/dashboard/myTimeWeeks'
import { payWeeksEndingAt } from '../../lib/people/utilization'
import { DashboardMyTimePicture } from './DashboardMyTimePicture'

// Wednesday Nov 25, 2026, 2:30 PM Central.
const TODAY = '2026-11-25'
const NOW = Date.parse('2026-11-25T20:30:00Z')
const at = (day: string, hm: string) => {
  const [h, m] = hm.split(':').map(Number)
  return new Date(Date.parse(`${day}T00:00:00Z`) + ((h ?? 0) + 6) * 3600_000 + (m ?? 0) * 60_000).toISOString()
}
const session = (day: string, inHm: string, outHm: string | null): MyTimeSession => ({ work_date: day, clocked_in_at: at(day, inHm), clocked_out_at: outHm ? at(day, outHm) : null })
const build = (sessions: MyTimeSession[]) => buildMyTimeWeeks({ weeks: payWeeksEndingAt(TODAY, MY_TIME_WEEKS), sessions, todayYmd: TODAY, nowMs: NOW })

const midWeek = build([session('2026-11-23', '08:00', '16:15'), session('2026-11-24', '08:00', '15:30'), session(TODAY, '08:00', null), session('2026-11-03', '07:00', '15:00')])

afterEach(cleanup)

describe('DashboardMyTimePicture', () => {
  it('draws the week as one figure with today beside it, and the running clock', () => {
    render(<DashboardMyTimePicture weeks={midWeek} selected={7} onSelect={() => {}} />)
    const pic = screen.getByTestId('my-time-picture')
    expect(within(pic).getByText('This week')).toBeTruthy()
    expect(within(pic).getByLabelText('This week: 22 h 15 m')).toBeTruthy()
    expect(within(pic).getByText('6h 30m')).toBeTruthy()
    expect(pic.textContent).toContain('On the clock since 8:00 AM.')
    expect(within(pic).getByRole('img', { name: 'Monday Nov 23, 8 h 15 m' })).toBeTruthy()
    expect(within(pic).getByRole('img', { name: 'Friday Nov 27, still to come' })).toBeTruthy()
    expect(within(pic).getAllByRole('button', { pressed: false })).toHaveLength(7)
    expect(within(pic).getByRole('button', { pressed: true }).getAttribute('aria-label')).toBe('This week, 22 h 15 m')
  })

  it('grades nothing: no quota, percent or band word', () => {
    render(<DashboardMyTimePicture weeks={midWeek} selected={7} onSelect={() => {}} />)
    const words = screen.getByTestId('my-time-picture').textContent ?? ''
    for (const gone of ['percent', ' of 40', 'On Shift', 'over', 'full', 'steady', 'light', 'Salaried']) expect(words).not.toContain(gone)
  })

  it('asks for a week on a press of its column or an arrow, and holds the arrows at the ends', () => {
    const onSelect = vi.fn()
    const { rerender } = render(<DashboardMyTimePicture weeks={midWeek} selected={7} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: 'Week of Nov 1, 8 h' }))
    expect(onSelect).toHaveBeenLastCalledWith(4)
    fireEvent.click(screen.getByRole('button', { name: 'The week before' }))
    expect(onSelect).toHaveBeenLastCalledWith(6)
    expect((screen.getByRole('button', { name: 'The week after' }) as HTMLButtonElement).disabled).toBe(true)
    rerender(<DashboardMyTimePicture weeks={midWeek} selected={0} onSelect={onSelect} />)
    expect((screen.getByRole('button', { name: 'The week before' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Week of Oct 4')).toBeTruthy()
    expect(screen.getByText('Oct 4 to Oct 10')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to this week' }))
    expect(onSelect).toHaveBeenLastCalledWith(7)
  })

  it('marks a day the end-of-day stop closed, and says who fixes it', () => {
    const stopped = build([{ work_date: '2026-11-22', clocked_in_at: '2026-11-22T15:15:00Z', clocked_out_at: '2026-11-23T05:59:59.999999Z' }])
    const { rerender } = render(<DashboardMyTimePicture weeks={stopped} selected={7} onSelect={() => {}} />)
    expect(screen.getByRole('note').textContent).toBe('!Check Sunday. Nobody clocked out, so the clock stopped itself at midnight. It shows 14 h 44 m. Ask the office to fix it.')
    expect(screen.getByRole('img', { name: 'Sunday Nov 22, 14 h 44 m, the clock stopped itself at midnight' })).toBeTruthy()
    const onDayPress = vi.fn()
    rerender(<DashboardMyTimePicture weeks={stopped} selected={7} onSelect={() => {}} canPressDay={() => true} onDayPress={onDayPress} />)
    expect(screen.getByRole('note').textContent).toContain('Press the day to fix it.')
    fireEvent.click(screen.getByRole('button', { name: /^Sunday Nov 22/ }))
    expect(onDayPress).toHaveBeenCalledWith('2026-11-22')
  })

  it('makes a day a press only when the section allows it', () => {
    const onDayPress = vi.fn()
    render(<DashboardMyTimePicture weeks={midWeek} selected={7} onSelect={() => {}} canPressDay={(d) => d.ymd === '2026-11-23'} onDayPress={onDayPress} />)
    expect(screen.getByText('Press a day to see its time.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Monday Nov 23, 8 h 15 m. Open the day' }))
    expect(onDayPress).toHaveBeenCalledWith('2026-11-23')
    expect(screen.queryByRole('button', { name: /^Tuesday Nov 24/ })).toBeNull()
  })

  it('draws an empty week as zeros, with nothing still to come marked as time', () => {
    render(<DashboardMyTimePicture weeks={build([])} selected={7} onSelect={() => {}} />)
    expect(screen.getByLabelText('This week: 0 m')).toBeTruthy()
    expect(screen.queryByText('Press a day to see its time.')).toBeNull()
    expect(screen.queryByRole('note')).toBeNull()
  })
})
