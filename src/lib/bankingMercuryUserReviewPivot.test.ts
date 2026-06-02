import { describe, it, expect } from 'vitest'
import {
  buildUserReviewPivot,
  USER_REVIEW_UNASSIGNED_USER_KEY,
  USER_REVIEW_UNLABELED_COL_KEY,
  resolveUserReviewColumnForTx,
  resolveUserReviewRowKeyForTx,
  userReviewPivotCellTotals,
  userReviewPivotCellTxIds,
  type UserReviewLabelRow,
  type UserReviewMercuryTxRow,
} from './bankingMercuryUserReviewPivot'

function tx(id: string, amount: number): UserReviewMercuryTxRow {
  return { id, amount }
}

function label(id: string, name: string, sort: number, defaultKey: string | null = null): UserReviewLabelRow {
  return { id, name, sort_order: sort, default_key: defaultKey }
}

describe('resolveUserReviewRowKeyForTx', () => {
  it('prefers user attribution when present', () => {
    const out = resolveUserReviewRowKeyForTx({
      txId: 't1',
      userIdByTxId: new Map([['t1', 'user-1']]),
      personIdByTxId: new Map([['t1', 'person-1']]),
      userNameById: { 'user-1': 'Alice' },
      personNameById: { 'person-1': 'Persona' },
    })
    expect(out.source).toBe('user')
    expect(out.sourceId).toBe('user-1')
    expect(out.displayName).toBe('Alice')
    expect(out.rowKey).toBe('u:user-1')
  })

  it('falls back to person when user is null', () => {
    const out = resolveUserReviewRowKeyForTx({
      txId: 't2',
      userIdByTxId: new Map([['t2', null]]),
      personIdByTxId: new Map([['t2', 'person-2']]),
      userNameById: {},
      personNameById: { 'person-2': 'Bob' },
    })
    expect(out.source).toBe('person')
    expect(out.sourceId).toBe('person-2')
    expect(out.displayName).toBe('Bob')
    expect(out.rowKey).toBe('p:person-2')
  })

  it('returns the unassigned sentinel when both are null', () => {
    const out = resolveUserReviewRowKeyForTx({
      txId: 't3',
      userIdByTxId: new Map(),
      personIdByTxId: new Map(),
      userNameById: {},
      personNameById: {},
    })
    expect(out.source).toBe('unassigned')
    expect(out.sourceId).toBeNull()
    expect(out.rowKey).toBe(USER_REVIEW_UNASSIGNED_USER_KEY)
  })

  it('keeps unknown-user fallback when the user id is missing from the name map', () => {
    const out = resolveUserReviewRowKeyForTx({
      txId: 't4',
      userIdByTxId: new Map([['t4', 'user-x']]),
      personIdByTxId: new Map(),
      userNameById: {},
      personNameById: {},
    })
    expect(out.displayName).toBe('Unknown user')
    expect(out.source).toBe('user')
  })
})

describe('resolveUserReviewColumnForTx', () => {
  it('returns the matched label column', () => {
    const labelById = new Map<string, UserReviewLabelRow>([
      ['l1', label('l1', 'Fuel / Gas', 30, 'fuel_gas')],
    ])
    const out = resolveUserReviewColumnForTx({
      txId: 'tA',
      labelIdByTxId: new Map([['tA', 'l1']]),
      labelById,
    })
    expect(out.colKey).toBe('l:l1')
    expect(out.displayName).toBe('Fuel / Gas')
    expect(out.defaultKey).toBe('fuel_gas')
    expect(out.sortOrder).toBe(30)
  })

  it('returns the Unlabeled sentinel when the tx has no assignment', () => {
    const out = resolveUserReviewColumnForTx({
      txId: 'tB',
      labelIdByTxId: new Map(),
      labelById: new Map(),
    })
    expect(out.colKey).toBe(USER_REVIEW_UNLABELED_COL_KEY)
    expect(out.labelId).toBeNull()
    expect(out.displayName).toBe('Unlabeled')
  })

  it('uses Unknown label when assignment points at a missing label', () => {
    const out = resolveUserReviewColumnForTx({
      txId: 'tC',
      labelIdByTxId: new Map([['tC', 'missing-id']]),
      labelById: new Map(),
    })
    expect(out.displayName).toBe('Unknown label')
    expect(out.labelId).toBe('missing-id')
  })
})

describe('buildUserReviewPivot', () => {
  const allLabels = [
    label('lFuel', 'Fuel / Gas', 30, 'fuel_gas'),
    label('lCogs', 'COGS', 10, 'cogs_part_iii'),
    label('lOther', 'Office', 20, null),
  ]

  it('aggregates count and totalAmount per (row, col), with row/col/grand totals', () => {
    const pivot = buildUserReviewPivot({
      transactions: [
        tx('t1', -1500),
        tx('t2', -2500),
        tx('t3', -1000),
        tx('t4', -500),
      ],
      userIdByTxId: new Map([
        ['t1', 'u1'],
        ['t2', 'u1'],
        ['t3', 'u2'],
        ['t4', null],
      ]),
      personIdByTxId: new Map(),
      userNameById: { u1: 'Alice', u2: 'Bob' },
      personNameById: {},
      labelIdByTxId: new Map([
        ['t1', 'lFuel'],
        ['t2', 'lCogs'],
        ['t3', 'lFuel'],
        ['t4', null],
      ]),
      allLabels,
    })

    // t1+t2 → Alice; t3 → Bob; t4 → unassigned (Unassigned sorts first)
    expect(pivot.rows.map((r) => r.displayName)).toEqual(['Unassigned', 'Alice', 'Bob'])

    // COGS (10) → Office (20) → Fuel (30) → Unlabeled
    expect(pivot.columns.map((c) => c.displayName)).toEqual(['COGS', 'Office', 'Fuel / Gas', 'Unlabeled'])

    expect(userReviewPivotCellTotals(pivot, 'u:u1', 'l:lFuel')).toMatchObject({ count: 1, totalAmount: -1500 })
    expect(userReviewPivotCellTotals(pivot, 'u:u1', 'l:lCogs')).toMatchObject({ count: 1, totalAmount: -2500 })
    expect(userReviewPivotCellTotals(pivot, 'u:u2', 'l:lFuel')).toMatchObject({ count: 1, totalAmount: -1000 })
    expect(userReviewPivotCellTotals(
      pivot,
      USER_REVIEW_UNASSIGNED_USER_KEY,
      USER_REVIEW_UNLABELED_COL_KEY,
    )).toMatchObject({ count: 1, totalAmount: -500 })

    expect(pivot.rowTotals.get('u:u1')).toEqual({ count: 2, totalAmount: -4000 })
    expect(pivot.colTotals.get('l:lFuel')).toEqual({ count: 2, totalAmount: -2500 })
    expect(pivot.grandTotal).toEqual({ count: 4, totalAmount: -5500 })
  })

  it('preserves the full column set when hideEmptyLabelColumns is false (default)', () => {
    const pivot = buildUserReviewPivot({
      transactions: [tx('t1', -100)],
      userIdByTxId: new Map([['t1', 'u1']]),
      personIdByTxId: new Map(),
      userNameById: { u1: 'Alice' },
      personNameById: {},
      labelIdByTxId: new Map([['t1', 'lFuel']]),
      allLabels,
    })
    expect(pivot.columns.map((c) => c.displayName)).toEqual(['COGS', 'Office', 'Fuel / Gas'])
  })

  it('omits empty label columns when hideEmptyLabelColumns is true', () => {
    const pivot = buildUserReviewPivot({
      transactions: [tx('t1', -100)],
      userIdByTxId: new Map([['t1', 'u1']]),
      personIdByTxId: new Map(),
      userNameById: { u1: 'Alice' },
      personNameById: {},
      labelIdByTxId: new Map([['t1', 'lFuel']]),
      allLabels,
      hideEmptyLabelColumns: true,
    })
    expect(pivot.columns.map((c) => c.displayName)).toEqual(['Fuel / Gas'])
  })

  it('adds the Unlabeled column only when there is at least one unlabeled tx', () => {
    const pivotWithUnlabeled = buildUserReviewPivot({
      transactions: [tx('t1', -100)],
      userIdByTxId: new Map([['t1', 'u1']]),
      personIdByTxId: new Map(),
      userNameById: { u1: 'Alice' },
      personNameById: {},
      labelIdByTxId: new Map([['t1', null]]),
      allLabels,
      hideEmptyLabelColumns: true,
    })
    expect(pivotWithUnlabeled.columns.map((c) => c.colKey)).toEqual([USER_REVIEW_UNLABELED_COL_KEY])

    const pivotAllLabeled = buildUserReviewPivot({
      transactions: [tx('t1', -100)],
      userIdByTxId: new Map([['t1', 'u1']]),
      personIdByTxId: new Map(),
      userNameById: { u1: 'Alice' },
      personNameById: {},
      labelIdByTxId: new Map([['t1', 'lFuel']]),
      allLabels,
      hideEmptyLabelColumns: true,
    })
    expect(pivotAllLabeled.columns.some((c) => c.colKey === USER_REVIEW_UNLABELED_COL_KEY)).toBe(false)
  })

  it('keeps Unassigned first in row ordering and Unlabeled last in column ordering', () => {
    const pivot = buildUserReviewPivot({
      transactions: [
        tx('t1', -100),
        tx('t2', -200),
        tx('t3', -300),
      ],
      userIdByTxId: new Map([
        ['t1', null],
        ['t2', 'u1'],
        ['t3', null],
      ]),
      personIdByTxId: new Map(),
      userNameById: { u1: 'Zelda' },
      personNameById: {},
      labelIdByTxId: new Map([
        ['t1', null],
        ['t2', 'lCogs'],
        ['t3', 'lFuel'],
      ]),
      allLabels,
    })
    expect(pivot.rows[0]?.rowKey).toBe(USER_REVIEW_UNASSIGNED_USER_KEY)
    expect(pivot.columns[pivot.columns.length - 1]?.colKey).toBe(USER_REVIEW_UNLABELED_COL_KEY)
  })

  it('userReviewPivotCellTxIds returns the original tx ids in insertion order', () => {
    const pivot = buildUserReviewPivot({
      transactions: [tx('t1', -10), tx('t2', -20), tx('t3', -30)],
      userIdByTxId: new Map([
        ['t1', 'u1'],
        ['t2', 'u1'],
        ['t3', 'u1'],
      ]),
      personIdByTxId: new Map(),
      userNameById: { u1: 'Alice' },
      personNameById: {},
      labelIdByTxId: new Map([
        ['t1', 'lFuel'],
        ['t2', 'lFuel'],
        ['t3', 'lFuel'],
      ]),
      allLabels,
    })
    expect(userReviewPivotCellTxIds(pivot, 'u:u1', 'l:lFuel')).toEqual(['t1', 't2', 't3'])
  })

  it('treats non-finite amount_cents as 0 instead of throwing', () => {
    const pivot = buildUserReviewPivot({
      transactions: [tx('t1', Number.NaN)],
      userIdByTxId: new Map([['t1', 'u1']]),
      personIdByTxId: new Map(),
      userNameById: { u1: 'Alice' },
      personNameById: {},
      labelIdByTxId: new Map([['t1', 'lFuel']]),
      allLabels,
    })
    expect(pivot.grandTotal).toEqual({ count: 1, totalAmount: 0 })
  })

  it('emits an empty pivot when there are no transactions and hideEmptyLabelColumns is true', () => {
    const pivot = buildUserReviewPivot({
      transactions: [],
      userIdByTxId: new Map(),
      personIdByTxId: new Map(),
      userNameById: {},
      personNameById: {},
      labelIdByTxId: new Map(),
      allLabels,
      hideEmptyLabelColumns: true,
    })
    expect(pivot.rows).toHaveLength(0)
    expect(pivot.columns).toHaveLength(0)
    expect(pivot.grandTotal).toEqual({ count: 0, totalAmount: 0 })
  })

  it('returns null/empty arrays for cells that do not exist', () => {
    const pivot = buildUserReviewPivot({
      transactions: [tx('t1', -100)],
      userIdByTxId: new Map([['t1', 'u1']]),
      personIdByTxId: new Map(),
      userNameById: { u1: 'Alice' },
      personNameById: {},
      labelIdByTxId: new Map([['t1', 'lFuel']]),
      allLabels,
    })
    expect(userReviewPivotCellTotals(pivot, 'u:u1', 'l:lCogs')).toBeNull()
    expect(userReviewPivotCellTxIds(pivot, 'u:u1', 'l:lCogs')).toEqual([])
  })
})
