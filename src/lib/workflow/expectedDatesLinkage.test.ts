import { describe, expect, it } from 'vitest'
import {
  expectedDatesProblems,
  expectedEndChanged,
  expectedLengthChanged,
  expectedStartChanged,
  seedExpectedDates,
} from './expectedDatesLinkage'

type S = { id: string; scheduled_start_date: string | null; scheduled_end_date: string | null }
const step = (id: string, start: string | null, end: string | null): S => ({
  id,
  scheduled_start_date: start,
  scheduled_end_date: end,
})

describe('seedExpectedDates', () => {
  it('opens on the step’s own dates and counts the length between them', () => {
    const b = step('b', '2026-09-07', '2026-09-10')
    expect(seedExpectedDates([step('a', null, '2026-09-01'), b, step('c', null, null)], b)).toEqual({
      expectedStart: '2026-09-07',
      expectedEnd: '2026-09-10',
      lengthDays: '3',
      hasNextStage: true,
      seededFromPrior: false,
    })
  })

  it('borrows the previous step’s end when the step has no start', () => {
    const b = step('b', null, null)
    expect(seedExpectedDates([step('a', '2026-09-01', '2026-09-05'), b], b)).toEqual({
      expectedStart: '2026-09-05',
      expectedEnd: '',
      lengthDays: '',
      hasNextStage: false,
      seededFromPrior: true,
    })
  })

  it('counts the length from a borrowed start to the step’s own end', () => {
    const b = step('b', null, '2026-09-08')
    const seed = seedExpectedDates([step('a', null, '2026-09-05'), b], b)
    expect(seed).toMatchObject({ expectedStart: '2026-09-05', expectedEnd: '2026-09-08', lengthDays: '3', seededFromPrior: true })
  })

  it('opens blank for the first step with no dates', () => {
    const a = step('a', null, null)
    expect(seedExpectedDates([a, step('b', '2026-09-07', null)], a)).toEqual({
      expectedStart: '',
      expectedEnd: '',
      lengthDays: '',
      hasNextStage: true,
      seededFromPrior: false,
    })
  })

  it('reads the day off timestamp values', () => {
    const a = step('a', '2026-09-07T00:00:00+00:00', '2026-09-09T00:00:00+00:00')
    expect(seedExpectedDates([a], a)).toMatchObject({ expectedStart: '2026-09-07', expectedEnd: '2026-09-09', lengthDays: '2' })
  })

  it('shows a negative length when the saved end is before the start', () => {
    const a = step('a', '2026-09-10', '2026-09-07')
    expect(seedExpectedDates([a], a).lengthDays).toBe('-3')
  })

  it('goes by position in the list: previous and next are the neighbours as listed', () => {
    const b = step('b', null, null)
    const seed = seedExpectedDates([step('c', null, '2026-12-01'), b, step('a', null, '2026-01-01')], b)
    expect(seed.expectedStart).toBe('2026-12-01')
    expect(seed.hasNextStage).toBe(true)
  })

  it('has no neighbours for a step that is not in the list', () => {
    const ghost = step('ghost', null, null)
    expect(seedExpectedDates([step('a', null, '2026-09-05')], ghost)).toMatchObject({
      expectedStart: '',
      hasNextStage: false,
      seededFromPrior: false,
    })
  })
})

describe('expectedStartChanged', () => {
  it('keeps the length and moves the end', () => {
    expect(
      expectedStartChanged({ expectedStart: '2026-09-07', expectedEnd: '2026-09-10', lengthDays: '3' }, '2026-09-14'),
    ).toEqual({ expectedStart: '2026-09-14', expectedEnd: '2026-09-17' })
  })

  it('moves the end across a month end', () => {
    expect(expectedStartChanged({ expectedStart: '', expectedEnd: '', lengthDays: '5' }, '2026-09-28')).toEqual({
      expectedStart: '2026-09-28',
      expectedEnd: '2026-10-03',
    })
  })

  it('with no length, re-counts the length to the end', () => {
    expect(expectedStartChanged({ expectedStart: '', expectedEnd: '2026-09-10', lengthDays: '' }, '2026-09-07')).toEqual({
      expectedStart: '2026-09-07',
      lengthDays: '3',
    })
  })

  it('with an unreadable length, re-counts it from the end', () => {
    expect(
      expectedStartChanged({ expectedStart: '', expectedEnd: '2026-09-10', lengthDays: 'abc' }, '2026-09-07'),
    ).toEqual({ expectedStart: '2026-09-07', lengthDays: '3' })
  })

  it('moves the end on a negative length too (the Forecast modal’s copy does not)', () => {
    expect(
      expectedStartChanged({ expectedStart: '2026-09-10', expectedEnd: '2026-09-07', lengthDays: '-3' }, '2026-09-20'),
    ).toEqual({ expectedStart: '2026-09-20', expectedEnd: '2026-09-17' })
  })

  it('sets only the start when there is neither a length nor an end', () => {
    expect(expectedStartChanged({ expectedStart: '', expectedEnd: '', lengthDays: '' }, '2026-09-07')).toEqual({
      expectedStart: '2026-09-07',
    })
  })

  it('clearing the start leaves the end and the length as they were', () => {
    expect(expectedStartChanged({ expectedStart: '2026-09-07', expectedEnd: '2026-09-10', lengthDays: '3' }, '')).toEqual({
      expectedStart: '',
    })
  })
})

describe('expectedEndChanged', () => {
  it('re-counts the length from the start', () => {
    expect(expectedEndChanged({ expectedStart: '2026-09-07', expectedEnd: '', lengthDays: '' }, '2026-09-12')).toEqual({
      expectedEnd: '2026-09-12',
      lengthDays: '5',
    })
  })

  it('gives a negative length for an end before the start', () => {
    expect(expectedEndChanged({ expectedStart: '2026-09-07', expectedEnd: '', lengthDays: '' }, '2026-09-05')).toEqual({
      expectedEnd: '2026-09-05',
      lengthDays: '-2',
    })
  })

  it('sets only the end when there is no start, or when the end is cleared', () => {
    expect(expectedEndChanged({ expectedStart: '', expectedEnd: '', lengthDays: '4' }, '2026-09-12')).toEqual({
      expectedEnd: '2026-09-12',
    })
    expect(expectedEndChanged({ expectedStart: '2026-09-07', expectedEnd: '2026-09-10', lengthDays: '3' }, '')).toEqual({
      expectedEnd: '',
    })
  })
})

describe('expectedLengthChanged', () => {
  const current = { expectedStart: '2026-09-07', expectedEnd: '2026-09-10', lengthDays: '3' }

  it('moves the end from the start', () => {
    expect(expectedLengthChanged(current, '10')).toEqual({ lengthDays: '10', expectedEnd: '2026-09-17' })
    expect(expectedLengthChanged(current, '0')).toEqual({ lengthDays: '0', expectedEnd: '2026-09-07' })
  })

  it('keeps what was typed as typed, spaces and all', () => {
    expect(expectedLengthChanged(current, ' 4 ')).toEqual({ lengthDays: ' 4 ', expectedEnd: '2026-09-11' })
  })

  it('moves the end backwards on a negative length — the window then warns', () => {
    expect(expectedLengthChanged(current, '-2')).toEqual({ lengthDays: '-2', expectedEnd: '2026-09-05' })
  })

  it('clears the length and leaves the end when the field is emptied', () => {
    expect(expectedLengthChanged(current, '')).toEqual({ lengthDays: '' })
    expect(expectedLengthChanged(current, '   ')).toEqual({ lengthDays: '' })
  })

  it('keeps an unreadable length and leaves the end', () => {
    expect(expectedLengthChanged(current, 'abc')).toEqual({ lengthDays: 'abc' })
  })

  it('sets only the length when there is no start', () => {
    expect(expectedLengthChanged({ ...current, expectedStart: '' }, '5')).toEqual({ lengthDays: '5' })
  })
})

describe('expectedDatesProblems', () => {
  it('finds nothing wrong with blank fields or a sound window', () => {
    expect(expectedDatesProblems({ expectedStart: '', expectedEnd: '', lengthDays: '' })).toEqual({
      lengthInvalid: false,
      endBeforeStart: false,
    })
    expect(expectedDatesProblems({ expectedStart: '2026-09-07', expectedEnd: '2026-09-10', lengthDays: '3' })).toEqual({
      lengthInvalid: false,
      endBeforeStart: false,
    })
  })

  it('allows a same-day window and a length of 0', () => {
    expect(expectedDatesProblems({ expectedStart: '2026-09-07', expectedEnd: '2026-09-07', lengthDays: '0' })).toEqual({
      lengthInvalid: false,
      endBeforeStart: false,
    })
  })

  it('flags a length that is not a number or is below zero', () => {
    expect(expectedDatesProblems({ expectedStart: '', expectedEnd: '', lengthDays: 'abc' }).lengthInvalid).toBe(true)
    expect(expectedDatesProblems({ expectedStart: '', expectedEnd: '', lengthDays: '-1' }).lengthInvalid).toBe(true)
  })

  it('flags an end before its start', () => {
    expect(
      expectedDatesProblems({ expectedStart: '2026-09-10', expectedEnd: '2026-09-07', lengthDays: '' }).endBeforeStart,
    ).toBe(true)
  })

  it('does not flag the order when either date is missing', () => {
    expect(expectedDatesProblems({ expectedStart: '', expectedEnd: '2026-09-07', lengthDays: '' }).endBeforeStart).toBe(false)
    expect(expectedDatesProblems({ expectedStart: '2026-09-07', expectedEnd: '', lengthDays: '' }).endBeforeStart).toBe(false)
  })
})
