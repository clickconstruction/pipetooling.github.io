import { describe, expect, it } from 'vitest'
import {
  minutesToScheduleTime,
  previewReorderedDay,
  reorderDayScheduleBlocks,
  scheduleTimeToMinutes,
  sortBlocksByDayOrder,
} from './reorderDayScheduleBlocks'

const b = (id: string, start: string, end: string) => ({ id, time_start: start, time_end: end })

describe('scheduleTimeToMinutes / minutesToScheduleTime', () => {
  it('parses HH:MM and HH:MM:SS', () => {
    expect(scheduleTimeToMinutes('08:30')).toBe(510)
    expect(scheduleTimeToMinutes('08:30:00')).toBe(510)
    expect(scheduleTimeToMinutes('13:05:59')).toBe(785)
  })
  it('emits HH:MM:SS', () => {
    expect(minutesToScheduleTime(510)).toBe('08:30:00')
    expect(minutesToScheduleTime(0)).toBe('00:00:00')
  })
})

describe('reorderDayScheduleBlocks — duration + gaps rule', () => {
  const A = b('a', '08:00:00', '10:00:00') // 2h
  const B = b('b', '10:30:00', '12:30:00') // 2h, 30m gap after A
  const C = b('c', '13:00:00', '16:00:00') // 3h, 30m gap after B

  it('1,2,3 → 1,3,2 keeps durations and gaps', () => {
    const changed = reorderDayScheduleBlocks([A, B, C], ['a', 'c', 'b'])
    expect(changed).toEqual([
      { id: 'c', time_start: '10:30:00', time_end: '13:30:00' },
      { id: 'b', time_start: '14:00:00', time_end: '16:00:00' },
    ])
  })

  it('no-op order returns no changes', () => {
    expect(reorderDayScheduleBlocks([A, B, C], ['a', 'b', 'c'])).toEqual([])
  })

  it('accepts blocks in any input order (sorts by time first)', () => {
    const changed = reorderDayScheduleBlocks([C, A, B], ['a', 'c', 'b'])
    expect(changed.map((c) => c.id)).toEqual(['c', 'b'])
  })

  it('two-block swap with unequal durations', () => {
    const changed = reorderDayScheduleBlocks([A, C], ['c', 'a'])
    // C takes A's start with its own 3h duration; original 3h gap (10:00→13:00) preserved.
    expect(changed).toEqual([
      { id: 'c', time_start: '08:00:00', time_end: '11:00:00' },
      { id: 'a', time_start: '14:00:00', time_end: '16:00:00' },
    ])
  })

  it('moving the first block keeps the day start anchored', () => {
    const changed = reorderDayScheduleBlocks([A, B, C], ['b', 'a', 'c'])
    expect(changed).toEqual([
      { id: 'b', time_start: '08:00:00', time_end: '10:00:00' },
      { id: 'a', time_start: '10:30:00', time_end: '12:30:00' },
      // a ends where b used to → c is unchanged only if its window matches; here it does.
    ])
  })

  it('back-to-back blocks stay back-to-back', () => {
    const X = b('x', '08:00:00', '09:00:00')
    const Y = b('y', '09:00:00', '11:00:00')
    const Z = b('z', '11:00:00', '11:30:00')
    const changed = reorderDayScheduleBlocks([X, Y, Z], ['z', 'y', 'x'])
    expect(changed).toEqual([
      { id: 'z', time_start: '08:00:00', time_end: '08:30:00' },
      { id: 'y', time_start: '08:30:00', time_end: '10:30:00' },
      { id: 'x', time_start: '10:30:00', time_end: '11:30:00' },
    ])
  })

  it('overlapping originals are treated as zero gap (never widens an overlap)', () => {
    const X = b('x', '08:00:00', '10:00:00')
    const Y = b('y', '09:30:00', '11:00:00') // overlaps X by 30m
    const changed = reorderDayScheduleBlocks([X, Y], ['y', 'x'])
    expect(changed).toEqual([
      { id: 'y', time_start: '08:00:00', time_end: '09:30:00' },
      { id: 'x', time_start: '09:30:00', time_end: '11:30:00' },
    ])
  })

  it('single block and empty are no-ops', () => {
    expect(reorderDayScheduleBlocks([A], ['a'])).toEqual([])
    expect(reorderDayScheduleBlocks([], [])).toEqual([])
  })

  it('rejects non-permutations', () => {
    expect(() => reorderDayScheduleBlocks([A, B], ['a'])).toThrow()
    expect(() => reorderDayScheduleBlocks([A, B], ['a', 'a'])).toThrow()
    expect(() => reorderDayScheduleBlocks([A, B], ['a', 'nope'])).toThrow()
  })
})

describe('previewReorderedDay', () => {
  it('returns every block in new order with resulting windows', () => {
    const A = b('a', '08:00:00', '10:00:00')
    const B = b('b', '10:30:00', '12:30:00')
    const C = b('c', '13:00:00', '16:00:00')
    expect(previewReorderedDay([A, B, C], ['a', 'c', 'b'])).toEqual([
      { id: 'a', time_start: '08:00:00', time_end: '10:00:00' },
      { id: 'c', time_start: '10:30:00', time_end: '13:30:00' },
      { id: 'b', time_start: '14:00:00', time_end: '16:00:00' },
    ])
  })
})

describe('sortBlocksByDayOrder', () => {
  it('sorts by start time with id tiebreak', () => {
    const rows = [b('z', '09:00', '10:00'), b('a', '09:00', '11:00'), b('m', '08:00', '09:00')]
    expect(sortBlocksByDayOrder(rows).map((r) => r.id)).toEqual(['m', 'a', 'z'])
  })
})
