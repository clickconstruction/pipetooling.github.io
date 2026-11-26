import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { hereNote, travelNote } from '../jobMode/onMyWay'
import { CLOCK_IN_PLAN_EMPTY_LINE, CLOCK_OUT_NOTE_EMPTY_LINE, CLOCK_OUT_NOTE_FROM_PLAN_LINE, clockNoteEmpty, clockNoteIsPlan, clockOutPlanLineShows } from './clockPlanWords'

describe('the clock’s empty-box lines (punch list #446, v2.8624)', () => {
  it('name the press that comes alive, in plain words', () => {
    expect(CLOCK_IN_PLAN_EMPTY_LINE).toBe('Say what you mean to get done today, then Complete Clock In.')
    expect(CLOCK_OUT_NOTE_EMPTY_LINE).toBe('Say what you worked on today, then Complete clock out.')
    expect(plainWordsFailures(CLOCK_IN_PLAN_EMPTY_LINE)).toEqual([])
    expect(plainWordsFailures(CLOCK_OUT_NOTE_EMPTY_LINE)).toEqual([])
  })
  it('a box of spaces is empty; one word is not', () => {
    expect(clockNoteEmpty('')).toBe(true)
    expect(clockNoteEmpty('   \n')).toBe(true)
    expect(clockNoteEmpty(' Rough-in ')).toBe(false)
  })
})

describe('the clock-out box that opens on the plan (punch list #445)', () => {
  it('says where the words came from, in plain words', () => {
    expect(CLOCK_OUT_NOTE_FROM_PLAN_LINE).toBe('From your plan at clock in. Change it or leave it.')
    expect(plainWordsFailures(CLOCK_OUT_NOTE_FROM_PLAN_LINE)).toEqual([])
  })
  it('a typed note is a plan; an empty one and the two notes Job Mode writes are not', () => {
    expect(clockNoteIsPlan('Rough-in at the ZZ Test job')).toBe(true)
    expect(clockNoteIsPlan('')).toBe(false)
    expect(clockNoteIsPlan('   ')).toBe(false)
    expect(clockNoteIsPlan(travelNote('J1007 · ZZ Test Clinic', 12))).toBe(false)
    expect(clockNoteIsPlan(travelNote('J1007 · ZZ Test Clinic', null))).toBe(false)
    expect(clockNoteIsPlan(hereNote('J1007 · ZZ Test Clinic'))).toBe(false)
  })
  it('the line shows while the box holds the plan untouched, and never over the reports’ words', () => {
    const plan = 'Rough-in at the ZZ Test job'
    expect(clockOutPlanLineShows({ seed: plan, text: plan, filledFromReports: false })).toBe(true)
    expect(clockOutPlanLineShows({ seed: plan, text: `${plan} and trim`, filledFromReports: false })).toBe(false)
    expect(clockOutPlanLineShows({ seed: plan, text: '', filledFromReports: false })).toBe(false)
    expect(clockOutPlanLineShows({ seed: plan, text: plan, filledFromReports: true })).toBe(false)
    expect(clockOutPlanLineShows({ seed: '', text: '', filledFromReports: false })).toBe(false)
    const leg = hereNote('J1007 · ZZ Test Clinic')
    expect(clockOutPlanLineShows({ seed: leg, text: leg, filledFromReports: false })).toBe(false)
  })
})
