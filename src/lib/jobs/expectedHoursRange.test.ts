import { describe, expect, it } from 'vitest'

import { clampExpectedHours, EXPECTED_HOURS_LEVER_WORDS, expectedHoursRange } from './expectedHoursRange'

describe('expectedHoursRange', () => {
  it('runs from the hours in to the budget\'s edge, stepping by the crew day the job read', () => {
    const r = expectedHoursRange({ hoursUsed: 40.7, budgetHours: 137.6, crewDay: 23.6, crewDayRead: true })
    expect(r).toEqual({ min: 40, max: 138, step: 24, pinned: false, pinnedWords: null })
  })

  it('steps by the hour while the crew day is assumed', () => {
    expect(expectedHoursRange({ hoursUsed: 0, budgetHours: 138, crewDay: 24, crewDayRead: false }).step).toBe(1)
  })

  it('pins within an hour of the edge and says so', () => {
    const r = expectedHoursRange({ hoursUsed: 137.5, budgetHours: 138, crewDay: 24, crewDayRead: true })
    expect(r.pinned).toBe(true)
    expect(r.pinnedWords).toBe('At the labor budget’s edge.')
    expect(r.min).toBe(137)
    expect(r.max).toBe(138)
  })

  it('pins over the edge with the hours over, the floor held at the ceiling', () => {
    const r = expectedHoursRange({ hoursUsed: 150, budgetHours: 138, crewDay: 24, crewDayRead: true })
    expect(r).toMatchObject({ min: 138, max: 138, pinned: true, pinnedWords: 'Over the labor budget by 12 h.' })
  })

  it('never pins a job with no budget, and keeps a control of at least one hour', () => {
    const r = expectedHoursRange({ hoursUsed: 30, budgetHours: 0, crewDay: 24, crewDayRead: false })
    expect(r).toMatchObject({ min: 1, max: 1, pinned: false, pinnedWords: null })
  })

  it('reads the lever words as one sentence', () => {
    expect(EXPECTED_HOURS_LEVER_WORDS).toBe('The budget is the lever now, on the Costs tab, not the target.')
  })
})

describe('clampExpectedHours', () => {
  const r = expectedHoursRange({ hoursUsed: 40, budgetHours: 138, crewDay: 24, crewDayRead: true })
  it('holds a dragged, pressed or typed number inside the range', () => {
    expect(clampExpectedHours(20, r)).toBe(40)
    expect(clampExpectedHours(200, r)).toBe(138)
    expect(clampExpectedHours(110.4, r)).toBe(110)
    expect(clampExpectedHours(Number.NaN, r)).toBe(138)
  })
})
