import { describe, expect, it } from 'vitest'

import {
  compareTakeoffs,
  parseRow,
  parseSizeIn,
  scopeMatchCheck,
} from './twinScorecard'

// Real rows from reference b201 (BT-16, AISD Garcia MS).
const GARCIA_REF = [
  { fixture: 'EWC-1', count: 1 },
  { fixture: 'L1A', count: 1 },
  { fixture: 'SK-1', count: 3 },
  { fixture: 'WC-1A', count: 1 },
  { fixture: 'IMB', count: 1 },
  { fixture: 'EWH', count: 2 },
  { fixture: 'ft of 3in Vent', count: 12.6 },
  { fixture: 'ft of 2in Vent', count: 28.9 },
  { fixture: 'ft of 4in Sewer', count: 11.1 },
  { fixture: 'ft of 3/4in DHW', count: 71.4 },
  { fixture: 'ft of 1 1/2IN G', count: 41.1 },
  { fixture: 'ft of 2 1/2IN GAS', count: 12.0 },
  { fixture: '2IN 90 CAST IRON', count: 18 },
  { fixture: '2 1/2 gas 90', count: 3 },
  { fixture: 'paint exposed pipes - labor', count: 1 },
]

describe('parseSizeIn', () => {
  it('parses whole, fractional, and mixed sizes', () => {
    expect(parseSizeIn('3IN WASTE')).toBe(3)
    expect(parseSizeIn('3/4in DHW')).toBe(0.75)
    expect(parseSizeIn('1 1/2IN G')).toBe(1.5)
    expect(parseSizeIn('2 1/2 gas 90')).toBe(2.5)
    expect(parseSizeIn('no size here')).toBeNull()
  })
})

describe('parseRow', () => {
  it('classifies fixture tags including suffixed and bare tags', () => {
    expect(parseRow('SK-1', 3)).toMatchObject({ kind: 'fixture', tag: 'SK1' })
    expect(parseRow('WC-1A', 1)).toMatchObject({ kind: 'fixture', tag: 'WC1A' })
    expect(parseRow('L1A', 1)).toMatchObject({ kind: 'fixture', tag: 'L1A' })
    expect(parseRow('IMB', 1)).toMatchObject({ kind: 'fixture', tag: 'IMB' })
  })

  it('classifies footage rows with system and size', () => {
    expect(parseRow('ft of 3in Vent', 12.6)).toMatchObject({
      kind: 'footage', system: 'vent', sizeIn: 3, feet: 12.6,
    })
    expect(parseRow('ft of 3/4in DHW', 71.4)).toMatchObject({
      kind: 'footage', system: 'water', sizeIn: 0.75,
    })
    expect(parseRow('ft of 2 1/2IN GAS', 12)).toMatchObject({
      kind: 'footage', system: 'gas', sizeIn: 2.5,
    })
    expect(parseRow('ft of 2IN NO HUB CAST IRON', 710.3)).toMatchObject({
      kind: 'footage', system: 'waste',
    })
  })

  it('classifies fittings and leaves prose as other', () => {
    expect(parseRow('2IN 90 CAST IRON', 18)).toMatchObject({ kind: 'fitting', system: 'waste' })
    expect(parseRow('2 1/2 gas 90', 3)).toMatchObject({ kind: 'fitting', system: 'gas' })
    expect(parseRow('paint exposed pipes - labor', 1)).toMatchObject({ kind: 'other' })
    expect(parseRow('demo wh prepare for new', 2)).toMatchObject({ kind: 'other' })
  })
})

describe('scopeMatchCheck', () => {
  it('passes when the set carries the reference tags (BT-16 shape)', () => {
    const result = scopeMatchCheck(GARCIA_REF, ['SK1', 'EWC-1', 'L1A', 'WC-1A', 'IMB', 'EWH', 'FD1'])
    expect(result.verdict).toBe('pass')
    expect(result.matchRate).toBe(1)
  })

  it('fails when the reference fixtures are absent from the set (BT-15 shape)', () => {
    // Wendi's TSAOG fit-out tags vs a core/shell set with none of them.
    const tsaogRef = [
      { fixture: 'SK-2', count: 8 },
      { fixture: 'WC-1', count: 6 },
      { fixture: 'LV-2', count: 2 },
      { fixture: 'UR-1', count: 2 },
      { fixture: 'EWC-1', count: 1 },
    ]
    const result = scopeMatchCheck(tsaogRef, ['G3', 'G6', 'DSN1'])
    expect(result.verdict).toBe('fail')
    expect(result.missingFromSet).toContain('SK2')
  })

  it('returns unknown with no fixture tags to judge by', () => {
    const result = scopeMatchCheck([{ fixture: 'ft of DEMO LINE', count: 181 }], [])
    expect(result.verdict).toBe('unknown')
  })
})

describe('compareTakeoffs', () => {
  it('produces per-tag deltas and footage ratios (BT-16 shape)', () => {
    const twin = [
      { name: 'SK1', count: 2 },          // twin missed one SK-1
      { name: 'EWC1', count: 1 },
      { name: 'L1A', count: 1 },
      { name: 'IMB', count: 1 },
      { name: 'EWH', count: 2 },
      // twin missed WC-1A entirely
      { name: 'ft of 2in Vent', count: 30 },
      { name: 'ft of 3in Vent', count: 12 },
      { name: 'ft of 1 1/2IN G', count: 90 },
    ]
    const card = compareTakeoffs(GARCIA_REF, twin, ['SK1', 'EWC1', 'L1A', 'WC1A', 'IMB', 'EWH'])

    expect(card.scopeMatch.verdict).toBe('pass')
    const wc = card.fixtures.find((f) => f.tag === 'WC1A')
    expect(wc).toMatchObject({ ref: 1, twin: 0, delta: -1 })
    const sk = card.fixtures.find((f) => f.tag === 'SK1')
    expect(sk).toMatchObject({ ref: 3, twin: 2, delta: -1 })
    // matched 7 of 9 reference fixtures
    expect(card.fixtureAccuracy).toBeCloseTo(7 / 9, 5)

    const vent = card.footage.find((f) => f.system === 'vent')
    expect(vent?.refFt).toBeCloseTo(41.5, 5)
    expect(vent?.ratio).toBeCloseTo(42 / 41.5, 3)
    const gas = card.footage.find((f) => f.system === 'gas')
    expect(gas?.refFt).toBeCloseTo(53.1, 5)

    expect(card.unmatchedRef).toContain('paint exposed pipes - labor')
  })
})
