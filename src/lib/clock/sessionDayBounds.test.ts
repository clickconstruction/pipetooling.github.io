import { describe, expect, it } from 'vitest'
import {
  clampYmdToBounds,
  dateInputBounds,
  datetimeLocalBounds,
  sessionDayBounds,
  sessionDayNote,
  sessionDayProblem,
} from './sessionDayBounds'

// Wed Sep 30 2026 on a 3-week window: the floor is Sun Sep 13 (assistantHoursWindow.test.ts math).
const assistant = sessionDayBounds({ floorYmd: '2026-09-13', todayYmd: '2026-09-30' })
const unlimited = sessionDayBounds({ floorYmd: null, todayYmd: '2026-09-30' })
const locked = sessionDayBounds({ floorYmd: '2026-09-13', todayYmd: '2026-09-30', lockedYmd: '2026-09-25' })

describe('sessionDayBounds', () => {
  it('an assistant gets her floor and today', () => {
    expect(assistant).toEqual({ minYmd: '2026-09-13', maxYmd: '2026-09-30', lockedYmd: null })
  })
  it('no floor means any day through today', () => {
    expect(unlimited).toEqual({ minYmd: null, maxYmd: '2026-09-30', lockedYmd: null })
  })
  it('a locked day is the only day, whatever the floor', () => {
    expect(locked).toEqual({ minYmd: '2026-09-25', maxYmd: '2026-09-25', lockedYmd: '2026-09-25' })
  })
})

describe('sessionDayNote', () => {
  it('names the floor and who to ask', () => {
    expect(sessionDayNote(assistant)).toBe('Sun, Sep 13 through today. Ask the owner for earlier days.')
  })
  it('says today only when the floor is today', () => {
    expect(sessionDayNote(sessionDayBounds({ floorYmd: '2026-09-27', todayYmd: '2026-09-27' }))).toBe('Today only. Ask the owner for earlier days.')
  })
  it('is short with no floor', () => {
    expect(sessionDayNote(unlimited)).toBe('Any day through today.')
  })
  it('names the locked day', () => {
    expect(sessionDayNote(locked)).toBe('This session goes on Fri, Sep 25.')
  })
})

describe('sessionDayProblem', () => {
  it('lets the floor day, today and a day between through', () => {
    expect(sessionDayProblem('2026-09-13', assistant)).toBeNull()
    expect(sessionDayProblem('2026-09-25', assistant)).toBeNull()
    expect(sessionDayProblem('2026-09-30', assistant)).toBeNull()
  })
  it('refuses the day before the floor with the floor named', () => {
    expect(sessionDayProblem('2026-09-12', assistant)).toBe('Sun, Sep 13 is the earliest day in your hours window. Ask the owner for earlier days.')
  })
  it('refuses tomorrow', () => {
    expect(sessionDayProblem('2026-10-01', assistant)).toBe('That day has not happened yet.')
    expect(sessionDayProblem('2026-10-01', unlimited)).toBe('That day has not happened yet.')
  })
  it('lets any past day through with no floor', () => {
    expect(sessionDayProblem('2019-01-01', unlimited)).toBeNull()
  })
  it('holds a locked door to its day', () => {
    expect(sessionDayProblem('2026-09-25', locked)).toBeNull()
    expect(sessionDayProblem('2026-09-24', locked)).toBe('This session goes on Fri, Sep 25.')
  })
  it('wants a real day', () => {
    expect(sessionDayProblem('', assistant)).toBe('Pick a day.')
    expect(sessionDayProblem('2026-9-3', assistant)).toBe('Pick a day.')
  })
})

describe('clampYmdToBounds', () => {
  it('snaps below the floor up, above today down, and a locked door to its day', () => {
    expect(clampYmdToBounds('2026-09-01', assistant)).toBe('2026-09-13')
    expect(clampYmdToBounds('2026-10-05', assistant)).toBe('2026-09-30')
    expect(clampYmdToBounds('2026-09-20', assistant)).toBe('2026-09-20')
    expect(clampYmdToBounds('2026-09-01', locked)).toBe('2026-09-25')
    expect(clampYmdToBounds('2019-01-01', unlimited)).toBe('2019-01-01')
  })
})

describe('input bounds', () => {
  it('date input gets the days', () => {
    expect(dateInputBounds(assistant)).toEqual({ min: '2026-09-13', max: '2026-09-30' })
    expect(dateInputBounds(unlimited)).toEqual({ min: undefined, max: '2026-09-30' })
  })
  it('datetime-local gets the whole first and last day', () => {
    expect(datetimeLocalBounds(assistant)).toEqual({ min: '2026-09-13T00:00', max: '2026-09-30T23:59' })
    expect(datetimeLocalBounds(unlimited)).toEqual({ min: undefined, max: '2026-09-30T23:59' })
  })
})
