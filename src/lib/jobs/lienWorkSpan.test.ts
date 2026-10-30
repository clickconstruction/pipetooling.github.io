import { describe, expect, it } from 'vitest'
import { EMPTY_LIEN_WORK_SPAN, lastDayOfMonth, lienWorkSpan } from './lienWorkSpan'

describe('lienWorkSpan (v2.6061) — the affidavit’s paragraph 5 swears the real period, not one day', () => {
  it('a job with sessions: the first approved day through the last', () => {
    expect(lienWorkSpan({ first_work_date: '2026-05-04', last_work_date: '2026-07-17' }, { lastMonth: '2026-07' })).toEqual({ workStart: '2026-05-04', workEnd: '2026-07-17', startSource: 'hours', endSource: 'hours' })
    // The desk's month beside the days changes nothing once the days are known.
    expect(lienWorkSpan({ first_work_date: '2026-05-04', last_work_date: '2026-07-17' }, { lastMonth: '2026-08', todayYmd: '2026-10-29' })).toMatchObject({ workStart: '2026-05-04', workEnd: '2026-07-17' })
  })
  it('a last day set by hand ends the span when it is the later; the hours end it when they are', () => {
    expect(lienWorkSpan({ first_work_date: '2026-05-04', last_work_date: '2026-07-17', lien_last_work_on: '2026-08-14' })).toEqual({ workStart: '2026-05-04', workEnd: '2026-08-14', startSource: 'hours', endSource: 'hand' })
    expect(lienWorkSpan({ first_work_date: '2026-05-04', last_work_date: '2026-07-17', lien_last_work_on: '2026-06-01' })).toMatchObject({ workEnd: '2026-07-17', endSource: 'hours' })
    expect(lienWorkSpan({ first_work_date: '2026-05-04', last_work_date: '2026-07-17', lien_last_work_on: '2026-07-17' })).toMatchObject({ workEnd: '2026-07-17', endSource: 'hand' })
  })
  it('a job with a by-hand last day and no sessions: the first of that month through the day', () => {
    expect(lienWorkSpan({ lien_last_work_on: '2026-07-17' }, { lastMonth: '2026-07' })).toEqual({ workStart: '2026-07-01', workEnd: '2026-07-17', startSource: 'month', endSource: 'hand' })
    expect(lienWorkSpan({ lien_last_work_on: '2026-07-17' })).toMatchObject({ workStart: '2026-07-01', workEnd: '2026-07-17' })
  })
  it('a job with only a month: the first to the last day of it, never one day', () => {
    expect(lienWorkSpan({}, { lastMonth: '2026-07' })).toEqual({ workStart: '2026-07-01', workEnd: '2026-07-31', startSource: 'month', endSource: 'month' })
    expect(lienWorkSpan(null, { lastMonth: '2026-02' })).toMatchObject({ workStart: '2026-02-01', workEnd: '2026-02-28' })
    expect(lienWorkSpan(null, { lastMonth: '2028-02' })).toMatchObject({ workEnd: '2028-02-29' })
    // The month still running ends today, never on a day that has not come.
    expect(lienWorkSpan({}, { lastMonth: '2026-10', todayYmd: '2026-10-29' })).toMatchObject({ workStart: '2026-10-01', workEnd: '2026-10-29', endSource: 'month' })
    expect(lienWorkSpan({}, { lastMonth: '2026-09', todayYmd: '2026-10-29' })).toMatchObject({ workEnd: '2026-09-30' })
  })
  it('the first month known starts the span while the job has no first day; the months fold when stale', () => {
    expect(lienWorkSpan({ last_work_date: '2026-07-17' }, { firstMonth: '2026-05', lastMonth: '2026-07' })).toEqual({ workStart: '2026-05-01', workEnd: '2026-07-17', startSource: 'month', endSource: 'hours' })
    expect(lienWorkSpan({ last_work_date: '2026-07-17' })).toMatchObject({ workStart: '2026-07-01', workEnd: '2026-07-17', startSource: 'month' })
    expect(lienWorkSpan({ lien_last_work_on: '2026-07-17' }, { firstMonth: '2026-10' })).toMatchObject({ workStart: '2026-07-01', workEnd: '2026-07-17' })
  })
  it('nothing known prints nothing, so the paper shows its blanks', () => {
    expect(lienWorkSpan(null)).toEqual(EMPTY_LIEN_WORK_SPAN)
    expect(lienWorkSpan({ first_work_date: 'soon', last_work_date: '' }, { lastMonth: 'last month' })).toEqual(EMPTY_LIEN_WORK_SPAN)
    // A timestamp is read as its day.
    expect(lienWorkSpan({ first_work_date: '2026-05-04T00:00:00', last_work_date: '2026-07-17T00:00:00' })).toMatchObject({ workStart: '2026-05-04', workEnd: '2026-07-17' })
  })
  it('lastDayOfMonth', () => {
    expect(lastDayOfMonth('2026-07')).toBe('2026-07-31')
    expect(lastDayOfMonth('2026-04')).toBe('2026-04-30')
    expect(lastDayOfMonth('2026-02')).toBe('2026-02-28')
    expect(lastDayOfMonth('2028-02')).toBe('2028-02-29')
    expect(lastDayOfMonth('2026-13')).toBe('')
    expect(lastDayOfMonth('July')).toBe('')
  })
})
