import { describe, expect, it } from 'vitest'

import { extractBasis, extractPriceCents, extractSizes, parseVendorReply } from './parseVendorReply'

const FIXTURES = [
  { name: 'ft of 4IN WASTE', count: 752 },
  { name: 'ft of 3IN WASTE', count: 1222 },
  { name: '3/4IN 90 WATER', count: 107 },
  { name: '3/4IN T WATER', count: 50 },
  { name: 'ft of 3/4IN WATER', count: 1782 },
  { name: '4IN FD-1', count: 1 },
  { name: '3IN FD-2', count: 7 },
  { name: 'GCO', count: 2 },
  { name: 'FCO', count: 5 },
  { name: 'WC-1', count: 4 },
  { name: 'WH-1', count: 4 },
]

const SAMPLE = [
  '4" cast iron 18.90/ft',
  '3" CI 14.25',
  'viega 3/4 90s - 36.80 ea',
  '3/4 viega tees 61.20',
  'copper 3/4 soft L 31.10 per ft',
  'wc carriers no stock til Oct',
  'floor drains JR smith 2010 - 148',
  'GCO/FCO 116 each',
  'call me on the water heaters',
].join('\n')

describe('extractSizes', () => {
  it('canonicalizes fractions, mixed numbers, and inch marks', () => {
    expect(extractSizes('1 1/2" Gas')).toEqual(['1.5'])
    expect(extractSizes('3/4in 90')).toContain('0.75')
    expect(extractSizes('4" cast iron')).toContain('4')
  })
  it('ignores model-number-scale integers', () => {
    expect(extractSizes('JR smith 2010')).toEqual([])
  })
})

describe('extractBasis', () => {
  it('consumes box-of-N so the N is never a price', () => {
    const b = extractBasis('3/4 90s $368/box of 50')
    expect(b.basis).toBe('box')
    expect(b.qty).toBe(50)
    expect(extractPriceCents(b.rest)).toBe(36800)
  })
  it('reads per-ft, per-100, and each', () => {
    expect(extractBasis('18.90/ft').basis).toBe('ft')
    expect(extractBasis('copper 412 per 100').basis).toBe('per_100')
    expect(extractBasis('116 each').basis).toBe('each')
  })
})

describe('extractPriceCents', () => {
  it('prefers $-prefixed, else the last plausible number (not model numbers)', () => {
    expect(extractPriceCents('smith 2010 - 148')).toBe(14800)
    expect(extractPriceCents('$1,234.5 list, net 987.65')).toBe(123450)
    expect(extractPriceCents('no numbers here')).toBeNull()
  })
  it('never reads a size fraction or inch-marked token as the price', () => {
    expect(extractPriceCents('3/4 tees 61.20')).toBe(6120)
    expect(extractPriceCents('4" combo 12.50')).toBe(1250)
  })
})

describe('parseVendorReply', () => {
  const result = parseVendorReply(SAMPLE, FIXTURES)

  it('matches the sample reply the way the design promises', () => {
    const byRaw = new Map(result.lines.map((l) => [l.raw, l]))
    expect(byRaw.get('4" cast iron 18.90/ft')?.fixtures).toEqual(['ft of 4IN WASTE'])
    expect(byRaw.get('4" cast iron 18.90/ft')?.unitPriceEachCents).toBe(1890)
    expect(byRaw.get('3" CI 14.25')?.fixtures).toEqual(['ft of 3IN WASTE'])
    expect(byRaw.get('viega 3/4 90s - 36.80 ea')?.fixtures).toEqual(['3/4IN 90 WATER'])
    expect(byRaw.get('3/4 viega tees 61.20')?.fixtures).toEqual(['3/4IN T WATER'])
    expect(byRaw.get('GCO/FCO 116 each')?.fixtures.sort()).toEqual(['FCO', 'GCO'])
  })

  it('flags no-stock phrasing as cantSupply with no price', () => {
    const wc = result.lines.find((l) => l.raw.includes('wc carriers'))
    expect(wc?.cantSupply).toBe(true)
    expect(wc?.unitPriceEachCents).toBeNull()
    expect(wc?.fixtures).toContain('WC-1')
  })

  it('leaves unmatchable unpriced lines for the human', () => {
    const callMe = result.lines.find((l) => l.raw.includes('call me'))
    // "call me on the water heaters" mentions water heaters — matched as cantSupply to WH-1.
    expect(callMe?.cantSupply).toBe(true)
    expect(parseVendorReply('thanks, talk soon', FIXTURES).unassigned).toEqual(['thanks, talk soon'])
  })

  it('derives $/each from box and per-100 bases', () => {
    const r = parseVendorReply('3/4 viega tees $368/box of 50', FIXTURES)
    expect(r.lines[0]?.basis).toBe('box')
    expect(r.lines[0]?.basisPriceCents).toBe(36800)
    expect(r.lines[0]?.unitPriceEachCents).toBe(736)
  })

  it('size disagreement blocks a match even with keyword overlap', () => {
    const r = parseVendorReply('2" copper tees 9.99 ea', FIXTURES)
    expect(r.lines[0]?.fixtures ?? []).toEqual([])
  })

  it('flags outliers against the baseline without dropping them', () => {
    const baseline = new Map([['ft of 4in waste', 1800]])
    const r = parseVendorReply('4" cast iron 1890.00/ft', FIXTURES, baseline)
    expect(r.lines[0]?.outlier).toBe(true)
    expect(r.lines[0]?.unitPriceEachCents).toBe(189000)
  })
})
