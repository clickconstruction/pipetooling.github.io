import { describe, expect, it } from 'vitest'
import { coverageCountWords, coverageMatterWords, parseFirmCoverage, shapeFirmCoverage } from './legalFirmCoverage'

const FIRMS = [
  { id: 'f-snell', name: 'Snell Law Firm', active: true, created_at: '2026-01-01T00:00:00Z' },
  { id: 'f-austin', name: 'Austin Collections', active: true, created_at: '2026-06-01T00:00:00Z' },
  { id: 'f-old', name: 'Retired & Gone', active: false, created_at: '2025-01-01T00:00:00Z' },
]

describe('shapeFirmCoverage', () => {
  it('keeps active firms oldest first, with their live counties sorted and their matter counts', () => {
    const out = shapeFirmCoverage({
      firms: [FIRMS[1]!, FIRMS[0]!, FIRMS[2]!],
      countyRows: [
        { firm_id: 'f-snell', county: 'Comal', until: null },
        { firm_id: 'f-snell', county: 'Bexar', until: null },
        { firm_id: 'f-snell', county: 'Hays', until: '2026-10-01T00:00:00Z' },
        { firm_id: 'f-austin', county: 'Travis', until: null },
        { firm_id: 'f-old', county: 'Potter', until: null },
        { firm_id: 'f-austin', county: '  ', until: null },
      ],
      matters: [
        { id: 'm1', firm_id: 'f-snell' },
        { id: 'm2', firm_id: 'f-snell' },
        { id: 'm3', firm_id: 'f-austin' },
        { id: 'm4', firm_id: 'f-old' },
      ],
      countyOfMatter: new Map([
        ['m1', 'Bexar'],
        ['m2', 'Bexar'],
        ['m3', 'Travis'],
        ['m4', null],
      ]),
    })
    expect(out.firms.map((f) => f.id)).toEqual(['f-snell', 'f-austin'])
    expect(out.firms[0]).toEqual({ id: 'f-snell', name: 'Snell Law Firm', createdAt: '2026-01-01T00:00:00Z', counties: ['Bexar', 'Comal'], matterCount: 2 })
    expect(out.firms[1]!.counties).toEqual(['Travis'])
    expect(out.firms[1]!.matterCount).toBe(1)
    // The retired firm is gone; its matter still counts in no county (its records named none).
    expect(out.countyCounts).toEqual({ Bexar: 2, Travis: 1 })
  })

  it('counts a county even when no live row covers it, and a firm with nothing stays listed', () => {
    const out = shapeFirmCoverage({
      firms: [FIRMS[0]!],
      countyRows: [],
      matters: [{ id: 'm1', firm_id: 'f-snell' }],
      countyOfMatter: new Map([['m1', 'Potter']]),
    })
    expect(out.firms).toEqual([{ id: 'f-snell', name: 'Snell Law Firm', createdAt: '2026-01-01T00:00:00Z', counties: [], matterCount: 1 }])
    expect(out.countyCounts).toEqual({ Potter: 1 })
  })
})

describe('parseFirmCoverage', () => {
  it('round-trips what the function shapes', () => {
    const shaped = shapeFirmCoverage({
      firms: FIRMS,
      countyRows: [{ firm_id: 'f-snell', county: 'Bexar', until: null }],
      matters: [{ id: 'm1', firm_id: 'f-snell' }],
      countyOfMatter: new Map([['m1', 'Bexar']]),
    })
    expect(parseFirmCoverage(JSON.parse(JSON.stringify(shaped)))).toEqual(shaped)
  })

  it('answers null on an older function or a foreign shape, and drops what it cannot read', () => {
    expect(parseFirmCoverage(undefined)).toBeNull()
    expect(parseFirmCoverage(null)).toBeNull()
    expect(parseFirmCoverage({})).toBeNull()
    expect(parseFirmCoverage({ firms: 'no' })).toBeNull()
    const out = parseFirmCoverage({
      firms: [{ id: 'f1', name: 'A', counties: ['Bexar', 7], matterCount: 2.9 }, { id: 9 }, 'junk'],
      countyCounts: { Bexar: 2, Travis: -1, Hays: 'two' },
    })
    expect(out).toEqual({ firms: [{ id: 'f1', name: 'A', createdAt: null, counties: ['Bexar'], matterCount: 2 }], countyCounts: { Bexar: 2 } })
  })
})

describe('the words', () => {
  it('say the counts plainly', () => {
    expect(coverageMatterWords(0)).toBe('No matters yet')
    expect(coverageMatterWords(1)).toBe('1 matter with the firm')
    expect(coverageMatterWords(3)).toBe('3 matters with the firm')
    expect(coverageCountWords(0)).toBe('No cases today')
    expect(coverageCountWords(1)).toBe('1 case')
    expect(coverageCountWords(5)).toBe('5 cases')
  })
})
