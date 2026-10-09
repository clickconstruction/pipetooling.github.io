import { describe, expect, it } from 'vitest'
import {
  LIEN_DESK_SIGNATURE_CLEAR,
  lienChipSigned,
  lienFieldsHash,
  lienNoticeSignatureAfterSigning,
  lienNoticeSignatureFromRow,
  lienSignatureAuditLine,
  lienSignatureStale,
  lienSignedRecordId,
  signatureColumnsOf,
  toFilingSignature,
  type LienDeskSignatureColumns,
} from './lienNoticeSignature'

const FIELDS = { notice: { claimAmount: '12480.00', contactPerson: 'Robert Douglas, Owner' }, gcEmail: 'ap@brightline.example', payLines: { a: '1' } }
const SIGNED_AT = '2026-10-09T19:14:00.000Z' // 2:14 PM in Chicago

const signed = (over: Partial<LienDeskSignatureColumns> = {}): LienDeskSignatureColumns => ({
  signed_at: SIGNED_AT,
  signed_by: 'u-robert',
  signed_on_device_of: null,
  signer_printed_name: 'Robert Douglas',
  signer_signature_mode: 'type',
  signer_signature_storage_path: null,
  signed_fields_hash: lienFieldsHash(FIELDS),
  ...over,
})

describe('the hash of the draft (v2.5077)', () => {
  it('is sixteen hex characters, the same for the same draft whatever the key order, and different once a field changes', () => {
    const a = lienFieldsHash(FIELDS)
    expect(a).toMatch(/^[0-9a-f]{16}$/)
    expect(lienFieldsHash({ payLines: { a: '1' }, gcEmail: 'ap@brightline.example', notice: { contactPerson: 'Robert Douglas, Owner', claimAmount: '12480.00' } })).toBe(a)
    expect(lienFieldsHash({ ...FIELDS, notice: { ...FIELDS.notice, claimAmount: '12481.00' } })).not.toBe(a)
    expect(lienFieldsHash({ ...FIELDS, extra: undefined })).toBe(a)
    expect(lienFieldsHash(null)).toBe(lienFieldsHash(null))
  })
})

describe('the row’s signature', () => {
  it('reads the seven columns off any row and treats a missing one as null', () => {
    expect(signatureColumnsOf({ id: 'it1', signed_at: SIGNED_AT, signer_printed_name: 'Robert Douglas' })).toEqual({
      signed_at: SIGNED_AT,
      signed_by: null,
      signed_on_device_of: null,
      signer_printed_name: 'Robert Douglas',
      signer_signature_mode: null,
      signer_signature_storage_path: null,
      signed_fields_hash: null,
    })
    expect(signatureColumnsOf(undefined).signed_at).toBeNull()
  })

  it('is null while unsigned, and null once the draft changed after signing — the signature is bound to the notice as drafted', () => {
    const hash = lienFieldsHash(FIELDS)
    expect(lienNoticeSignatureFromRow(signed({ signed_at: null }), { jobNumber: '878', itemId: 'it1', fieldsHash: hash })).toBeNull()
    expect(lienNoticeSignatureFromRow(signed({ signer_printed_name: '  ' }), { jobNumber: '878', itemId: 'it1', fieldsHash: hash })).toBeNull()
    const edited = lienFieldsHash({ ...FIELDS, gcEmail: 'other@example.com' })
    expect(lienNoticeSignatureFromRow(signed(), { jobNumber: '878', itemId: 'it1', fieldsHash: edited })).toBeNull()
    expect(lienSignatureStale(signed(), edited)).toBe(true)
    expect(lienSignatureStale(signed(), hash)).toBe(false)
    expect(lienSignatureStale(signed({ signed_at: null }), edited)).toBe(false)
    // A row signed before the hash existed still counts.
    expect(lienNoticeSignatureFromRow(signed({ signed_fields_hash: null }), { jobNumber: '878', itemId: 'it1', fieldsHash: edited })).not.toBeNull()
  })

  it('a pressed signature: the cursive name, the record ID, the day and the clock, and the sentence that says it was his own press', () => {
    const sig = lienNoticeSignatureFromRow(signed(), { jobNumber: '878', itemId: '4c2e91aa-0000-4000-8000-000000000000', fieldsHash: lienFieldsHash(FIELDS) })
    expect(sig).not.toBeNull()
    expect(sig!.mode).toBe('type')
    expect(sig!.printedName).toBe('Robert Douglas')
    expect(sig!.pngDataUrl).toBeNull()
    expect(sig!.recordId).toBe('L878-4C2E91')
    expect(lienSignedRecordId('878', '4c2e91aa-0000-4000-8000-000000000000')).toBe('L878-4C2E91')
    expect(sig!.signedWords).toBe('Signed October 9, 2026 at 2:14 PM CT')
    expect(sig!.auditLine).toBe('Placed by Robert Douglas with one press under his own sign-in to ClickTooling on October 9, 2026 at 2:14 PM CT.')
    expect(sig!.onDeviceOf).toBeNull()
    expect(toFilingSignature(sig!)).toEqual({
      mode: 'type',
      printedName: 'Robert Douglas',
      pngDataUrl: null,
      signedWords: 'Signed October 9, 2026 at 2:14 PM CT',
      recordId: 'L878-4C2E91',
      auditLine: sig!.auditLine,
    })
  })

  it('a drawn signature carries the ink it was given and names the screen it was drawn on', () => {
    const sig = lienNoticeSignatureFromRow(signed({ signer_signature_mode: 'draw', signer_signature_storage_path: 'desk/it1/a.png', signed_on_device_of: 'u-taunya' }), {
      jobNumber: '878',
      itemId: 'it1',
      fieldsHash: lienFieldsHash(FIELDS),
      onDeviceName: 'Taunya',
      pngDataUrl: 'data:image/png;base64,AAAA',
    })
    expect(sig!.mode).toBe('draw')
    expect(sig!.pngDataUrl).toBe('data:image/png;base64,AAAA')
    expect(sig!.onDeviceOf).toBe('Taunya')
    expect(sig!.auditLine).toBe('Drawn by Robert Douglas in ClickTooling on October 9, 2026 at 2:14 PM CT, on Taunya’s screen.')
    // A pressed signature never carries ink, whatever it was handed.
    const pressed = lienNoticeSignatureFromRow(signed(), { jobNumber: '878', itemId: 'it1', fieldsHash: lienFieldsHash(FIELDS), pngDataUrl: 'data:image/png;base64,AAAA' })
    expect(pressed!.pngDataUrl).toBeNull()
    expect(lienSignatureAuditLine({ mode: 'draw', printedName: '', signedAtIso: SIGNED_AT })).toBe('Drawn by the leader in ClickTooling on October 9, 2026 at 2:14 PM CT.')
  })
})

describe('the chip’s word and the clearing patch (v2.5082)', () => {
  it('signed with the instant while the draft is what he signed, unsigned otherwise; the clearing patch nulls all seven columns', () => {
    const hash = lienFieldsHash(FIELDS)
    expect(lienChipSigned(signed(), hash)).toEqual({ at: SIGNED_AT })
    expect(lienChipSigned(signed(), lienFieldsHash({ ...FIELDS, gcEmail: 'x' }))).toBe('unsigned')
    expect(lienChipSigned(signed({ signed_at: null }), hash)).toBe('unsigned')
    expect(Object.values(LIEN_DESK_SIGNATURE_CLEAR).every((v) => v === null)).toBe(true)
    expect(Object.keys(LIEN_DESK_SIGNATURE_CLEAR).sort()).toEqual(['signed_at', 'signed_by', 'signed_fields_hash', 'signed_on_device_of', 'signer_printed_name', 'signer_signature_mode', 'signer_signature_storage_path'])
  })
})

describe('the signature the run dresses a notice with right after signing (v2.5086)', () => {
  it('a drawing at the office’s screen: the ink, the record ID, the words and the sentence naming whose screen', () => {
    const sig = lienNoticeSignatureAfterSigning({ mode: 'draw', printedName: 'Robert Douglas', pngDataUrl: 'data:image/png;base64,AAAA', signedAtIso: SIGNED_AT, jobNumber: '878', itemId: '4c2e91aa-0000-4000-8000-000000000000', onDeviceName: 'Taunya' })
    expect(sig.recordId).toBe('L878-4C2E91')
    expect(sig.pngDataUrl).toBe('data:image/png;base64,AAAA')
    expect(sig.signedWords).toBe('Signed October 9, 2026 at 2:14 PM CT')
    expect(sig.auditLine).toBe('Drawn by Robert Douglas in ClickTooling on October 9, 2026 at 2:14 PM CT, on Taunya’s screen.')
    expect(sig.onDeviceOf).toBe('Taunya')
  })
})
