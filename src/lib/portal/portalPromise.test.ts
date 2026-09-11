import { describe, expect, it } from 'vitest'
import {
  PROMISE_ASK_MIN_BILL_AGE_DAYS,
  PROMISE_MAX_DAYS_AHEAD,
  promiseAskVisible,
  promiseDateChoices,
  promiseDateProblem,
  promiseDaysBetween,
} from '../../../supabase/functions/_shared/portalPromise'

describe('promiseDateProblem', () => {
  const today = '2026-09-11' // a Friday
  it('accepts today through the horizon', () => {
    expect(promiseDateProblem('2026-09-11', today)).toBeNull()
    expect(promiseDateProblem('2026-09-12', today)).toBeNull()
    expect(promiseDateProblem('2026-11-10', today)).toBeNull() // +60
  })
  it('refuses the past, the far future, and garbage', () => {
    expect(promiseDateProblem('2026-09-10', today)).toMatch(/already passed/)
    expect(promiseDateProblem('2026-11-11', today)).toMatch(new RegExp(`${PROMISE_MAX_DAYS_AHEAD} days`))
    expect(promiseDateProblem('soon', today)).toMatch(/pick a date/i)
    expect(promiseDateProblem('2026-02-30', today)).toMatch(/pick a date/i)
    expect(promiseDateProblem('2026-09-12', 'nope')).toMatch(/pick a date/i)
  })
})

describe('promiseDateChoices', () => {
  it('offers this Friday, next Friday, and two weeks after that on a weekday', () => {
    // Wed Sep 9 → Fri Sep 11, Fri Sep 18, Fri Oct 2
    expect(promiseDateChoices('2026-09-09')).toEqual([
      { ymd: '2026-09-11', label: 'Fri Sep 11' },
      { ymd: '2026-09-18', label: 'Fri Sep 18' },
      { ymd: '2026-10-02', label: 'Fri Oct 2' },
    ])
  })
  it('on a Friday or the weekend, starts from next Friday', () => {
    expect(promiseDateChoices('2026-09-11')[0]!.ymd).toBe('2026-09-18')
    expect(promiseDateChoices('2026-09-12')[0]!.ymd).toBe('2026-09-18')
    expect(promiseDateChoices('2026-09-13')[0]!.ymd).toBe('2026-09-18')
  })
  it('every choice passes the date rule', () => {
    for (const c of promiseDateChoices('2026-09-09')) expect(promiseDateProblem(c.ymd, '2026-09-09')).toBeNull()
    expect(promiseDateChoices('bad')).toEqual([])
  })
})

describe('promiseAskVisible', () => {
  const today = '2026-09-11'
  it('needs money due and a bill at least a week old', () => {
    expect(PROMISE_ASK_MIN_BILL_AGE_DAYS).toBe(7)
    expect(promiseAskVisible([{ billedOn: '2026-09-04', amount: 250 }], today)).toBe(true)
    expect(promiseAskVisible([{ billedOn: '2026-09-05', amount: 250 }], today)).toBe(false)
    expect(promiseAskVisible([{ billedOn: '2026-08-01', amount: 0 }], today)).toBe(false)
    expect(promiseAskVisible([{ billedOn: null, amount: 250 }], today)).toBe(false)
    expect(promiseAskVisible([], today)).toBe(false)
  })
  it('one old bill is enough even when a fresh one sits beside it', () => {
    expect(promiseAskVisible([{ billedOn: '2026-09-10', amount: 100 }, { billedOn: '2026-08-20', amount: 50 }], today)).toBe(true)
  })
  it('promiseDaysBetween is null on bad input', () => {
    expect(promiseDaysBetween('2026-09-01', '2026-09-11')).toBe(10)
    expect(promiseDaysBetween('x', '2026-09-11')).toBeNull()
  })
})
