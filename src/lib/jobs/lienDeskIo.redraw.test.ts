import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The redraw's write (punch list #305): one update per paper that pulls it back to a draft and marks it for the short
 * form, refused for a paper no longer on the desk, and a batch that keeps going past a paper that fails.
 */
const db = vi.hoisted(() => ({
  updates: [] as Array<{ patch: Record<string, unknown>; filters: Array<[string, string, unknown]> }>,
  /** What the update's select answers, by item id: the rows that moved, or an error. */
  answer: {} as Record<string, { data: Array<{ id: string }> | null; error: { message: string } | null }>,
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
      b.eq = (col: string, v: unknown) => {
        call.filters.push(['eq', col, v])
        return b
      }
      b.in = (col: string, v: unknown) => {
        call.filters.push(['in', col, v])
        return b
      }
      b.select = () => {
        const id = call.filters.find(([op, col]) => op === 'eq' && col === 'id')?.[2] as string
        return Promise.resolve(db.answer[id] ?? { data: [{ id }], error: null })
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

import { redrawLienAffidavitShort, redrawLienAffidavitsShort } from './lienDeskIo'

beforeEach(() => {
  db.updates = []
  db.answer = {}
})

describe('redrawLienAffidavitShort', () => {
  it('one write: back to a draft, the approval and the signature cleared, the fields kept and marked for the short form', async () => {
    await redrawLienAffidavitShort({ id: 'aff1', fields: { notice: { claimAmount: '595.00' }, gcEmail: 'gc@sample.test' } } as never, 'u-office')
    expect(db.updates).toHaveLength(1)
    const { patch, filters } = db.updates[0]!
    expect(patch).toMatchObject({ status: 'drafted', approval_mode: null, approved_by: null, approved_at: null, word_note: '', hold_reason: '', hold_until: null, signed_at: null, signed_fields_hash: null, pulled_back_by: 'u-office' })
    expect(patch.fields).toEqual({ notice: { claimAmount: '595.00' }, gcEmail: 'gc@sample.test', affidavitForm: 'short' })
    expect(typeof patch.pulled_back_at).toBe('string')
    // Only an affidavit still on the desk moves: a filed or voided one matches no row.
    expect(filters).toEqual([
      ['eq', 'id', 'aff1'],
      ['eq', 'kind', 'affidavit'],
      ['in', 'status', ['drafted', 'awaiting_approval', 'approved', 'held']],
    ])
  })

  it('a paper filed or taken back since the list was read is refused with the reason', async () => {
    db.answer.aff1 = { data: [], error: null }
    await expect(redrawLienAffidavitShort({ id: 'aff1', fields: {} } as never, null)).rejects.toThrow('no longer a draft on the desk')
  })

  it('fields that are not an object are replaced by the mark alone', async () => {
    await redrawLienAffidavitShort({ id: 'aff1', fields: null } as never, null)
    expect(db.updates[0]!.patch.fields).toEqual({ affidavitForm: 'short' })
  })
})

describe('redrawLienAffidavitsShort · the batch keeps going past a paper that fails', () => {
  it('redraws the rest and names the one that did not take, with its reason', async () => {
    db.answer.b = { data: null, error: { message: 'new row violates row-level security policy' } }
    db.answer.d = { data: [], error: null }
    const result = await redrawLienAffidavitsShort(
      ['a', 'b', 'c', 'd'].map((id) => ({ jobId: `job-${id}`, item: { id, fields: {} } as never })),
      'u-office',
    )
    expect(db.updates).toHaveLength(4)
    expect(result.done).toEqual(['job-a', 'job-c'])
    expect(result.failed.map((f) => f.jobId)).toEqual(['job-b', 'job-d'])
    expect(result.failed[0]!.reason).toContain('row-level security')
    expect(result.failed[1]!.reason).toContain('no longer a draft on the desk')
  })

  it('nothing to redraw is nothing done', async () => {
    expect(await redrawLienAffidavitsShort([], null)).toEqual({ done: [], failed: [] })
    expect(db.updates).toEqual([])
  })
})
