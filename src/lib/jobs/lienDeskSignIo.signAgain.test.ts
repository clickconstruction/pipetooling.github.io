import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Sign it again (v2.7502): the write clears the ten signature columns and nothing else, keeps one line of who
 * cleared which signature, and leaves a row alone that printed, went, was set aside or was signed afresh
 * since the screen read it. Made-up people.
 */
type Row = { id: string; fields: unknown; status: string | null; printed_at: string | null; voided_at: string | null; signed_at: string | null; signed_by: string | null; signer_printed_name: string | null; signer_signature_mode: string | null; signer_signature_storage_path: string | null }
const db = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  updates: [] as Array<{ patch: Record<string, unknown>; filters: Array<[string, string, unknown]> }>,
  /** What the update's select answers; the default is the row. */
  moved: null as Array<{ id: string }> | null,
  removes: 0,
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
      b.update = (patch: Record<string, unknown>) => {
        call.patch = patch
        db.updates.push({ patch, filters: call.filters })
        return b
      }
      b.select = () => (call.patch ? Promise.resolve({ data: db.moved ?? [{ id: 'it1' }], error: null }) : b)
      b.maybeSingle = async () => ({ data: db.row, error: null })
      return b
    },
    storage: {
      from: () => ({
        remove: async () => {
          db.removes++
          return { error: null }
        },
      }),
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

import { clearLienSignatureToSignAgain } from './lienDeskSignIo'
import { LIEN_DESK_SIGNATURE_CLEAR } from './lienNoticeSignature'
import { LIEN_SIGN_AGAIN_GONE, signatureClearedOf } from './lienSignAgain'

const FIELDS = { notice: { claimAmount: '2400.00' }, runTakenBack: { at: '2026-11-16T18:09:00Z' } }
const row = (over: Partial<Row> = {}): Row => ({ id: 'it1', fields: FIELDS, status: 'approved', printed_at: null, voided_at: null, signed_at: '2026-11-16T21:00:00.123456+00:00', signed_by: 'u-avery', signer_printed_name: 'Avery Stone', signer_signature_mode: 'draw', signer_signature_storage_path: 'desk/it1/ink.png', ...over })
const who = { userId: 'u-dana', userName: 'Dana' }

beforeEach(() => {
  db.row = null
  db.updates = []
  db.moved = null
  db.removes = 0
})

describe('clearLienSignatureToSignAgain', () => {
  it('clears the ten signature columns and nothing else, and keeps the line on the fields', async () => {
    db.row = row()
    expect(await clearLienSignatureToSignAgain('it1', who)).toEqual({ ok: true })
    expect(db.updates).toHaveLength(1)
    const { patch } = db.updates[0]!
    expect(Object.keys(patch).sort()).toEqual([...Object.keys(LIEN_DESK_SIGNATURE_CLEAR), 'fields'].sort())
    for (const k of Object.keys(LIEN_DESK_SIGNATURE_CLEAR)) expect(patch[k]).toBeNull()
    // The approval, the print stamp and the status are not in the patch.
    for (const k of ['status', 'approval_mode', 'approved_by', 'approved_at', 'printed_at', 'word_note']) expect(k in patch).toBe(false)
    const fields = patch.fields as Record<string, unknown>
    expect(fields.notice).toEqual(FIELDS.notice)
    expect(fields.runTakenBack).toEqual(FIELDS.runTakenBack)
    expect(signatureClearedOf(fields)).toMatchObject({ by: 'u-dana', byName: 'Dana', signedAt: '2026-11-16T21:00:00.123456+00:00', signedBy: 'u-avery', signerName: 'Avery Stone', mode: 'draw', storagePath: 'desk/it1/ink.png' })
  })

  it('the write names what it read: still approved, the same signature, not printed, not set aside', async () => {
    db.row = row()
    await clearLienSignatureToSignAgain('it1', who)
    expect(db.updates[0]!.filters).toEqual([
      ['eq', 'id', 'it1'],
      ['eq', 'status', 'approved'],
      ['eq', 'signed_at', '2026-11-16T21:00:00.123456+00:00'],
      ['is', 'printed_at', null],
      ['is', 'voided_at', null],
    ])
  })

  it('the stored drawing is not deleted', async () => {
    db.row = row()
    await clearLienSignatureToSignAgain('it1', who)
    expect(db.removes).toBe(0)
  })

  it('a row that printed, went, was set aside, lost its approval or has no signature is left alone, and the person is told', async () => {
    for (const over of [{ printed_at: '2026-11-17T15:00:00Z' }, { status: 'sent' }, { voided_at: '2026-11-17T15:00:00Z' }, { status: 'drafted' }, { signed_at: null }] as Array<Partial<Row>>) {
      db.row = row(over)
      expect(await clearLienSignatureToSignAgain('it1', who)).toEqual({ ok: false, message: LIEN_SIGN_AGAIN_GONE })
    }
    db.row = null
    expect(await clearLienSignatureToSignAgain('it1', who)).toEqual({ ok: false, message: LIEN_SIGN_AGAIN_GONE })
    expect(db.updates).toHaveLength(0)
  })

  it('a row that moved between the read and the write answers with no row, and the person is told', async () => {
    db.row = row()
    db.moved = []
    expect(await clearLienSignatureToSignAgain('it1', who)).toEqual({ ok: false, message: LIEN_SIGN_AGAIN_GONE })
  })
})
