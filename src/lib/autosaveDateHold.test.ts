import { describe, expect, it } from 'vitest'
import { heldDatesToTell, isUnfinishedDate } from './autosaveDateHold'

describe('isUnfinishedDate', () => {
  it('holds every date a browser reports while the year "2026" is typed one digit at a time', () => {
    expect(['0002-09-30', '0020-09-30', '0202-09-30'].map(isUnfinishedDate)).toEqual([true, true, true])
    expect(isUnfinishedDate('2026-09-30')).toBe(false)
  })

  it('holds a year typed as two digits', () => {
    expect(isUnfinishedDate('0026-09-30')).toBe(true)
  })

  it('an empty box is a cleared date, never an unfinished one', () => {
    expect([null, undefined, '', '   '].map(isUnfinishedDate)).toEqual([false, false, false, false])
  })

  it('reads a date with spaces around it as the date', () => {
    expect(isUnfinishedDate(' 2026-09-30 ')).toBe(false)
  })

  it('holds anything that is not a real day', () => {
    expect(isUnfinishedDate('2026-02-30')).toBe(true)
    expect(isUnfinishedDate('2026-09-30T00:00:00')).toBe(true)
  })
})

describe('heldDatesToTell', () => {
  it('says a newly held box, and nothing when no box is held', () => {
    expect(heldDatesToTell([], ['bid_due_date'])).toBe(true)
    expect(heldDatesToTell([], [])).toBe(false)
    expect(heldDatesToTell(['bid_due_date'], [])).toBe(false)
  })

  it('says a box once while it stays held — the next pause mid-year is quiet', () => {
    expect(heldDatesToTell(['bid_due_date'], ['bid_due_date'])).toBe(false)
  })

  it('says a second box held beside the first', () => {
    expect(heldDatesToTell(['bid_due_date'], ['bid_due_date', 'design_drawing_plan_date'])).toBe(true)
  })
})
