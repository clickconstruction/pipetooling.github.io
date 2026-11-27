import { describe, expect, it } from 'vitest'
import { DEFAULT_LABOR_BURDEN_FACTOR } from './appSettingsKeys'
import { LABOR_BURDEN_TITLE, LABOR_BURDEN_WORDS, laborBurdenExample, laborBurdenFigure, laborBurdenSentences } from './laborBurdenWords'
import { plainWordsFailures } from './plainWords'

describe('the labor burden factor, in words (Taunya, 2026-11-27)', () => {
  it('writes the factor as the screens do, to two places', () => {
    expect(laborBurdenFigure(DEFAULT_LABOR_BURDEN_FACTOR)).toBe('×1.20')
    expect(laborBurdenFigure(1.25)).toBe('×1.25')
    expect(laborBurdenFigure(1)).toBe('×1.00')
  })

  it('works one wage out from the factor itself, so the example cannot drift from the number', () => {
    expect(laborBurdenExample(1.2)).toBe('A wage of $30.00 an hour counts as $36.00 an hour.')
    expect(laborBurdenExample(1.25)).toBe('A wage of $30.00 an hour counts as $37.50 an hour.')
    expect(laborBurdenExample(1.2, 20)).toBe('A wage of $20.00 an hour counts as $24.00 an hour.')
  })

  it('says what it stands for in her words: depreciation on the tools and the truck', () => {
    expect(LABOR_BURDEN_WORDS.standsFor).toBe('It stands for depreciation on the tools and the truck a person uses.')
    // The old comment's meaning is gone from every sentence.
    expect(laborBurdenSentences(1.2).join(' ')).not.toMatch(/taxes|insurance/i)
  })

  it('names the seven places it reaches and the five it does not, and says nothing here changes it', () => {
    expect(LABOR_BURDEN_WORDS.reaches).toHaveLength(7)
    expect(LABOR_BURDEN_WORDS.not).toHaveLength(5)
    expect(LABOR_BURDEN_WORDS.reaches.join(' ')).toMatch(/crew rate/)
    expect(LABOR_BURDEN_WORDS.reaches.join(' ')).toMatch(/labor budget/)
    expect(LABOR_BURDEN_WORDS.reaches.join(' ')).toMatch(/scoreboard/)
    expect(LABOR_BURDEN_WORDS.reaches.join(' ')).toMatch(/field score/)
    expect(LABOR_BURDEN_WORDS.reaches.join(' ')).toMatch(/estimator/)
    // Punch list #448: a job's burn is priced at the factor, and the money table under it is not.
    expect(LABOR_BURDEN_WORDS.reaches.join(' ')).toMatch(/A job’s burn/)
    expect(LABOR_BURDEN_WORDS.not.join(' ')).toMatch(/Where the money went/)
    expect(LABOR_BURDEN_WORDS.not.join(' ')).not.toMatch(/burn/)
    expect(LABOR_BURDEN_WORDS.not.join(' ')).toMatch(/Pay stubs/)
    expect(LABOR_BURDEN_WORDS.not.join(' ')).toMatch(/overhead pool/)
    expect(LABOR_BURDEN_WORDS.change).toBe('No press here changes it. A developer changes the number in the database.')
    expect(LABOR_BURDEN_TITLE).toBe('Labor burden factor (dev)')
  })

  it('keeps every sentence to the plain-words rules', () => {
    expect(laborBurdenSentences(1.2).flatMap(plainWordsFailures)).toEqual([])
  })
})
