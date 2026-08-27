import { describe, expect, it } from 'vitest'
import { filterPriceBookEntries, searchPriceBookEntries, seedPricingAssignmentSearch } from './priceBookAssignSearch'
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

// v2.2397 (Wendi): exact mode + highlight ranges + the header's word diagnostics.
describe('searchPriceBookEntries', () => {
  const book = [
    '2IN 90 PVC',
    '2IN 90 CAST IRON',
    '1 1/2IN 90 COPPER',
    '3IN 90 PVC',
    '4IN 90 CAST IRON',
    'FEET OF 1 1/2IN COPPER',
  ].map((name, i) => ({ id: String(i), name }))
  const run = (search: string, mode: 'similar' | 'exact', cap = Infinity) =>
    searchPriceBookEntries(book, (e) => e.name, search, mode, cap)

  it("similar mode ranks Wendi's search with all-word matches first", () => {
    const res = run('2IN 90 pex', 'similar')
    expect(res.matches.map((m) => m.name)).toEqual([
      '1 1/2IN 90 COPPER', // «2IN» hides inside «1/2IN» + «90» — 2 hits
      '2IN 90 CAST IRON',
      '2IN 90 PVC',
      '3IN 90 PVC',
      '4IN 90 CAST IRON',
      'FEET OF 1 1/2IN COPPER',
    ])
    expect(res.unmatchedWords).toEqual(['pex'])
    expect(res.matchedWords).toEqual(['2in', '90'])
    expect(res.similarCount).toBe(6)
  })

  it('exact mode keeps only entries containing EVERY word', () => {
    const res = run('2IN 90 PVC', 'exact')
    expect(res.matches.map((m) => m.name)).toEqual(['2IN 90 PVC'])
    expect(res.unmatchedWords).toEqual([])
  })

  it('exact mode with an impossible word is empty but reports the similar count', () => {
    const res = run('2IN 90 pex', 'exact')
    expect(res.matches).toEqual([])
    expect(res.similarCount).toBe(6)
    expect(res.unmatchedWords).toEqual(['pex'])
  })

  it('ranges cover every occurrence of each matched word', () => {
    const res = run('90', 'similar')
    const pvc = res.matches.find((m) => m.name === '2IN 90 PVC')!
    expect(pvc.ranges).toEqual([[4, 6]])
    expect(pvc.name.slice(4, 6)).toBe('90')
  })

  it('overlapping word hits merge into one range', () => {
    const res = searchPriceBookEntries([{ name: '2IN NIPPLE' }], (e) => e.name, '2in in', 'similar', Infinity)
    // «2in» = [0,3), «in» = [1,3) + [7,9) («nIPple» has no in… «NIPPLE» → i at 1? name lower: '2in nipple' — 'in' at 1 and 5)
    const m = res.matches[0]!
    expect(m.ranges[0]).toEqual([0, 3])
    expect(m.ranges.every(([s, e]) => e > s)).toBe(true)
  })

  it('blank search returns entries as given (no ranges) in both modes', () => {
    for (const mode of ['similar', 'exact'] as const) {
      const res = run('  ', mode)
      expect(res.matches.map((m) => m.name)).toEqual(book.map((b) => b.name))
      expect(res.matches.every((m) => m.ranges.length === 0)).toBe(true)
    }
  })

  it('cap applies after mode filtering', () => {
    expect(run('90', 'similar', 2).matches).toHaveLength(2)
    expect(run('90 PVC', 'exact', 1).matches.map((m) => m.name)).toEqual(['2IN 90 PVC'])
  })
})
