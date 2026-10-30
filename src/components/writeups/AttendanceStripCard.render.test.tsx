// @vitest-environment jsdom
/**
 * Render smoke for the Write-ups attendance card (v2.6140, punch list #217, people-docs-3): the
 * chips at the head, ninety day buttons with their kinds, a press opening a late day's receipt and
 * closing it, the warning's write-up door, and the salaried line. The strip comes from the kernel
 * over invented people, so the wiring is what is under test.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { attendanceStrip } from '../../lib/people/attendanceStrip'
import { latenessCellKey, type LatenessBlockRow, type LatenessSessionRow } from '../../lib/scheduleLateness'
import { AttendanceStripCard } from './AttendanceStripCard'

// APP_CALENDAR_TZ is America/Chicago; October 2026 is CDT (UTC-5), so 7:00 AM wall clock = 12:00Z.
const TODAY = '2026-10-30'
const HAL = 'hal-1'

function block(work_date: string, over: Partial<LatenessBlockRow> = {}): LatenessBlockRow {
  return { assignee_user_id: HAL, work_date, time_start: '07:00:00', job_label: 'J996', ...over }
}
function session(work_date: string, hhmmZ: string, over: Partial<LatenessSessionRow> = {}): LatenessSessionRow {
  return { user_id: HAL, work_date, clocked_in_at: `${work_date}T${hhmmZ}:00Z`, origin: 'user_punch', ...over }
}

const HAL_STRIP = attendanceStrip({
  userId: HAL,
  todayYmd: TODAY,
  blocks: [block('2026-10-05'), block('2026-10-20'), block('2026-10-26'), block('2026-10-27'), block('2026-10-28'), block('2026-10-29')],
  sessions: [session('2026-10-05', '12:35'), session('2026-10-20', '12:31'), session('2026-10-26', '11:55'), session('2026-10-27', '12:35'), session('2026-10-28', '13:30')],
  excuses: new Map([[latenessCellKey(HAL, '2026-10-20'), { note: 'flat tire, called 7:05', byName: 'Taunya Sample', onYmd: '2026-10-21' }]]),
  ncns: [{ work_date: '2026-10-09', byName: 'Taunya Sample', filedYmd: '2026-10-09', details: 'No answer on his phone.' }],
})

afterEach(cleanup)

describe('AttendanceStripCard', () => {
  it('draws the chips, ninety days with their kinds, and opens a late day’s receipt on press', () => {
    renderWithProviders(<AttendanceStripCard personName="Hal Sample" strip={HAL_STRIP} />)

    // first paint
    expect(screen.getByText('Attendance — Hal Sample, last 90 days')).toBeTruthy()
    const chips = screen.getByText('late 3 · 1 excused')
    expect(chips.getAttribute('title')).toBe("3 unexcused late days in 90 days, and 1 excused late. Median 35 minutes late. Late is a first clock-in more than 15 minutes after the earliest block's start.")
    expect(screen.getByText('NCNS 1')).toBeTruthy()
    expect(screen.getByText('on time 1 of 6')).toBeTruthy()

    const strip = screen.getByRole('group', { name: /^90 days, Aug 2 to Oct 30/ })
    const days = within(strip).getAllByRole('button')
    expect(days.length).toBe(90)
    expect(days.filter((b) => b.getAttribute('data-kind') === 'late').length).toBe(3)
    expect(days.filter((b) => b.getAttribute('data-kind') === 'excused').length).toBe(1)
    expect(days.filter((b) => b.getAttribute('data-kind') === 'ncns').length).toBe(1)
    expect(days.filter((b) => b.getAttribute('data-kind') === 'onTime').length).toBe(1)
    expect(days.filter((b) => b.getAttribute('data-kind') === 'noClockIn').length).toBe(1)
    expect(days.filter((b) => b.getAttribute('data-recent') === 'yes').length).toBe(30)
    expect(days[89]!.getAttribute('data-today')).toBe('yes')
    expect(screen.getByText('Oct 1, last 30 days')).toBeTruthy()
    expect(screen.getByText('today')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Tue, Oct 27: late 35 minutes, 20 minutes past grace.' }))
    const receipt = screen.getByRole('region', { name: 'Receipt for Tue, Oct 27' })
    expect(within(receipt).getByText('Block 7:00 AM on J996.')).toBeTruthy()
    expect(within(receipt).getByText('First clock-in 7:35 AM.')).toBeTruthy()
    expect(within(receipt).getByText('20 minutes past the 15-minute grace.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Wed, Oct 28: late 1 hour 30 minutes, 1 hour 15 minutes past grace.' }))
    expect(screen.getByRole('region', { name: 'Receipt for Wed, Oct 28' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Close the receipt' }))
    expect(screen.queryByRole('region', { name: /^Receipt for/ })).toBeNull()
  })

  it('an excused day and a no-call no-show carry who and the note on their receipts', () => {
    renderWithProviders(<AttendanceStripCard personName="Hal Sample" strip={HAL_STRIP} />)

    // first paint
    fireEvent.click(screen.getByRole('button', { name: 'Tue, Oct 20: late 31 minutes, excused.' }))
    expect(within(screen.getByRole('region', { name: 'Receipt for Tue, Oct 20' })).getByText('Excused by Taunya Sample on Wed, Oct 21: flat tire, called 7:05')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Fri, Oct 9: no call, no show.' }))
    const r = screen.getByRole('region', { name: 'Receipt for Fri, Oct 9' })
    expect(within(r).getByText('Filed by Taunya Sample on Fri, Oct 9.')).toBeTruthy()
    expect(within(r).getByText('No answer on his phone.')).toBeTruthy()
  })

  it('three unexcused lates in the last thirty days show the warning and its write-up door', () => {
    const onStart = vi.fn()
    renderWithProviders(<AttendanceStripCard personName="Hal Sample" strip={HAL_STRIP} onStartWriteup={onStart} />)

    // first paint
    expect(screen.getByText('3 unexcused lates in the last 30 days.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Start a tardiness write-up →' }))
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(HAL_STRIP.writeupLines[0]).toBe('3 unexcused lates in the last 30 days.')
    expect(HAL_STRIP.writeupLines[2]).toBe('Wed, Oct 28: block 7:00 AM on J996, clocked in 8:30 AM, 1 hour 15 minutes past grace.')
  })

  it('a salaried person’s card marks no day and says why; two lates raise no warning', () => {
    const salaried = attendanceStrip({
      userId: HAL,
      todayYmd: TODAY,
      blocks: [block('2026-10-26'), block('2026-10-27')],
      sessions: [session('2026-10-26', '12:00', { origin: 'salary_schedule' }), session('2026-10-27', '12:00', { origin: 'salary_schedule' })],
      excuses: new Map(),
      ncns: [],
    })
    renderWithProviders(<AttendanceStripCard personName="Sal Sample" strip={salaried} />)

    // first paint
    expect(screen.getByText('Salaried. Clock sessions are made at schedule time, so no day is marked late or on time.')).toBeTruthy()
    expect(screen.getByText('NCNS 0')).toBeTruthy()
    expect(screen.queryByText(/^late \d/)).toBeNull()
    const strip = screen.getByRole('group', { name: /Salaried: clock sessions are made at schedule time/ })
    expect(within(strip).getAllByRole('button').every((b) => b.getAttribute('data-kind') === 'none')).toBe(true)
    expect(screen.queryByRole('button', { name: 'Start a tardiness write-up →' })).toBeNull()
  })
})
