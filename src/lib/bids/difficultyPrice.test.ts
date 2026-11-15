import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DIFFICULTY_PRICE_V1,
  difficultyCanEditPrice,
  difficultyCanRate,
  difficultyPayingRuleOf,
  difficultyPriceProblems,
  difficultyPriceVersionWords,
  difficultyPriceWords,
  difficultyRaterOfRole,
  parseDifficultyPriceList,
} from './difficultyPrice'

const MIGRATION = resolve(__dirname, '../../../supabase/migrations/20261115020000_difficulty_price_versions.sql')

describe('difficultyPrice (punch list #357, PR 4)', () => {
  it('version 1 in the kernel is the JSON the migration seeds', () => {
    const sql = readFileSync(MIGRATION, 'utf8')
    const m = /\$json\$(\{.*?\})\$json\$/s.exec(sql)
    expect(m).not.toBeNull()
    expect(JSON.parse(m![1]!)).toEqual(DIFFICULTY_PRICE_V1)
  })

  it('parses leniently: a missing number takes version 1, a typed string reads as a number, unknown raters drop', () => {
    expect(parseDifficultyPriceList(null)).toBeNull()
    expect(parseDifficultyPriceList([])).toBeNull()
    expect(parseDifficultyPriceList({})).toEqual(DIFFICULTY_PRICE_V1)
    expect(parseDifficultyPriceList({ fieldPctPerPoint: '7.5', raters: ['office', 'janitor'] })).toEqual({ ...DIFFICULTY_PRICE_V1, fieldPctPerPoint: 7.5, raters: ['office'] })
    expect(parseDifficultyPriceList('{"capPct":12}')).toEqual({ ...DIFFICULTY_PRICE_V1, capPct: 12 })
  })

  it('names the rules a list breaks, one a person can act on each', () => {
    expect(difficultyPriceProblems(DIFFICULTY_PRICE_V1)).toEqual([])
    const bad = difficultyPriceProblems({ ...DIFFICULTY_PRICE_V1, fieldPctPerPoint: 120, payingMinBills: 0, raters: [] })
    expect(bad).toEqual([
      'The field percent is a percent from 0 to 100.',
      'The bills a read needs is a whole number from 1 to 50.',
      'Someone has to be able to rate a GC: pick at least one of the office, the estimators and the masters.',
    ])
  })

  it('the paying rule the reader takes', () => {
    expect(difficultyPayingRuleOf(DIFFICULTY_PRICE_V1)).toEqual({ daysPast: 45, lateBillsInYear: 2, minBills: 3 })
  })

  it('who may rate: the list says, a dev always may, a primary and a sub never', () => {
    expect(difficultyRaterOfRole('master_technician')).toBe('master')
    expect(difficultyRaterOfRole('assistant')).toBe('office')
    expect(difficultyRaterOfRole('estimator')).toBe('estimator')
    expect(difficultyRaterOfRole('primary')).toBeNull()
    expect(difficultyCanRate(null, 'assistant')).toBe(true)
    expect(difficultyCanRate(null, 'estimator')).toBe(false)
    expect(difficultyCanRate({ ...DIFFICULTY_PRICE_V1, raters: ['estimator'] }, 'estimator')).toBe(true)
    expect(difficultyCanRate({ ...DIFFICULTY_PRICE_V1, raters: ['estimator'] }, 'assistant')).toBe(false)
    expect(difficultyCanRate({ ...DIFFICULTY_PRICE_V1, raters: [] }, 'dev')).toBe(true)
    expect(difficultyCanRate(DIFFICULTY_PRICE_V1, 'subcontractor')).toBe(false)
  })

  it('the owner, the controller and a dev edit the list', () => {
    expect(difficultyCanEditPrice('master_technician')).toBe(true)
    expect(difficultyCanEditPrice('controller')).toBe(true)
    expect(difficultyCanEditPrice('dev')).toBe(true)
    expect(difficultyCanEditPrice('assistant')).toBe(false)
    expect(difficultyCanEditPrice('estimator')).toBe(false)
  })

  it('the list in sentences, and the version line', () => {
    expect(difficultyPriceWords(DIFFICULTY_PRICE_V1)).toEqual([
      "Each field point adds 5% of the bid's field hours at its labor rate.",
      'Each office point adds 12 office hours at $80 an hour.',
      "Each site point adds 4% of the bid's field hours at its labor rate.",
      'The paying point carries the price for the days past 45 at 1.5% a month.',
      "All lines together add at most 10% of the bid's own cost.",
      'Paying is read from the bills once a GC has 3 or more, or when 2 in a year ran past their calendar.',
    ])
    expect(difficultyPriceVersionWords({ version: 2, publishedAt: '2026-11-20T15:00:00Z', publishedByName: 'Taunya' })).toBe('price list version 2 · 2026-11-20 by Taunya')
    expect(difficultyPriceVersionWords({ version: 1, publishedAt: null, publishedByName: '' })).toBe('price list version 1')
  })
})
