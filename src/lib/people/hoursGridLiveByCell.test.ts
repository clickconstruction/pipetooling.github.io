import { describe, expect, it } from 'vitest'
import type { ClockSessionRow } from '../../types/clockSessions'
import {
  buildHoursGridLiveByCell,
  hoursGridLiveCellKey,
  hoursGridLiveCellView,
  isLiveCellLeftOpen,
  leftOpenDayChipLabel,
  leftOpenDayChipTitle,
  liveCellAddedHours,
  liveCellRunningHours,
  liveDayChipLabel,
  liveDayChipTitle,
  liveTotalSubLabel,
  liveTotalTitle,
  summarizeHoursGridLiveDays,
} from './hoursGridLiveByCell'

const NOW = new Date('2026-09-02T20:00:00Z').getTime()
const users = [
  { id: 'u-ana', name: ' Ana Ruiz ' },
  { id: 'u-bo', name: 'Bo Lee' },
  { id: 'u-cy', name: 'Cy Park' },
]

function open(id: string, user_id: string, work_date: string, hoursAgo: number, extra: Partial<ClockSessionRow> = {}): ClockSessionRow {
  return {
    id,
    user_id,
    work_date,
    clocked_in_at: new Date(NOW - hoursAgo * 3_600_000).toISOString(),
    clocked_out_at: null,
    notes: '',
    job_ledger_id: null,
    bid_id: null,
    clock_in_lat: null,
    clock_in_lng: null,
    clock_out_lat: null,
    clock_out_lng: null,
    clock_in_location_source: null,
    clock_out_location_source: null,
    approved_at: null,
    approved_by: null,
    rejected_at: null,
    rejected_by: null,
    revoked_at: null,
    revoked_by: null,
    users: null,
    approved_by_user: null,
    rejected_by_user: null,
    revoked_by_user: null,
    jobs_ledger: null,
    ...extra,
  } as ClockSessionRow
}

const TODAY = '2026-09-02'
const build = (activeClockSessions: ClockSessionRow[], peopleNames = ['Ana Ruiz', 'Bo Lee', 'Cy Park'], workDates = ['2026-09-01', TODAY]) =>
  buildHoursGridLiveByCell({ activeClockSessions, peopleNames, workDates, users })

describe('buildHoursGridLiveByCell', () => {
  it('makes one cell per person and day, trimming names through the shared join', () => {
    const map = build([open('a', 'u-ana', TODAY, 2), open('b', 'u-bo', TODAY, 0.5), open('c', 'u-cy', '2026-09-01', 4)])
    expect([...map.keys()].sort()).toEqual([hoursGridLiveCellKey('Ana Ruiz', TODAY), hoursGridLiveCellKey('Bo Lee', TODAY), hoursGridLiveCellKey('Cy Park', '2026-09-01')].sort())
    expect(map.get(hoursGridLiveCellKey(' Ana Ruiz ', TODAY))).toEqual({ personName: 'Ana Ruiz', workDate: TODAY, clockInsMs: [NOW - 2 * 3_600_000] })
  })

  it('ignores closed, rejected and revoked sessions, people off the roster, and days off the grid', () => {
    const map = build(
      [
        open('closed', 'u-ana', TODAY, 3, { clocked_out_at: new Date(NOW).toISOString() }),
        open('rejected', 'u-bo', TODAY, 3, { rejected_at: new Date(NOW).toISOString() }),
        open('revoked', 'u-bo', TODAY, 3, { revoked_at: new Date(NOW).toISOString() }),
        open('off-roster', 'u-cy', TODAY, 3),
        open('off-grid', 'u-ana', '2026-08-20', 3),
        open('unknown-user', 'u-zed', TODAY, 3),
      ],
      ['Ana Ruiz', 'Bo Lee'],
      [TODAY],
    )
    expect(map.size).toBe(0)
  })

  it('keeps both clock-ins of a person clocked in twice, the earliest first', () => {
    const cell = build([open('late', 'u-ana', TODAY, 1), open('early', 'u-ana', TODAY, 3)]).get(hoursGridLiveCellKey('Ana Ruiz', TODAY))
    expect(cell?.clockInsMs).toEqual([NOW - 3 * 3_600_000, NOW - 1 * 3_600_000])
  })

  it('returns an empty map without work when nobody is on the clock', () => {
    expect(build([]).size).toBe(0)
  })
})

describe('running time', () => {
  const cell = { personName: 'Ana Ruiz', workDate: TODAY, clockInsMs: [NOW - 2 * 3_600_000, NOW + 3_600_000] }

  it('adds up the open sessions as of now, and a clock-in in the future adds nothing', () => {
    expect(liveCellRunningHours(cell, NOW, TODAY)).toBe(2)
    expect(liveCellRunningHours(cell, NOW + 30 * 60_000, TODAY)).toBe(2.5)
  })

  it('a session still open on a day before today was left open and adds no time', () => {
    const stale = { ...cell, workDate: '2026-09-01' }
    expect(isLiveCellLeftOpen(stale, TODAY)).toBe(true)
    expect(isLiveCellLeftOpen(cell, TODAY)).toBe(false)
    expect(liveCellRunningHours(stale, NOW, TODAY)).toBe(0)
  })

  it('a salaried day, a left-open cell and a cell with nobody on the clock add nothing to a total', () => {
    expect(liveCellAddedHours(cell, { nowMs: NOW, todayYmd: TODAY, salaryOnly: false })).toBe(2)
    expect(liveCellAddedHours(cell, { nowMs: NOW, todayYmd: TODAY, salaryOnly: true })).toBe(0)
    expect(liveCellAddedHours({ ...cell, workDate: '2026-09-01' }, { nowMs: NOW, todayYmd: TODAY, salaryOnly: false })).toBe(0)
    expect(liveCellAddedHours(undefined, { nowMs: NOW, todayYmd: TODAY, salaryOnly: false })).toBe(0)
  })
})

describe('hoursGridLiveCellView', () => {
  // NOW is 20:00 UTC on Sep 2, 3:00 PM in the company's zone, so two and a quarter hours ago is 12:45 PM.
  const cell = { personName: 'Ana Ruiz', workDate: TODAY, clockInsMs: [NOW - 2.25 * 3_600_000] }

  it('reads the whole day so far to the minute: the saved hours and the running time', () => {
    const view = hoursGridLiveCellView({ cell, settledHours: 4, salaryOnly: false, nowMs: NOW, todayYmd: TODAY })
    expect(view).toEqual({
      tone: 'running',
      figure: '6:15',
      word: 'on the clock',
      figureMuted: false,
      title: 'Ana Ruiz, Wed Sep 2: 6:15 so far, on the clock since 12:45 PM. Opens My Time.',
    })
  })

  it('reads 0:00 for someone who clocked in this minute, never an empty box', () => {
    const fresh = { ...cell, clockInsMs: [NOW - 20_000] }
    expect(hoursGridLiveCellView({ cell: fresh, settledHours: 0, salaryOnly: false, nowMs: NOW, todayYmd: TODAY }).figure).toBe('0:00')
  })

  it('a salaried day keeps its set hours, grey, and still says on the clock', () => {
    const view = hoursGridLiveCellView({ cell, settledHours: 8, salaryOnly: true, nowMs: NOW, todayYmd: TODAY })
    expect(view.figure).toBe('8:00:00')
    expect(view.figureMuted).toBe(true)
    expect(view.word).toBe('on the clock')
    expect(view.title).toBe('Ana Ruiz, Wed Sep 2: on the clock since 12:45 PM. A salaried day counts its set hours, 8:00:00. Opens My Time.')
  })

  it('a session from a day before today says left open and no clock-out, with no figure, and when it started in the tooltip', () => {
    const stale = { personName: 'Cy Park', workDate: '2026-09-01', clockInsMs: [new Date('2026-09-01T12:30:00Z').getTime()] }
    const view = hoursGridLiveCellView({ cell: stale, settledHours: 0, salaryOnly: false, nowMs: NOW, todayYmd: TODAY })
    expect(view).toEqual({
      tone: 'leftOpen',
      figure: 'left open',
      word: 'no clock-out',
      figureMuted: false,
      title: 'Cy Park, Tue Sep 1: a session left open since 7:30 AM. It adds no time here. Opens My Time, where Force clock out is.',
    })
  })
})

describe('summarizeHoursGridLiveDays', () => {
  it('counts the people on the clock and their running time per day column, and the left-open ones apart', () => {
    const days = summarizeHoursGridLiveDays(build([open('a', 'u-ana', TODAY, 2), open('b', 'u-bo', TODAY, 0.5), open('c', 'u-cy', '2026-09-01', 30)]), NOW, TODAY)
    expect(days.get(TODAY)).toEqual({ workDate: TODAY, people: 2, leftOpen: 0, elapsedHours: 2.5 })
    expect(days.get('2026-09-01')).toEqual({ workDate: '2026-09-01', people: 0, leftOpen: 1, elapsedHours: 0 })
  })

  it('a person clocked in twice on one day counts once', () => {
    const days = summarizeHoursGridLiveDays(build([open('a1', 'u-ana', TODAY, 1), open('a2', 'u-ana', TODAY, 0.5)]), NOW, TODAY)
    expect(days.get(TODAY)).toEqual({ workDate: TODAY, people: 1, leftOpen: 0, elapsedHours: 1.5 })
  })
})

describe('the head line and the totals in words', () => {
  it('labels the count and says where the time shows', () => {
    const one = { workDate: TODAY, people: 1, leftOpen: 0, elapsedHours: 2.25 }
    const many = { workDate: TODAY, people: 3, leftOpen: 0, elapsedHours: 7.5 }
    expect(liveDayChipLabel(one)).toBe('+1 on the clock')
    expect(liveDayChipLabel(many)).toBe('+3 on the clock')
    expect(liveDayChipTitle(one)).toBe('1 person is clocked in right now (2.25 h so far). Their box in this column is green, and the totals count the time so far.')
    expect(liveDayChipTitle(many)).toBe('3 people are clocked in right now (7.50 h so far). Their boxes in this column are green, and the totals count the time so far.')
  })

  it('names a day somebody never clocked out of', () => {
    const day = { workDate: '2026-09-01', people: 0, leftOpen: 1, elapsedHours: 0 }
    expect(leftOpenDayChipLabel(day)).toBe('1 left open')
    expect(leftOpenDayChipTitle(day)).toContain('1 person has a session left open on this day.')
    expect(leftOpenDayChipTitle({ ...day, leftOpen: 2 })).toContain('2 people have sessions left open on this day.')
  })

  it('a running total names its running part, and its tooltip keeps the settled part apart', () => {
    expect(liveTotalSubLabel(7 + 38 / 60)).toBe('7:38 on the clock')
    expect(liveTotalTitle(15.5, 7 + 38 / 60)).toBe('15:30:00 settled and 7:38 still running. The running part is not in payroll until it is clocked out and approved.')
    expect(liveTotalTitle(0, 0.5)).toContain('0:00:00 settled and 0:30 still running.')
  })
})
