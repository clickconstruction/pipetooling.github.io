import { describe, expect, it } from 'vitest'
import { describeScheduleWhen, describeTime, describeWeekdays, fromPgTime, toPgTime } from './digestScheduleFields'

describe('digestScheduleFields (v2.3595)', () => {
  it('bridges Postgres time and the time input', () => {
    expect(toPgTime('07:15')).toBe('07:15:00')
    expect(toPgTime('nope')).toBe('06:00:00')
    expect(fromPgTime('03:00:00')).toBe('03:00')
    expect(fromPgTime(null)).toBe('06:00')
  })
  it('names days and times the way the office says them', () => {
    expect(describeWeekdays([1, 2, 3, 4, 5])).toBe('Mon–Fri')
    expect(describeWeekdays([2, 3, 4, 5, 6])).toBe('Tue–Sat')
    expect(describeWeekdays([0, 1, 2, 3, 4, 5, 6])).toBe('Every day')
    expect(describeWeekdays([1, 3, 5])).toBe('Mon, Wed, Fri')
    expect(describeWeekdays([1])).toBe('Mon')
    expect(describeWeekdays([])).toBe('no days')
    expect(describeTime('03:00:00')).toBe('3:00 AM')
    expect(describeTime('12:30:00')).toBe('12:30 PM')
    expect(describeTime('00:15:00')).toBe('12:15 AM')
    expect(describeScheduleWhen({ days_of_week: [1], time_local: '03:00:00' })).toBe('Mon 3:00 AM')
  })
})
