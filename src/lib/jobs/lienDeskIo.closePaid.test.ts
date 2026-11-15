import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Close paid notices (v2.7353): one write per notice that sets it aside and keeps who closed it, refused for a
 * row no longer live, and a batch that keeps going past a row that fails.
 */
type Row = { id: string; kind: string; fields: unknown; printed_at: string | null; status: string; voided_at: string | null }
const db = vi.hoisted(() => ({
  rows: [] as Array<{ id: string; kind: string; fields: unknown; printed_at: string | null; status: string; voided_at: string | null }>,
  updates: [] as Array<{ patch: Record<string, unknown>; filters: Array<[string, string, unknown]> }>,
  /** What an update's select answers, by item id; the default is the row itself. */
  answer: {} as Record<string, { data: Array<{ id: string }> | null; error: { message: string } | null }>,
}))

vi.mock('../supabase', () => ({
  supabase: {
    from: () => {
      const call = { patch: null as Record<string, unknown> | null, filters: [] as Array<[string, string, unknown]> }
      const b: Record<string, unknown> = {}
      const filter = (op: string) => (col: string, v: unknown) => {
        call.filters.push([op, col, v])
        return b
      }
      b.eq = filter('eq')
      b.is = filter('is')
      b.in = filter('in')
      b.update = (patch: Record<string, unknown>) => {
        call.patch = patch
        db.updates.push({ patch, filters: call.filters })
        return b
      }
      b.select = () => {
        if (call.patch) {
          const id = call.filters.find(([op, col]) => op === 'eq' && col === 'id')?.[2] as string
          return Promise.resolve(db.answer[id] ?? { data: [{ id }], error: null })
        }
        return b
      }
      // The read: `select(...).in('id', ids)` awaited.
      b.then = (ok: (v: unknown) => unknown) => {
        const ids = (call.filters.find(([op, col]) => op === 'in' && col === 'id')?.[2] ?? []) as string[]
        return Promise.resolve({ data: db.rows.filter((r) => ids.includes(r.id)), error: null }).then(ok)
      }
      return b
    },
  },
}))
vi.mock('../../utils/errorHandling', async () => {
  const actual = await vi.importActual<typeof import('../../utils/errorHandling')>('../../utils/errorHandling')
  // No retries in the test: the builder's answer is read once.
  return {
    ...actual,
    withSupabaseRetry: async (fn: () => PromiseLike<{ data: unknown; error: unknown }>) => {
      const { data, error } = await fn()
      if (error) throw error
      return data
    },
  }
})

import { closePaidLienDeskItems } from './lienDeskIo'
import { runClosedPaidOf } from './lienRunClosePaid'

const row = (id: string, over: Partial<Row> = {}): Row => ({ id, kind: 'notice_53_056', fields: { notice: { claimAmount: '2400.00' }, gcEmail: 'zz@example.test' }, printed_at: '2026-10-08T15:00:00Z', status: 'approved', voided_at: null, ...over })
const who = { userId: 'u1', userName: 'ZZ Office' }

beforeEach(() => {
  db.rows = []
  db.updates = []
  db.answer = {}
})

describe('closePaidLienDeskItems', () => {
  it('one write per notice: set aside, the line kept on its fields, only while it is still a live monthly notice', async () => {
    db.rows = [row('a')]
    const out = await closePaidLienDeskItems(['a'], who)
    expect(out).toEqual({ closed: ['a'], failed: [] })
    expect(db.updates).toHaveLength(1)
    const { patch, filters } = db.updates[0]!
    expect(typeof patch.voided_at).toBe('string')
    expect(patch.fields).toMatchObject({ gcEmail: 'zz@example.test', notice: { claimAmount: '2400.00' } })
    expect(runClosedPaidOf(patch.fields)).toMatchObject({ by: 'u1', byName: 'ZZ Office', printedAt: '2026-10-08T15:00:00Z', paperClaim: 2400, at: patch.voided_at })
    expect(filters).toEqual([
      ['eq', 'id', 'a'],
      ['eq', 'kind', 'notice_53_056'],
      ['is', 'voided_at', null],
      ['in', 'status', ['drafted', 'awaiting_approval', 'approved', 'held']],
    ])
  })

  it('writes nothing for a row that was sent, closed, missing or not a monthly notice, and names each', async () => {
    db.rows = [row('sent', { status: 'sent' }), row('gone', { voided_at: '2026-11-01T00:00:00Z' }), row('ret', { kind: 'retainage_53_057' })]
    const out = await closePaidLienDeskItems(['sent', 'gone', 'ret', 'nowhere'], who)
    expect(db.updates).toHaveLength(0)
    expect(out.closed).toEqual([])
    expect(out.failed).toEqual(['sent', 'gone', 'ret', 'nowhere'].map((itemId) => ({ itemId, why: 'It was sent or closed already.' })))
  })

  it('keeps going past a notice that fails, and past one that moved meanwhile', async () => {
    db.rows = [row('a'), row('b'), row('c'), row('d')]
    db.answer = { b: { data: null, error: { message: 'canceling statement due to lock timeout' } }, c: { data: [], error: null } }
    const out = await closePaidLienDeskItems(['a', 'b', 'c', 'd'], who)
    expect(out.closed).toEqual(['a', 'd'])
    expect(out.failed).toEqual([
      { itemId: 'b', why: 'canceling statement due to lock timeout' },
      { itemId: 'c', why: 'It was sent or closed already.' },
    ])
  })

  it('reads nothing when it is handed nothing', async () => {
    expect(await closePaidLienDeskItems([], who)).toEqual({ closed: [], failed: [] })
    expect(db.updates).toHaveLength(0)
  })
})
