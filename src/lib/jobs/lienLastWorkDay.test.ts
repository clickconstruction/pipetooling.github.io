import { describe, expect, it } from 'vitest'
import { LAST_DAY_BY_HAND_LATER_HOURS_WORDS, LIEN_LAST_WORK_CLEAR, lienClockMonths, lienHoursAfterHandDay, lienHoursAfterHandDayWords, lienLastWorkDay, lienLastWorkDayPatch, lienLastWorkDayProblem, lienLastWorkSourceLine } from './lienLastWorkDay'
import { plainWordsFailures } from '../plainWords'

describe('lienLastWorkDay (v2.4676)', () => {
  it('a hand-set day wins, then the last clock day, then the creation day, then nothing', () => {
    expect(lienLastWorkDay({ lien_last_work_on: '2026-08-14', last_work_date: '2026-07-02', created_at: '2026-07-01T15:00:00Z', lien_last_work_note: ' walk-through ', lien_last_work_set_at: '2026-10-06T14:00:00Z', lien_last_work_set_by: 'u1' })).toEqual({ day: '2026-08-14', source: 'hand', sourceWords: 'set by hand', note: 'walk-through', setAt: '2026-10-06T14:00:00Z', setBy: 'u1' })
    expect(lienLastWorkDay({ last_work_date: '2026-07-02', created_at: '2026-07-01T15:00:00Z' })).toMatchObject({ day: '2026-07-02', source: 'hours', sourceWords: 'from clock hours' })
    expect(lienLastWorkDay({ created_at: '2026-07-01T15:00:00Z' })).toMatchObject({ day: '2026-07-01', source: 'created', sourceWords: "from the job's creation" })
    expect(lienLastWorkDay(null)).toMatchObject({ day: null, source: 'created', sourceWords: 'no day yet' })
  })
  it('refuses a bad day, a future day, and a day before the clock hours', () => {
    expect(lienLastWorkDayProblem('2026-13-40', null, '2026-10-06')).toBe('Pick a day.')
    expect(lienLastWorkDayProblem('2026-10-07', null, '2026-10-06')).toBe('The last day of work cannot be after today.')
    expect(lienLastWorkDayProblem('2026-08-14', '2026-09-24', '2026-10-06')).toBe('The clock hours already say Sep 24. The last day cannot be earlier.')
    expect(lienLastWorkDayProblem('2026-09-24', '2026-09-24', '2026-10-06')).toBeNull()
    expect(lienLastWorkDayProblem('2026-08-14', null, '2026-10-06')).toBeNull()
  })
  it('the patch carries the day, the reason trimmed, who and when; the clear empties all four', () => {
    expect(lienLastWorkDayPatch('2026-08-14', '  final walk-through ', 'u1', '2026-10-06T14:00:00Z')).toEqual({ lien_last_work_on: '2026-08-14', lien_last_work_note: 'final walk-through', lien_last_work_set_at: '2026-10-06T14:00:00Z', lien_last_work_set_by: 'u1' })
    expect(LIEN_LAST_WORK_CLEAR).toEqual({ lien_last_work_on: null, lien_last_work_note: '', lien_last_work_set_at: null, lien_last_work_set_by: null })
  })
  it('the source line names who and when for a hand-set day, and the source alone otherwise', () => {
    const d = lienLastWorkDay({ lien_last_work_on: '2026-08-14', lien_last_work_set_at: '2026-10-06T14:00:00Z', lien_last_work_set_by: 'u1' })
    expect(lienLastWorkSourceLine(d, 'Robert')).toBe('set by hand · Robert · Oct 6')
    expect(lienLastWorkSourceLine(d)).toBe('set by hand · Oct 6')
    expect(lienLastWorkSourceLine(lienLastWorkDay({ last_work_date: '2026-09-24' }))).toBe('from clock hours')
  })
})

describe('lienClockMonths — the day set by hand counts (v2.7193, punch list #335, row 1, the owner’s reading of 2026-11-13)', () => {
  it('with no day set by hand the clock counts every month with approved hours', () => {
    expect(lienClockMonths(['2026-07', '2026-05', '2026-07'], null)).toEqual({ months: ['2026-05', '2026-07'], lastMonth: '2026-07', byHand: false, hoursAfter: [] })
    expect(lienClockMonths([], null)).toEqual({ months: [], lastMonth: '', byHand: false, hoursAfter: [] })
    expect(lienClockMonths(['2026-07'], 'not a day')).toMatchObject({ lastMonth: '2026-07', byHand: false })
  })

  it('a hand day later than the hours adds its month, as it always did', () => {
    expect(lienClockMonths(['2026-05', '2026-07'], '2026-08-14')).toEqual({ months: ['2026-05', '2026-07', '2026-08'], lastMonth: '2026-08', byHand: true, hoursAfter: [] })
    expect(lienClockMonths([], '2026-08-14')).toEqual({ months: ['2026-08'], lastMonth: '2026-08', byHand: true, hoursAfter: [] })
  })

  it('hours approved after the hand day do not move the clock: their months are off it, and named', () => {
    // The live case: a day set in June, hours approved four months later.
    expect(lienClockMonths(['2026-05', '2026-10'], '2026-06-12')).toEqual({ months: ['2026-05', '2026-06'], lastMonth: '2026-06', byHand: true, hoursAfter: ['2026-10'] })
    expect(lienClockMonths(['2026-09', '2026-10'], '2026-06-12')).toEqual({ months: ['2026-06'], lastMonth: '2026-06', byHand: true, hoursAfter: ['2026-09', '2026-10'] })
  })

  it('hours in the hand day’s own month keep that one month, by hand', () => {
    expect(lienClockMonths(['2026-05', '2026-06'], '2026-06-12')).toEqual({ months: ['2026-05', '2026-06'], lastMonth: '2026-06', byHand: true, hoursAfter: [] })
  })

  it('later hours are found by the day, and said in plain words', () => {
    expect(lienHoursAfterHandDay({ last_work_date: '2026-10-20', lien_last_work_on: '2026-06-12' })).toBe('2026-10-20')
    expect(lienHoursAfterHandDay({ last_work_date: '2026-06-25', lien_last_work_on: '2026-06-12' })).toBe('2026-06-25')
    expect(lienHoursAfterHandDay({ last_work_date: '2026-06-12', lien_last_work_on: '2026-06-12' })).toBe('')
    expect(lienHoursAfterHandDay({ last_work_date: '2026-05-02', lien_last_work_on: '2026-06-12' })).toBe('')
    expect(lienHoursAfterHandDay({ last_work_date: '2026-10-20' })).toBe('')
    expect(lienHoursAfterHandDay(null)).toBe('')
    expect(lienHoursAfterHandDayWords('2026-10-20')).toBe('Hours were approved after it, through Oct 20. They do not move it.')
    expect(lienHoursAfterHandDayWords('')).toBe('')
    expect(plainWordsFailures(lienHoursAfterHandDayWords('2026-10-20'))).toEqual([])
    expect(LAST_DAY_BY_HAND_LATER_HOURS_WORDS).toBe('last day set by hand · later hours do not move it')
  })
})
