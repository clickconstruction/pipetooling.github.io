import { describe, expect, it } from 'vitest'
import { lienFieldsHash, lienRowUnsigned } from '../../../supabase/functions/_shared/lienFieldsHash'
import { lienSignatureAskable } from '../../../supabase/functions/_shared/lienApprovalPush'
import { lienFieldsHash as deskHash, lienItemUnsigned } from './lienNoticeSignature'

/**
 * One rule for *unsigned* (v2.7491): `notify-lien-approval` reminds the leader of a notice only when the desk would
 * count it as waiting on his signature. The function cannot import the desk's kernel, so the hash and the rule live in
 * `_shared/lienFieldsHash.ts` and this holds the two to one answer, row by row.
 */
const fields = { notice: { claimAmount: 27_199, months: ['2026-07'] } }
const signed = { signed_at: '2026-11-10T15:00:00Z', signer_printed_name: 'Sam Leader', signed_fields_hash: lienFieldsHash(fields) }
const rows: Array<{ name: string; row: Record<string, unknown>; unsigned: boolean }> = [
  { name: 'never signed', row: { fields }, unsigned: true },
  { name: 'signed as it stands', row: { fields, ...signed }, unsigned: false },
  { name: 'signed, then the draft changed', row: { fields: { notice: { claimAmount: 30_000 } }, ...signed }, unsigned: true },
  { name: 'signed with no name', row: { fields, ...signed, signer_printed_name: '  ' }, unsigned: true },
  { name: 'signed before the hash was kept', row: { fields, ...signed, signed_fields_hash: null }, unsigned: false },
  { name: 'the same draft with its keys in another order', row: { fields: { notice: { months: ['2026-07'], claimAmount: 27_199 } }, ...signed }, unsigned: false },
]

describe('the shared rule for a notice with no signature', () => {
  it('the desk reads the shared hash, so the two are one function', () => {
    expect(deskHash).toBe(lienFieldsHash)
    expect(lienFieldsHash({ b: 1, a: undefined, c: [1, { z: 1, y: 2 }] })).toBe(lienFieldsHash({ c: [1, { y: 2, z: 1 }], b: 1 }))
    expect(lienFieldsHash(fields)).toMatch(/^[0-9a-f]{16}$/)
  })

  for (const c of rows) {
    it(`${c.name}: the function and the desk agree`, () => {
      expect(lienRowUnsigned(c.row, c.row.fields)).toBe(c.unsigned)
      expect(lienItemUnsigned(c.row as { fields: unknown })).toBe(c.unsigned)
    })
  }

  it('no row at all reads as unsigned to the function, which then asks the rest of its rule', () => {
    expect(lienRowUnsigned(null, {})).toBe(true)
    expect(lienSignatureAskable(null)).toBe(false)
  })
})

describe('lienSignatureAskable: the desk’s Approved · to print bin, less what is signed', () => {
  const row = (over: Record<string, unknown> = {}) => ({ kind: 'notice_53_056', status: 'approved', voided_at: null, printed_at: null, fields, ...over })
  it('an approved monthly notice with no signature is asked', () => {
    expect(lienSignatureAskable(row())).toBe(true)
    expect(lienSignatureAskable(row({ fields: { notice: { claimAmount: 1 } }, ...signed }))).toBe(true)
  })
  it('signed, printed, voided, not approved, or another kind of paper is not', () => {
    expect(lienSignatureAskable(row(signed))).toBe(false)
    expect(lienSignatureAskable(row({ printed_at: '2026-11-12T15:00:00Z' }))).toBe(false)
    expect(lienSignatureAskable(row({ voided_at: '2026-11-12T15:00:00Z' }))).toBe(false)
    for (const status of ['draft', 'awaiting_approval', 'held', 'sent', 'missed']) expect(lienSignatureAskable(row({ status }))).toBe(false)
    for (const kind of ['affidavit', 'retainage_53_057']) expect(lienSignatureAskable(row({ kind }))).toBe(false)
  })
})
