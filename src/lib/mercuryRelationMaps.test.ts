import { describe, expect, it } from 'vitest'
import { buildMercuryRelationMaps, splitFromAllocationRow } from './mercuryRelationMaps'

const alloc = (tx: string, job: string, amount: number | string, note: string | null = null) => ({
  mercury_transaction_id: tx,
  job_id: job,
  amount,
  note,
})
const attr = (tx: string, person_id: string | null, user_id: string | null) => ({ mercury_transaction_id: tx, person_id, user_id })

describe('splitFromAllocationRow', () => {
  it('coerces numeric strings and drops blank notes', () => {
    expect(splitFromAllocationRow(alloc('t1', 'j1', '-12.5', ''))).toEqual({ job_id: 'j1', amount: -12.5 })
    expect(splitFromAllocationRow(alloc('t1', 'j1', -3, 'fittings'))).toEqual({ job_id: 'j1', amount: -3, note: 'fittings' })
  })
})

describe('buildMercuryRelationMaps', () => {
  it('groups every split for every loaded transaction (results from chunked/paged reads)', () => {
    // Rows arrive grouped by chunk, not by transaction — the map must still gather all of them.
    const allocRows = [alloc('t1', 'jA', -10), alloc('t2', 'jB', -5), alloc('t1', 'jB', -20, 'valves'), alloc('t2', 'jC', -1)]
    const maps = buildMercuryRelationMaps(allocRows, [], ['t1', 't2', 't3'])
    expect(maps.allocationsByTxId.get('t1')).toEqual([
      { job_id: 'jA', amount: -10 },
      { job_id: 'jB', amount: -20, note: 'valves' },
    ])
    expect(maps.allocationsByTxId.get('t2')).toHaveLength(2)
    expect(maps.allocationsByTxId.has('t3')).toBe(false)
    expect([...maps.jobIds].sort()).toEqual(['jA', 'jB', 'jC'])
  })

  it('gives every loaded id an explicit null attribution and collects distinct people/users', () => {
    const maps = buildMercuryRelationMaps([], [attr('t1', 'p1', null), attr('t2', null, 'u1'), attr('t3', null, 'u1')], ['t1', 't2', 't3', 't4'])
    expect(maps.personIdByTxId.get('t1')).toBe('p1')
    expect(maps.userIdByTxId.get('t1')).toBeNull()
    expect(maps.userIdByTxId.get('t2')).toBe('u1')
    expect(maps.personIdByTxId.get('t4')).toBeNull()
    expect(maps.userIdByTxId.get('t4')).toBeNull()
    expect(maps.personIdByTxId.has('t4')).toBe(true)
    expect(maps.personIds).toEqual(['p1'])
    expect(maps.userIds).toEqual(['u1'])
  })

  it('drops relation rows for transactions that are not loaded (keeps label lookups scoped)', () => {
    const maps = buildMercuryRelationMaps([alloc('other', 'jZ', -9)], [attr('other', 'pZ', null)], ['t1'])
    expect(maps.allocationsByTxId.size).toBe(0)
    expect(maps.jobIds).toEqual([])
    expect(maps.personIds).toEqual([])
    expect(maps.personIdByTxId.get('t1')).toBeNull()
  })

  it('a complete relation read means no loaded split is missing — the J33-N1 shape', () => {
    // 2,060 allocation rows over 2,060 transactions; a 1,000-row truncated read would leave
    // 1,060 of them looking "Not split". With all rows present, none do.
    const txIds = Array.from({ length: 2060 }, (_, i) => `t${i}`)
    const allocRows = txIds.map((t, i) => alloc(t, `j${i % 7}`, -1))
    const maps = buildMercuryRelationMaps(allocRows, [], txIds)
    const notSplit = txIds.filter((t) => (maps.allocationsByTxId.get(t) ?? []).length === 0)
    expect(notSplit).toHaveLength(0)
    expect(maps.jobIds).toHaveLength(7)
  })
})
