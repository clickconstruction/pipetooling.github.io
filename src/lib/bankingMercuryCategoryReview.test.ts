import { describe, it, expect } from 'vitest'
import {
  buildCategoryReviewEntries,
  sortCategoryReviewEntries,
  totalsForCategoryReviewEntries,
  type CategoryReviewMercuryTxRow,
} from './bankingMercuryCategoryReview'
import {
  USER_REVIEW_UNLABELED_COL_KEY,
  type UserReviewLabelRow,
} from './bankingMercuryUserReviewPivot'

function tx(id: string, amount: number): CategoryReviewMercuryTxRow {
  return { id, amount }
}

function lbl(id: string, name: string, sort: number, defaultKey: string | null = null): UserReviewLabelRow {
  return { id, name, sort_order: sort, default_key: defaultKey }
}

const ALL_LABELS: UserReviewLabelRow[] = [
  lbl('lFuel', 'Fuel / Gas', 30, 'fuel_gas'),
  lbl('lCogs', 'COGS', 10, 'cogs_part_iii'),
  lbl('lOffice', 'Office', 20, null),
]

describe('buildCategoryReviewEntries', () => {
  it('aggregates count + totalAmount per category and preserves all label columns by default', () => {
    const entries = buildCategoryReviewEntries({
      transactions: [
        tx('t1', -100),
        tx('t2', -200),
        tx('t3', -50),
      ],
      labelIdByTxId: new Map<string, string | null>([
        ['t1', 'lFuel'],
        ['t2', 'lFuel'],
        ['t3', 'lCogs'],
      ]),
      allLabels: ALL_LABELS,
    })
    expect(entries.map((e) => e.displayName)).toEqual(['COGS', 'Office', 'Fuel / Gas'])
    const fuel = entries.find((e) => e.colKey === 'l:lFuel')!
    expect(fuel.count).toBe(2)
    expect(fuel.totalAmount).toBe(-300)
    expect(fuel.txIds).toEqual(['t1', 't2'])
    const office = entries.find((e) => e.colKey === 'l:lOffice')!
    expect(office.count).toBe(0)
    expect(office.totalAmount).toBe(0)
    expect(office.txIds).toEqual([])
  })

  it('omits empty categories when hideEmptyCategories is true', () => {
    const entries = buildCategoryReviewEntries({
      transactions: [tx('t1', -50)],
      labelIdByTxId: new Map<string, string | null>([['t1', 'lFuel']]),
      allLabels: ALL_LABELS,
      hideEmptyCategories: true,
    })
    expect(entries.map((e) => e.displayName)).toEqual(['Fuel / Gas'])
  })

  it('adds the Unlabeled bucket only when there is at least one unlabeled tx', () => {
    const noneUnlabeled = buildCategoryReviewEntries({
      transactions: [tx('t1', -50)],
      labelIdByTxId: new Map<string, string | null>([['t1', 'lFuel']]),
      allLabels: ALL_LABELS,
    })
    expect(noneUnlabeled.some((e) => e.colKey === USER_REVIEW_UNLABELED_COL_KEY)).toBe(false)

    const someUnlabeled = buildCategoryReviewEntries({
      transactions: [tx('t1', -10), tx('t2', -20)],
      labelIdByTxId: new Map<string, string | null>([
        ['t1', null],
        ['t2', 'lFuel'],
      ]),
      allLabels: ALL_LABELS,
    })
    const unlabeled = someUnlabeled.find((e) => e.colKey === USER_REVIEW_UNLABELED_COL_KEY)
    expect(unlabeled).toBeTruthy()
    expect(unlabeled?.count).toBe(1)
    expect(unlabeled?.totalAmount).toBe(-10)
    expect(unlabeled?.isUnlabeled).toBe(true)
  })

  it('keeps Unlabeled last in category_order even when sort_order would otherwise rank it elsewhere', () => {
    const entries = buildCategoryReviewEntries({
      transactions: [tx('t1', -10), tx('t2', -20)],
      labelIdByTxId: new Map<string, string | null>([
        ['t1', null],
        ['t2', 'lCogs'],
      ]),
      allLabels: ALL_LABELS,
      hideEmptyCategories: true,
    })
    expect(entries[entries.length - 1]?.colKey).toBe(USER_REVIEW_UNLABELED_COL_KEY)
  })

  it('falls back to Unknown label when the assignment points at a missing label id', () => {
    const entries = buildCategoryReviewEntries({
      transactions: [tx('t1', -42)],
      labelIdByTxId: new Map<string, string | null>([['t1', 'gone']]),
      allLabels: ALL_LABELS,
      hideEmptyCategories: true,
    })
    expect(entries).toHaveLength(1)
    expect(entries[0]!.displayName).toBe('Unknown label')
    expect(entries[0]!.labelId).toBe('gone')
  })

  it('coerces non-finite amounts to 0', () => {
    const entries = buildCategoryReviewEntries({
      transactions: [tx('t1', Number.NaN)],
      labelIdByTxId: new Map<string, string | null>([['t1', 'lFuel']]),
      allLabels: ALL_LABELS,
      hideEmptyCategories: true,
    })
    expect(entries[0]!.totalAmount).toBe(0)
    expect(entries[0]!.count).toBe(1)
  })

  it('returns empty array when there are no transactions and hideEmptyCategories is true', () => {
    const entries = buildCategoryReviewEntries({
      transactions: [],
      labelIdByTxId: new Map(),
      allLabels: ALL_LABELS,
      hideEmptyCategories: true,
    })
    expect(entries).toEqual([])
  })
})

describe('sortCategoryReviewEntries', () => {
  function rawEntries() {
    return buildCategoryReviewEntries({
      transactions: [
        tx('t1', -300), // Fuel
        tx('t2', -200), // Fuel
        tx('t3', -50), // COGS
        tx('t4', -25), // unlabeled
      ],
      labelIdByTxId: new Map<string, string | null>([
        ['t1', 'lFuel'],
        ['t2', 'lFuel'],
        ['t3', 'lCogs'],
        ['t4', null],
      ]),
      allLabels: ALL_LABELS,
    })
  }

  it('name_asc sorts alphabetically with Unlabeled last', () => {
    const e = sortCategoryReviewEntries(rawEntries(), 'name_asc')
    expect(e.map((x) => x.displayName)).toEqual(['COGS', 'Fuel / Gas', 'Office', 'Unlabeled'])
  })

  it('amount_desc puts the most-positive total first (least-negative since signs match Mercury); Unlabeled last', () => {
    const e = sortCategoryReviewEntries(rawEntries(), 'amount_desc')
    // 0 (Office) > -50 (COGS) > -500 (Fuel); Unlabeled (-25) pinned last regardless
    expect(e.map((x) => x.displayName)).toEqual(['Office', 'COGS', 'Fuel / Gas', 'Unlabeled'])
  })

  it('amount_abs_desc puts the largest absolute total first; Unlabeled last', () => {
    const e = sortCategoryReviewEntries(rawEntries(), 'amount_abs_desc')
    expect(e.map((x) => x.displayName)).toEqual(['Fuel / Gas', 'COGS', 'Office', 'Unlabeled'])
  })

  it('count_desc puts the busiest category first; Unlabeled last', () => {
    const e = sortCategoryReviewEntries(rawEntries(), 'count_desc')
    expect(e.map((x) => x.displayName)).toEqual(['Fuel / Gas', 'COGS', 'Office', 'Unlabeled'])
  })

  it('category_order uses canonical sort_order ascending with Unlabeled last', () => {
    const e = sortCategoryReviewEntries(rawEntries(), 'category_order')
    expect(e.map((x) => x.displayName)).toEqual(['COGS', 'Office', 'Fuel / Gas', 'Unlabeled'])
  })
})

describe('totalsForCategoryReviewEntries', () => {
  it('sums count and totalAmount across all entries', () => {
    const entries = buildCategoryReviewEntries({
      transactions: [tx('t1', -100), tx('t2', -200), tx('t3', -50)],
      labelIdByTxId: new Map<string, string | null>([
        ['t1', 'lFuel'],
        ['t2', 'lFuel'],
        ['t3', 'lCogs'],
      ]),
      allLabels: ALL_LABELS,
      hideEmptyCategories: true,
    })
    expect(totalsForCategoryReviewEntries(entries)).toEqual({ count: 3, totalAmount: -350 })
  })

  it('returns zeros for an empty list', () => {
    expect(totalsForCategoryReviewEntries([])).toEqual({ count: 0, totalAmount: 0 })
  })
})
