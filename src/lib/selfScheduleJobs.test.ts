import { describe, expect, it } from 'vitest'
import { findOwnScheduleOverlap, formatFieldMovedFrom, shiftPgTime } from './selfScheduleJobs'

const block = (id: string, work_date: string, time_start: string, time_end: string) => ({
  id,
  work_date,
  time_start,
  time_end,
})

describe('findOwnScheduleOverlap', () => {
  const day = [block('a', '2026-08-11', '08:00', '12:00'), block('b', '2026-08-11', '17:00', '18:00')]

  it('detects a straddling window and ignores other days', () => {
    expect(findOwnScheduleOverlap(day, { workDate: '2026-08-11', timeStart: '11:00', timeEnd: '13:00' })?.id).toBe('a')
    expect(findOwnScheduleOverlap(day, { workDate: '2026-08-12', timeStart: '11:00', timeEnd: '13:00' })).toBeNull()
  })

  it('back-to-back windows do not overlap; the edited block is excluded', () => {
    expect(findOwnScheduleOverlap(day, { workDate: '2026-08-11', timeStart: '12:00', timeEnd: '17:00' })).toBeNull()
    expect(
      findOwnScheduleOverlap(day, { workDate: '2026-08-11', timeStart: '08:30', timeEnd: '09:00' }, 'a'),
    ).toBeNull()
  })

  it('rejects inverted windows', () => {
    expect(findOwnScheduleOverlap(day, { workDate: '2026-08-11', timeStart: '12:00', timeEnd: '10:00' })).toBeNull()
  })
})

describe('formatFieldMovedFrom', () => {
  it('renders the original window and tolerates missing trails', () => {
    expect(
      formatFieldMovedFrom({ field_moved_from: { work_date: '2026-08-11', time_start: '12:00', time_end: '14:00' } }),
    ).toBe('was 2026-08-11 12:00 PM–2:00 PM')
    expect(formatFieldMovedFrom({ field_moved_from: null })).toBeNull()
    expect(formatFieldMovedFrom(undefined)).toBeNull()
  })
})

describe('shiftPgTime', () => {
  it('shifts by minutes and clamps to the day', () => {
    expect(shiftPgTime('08:00', 30)).toBe('08:30')
    expect(shiftPgTime('08:00:00', -30)).toBe('07:30')
    expect(shiftPgTime('00:10', -30)).toBe('00:00')
    expect(shiftPgTime('23:50', 30)).toBe('24:00')
  })
})
