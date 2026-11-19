import { describe, expect, it } from 'vitest'
import { salariedWeekLine } from './salariedWeekLine'

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
