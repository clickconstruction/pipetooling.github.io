import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SUPABASE_IN_CHUNK_SIZE } from '../supabasePaging'

// The table as a list: a read keeps the rows whose source_ids overlap the ids asked for, or fails when told to.
const db = vi.hoisted(() => ({ rows: [] as Array<{ id: string; source_ids: string[] }>, reads: [] as string[][], fail: false }))
vi.mock('../supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        overlaps: async (_col: string, ids: string[]) => {
          db.reads.push(ids)
          return db.fail ? { data: null, error: { message: 'no such table' } } : { data: db.rows.filter((r) => r.source_ids.some((s) => ids.includes(s))), error: null }
        },
      }),
    }),
  },
}))
vi.mock('../../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => PromiseLike<{ data: unknown; error: { message: string } | null }>) => {
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
}))

import { readMailPiecesBySource } from './lienMailPiecesIo'

beforeEach(() => {
  db.rows = []
  db.reads = []
  db.fail = false
})

describe('readMailPiecesBySource (v2.5532)', () => {
  it('keys the pieces by each id asked for, leaving out the other rows a piece names', async () => {
    db.rows = [
      { id: 'p1', source_ids: ['it1', 'f9'] },
      { id: 'p2', source_ids: ['it1', 'it2'] },
      { id: 'p3', source_ids: ['f7'] },
    ]
    const by = await readMailPiecesBySource(['it1', 'it2', 'it1'], 'test')
    expect(Object.keys(by).sort()).toEqual(['it1', 'it2'])
    expect(by.it1!.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(by.it2!.map((p) => p.id)).toEqual(['p2'])
    expect(db.reads).toEqual([['it1', 'it2']])
  })

  it('reads in chunks, each id from its own chunk; nothing asked, nothing read', async () => {
    const ids = Array.from({ length: SUPABASE_IN_CHUNK_SIZE + 1 }, (_, i) => `it${i}`)
    db.rows = [{ id: 'p1', source_ids: ['it0', ids[ids.length - 1]!] }]
    const by = await readMailPiecesBySource(ids, 'test')
    expect(db.reads).toHaveLength(2)
    expect(by.it0!.map((p) => p.id)).toEqual(['p1'])
    expect(by[ids[ids.length - 1]!]!.map((p) => p.id)).toEqual(['p1'])
    db.reads = []
    expect(await readMailPiecesBySource([], 'test')).toEqual({})
    expect(db.reads).toEqual([])
  })

  it('a read that fails leaves its ids out, as an absent table does', async () => {
    db.rows = [{ id: 'p1', source_ids: ['it1'] }]
    db.fail = true
    expect(await readMailPiecesBySource(['it1'], 'test')).toEqual({})
  })
})
