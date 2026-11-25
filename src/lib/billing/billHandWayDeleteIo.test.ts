import { beforeEach, describe, expect, it, vi } from 'vitest'

/** What the database answers each statement in turn, and every call each statement made on its query, in order. */
const db = vi.hoisted(() => ({
  answers: [] as Array<{ data: unknown; error: unknown; count?: number | null }>,
  statements: [] as Array<{ table: string; calls: Array<[string, unknown[]]> }>,
}))

vi.mock('../supabase', () => {
  const builder = (table: string) => {
    const statement = { table, calls: [] as Array<[string, unknown[]]> }
    db.statements.push(statement)
    const b: Record<string, unknown> = new Proxy(
      {},
      {
        get: (_t, op: string) => {
          if (op === 'then') {
            return (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(db.answers.shift() ?? { data: null, error: null }).then(resolve, reject)
          }
          return (...args: unknown[]) => {
            statement.calls.push([op, args])
            return b
          }
        },
      },
    )
    return b
  }
  return { supabase: { from: (table: string) => builder(table) } }
})

import type { BillHandWay } from './billHandWays'
import { countBillHandWayRecords, deleteBillHandWayNobodyUsed } from './billHandWayDeleteIo'

const way = (over: Partial<BillHandWay> = {}): BillHandWay => ({
  id: 'w-1',
  key: 'w_0123456789',
  label: 'ZZ Test portal upload',
  sentHow: 'other',
  sortOrder: 5,
  retiredAtIso: '2026-11-24T18:00:00.000Z',
  retiredByName: 'Priya',
  createdByName: 'Priya',
  createdAtIso: '2026-11-24T17:00:00.000Z',
  ...over,
})

beforeEach(() => {
  db.answers.length = 0
  db.statements.length = 0
})

describe('countBillHandWayRecords', () => {
  it('counts the by-hand records that carry the way’s key', async () => {
    db.answers.push({ data: [{ id: 's1' }], error: null, count: 2 })
    expect(await countBillHandWayRecords('w_0123456789')).toBe(2)
    expect(db.statements[0]?.table).toBe('sent_documents')
    expect(db.statements[0]?.calls).toEqual([
      ['select', ['id', { count: 'exact' }]],
      ['eq', ['kind', 'bill_by_hand']],
      ['eq', ['source_snapshot->>how', 'w_0123456789']],
      ['limit', [1]],
    ])
  })
  it('throws when the read fails or answers no count', async () => {
    db.answers.push({ data: null, error: { message: 'no signal' } })
    await expect(countBillHandWayRecords('w_0123456789')).rejects.toEqual({ message: 'no signal' })
    db.answers.push({ data: [], error: null, count: null })
    await expect(countBillHandWayRecords('w_0123456789')).rejects.toThrow(/could not be counted/)
  })
})

describe('deleteBillHandWayNobodyUsed', () => {
  it('counts, then deletes the one row, and only while it is taken off', async () => {
    db.answers.push({ data: [], error: null, count: 0 }, { data: [{ id: 'w-1' }], error: null })
    await deleteBillHandWayNobodyUsed(way())
    expect(db.statements.map((s) => s.table)).toEqual(['sent_documents', 'bill_hand_ways'])
    expect(db.statements[1]?.calls).toEqual([
      ['delete', []],
      ['eq', ['id', 'w-1']],
      ['not', ['retired_at', 'is', null]],
      ['select', ['id']],
    ])
  })
  it('refuses a way a bill was recorded with, and deletes nothing', async () => {
    db.answers.push({ data: [{ id: 's1' }], error: null, count: 1 })
    await expect(deleteBillHandWayNobodyUsed(way())).rejects.toThrow('1 bill was recorded with this way. It stays.')
    expect(db.statements.map((s) => s.table)).toEqual(['sent_documents'])
  })
  it('refuses a way that is not a test way, or one still on the list, before anything is read', async () => {
    await expect(deleteBillHandWayNobodyUsed(way({ label: 'Faxed' }))).rejects.toThrow(/must start with ZZ/)
    await expect(deleteBillHandWayNobodyUsed(way({ retiredAtIso: null }))).rejects.toThrow('Take this way off the list first.')
    expect(db.statements).toEqual([])
  })
  it('says so when the delete reaches no row: another role, or a way brought back meanwhile', async () => {
    db.answers.push({ data: [], error: null, count: 0 }, { data: [], error: null })
    await expect(deleteBillHandWayNobodyUsed(way())).rejects.toThrow(/was not deleted/)
  })
  it('deletes nothing when the count cannot be read', async () => {
    db.answers.push({ data: null, error: { message: 'no signal' } })
    await expect(deleteBillHandWayNobodyUsed(way())).rejects.toEqual({ message: 'no signal' })
    expect(db.statements.map((s) => s.table)).toEqual(['sent_documents'])
  })
})
