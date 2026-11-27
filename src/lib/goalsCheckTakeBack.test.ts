import { describe, expect, it } from 'vitest'
import { plainSentence, sentenceParts } from './valuesInPlace'
import {
  GOALS_CHECK_NOT_TAKEN_BACK,
  GOALS_CHECK_TAKEN_BACK,
  goalsCheckAsksAgain,
  goalsCheckDayWords,
  goalsCheckDays,
  goalsCheckTakeBackConfirm,
  goalsCheckTakeBackDrawn,
  goalsCheckTakeBackProblem,
  type GoalsCheckToday,
} from './goalsCheckTakeBack'

const DAY = '2026-11-26'
const passed = (over: Partial<GoalsCheckToday> = {}): GoalsCheckToday => ({ acks: [{ localDate: DAY, completedAtIso: '2026-11-26T15:14:00Z' }], goals: 3, sessions: 1, ...over })

describe('goalsCheckTakeBackDrawn', () => {
  it('is a dev alone', () => {
    expect(goalsCheckTakeBackDrawn('dev')).toBe(true)
    for (const role of ['master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers', '', null, undefined]) {
      expect(goalsCheckTakeBackDrawn(role)).toBe(false)
    }
  })
})

describe('goalsCheckDays', () => {
  it('is one day when the device and the company agree', () => {
    expect(goalsCheckDays(DAY, DAY)).toEqual([DAY])
  })
  it('is both days, the company’s first, when a device sits in another time zone', () => {
    expect(goalsCheckDays(DAY, '2026-11-27')).toEqual([DAY, '2026-11-27'])
  })
  it('drops anything that is not a day', () => {
    expect(goalsCheckDays('', DAY)).toEqual([DAY])
    expect(goalsCheckDays('today', ' 2026-11-26 ')).toEqual([DAY])
    expect(goalsCheckDays('', '')).toEqual([])
  })
})

describe('goalsCheckTakeBackProblem', () => {
  it('lets a dev take back a check that was passed', () => {
    expect(goalsCheckTakeBackProblem('dev', passed())).toBe('')
  })
  it('refuses every role but a dev, whatever was read', () => {
    for (const role of ['master_technician', 'assistant', 'controller', 'primary', null]) {
      expect(goalsCheckTakeBackProblem(role, passed())).toBe('Only a developer takes a goals check back.')
    }
  })
  it('refuses when the day could not be read', () => {
    expect(goalsCheckTakeBackProblem('dev', null)).toBe('Today’s check could not be read. Nothing was taken back.')
    expect(goalsCheckTakeBackProblem('dev', undefined)).toBe('Today’s check could not be read. Nothing was taken back.')
  })
  it('refuses when the check is not passed, and says there is nothing to take back', () => {
    expect(goalsCheckTakeBackProblem('dev', passed({ acks: [] }))).toBe('You have not passed today’s check, so there is nothing to take back.')
  })
})

describe('goalsCheckAsksAgain', () => {
  it('says the next load of the app when a clock session stands today, with the count marked as a value', () => {
    const one = goalsCheckAsksAgain({ goals: 3, sessions: 1 })
    expect(plainSentence(one)).toBe('You have 1 clock session today, so the check asks again the next time the app loads.')
    expect(sentenceParts(one)).toContainEqual({ kind: 'sessions', text: '1 clock session' })
    expect(plainSentence(goalsCheckAsksAgain({ goals: 3, sessions: 2 }))).toBe('You have 2 clock sessions today, so the check asks again the next time the app loads.')
  })
  it('says the first clock in when no session stands today', () => {
    expect(goalsCheckAsksAgain({ goals: 1, sessions: 0 })).toBe('You have no clock session today, so the check asks again after your first clock in.')
  })
  it('says the check does not ask for an account with no goals', () => {
    expect(goalsCheckAsksAgain({ goals: 0, sessions: 2 })).toBe('You have no goals, so the check does not ask.')
  })
  it('keeps every sentence under 20 words, with no dash, semicolon or parenthesis', () => {
    for (const s of [goalsCheckAsksAgain({ goals: 3, sessions: 12 }), goalsCheckAsksAgain({ goals: 3, sessions: 0 }), goalsCheckAsksAgain({ goals: 0, sessions: 0 })]) {
      const plain = plainSentence(s)
      expect(plain.split(/\s+/).length).toBeLessThan(20)
      expect(plain).not.toMatch(/[—–;()]/)
    }
  })
})

describe('goalsCheckTakeBackConfirm', () => {
  it('names the act on its button, and says what goes, what stays and when the check asks again', () => {
    expect(goalsCheckTakeBackConfirm(passed())).toEqual({
      title: 'Take today’s goals check back?',
      message: `This deletes your own record that you passed the check on ${goalsCheckDayWords(DAY)}. Your goals and your clock sessions stay. You have 1 clock session today, so the check asks again the next time the app loads.`,
      confirmLabel: 'Take the check back',
    })
  })
  it('names both days when today is two', () => {
    const two = passed({ acks: [{ localDate: DAY, completedAtIso: null }, { localDate: '2026-11-27', completedAtIso: null }], sessions: 0 })
    expect(goalsCheckTakeBackConfirm(two).message).toBe(
      `This deletes your own record that you passed the check on ${goalsCheckDayWords(DAY)} and ${goalsCheckDayWords('2026-11-27')}. Your goals and your clock sessions stay. You have no clock session today, so the check asks again after your first clock in.`,
    )
  })
  it('carries no value mark into the window', () => {
    expect(goalsCheckTakeBackConfirm(passed()).message).not.toMatch(/[⟪⟫|]/)
  })
  it('never says OK', () => {
    expect(goalsCheckTakeBackConfirm(passed()).confirmLabel).not.toMatch(/^ok$/i)
  })
})

describe('the words', () => {
  it('reads a day as a weekday and a date', () => {
    expect(goalsCheckDayWords(DAY)).toBe('Thu, Nov 26')
  })
  it('says what happened', () => {
    expect(GOALS_CHECK_TAKEN_BACK).toBe('Today’s goals check was taken back.')
    expect(GOALS_CHECK_NOT_TAKEN_BACK).toBe('The check was not taken back. Its record may be gone already. Read it again.')
  })
})
