import { describe, expect, it } from 'vitest'
import { PROMISE_BACKFILL_MIN_DAYS_LATE, promiseBackfillChoices, shouldAskPromiseBackfill } from './promiseBackfillPrompt'

describe('shouldAskPromiseBackfill', () => {
  it('asks for a payment two weeks or more after the bill with no promise on record', () => {
    expect(PROMISE_BACKFILL_MIN_DAYS_LATE).toBe(14)
    expect(shouldAskPromiseBackfill({ billedYmd: '2026-08-25', paidOnYmd: '2026-09-08', existingPromiseYmd: null })).toBe(true)
    expect(shouldAskPromiseBackfill({ billedYmd: '2026-08-25', paidOnYmd: '2026-09-07', existingPromiseYmd: null })).toBe(false)
  })
  it('never asks when a promise already exists, or without a bill date', () => {
    expect(shouldAskPromiseBackfill({ billedYmd: '2026-08-01', paidOnYmd: '2026-09-08', existingPromiseYmd: '2026-09-05' })).toBe(false)
    expect(shouldAskPromiseBackfill({ billedYmd: null, paidOnYmd: '2026-09-08', existingPromiseYmd: null })).toBe(false)
    expect(shouldAskPromiseBackfill({ billedYmd: 'garbage', paidOnYmd: '2026-09-08', existingPromiseYmd: null })).toBe(false)
  })
})

describe('promiseBackfillChoices', () => {
  it('offers the paid day and the two Fridays before it, all after the bill', () => {
    // Tue Sep 15 → Sep 15, Fri Sep 11, Fri Sep 4
    expect(promiseBackfillChoices('2026-09-15', '2026-08-25')).toEqual([
      { ymd: '2026-09-15', label: 'Sep 15' },
      { ymd: '2026-09-11', label: 'Sep 11' },
      { ymd: '2026-09-04', label: 'Sep 4' },
    ])
  })
  it('a Friday payment offers itself and the two Fridays before', () => {
    expect(promiseBackfillChoices('2026-09-11', null).map((c) => c.ymd)).toEqual(['2026-09-11', '2026-09-04', '2026-08-28'])
  })
  it('drops choices on or before the bill date', () => {
    expect(promiseBackfillChoices('2026-09-08', '2026-09-04').map((c) => c.ymd)).toEqual(['2026-09-08'])
    expect(promiseBackfillChoices('bad', null)).toEqual([])
  })
})
