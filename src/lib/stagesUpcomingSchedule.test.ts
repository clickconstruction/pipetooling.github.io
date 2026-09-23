import { describe, expect, it } from 'vitest'
import {
  formatStagesCompactWindow,
  formatStagesNextDateLabel,
  pickNextUpcomingAppointmentPerJob,
  type StagesUpcomingBlockRow,
} from './stagesUpcomingSchedule'

function row(over: Partial<StagesUpcomingBlockRow>): StagesUpcomingBlockRow {
  return {
    job_id: 'j1',
    work_date: '2026-07-31',
    time_start: '11:00:00',
    time_end: '12:30:00',
    note: 'pretest from cleanout- wife will be home',
    users: { name: 'Abraham' },
    ...over,
  }
}

describe('pickNextUpcomingAppointmentPerJob', () => {
  it('returns empty for no rows', () => {
    expect(pickNextUpcomingAppointmentPerJob([])).toEqual({})
  })

  it('keeps the earliest block per job (rows arrive date/time ordered)', () => {
    const out = pickNextUpcomingAppointmentPerJob([
      row({}),
      row({ work_date: '2026-08-04', note: 'later block' }),
    ])
    expect(out.j1).toEqual({
      ymd: '2026-07-31',
      timeStart: '11:00:00',
      timeEnd: '12:30:00',
      assigneeNames: ['Abraham'],
      note: 'pretest from cleanout- wife will be home',
      bookedYmds: ['2026-07-31', '2026-08-04'],
      lastYmd: '2026-08-04',
      visitCount: 2,
    })
  })

  it('a later block adds its day to the strip but never becomes the NEXT window', () => {
    const out = pickNextUpcomingAppointmentPerJob([
      row({}),
      row({ work_date: '2026-07-31', time_start: '14:00:00', time_end: '16:00:00', users: { name: 'Darren' } }),
      row({ work_date: '2026-08-03', users: { name: 'Darren' } }),
      row({ work_date: '2026-08-03', time_start: '13:00:00', time_end: '15:00:00' }),
    ])
    expect(out.j1).toMatchObject({ ymd: '2026-07-31', timeStart: '11:00:00', assigneeNames: ['Abraham'] })
    expect(out.j1!.bookedYmds).toEqual(['2026-07-31', '2026-08-03'])
    expect(out.j1!.lastYmd).toBe('2026-08-03')
    expect(out.j1!.visitCount).toBe(2)
  })

  it('merges assignees sharing the winning window, name-sorted and deduped', () => {
    const out = pickNextUpcomingAppointmentPerJob([
      row({ users: { name: 'Darren' } }),
      row({ users: { name: 'Abraham' } }),
      row({ users: { name: 'Darren' } }),
    ])
    expect(out.j1!.assigneeNames).toEqual(['Abraham', 'Darren'])
  })

  it('does NOT merge a same-day block with a different window', () => {
    const out = pickNextUpcomingAppointmentPerJob([
      row({}),
      row({ time_start: '14:00:00', time_end: '16:00:00', users: { name: 'Darren' } }),
    ])
    expect(out.j1!.assigneeNames).toEqual(['Abraham'])
  })

  it('fills a missing note from a merged shared leg', () => {
    const out = pickNextUpcomingAppointmentPerJob([
      row({ note: null }),
      row({ note: '  bring camera ', users: { name: 'Darren' } }),
    ])
    expect(out.j1!.note).toBe('bring camera')
  })

  it('keeps jobs independent and tolerates null names', () => {
    const out = pickNextUpcomingAppointmentPerJob([
      row({}),
      row({ job_id: 'j2', users: { name: null }, note: null }),
    ])
    expect(out.j2).toEqual({
      ymd: '2026-07-31',
      timeStart: '11:00:00',
      timeEnd: '12:30:00',
      assigneeNames: ['Unknown'],
      note: null,
      bookedYmds: ['2026-07-31'],
      lastYmd: '2026-07-31',
      visitCount: 1,
    })
    expect(out.j1!.assigneeNames).toEqual(['Abraham'])
  })
})

describe('formatStagesNextDateLabel', () => {
  it('renders "Fri Jul 31" with no comma', () => {
    expect(formatStagesNextDateLabel('2026-07-31')).toBe('Fri Jul 31')
  })
})

describe('formatStagesCompactWindow', () => {
  it('drops the start meridiem when both sides share it, and :00 on whole hours', () => {
    expect(formatStagesCompactWindow('08:00:00', '09:30:00')).toBe('8\u20139:30 AM')
    expect(formatStagesCompactWindow('13:00:00', '16:00:00')).toBe('1\u20134 PM')
  })
  it('keeps both meridiems across noon and drops :00 on whole hours', () => {
    expect(formatStagesCompactWindow('10:00:00', '12:00:00')).toBe('10 AM\u201312 PM')
    expect(formatStagesCompactWindow('11:00:00', '12:30:00')).toBe('11 AM\u201312:30 PM')
  })
  it('keeps minutes when not a whole hour', () => {
    expect(formatStagesCompactWindow('08:15:00', '09:45:00')).toBe('8:15\u20139:45 AM')
  })
})
