import { describe, expect, it } from 'vitest'
import type { Database } from '../types/database'
import { countSortingUnmatched, mercuryRowIncompleteForSorting } from './bankingSortingCounts'
import { buildMercuryRelationMaps } from './mercuryRelationMaps'

type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']

function tx(id: string): MercuryTxRow {
  return { id } as unknown as MercuryTxRow
}

describe('countSortingUnmatched (the User Sort headline)', () => {
  it('counts from complete relation maps — a row with splits and a person is matched', () => {
    const t1 = tx('t1')
    const t2 = tx('t2')
    const rows = [t1, t2, tx('t3'), tx('t4')]
    const maps = buildMercuryRelationMaps(
      [
        { mercury_transaction_id: 't1', job_id: 'jA', amount: -10, note: null },
        { mercury_transaction_id: 't3', job_id: 'jA', amount: -10, note: null },
      ],
      [
        { mercury_transaction_id: 't1', person_id: null, user_id: 'u1' },
        { mercury_transaction_id: 't2', person_id: 'p1', user_id: null },
      ],
      rows.map((r) => r.id),
    )
    expect(countSortingUnmatched(rows, maps.personIdByTxId, maps.userIdByTxId, maps.allocationsByTxId)).toEqual({
      withoutPerson: 2, // t3, t4
      withoutJobSplit: 2, // t2, t4
    })
    expect(mercuryRowIncompleteForSorting(t1, maps.personIdByTxId, maps.userIdByTxId, maps.allocationsByTxId)).toBe(false)
    expect(mercuryRowIncompleteForSorting(t2, maps.personIdByTxId, maps.userIdByTxId, maps.allocationsByTxId)).toBe(true)
  })

  it('a truncated relation read inflates the headline; a complete one does not (J33-N1 shape)', () => {
    const rows = Array.from({ length: 2060 }, (_, i) => tx(`t${i}`))
    const allAllocs = rows.map((r) => ({ mercury_transaction_id: r.id, job_id: 'j', amount: -1, note: null }))
    const allAttrs = rows.map((r) => ({ mercury_transaction_id: r.id, person_id: null, user_id: 'u' }))
    const ids = rows.map((r) => r.id)

    const truncated = buildMercuryRelationMaps(allAllocs.slice(0, 1000), allAttrs.slice(0, 1000), ids)
    expect(countSortingUnmatched(rows, truncated.personIdByTxId, truncated.userIdByTxId, truncated.allocationsByTxId)).toEqual({
      withoutPerson: 1060,
      withoutJobSplit: 1060,
    })

    const complete = buildMercuryRelationMaps(allAllocs, allAttrs, ids)
    expect(countSortingUnmatched(rows, complete.personIdByTxId, complete.userIdByTxId, complete.allocationsByTxId)).toEqual({
      withoutPerson: 0,
      withoutJobSplit: 0,
    })
  })

  it('counts only the rows it is given (the filtered slice), not every map entry', () => {
    const maps = buildMercuryRelationMaps([], [], ['t1', 't2', 't3'])
    expect(countSortingUnmatched([tx('t1')], maps.personIdByTxId, maps.userIdByTxId, maps.allocationsByTxId)).toEqual({
      withoutPerson: 1,
      withoutJobSplit: 1,
    })
  })
})
