import { describe, expect, it } from 'vitest'
import { LIEN_LAST_WORK_CLEAR, lienLastWorkDay, lienLastWorkDayPatch, lienLastWorkDayProblem, lienLastWorkSourceLine } from './lienLastWorkDay'

describe('lienLastWorkDay (v2.4653)', () => {
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
