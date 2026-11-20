import { describe, expect, it } from 'vitest'
import { plainSentence, sentenceParts } from '../valuesInPlace'
import { salariedCreditSentence, salariedWeekLine } from './salariedWeekLine'

describe('what a salaried wage comes to', () => {
  it('six hours on five days at $10 is $300 a week', () => {
    expect(salariedWeekLine({ isSalary: true, hourlyWage: 10, week: [0, 6, 6, 6, 6, 6, 0] })).toBe('6 h Mon to Fri · $300.00 a week')
  })

  it('a row with no week reads as 8 hours on the five weekdays', () => {
    expect(salariedWeekLine({ isSalary: true, hourlyWage: 7.5 })).toBe('8 h Mon to Fri · $300.00 a week')
    expect(salariedWeekLine({ isSalary: true, hourlyWage: 7.5, week: null })).toBe('8 h Mon to Fri · $300.00 a week')
  })

  it('says each stretch of days when they differ, and writes thousands', () => {
    expect(salariedWeekLine({ isSalary: true, hourlyWage: 32.5, week: [0, 8, 8, 8, 8, 4, 0] })).toBe('8 h Mon to Thu, 4 h Fri · $1,170.00 a week')
  })

  it('says nothing for an hourly person or a salaried row with no wage', () => {
    expect(salariedWeekLine({ isSalary: false, hourlyWage: 10, week: [0, 6, 6, 6, 6, 6, 0] })).toBeNull()
    expect(salariedWeekLine({ isSalary: true, hourlyWage: null })).toBeNull()
    expect(salariedWeekLine({ isSalary: true, hourlyWage: 0 })).toBeNull()
  })
})

describe('what the Salaried switch says a person is credited', () => {
  it('a row with no week reads as 8 hours on the five weekdays, as the card always said', () => {
    expect(plainSentence(salariedCreditSentence())).toBe('credited 8 h Mon to Fri on all pay and cost screens, whatever the clock says.')
    expect(plainSentence(salariedCreditSentence(null))).toBe(plainSentence(salariedCreditSentence([0, 8, 8, 8, 8, 8, 0])))
  })

  it('a set week reads as its own days and hours, never the flat 8', () => {
    expect(plainSentence(salariedCreditSentence([0, 8, 8, 8, 8, 4, 0]))).toBe('credited 8 h Mon to Thu, 4 h Fri on all pay and cost screens, whatever the clock says.')
    expect(plainSentence(salariedCreditSentence([0, 10, 10, 10, 10, 0, 0]))).toBe('credited 10 h Mon to Thu on all pay and cost screens, whatever the clock says.')
    expect(plainSentence(salariedCreditSentence([0, 0, 8, 8, 8, 8, 8]))).toBe('credited 8 h Tue to Sat on all pay and cost screens, whatever the clock says.')
    expect(plainSentence(salariedCreditSentence([0, 6, 6, 6, 6, 6, 0]))).not.toContain('8')
  })

  it('marks the week as the one value, so the card draws it apart from the words', () => {
    expect(sentenceParts(salariedCreditSentence([0, 6, 6, 6, 6, 6, 0]))).toEqual(['credited ', { kind: 'week', text: '6 h Mon to Fri' }, ' on all pay and cost screens, whatever the clock says.'])
  })

  it('a week with no paid days says so, in place of a credit on no days', () => {
    expect(plainSentence(salariedCreditSentence([0, 0, 0, 0, 0, 0, 0]))).toBe('credited nothing: their set week has no paid days.')
  })
})
