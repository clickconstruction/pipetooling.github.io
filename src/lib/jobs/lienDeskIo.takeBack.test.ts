import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Take back a printed notice (punch list #101), and since v2.7503 its signature with it (the owner's call of
 * 2026-11-16): the write clears the print stamp and the ten signature columns, keeps the approval, and keeps two
 * lines on the notice — who took it back, and which signature came off. Until v2.7503 the write changed `fields`
 * and left the signature columns alone, so the signature read as gone by its hash while the row still carried it.
 * Made-up people.
 */
type Row = { id: string; fields: unknown; printed_at: string | null; status: string; voided_at: string | null; signed_at: string | null; signed_by: string | null; signer_printed_name: string | null; signer_signature_mode: string | null; signer_signature_storage_path: string | null }
const db = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  updates: [] as Array<{ patch: Record<string, unknown>; filters: Array<[string, string, unknown]> }>,
}))

vi.mock('../supabase', () => ({
  supabase: {
    from: () => {
      const call = { patch: null as Record<string, unknown> | null, filters: [] as Array<[string, string, unknown]> }
      const b: Record<string, unknown> = {}
      const filter = (op: string) => (col: string, ...rest: unknown[]) => {
        call.filters.push([op, col, rest.length > 1 ? rest : rest[0]])
        return b
      }
      b.eq = filter('eq')
      b.neq = filter('neq')
      b.not = filter('not')
      b.in = filter('in')
      b.select = () => b
      b.update = (patch: Record<string, unknown>) => {
        call.patch = patch
        db.updates.push({ patch, filters: call.filters })
        return b
      }
      b.then = (ok: (v: unknown) => unknown) => {
        if (call.patch) return Promise.resolve({ data: null, error: null }).then(ok)
        const ids = (call.filters.find(([op, col]) => op === 'in' && col === 'id')?.[2] ?? []) as string[]
        return Promise.resolve({ data: db.rows.filter((r) => ids.includes(r.id as string)), error: null }).then(ok)
      }
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

import { takeBackLienDeskItems } from './lienDeskIo'
import { LIEN_DESK_SIGNATURE_CLEAR, lienFieldsHash, lienItemUnsigned } from './lienNoticeSignature'
import { runTakenBackOf } from './lienRunTakeBack'
import { signatureClearedOf } from './lienSignAgain'

const FIELDS = { notice: { claimAmount: '2400.00' }, gcEmail: 'zz@example.test' }
const row = (id: string, over: Partial<Row> = {}): Row => ({ id, fields: FIELDS, printed_at: '2026-11-16T18:05:00Z', status: 'approved', voided_at: null, signed_at: '2026-11-16T15:00:00Z', signed_by: 'u-avery', signer_printed_name: 'Avery Stone', signer_signature_mode: 'code', signer_signature_storage_path: null, ...over })
const who = { userId: 'u-dana', userName: 'Dana' }

beforeEach(() => {
  db.rows = []
  db.updates = []
})

describe('takeBackLienDeskItems', () => {
  it('the bug it closes: fields that gain the take-back line no longer match the signed hash, so the signature read as gone while the row kept it', () => {
    const signedRow = { ...row('a'), signed_fields_hash: lienFieldsHash(FIELDS) }
    expect(lienItemUnsigned(signedRow)).toBe(false)
    expect(lienItemUnsigned({ ...signedRow, fields: { ...FIELDS, runTakenBack: { at: '2026-11-16T18:09:00Z' } } })).toBe(true)
  })

  it('a signed notice: the print stamp and the ten signature columns clear in one write, the approval is not touched, and both lines are kept', async () => {
    db.rows = [row('a')]
    expect(await takeBackLienDeskItems(['a'], who)).toBe(1)
    expect(db.updates).toHaveLength(1)
    const { patch, filters } = db.updates[0]!
    expect(Object.keys(patch).sort()).toEqual(['fields', 'printed_at', 'printed_by', ...Object.keys(LIEN_DESK_SIGNATURE_CLEAR)].sort())
    expect(patch.printed_at).toBeNull()
    for (const k of Object.keys(LIEN_DESK_SIGNATURE_CLEAR)) expect(patch[k]).toBeNull()
    for (const k of ['status', 'approval_mode', 'approved_by', 'approved_at']) expect(k in patch).toBe(false)
    const fields = patch.fields as Record<string, unknown>
    expect(fields.notice).toEqual(FIELDS.notice)
    expect(runTakenBackOf(fields)).toMatchObject({ by: 'u-dana', byName: 'Dana', printedAt: '2026-11-16T18:05:00Z' })
    expect(signatureClearedOf(fields)).toMatchObject({ by: 'u-dana', byName: 'Dana', signedAt: '2026-11-16T15:00:00Z', signedBy: 'u-avery', signerName: 'Avery Stone', mode: 'code' })
    // The same instant on both lines: one act.
    expect(signatureClearedOf(fields)!.at).toBe(runTakenBackOf(fields)!.at)
    // Still only a row that is printed and not sent.
    expect(filters).toContainEqual(['eq', 'id', 'a'])
    expect(filters).toContainEqual(['neq', 'status', 'sent'])
    expect(filters.some(([op, col]) => op === 'not' && col === 'printed_at')).toBe(true)
    // After the write the row is cleanly unsigned, by its columns and not by a hash that stopped matching.
    expect(lienItemUnsigned({ ...row('a'), ...patch })).toBe(true)
  })

  it('an unsigned notice: the same write, with no line about a signature', async () => {
    db.rows = [row('a', { signed_at: null, signed_by: null, signer_printed_name: null, signer_signature_mode: null })]
    await takeBackLienDeskItems(['a'], who)
    const fields = db.updates[0]!.patch.fields as Record<string, unknown>
    expect(runTakenBackOf(fields)).not.toBeNull()
    expect(signatureClearedOf(fields)).toBeNull()
  })

  it('a row that is not printed, was sent or was set aside is left alone', async () => {
    db.rows = [row('a', { printed_at: null }), row('b', { status: 'sent' }), row('c', { voided_at: '2026-11-16T19:00:00Z' }), row('d')]
    expect(await takeBackLienDeskItems(['a', 'b', 'c', 'd'], who)).toBe(1)
    expect(db.updates).toHaveLength(1)
    expect(db.updates[0]!.filters).toContainEqual(['eq', 'id', 'd'])
  })
})
