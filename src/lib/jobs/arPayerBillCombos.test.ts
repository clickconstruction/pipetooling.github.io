import { describe, expect, it } from 'vitest'
import { findExactBillCombos, type ComboTargetSlice } from './arPayerBillCombos'

const t = (key: string, remaining: number): ComboTargetSlice => ({ key, remaining })

describe('findExactBillCombos', () => {
  it('finds the one pair that sums to the deposit (the Reliant case)', () => {
    const combos = findExactBillCombos(4091.5, [t('915', 2711.5), t('880', 1380)])
    expect(combos).toEqual([['915', '880']])
  })

  it('finds a triple among distractors', () => {
    const combos = findExactBillCombos(600, [t('a', 100), t('b', 200), t('c', 300), t('d', 450)])
    expect(combos).toEqual([['a', 'b', 'c']])
  })

  it('returns [] when a single bill already equals the deposit — that is the match chips\' job', () => {
    expect(findExactBillCombos(300, [t('exact', 300), t('a', 100), t('b', 200)])).toEqual([])
  })

  it('returns every exact combo when a few exist, fewest bills first', () => {
    // 300 = 100+200 = 50+250 — exactly two combos.
    const combos = findExactBillCombos(300, [t('a', 100), t('b', 200), t('c', 50), t('d', 250)])
    expect(combos).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('never uses more than maxSize bills', () => {
    expect(findExactBillCombos(5, [t('a', 1), t('b', 1), t('c', 1), t('d', 1), t('e', 1)])).toEqual([])
  })

  it('is cents-exact — off by a cent is no combo', () => {
    expect(findExactBillCombos(300.01, [t('a', 100), t('b', 200)])).toEqual([])
  })

  it('gives up on oversized pools and degenerate inputs', () => {
    const many = Array.from({ length: 13 }, (_, i) => t(`k${i}`, i + 1))
    expect(findExactBillCombos(25, many)).toEqual([])
    expect(findExactBillCombos(0, [t('a', 100), t('b', 200)])).toEqual([])
    expect(findExactBillCombos(100, [t('only', 100)])).toEqual([])
  })

  it('bails to [] when more than maxCombos exact sums exist (too ambiguous to suggest)', () => {
    // 2 = 1+1, six ways from four $1 bills.
    const combos = findExactBillCombos(2, [t('a', 1), t('b', 1), t('c', 1), t('d', 1)])
    expect(combos).toEqual([])
  })
})
