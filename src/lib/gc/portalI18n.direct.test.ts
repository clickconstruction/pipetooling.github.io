/**
 * Main's own tests for the trade's portal's dates in English and Spanish (the schedule's PR 1b):
 * the spike's own cases.
 */
import { describe, expect, it } from 'vitest'
import { pDate, pWeekday } from './portalI18n'

describe('the portal’s dates', () => {
  it('says a day in English and in Spanish', () => {
    expect([pDate('en', '2026-10-08'), pDate('es', '2026-10-08')]).toEqual(['Oct 8', '8 oct'])
    expect([pWeekday('en', '2026-10-08'), pWeekday('es', '2026-10-08')]).toEqual(['Thu Oct 8', 'jue 8 oct'])
    expect(pDate('es', '2026-09-30')).toBe('30 sep')
  })

  it('says nothing for no day', () => {
    expect([pDate('es', null), pWeekday('es', null), pDate('en', null), pWeekday('en', null)]).toEqual(['', '', '', ''])
  })
})
