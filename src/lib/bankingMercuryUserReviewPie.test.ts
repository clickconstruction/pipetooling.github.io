import { describe, expect, it } from 'vitest'
import {
  buildUserReviewPieData,
  magnitudeForDirection,
  PIE_OTHER_KEY,
  type BuildUserReviewPieArgs,
} from './bankingMercuryUserReviewPie'
import type { UserReviewLabelRow } from './bankingMercuryUserReviewPivot'

const labels: UserReviewLabelRow[] = [
  { id: 'lFuel', name: 'Fuel', default_key: null, sort_order: 1 },
  { id: 'lMat', name: 'Materials', default_key: null, sort_order: 2 },
]

// tx t1: Malachi / Fuel / -100 (out)
// tx t2: Malachi / Materials / -40 (out)
// tx t3: Trace / Fuel / -25 (out)
// tx t4: Malachi / Fuel / +200 (in, a refund)
function baseArgs(direction: 'out' | 'in', topN?: number): BuildUserReviewPieArgs {
  return {
    transactions: [
      { id: 't1', amount: -100 },
      { id: 't2', amount: -40 },
      { id: 't3', amount: -25 },
      { id: 't4', amount: 200 },
    ],
    userIdByTxId: new Map([
      ['t1', 'uMal'],
      ['t2', 'uMal'],
      ['t3', 'uTrace'],
      ['t4', 'uMal'],
    ]),
    personIdByTxId: new Map(),
    userNameById: { uMal: 'Malachi', uTrace: 'Trace' },
    personNameById: {},
    labelIdByTxId: new Map([
      ['t1', 'lFuel'],
      ['t2', 'lMat'],
      ['t3', 'lFuel'],
      ['t4', 'lFuel'],
    ]),
    allLabels: labels,
    direction,
    topN,
  }
}

describe('magnitudeForDirection', () => {
  it('out = magnitude of negatives only', () => {
    expect(magnitudeForDirection(-100, 'out')).toBe(100)
    expect(magnitudeForDirection(200, 'out')).toBe(0)
  })
  it('in = magnitude of positives only', () => {
    expect(magnitudeForDirection(200, 'in')).toBe(200)
    expect(magnitudeForDirection(-100, 'in')).toBe(0)
  })
})

describe('buildUserReviewPieData — spending (out)', () => {
  const d = buildUserReviewPieData(baseArgs('out'))

  it('groups by person with correct totals (excludes the +200 inflow)', () => {
    expect(d.grandTotal).toBe(165)
    const byKey = Object.fromEntries(d.personSlices.map((s) => [s.name, s.value]))
    expect(byKey).toEqual({ Malachi: 140, Trace: 25 })
    // top-level person slices are drillable (personKey set, no categoryKey)
    const mal = d.personSlices.find((s) => s.name === 'Malachi')!
    expect(mal.personKey).toBe('u:uMal')
    expect(mal.categoryKey).toBeUndefined()
  })

  it('groups by category', () => {
    const byKey = Object.fromEntries(d.categorySlices.map((s) => [s.name, s.value]))
    expect(byKey).toEqual({ Fuel: 125, Materials: 40 })
  })

  it('drills a person into categories with leaf keys for the modal', () => {
    const mal = d.drillByPerson.get('u:uMal')!
    expect(Object.fromEntries(mal.map((s) => [s.name, s.value]))).toEqual({ Fuel: 100, Materials: 40 })
    const fuel = mal.find((s) => s.name === 'Fuel')!
    expect(fuel.personKey).toBe('u:uMal')
    expect(fuel.categoryKey).toBe('l:lFuel') // leaf → opens cell modal
  })

  it('drills a category into people', () => {
    const fuel = d.drillByCategory.get('l:lFuel')!
    expect(Object.fromEntries(fuel.map((s) => [s.name, s.value]))).toEqual({ Malachi: 100, Trace: 25 })
  })
})

describe('buildUserReviewPieData — income (in)', () => {
  it('counts only positive amounts', () => {
    const d = buildUserReviewPieData(baseArgs('in'))
    expect(d.grandTotal).toBe(200)
    expect(d.personSlices).toHaveLength(1)
    expect(d.personSlices[0]!.name).toBe('Malachi')
    expect(d.personSlices[0]!.value).toBe(200)
  })
})

describe('internal transfers are excluded', () => {
  it('drops transactions with kind=internalTransfer', () => {
    const d = buildUserReviewPieData({
      ...baseArgs('out'),
      transactions: [
        { id: 't1', amount: -100, kind: 'debitCard' },
        { id: 'xfer', amount: -500, kind: 'internalTransfer' },
      ],
    })
    expect(d.grandTotal).toBe(100) // the -500 transfer is excluded
  })

  it('drops transactions categorized as Internal Transfers (by label default_key)', () => {
    const d = buildUserReviewPieData({
      transactions: [
        { id: 't1', amount: -100 },
        { id: 'xfer', amount: -500 },
      ],
      userIdByTxId: new Map([
        ['t1', 'uMal'],
        ['xfer', 'uMal'],
      ]),
      personIdByTxId: new Map(),
      userNameById: { uMal: 'Malachi' },
      personNameById: {},
      labelIdByTxId: new Map([
        ['t1', 'lFuel'],
        ['xfer', 'lIT'],
      ]),
      allLabels: [
        ...labels,
        { id: 'lIT', name: 'Internal Transfers', default_key: 'internal_transfers', sort_order: 9 },
      ],
      direction: 'out',
    })
    expect(d.grandTotal).toBe(100)
    expect(d.categorySlices.map((s) => s.name)).not.toContain('Internal Transfers')
  })
})

describe('unassigned / unlabeled buckets', () => {
  it('falls back to Unassigned / Unlabeled', () => {
    const d = buildUserReviewPieData({
      transactions: [{ id: 'x', amount: -50 }],
      userIdByTxId: new Map([['x', null]]),
      personIdByTxId: new Map([['x', null]]),
      userNameById: {},
      personNameById: {},
      labelIdByTxId: new Map([['x', null]]),
      allLabels: labels,
      direction: 'out',
    })
    expect(d.personSlices[0]!.name).toBe('Unassigned')
    expect(d.categorySlices[0]!.name).toBe('Unlabeled')
  })
})

describe('top-N + Other', () => {
  it('collapses the tail beyond topN into a non-drillable Other slice', () => {
    const txs = Array.from({ length: 5 }, (_, i) => ({ id: `t${i}`, amount: -(10 - i) }))
    const d = buildUserReviewPieData({
      transactions: txs,
      userIdByTxId: new Map(txs.map((t, i) => [t.id, `u${i}`])),
      personIdByTxId: new Map(),
      userNameById: Object.fromEntries(txs.map((_, i) => [`u${i}`, `P${i}`])),
      personNameById: {},
      labelIdByTxId: new Map(txs.map((t) => [t.id, 'lFuel'])),
      allLabels: labels,
      direction: 'out',
      topN: 3,
    })
    expect(d.personSlices).toHaveLength(4) // 3 + Other
    const other = d.personSlices.find((s) => s.key === PIE_OTHER_KEY)!
    // magnitudes 10,9,8,7,6 → top3 = 10,9,8; tail = 7+6 = 13
    expect(other.value).toBe(13)
    expect(other.personKey).toBeUndefined() // not drillable
  })

  it('returns empty for no matching activity', () => {
    const d = buildUserReviewPieData(baseArgs('in', 3))
    // only one inflow exists; switch to a case with none
    const none = buildUserReviewPieData({ ...baseArgs('out'), transactions: [{ id: 'p', amount: 200 }] })
    expect(none.personSlices).toEqual([])
    expect(none.grandTotal).toBe(0)
    expect(d.grandTotal).toBe(200)
  })
})
