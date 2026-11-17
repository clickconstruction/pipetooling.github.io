import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Redraw from the bills (v2.7520): one update that replaces the stored paper and clears the signature, only on a live
 * row past a draft and not printed, and an honest answer when the row had moved on.
 */
const db = vi.hoisted(() => ({
  updates: [] as Array<{ patch: Record<string, unknown>; filters: Array<[string, string, unknown]> }>,
  answer: { data: [{ id: 'it1' }] as Array<{ id: string }> | null, error: null as { message: string } | null },
}))

vi.mock('../supabase', () => ({
  supabase: {
    from: () => {
      const call = { patch: {} as Record<string, unknown>, filters: [] as Array<[string, string, unknown]> }
      const b: Record<string, unknown> = {}
      b.update = (patch: Record<string, unknown>) => {
        call.patch = patch
        db.updates.push(call)
        return b
      }
      for (const op of ['eq', 'in', 'is'] as const) {
        b[op] = (col: string, v: unknown) => {
          call.filters.push([op, col, v])
          return b
        }
      }
      b.select = () => Promise.resolve(db.answer)
      return b
    },
  },
}))
vi.mock('../../utils/errorHandling', async () => {
  const actual = await vi.importActual<typeof import('../../utils/errorHandling')>('../../utils/errorHandling')
  return {
    ...actual,
    withSupabaseRetry: async (fn: () => PromiseLike<{ data: unknown; error: unknown }>) => {
      const { data, error } = await fn()
      if (error) throw error
      return data
    },
  }
})

import { redrawLienDeskItem } from './lienDeskIo'

beforeEach(() => {
  db.updates = []
  db.answer = { data: [{ id: 'it1' }], error: null }
})

describe('redrawLienDeskItem', () => {
  const fields = { notice: { claimAmount: '6150.00', noticeDate: '2026-11-16', claimSplit: undefined }, gcEmail: '', redrawn: { at: '2026-11-16T22:10:00Z', by: 'u-dana', byName: 'Dana', wasClaim: '18400.00', wasDate: '2026-10-07' } }

  it('one write: the fields as JSON, the signature cleared, the status left alone', async () => {
    expect(await redrawLienDeskItem('it1', fields)).toBe(true)
    expect(db.updates).toHaveLength(1)
    const { patch } = db.updates[0]!
    expect(patch.fields).toEqual({ notice: { claimAmount: '6150.00', noticeDate: '2026-11-16' }, gcEmail: '', redrawn: fields.redrawn })
    expect(patch.signed_at).toBeNull()
    expect(patch.signed_fields_hash).toBeNull()
    expect('status' in patch).toBe(false)
    expect('approved_at' in patch).toBe(false)
  })

  it('only a live row past a draft and not printed is written', async () => {
    await redrawLienDeskItem('it1', fields)
    expect(db.updates[0]!.filters).toEqual([
      ['eq', 'id', 'it1'],
      ['in', 'status', ['awaiting_approval', 'approved', 'held']],
      ['is', 'printed_at', null],
      ['is', 'voided_at', null],
    ])
  })

  it('a row that printed, went or was closed meanwhile answers false', async () => {
    db.answer = { data: [], error: null }
    expect(await redrawLienDeskItem('it1', fields)).toBe(false)
    db.answer = { data: null, error: null }
    expect(await redrawLienDeskItem('it1', fields)).toBe(false)
  })

  it('a refusal is thrown with its reason, never read as done', async () => {
    db.answer = { data: null, error: { message: 'permission denied for table job_lien_desk_items' } }
    await expect(redrawLienDeskItem('it1', fields)).rejects.toMatchObject({ message: 'permission denied for table job_lien_desk_items' })
  })
})
