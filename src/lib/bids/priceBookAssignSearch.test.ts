import { describe, expect, it } from 'vitest'
import { filterPriceBookEntries, seedPricingAssignmentSearch } from './priceBookAssignSearch'
import { stripCountRowUnitPrefix } from './countRowUnit'

describe('stripCountRowUnitPrefix', () => {
  it('drops every unit-prefix form', () => {
    expect(stripCountRowUnitPrefix('ft of 2" Demo Water Line')).toBe('2" Demo Water Line')
    expect(stripCountRowUnitPrefix('feet of sewer')).toBe('sewer')
    expect(stripCountRowUnitPrefix('lin. ft of 4in PVC')).toBe('4in PVC')
    expect(stripCountRowUnitPrefix('px of 1in Gas')).toBe('1in Gas')
    expect(stripCountRowUnitPrefix('sq ft of slab')).toBe('slab')
  })

  it('drops the CountTooling [Group] prefix too', () => {
    expect(stripCountRowUnitPrefix('[Underground] ft of 4IN WASTE')).toBe('4IN WASTE')
    expect(stripCountRowUnitPrefix('[Underground] WC - 1')).toBe('WC - 1')
  })

  it('leaves unprefixed names alone (FT-1 tags included)', () => {
    expect(stripCountRowUnitPrefix('112 - MOP SINK')).toBe('112 - MOP SINK')
    expect(stripCountRowUnitPrefix('FT-1')).toBe('FT-1')
    expect(stripCountRowUnitPrefix('  WC - 2  ')).toBe('WC - 2')
    expect(stripCountRowUnitPrefix('1/2" PEX PER FT')).toBe('1/2" PEX PER FT')
  })

  it('handles null/undefined/empty', () => {
    expect(stripCountRowUnitPrefix(null)).toBe('')
    expect(stripCountRowUnitPrefix(undefined)).toBe('')
    expect(stripCountRowUnitPrefix('')).toBe('')
  })
})

describe('seedPricingAssignmentSearch', () => {
  it('seeds the row name without its unit prefix', () => {
    expect(seedPricingAssignmentSearch('ft of 3/4IN WATER')).toBe('3/4IN WATER')
    expect(seedPricingAssignmentSearch('RCP-1')).toBe('RCP-1')
  })
})

describe('filterPriceBookEntries', () => {
  const book = [
    '1 1/2" PEX',
    '2 1/2" PEX',
    '2" Black Steel Pipe (Threaded)',
    '2" Schedule 80',
    'FEET OF 3/4IN COPPER',
    'Feet of 8" Schedule 40 PVC',
    'feet of water line',
  ].map((name, i) => ({ id: String(i), name }))
  const names = (search: string, cap?: number) =>
    filterPriceBookEntries(book, (e) => e.name, search, cap).map((e) => e.name)

  it('matches any word, ranking all-words matches first', () => {
    expect(names('2" Demo Water Line')).toEqual([
      'feet of water line', // water + line — most words matched
      '1 1/2" PEX', // the rest match only «2"» (as a substring) — A→Z
      '2 1/2" PEX',
      '2" Black Steel Pipe (Threaded)',
      '2" Schedule 80',
    ])
  })

  it('a single word behaves like the old substring filter', () => {
    expect(names('pex')).toEqual(['1 1/2" PEX', '2 1/2" PEX'])
    expect(names('copper')).toEqual(['FEET OF 3/4IN COPPER'])
  })

  it('all-words matches beat higher raw counts and ties break A→Z', () => {
    expect(names('schedule 80')).toEqual([
      '2" Schedule 80', // both words
      'Feet of 8" Schedule 40 PVC', // schedule + "8" substring? no — "80" not in name; schedule only
    ])
  })

  it('empty search returns entries in given order, capped', () => {
    expect(names('')).toHaveLength(7)
    expect(names('   ', 3)).toEqual(['1 1/2" PEX', '2 1/2" PEX', '2" Black Steel Pipe (Threaded)'])
  })

  it('caps ranked results and supports Infinity', () => {
    expect(names('2"', 2)).toHaveLength(2)
    expect(names('2"', Infinity)).toEqual(['1 1/2" PEX', '2 1/2" PEX', '2" Black Steel Pipe (Threaded)', '2" Schedule 80'])
  })

  it('no word matches → empty', () => {
    expect(names('galvanized')).toEqual([])
  })
})
