import { describe, expect, it } from 'vitest'
import { EMPTY_SCHEDULE, sameSchedule, scheduleColumns, scheduleDraftOf, scheduleDraftProblem, scheduleDraftWords, scheduleLengthWords, scheduleStanding } from './bidSchedule'

describe('scheduleDraftProblem', () => {
  it('lets a bid with no schedule save', () => {
    expect(scheduleDraftProblem(EMPTY_SCHEDULE)).toBeNull()
  })
  it('lets a start and an end save, and a start with no end date', () => {
    expect(scheduleDraftProblem({ start: '2025-07-01', end: '2026-12-31', noEnd: false })).toBeNull()
    expect(scheduleDraftProblem({ start: '2025-07-01', end: '2025-07-01', noEnd: false })).toBeNull()
    expect(scheduleDraftProblem({ start: '2025-07-01', end: '', noEnd: true })).toBeNull()
  })
  it('names what is missing, in the order a person fixes it', () => {
    expect(scheduleDraftProblem({ start: '', end: '2026-12-31', noEnd: false })).toBe('Type the day the schedule starts.')
    expect(scheduleDraftProblem({ start: '', end: '', noEnd: true })).toBe('Type the day the schedule starts.')
    expect(scheduleDraftProblem({ start: '2025-07-01', end: '', noEnd: false })).toBe('Type the day the schedule ends, or tick No end date.')
    expect(scheduleDraftProblem({ start: '2025-07-01', end: '2025-06-30', noEnd: false })).toBe('The end is before the start.')
  })
  it('holds a date caught half typed', () => {
    expect(scheduleDraftProblem({ start: '0202-07-01', end: '2026-12-31', noEnd: false })).toBe('Finish the start date.')
    expect(scheduleDraftProblem({ start: '2025-07-01', end: '0020-12-31', noEnd: false })).toBe('Finish the end date.')
  })
})

describe('scheduleColumns', () => {
  it('writes the three columns for each of the three states', () => {
    expect(scheduleColumns(EMPTY_SCHEDULE)).toEqual({ schedule_start: null, schedule_end: null, schedule_open_ended: false })
    expect(scheduleColumns({ start: '2025-07-01', end: '2026-12-31', noEnd: false })).toEqual({ schedule_start: '2025-07-01', schedule_end: '2026-12-31', schedule_open_ended: false })
    // The tick drops whatever end was typed, as the database's check wants.
    expect(scheduleColumns({ start: '2025-07-01', end: '2026-12-31', noEnd: true })).toEqual({ schedule_start: '2025-07-01', schedule_end: null, schedule_open_ended: true })
  })
  it('reads a bid back into a draft', () => {
    expect(scheduleDraftOf({ schedule_start: '2025-07-01', schedule_end: null, schedule_open_ended: true })).toEqual({ start: '2025-07-01', end: '', noEnd: true })
    expect(scheduleDraftOf({})).toEqual(EMPTY_SCHEDULE)
  })
  it('calls two drafts the same when the tick makes the end moot', () => {
    expect(sameSchedule({ start: '2025-07-01', end: '2026-01-01', noEnd: true }, { start: '2025-07-01', end: '', noEnd: true })).toBe(true)
    expect(sameSchedule({ start: '2025-07-01', end: '2026-01-01', noEnd: false }, { start: '2025-07-01', end: '', noEnd: false })).toBe(false)
  })
})

describe('the words', () => {
  it('says a length in the unit a person would', () => {
    expect(scheduleLengthWords('2025-07-01', '2026-12-31')).toBe('18 months')
    expect(scheduleLengthWords('2025-07-01', '2026-01-01')).toBe('6 months')
    expect(scheduleLengthWords('2026-01-05', '2026-02-16')).toBe('6 weeks')
    expect(scheduleLengthWords('2026-01-05', '2026-01-12')).toBe('7 days')
    expect(scheduleLengthWords('2026-01-05', '2026-01-06')).toBe('1 day')
    expect(scheduleLengthWords('2026-01-05', '2026-01-01')).toBe('')
  })
  it('says where a schedule stands today, and that it is over only once past its end', () => {
    expect(scheduleStanding({ start: '2025-07-01', end: '2026-12-31' }, '2026-11-16')).toEqual({ words: '45 days left', over: false })
    expect(scheduleStanding({ start: '2025-07-01', end: '2026-11-16' }, '2026-11-16')).toEqual({ words: 'ends today', over: false })
    expect(scheduleStanding({ start: '2025-07-01', end: '2026-10-13' }, '2026-11-16')).toEqual({ words: '34 days over', over: true })
    expect(scheduleStanding({ start: '2025-07-01', end: null }, '2026-11-16')).toEqual({ words: 'no end date', over: false })
    expect(scheduleStanding({ start: '2026-11-28', end: '2027-06-01' }, '2026-11-16')).toEqual({ words: 'starts in 12 days', over: false })
  })
  it('puts the length and the standing beside the dates, and nothing while the draft is not ready', () => {
    expect(scheduleDraftWords({ start: '2025-07-01', end: '2026-12-31', noEnd: false }, '2026-11-16')).toBe('18 months · 45 days left')
    expect(scheduleDraftWords({ start: '2025-07-01', end: '', noEnd: true }, '2026-11-16')).toBe('no end date')
    expect(scheduleDraftWords({ start: '2025-07-01', end: '', noEnd: false }, '2026-11-16')).toBe('')
    expect(scheduleDraftWords(EMPTY_SCHEDULE, '2026-11-16')).toBe('')
  })
})
