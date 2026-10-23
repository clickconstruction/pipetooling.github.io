import { describe, expect, it } from 'vitest'
import {
  LIEN_DESK_SIGNATURE_CLEAR,
  lienChipSigned,
  lienFieldsHash,
  lienNoticeSignatureAfterSigning,
  lienPenWitnessWords,
  lienPenAwaitsConfirm,
  lienSignatureModeOf,
  lienPenWitnessHowOf,
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
  signed_recorded_by: null,
  signed_witness_how: null,
  signed_leader_confirmed_at: null,
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
  it('reads the ten columns off any row and treats a missing one as null', () => {
    expect(signatureColumnsOf({ id: 'it1', signed_at: SIGNED_AT, signer_printed_name: 'Robert Douglas' })).toEqual({
      signed_at: SIGNED_AT,
      signed_by: null,
      signed_on_device_of: null,
      signer_printed_name: 'Robert Douglas',
      signer_signature_mode: null,
      signer_signature_storage_path: null,
      signed_fields_hash: null,
      signed_recorded_by: null,
      signed_witness_how: null,
      signed_leader_confirmed_at: null,
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
    expect(lienChipSigned(signed(), hash)).toEqual({ at: SIGNED_AT, mode: 'type', recordedBy: null, confirmedAt: null })
    expect(lienChipSigned(signed(), lienFieldsHash({ ...FIELDS, gcEmail: 'x' }))).toBe('unsigned')
    expect(lienChipSigned(signed({ signed_at: null }), hash)).toBe('unsigned')
    expect(Object.values(LIEN_DESK_SIGNATURE_CLEAR).every((v) => v === null)).toBe(true)
    expect(Object.keys(LIEN_DESK_SIGNATURE_CLEAR).sort()).toEqual(['signed_at', 'signed_by', 'signed_fields_hash', 'signed_leader_confirmed_at', 'signed_on_device_of', 'signed_recorded_by', 'signed_witness_how', 'signer_printed_name', 'signer_signature_mode', 'signer_signature_storage_path'])
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

describe('signed with a pen (the pen train, migration 20261013100000)', () => {
  const pen = (over: Partial<LienDeskSignatureColumns> = {}) => signed({ signer_signature_mode: 'pen', signed_recorded_by: 'u-taunya', signed_witness_how: 'watched', ...over })
  const opts = { jobNumber: '878', itemId: '4c2e91aa-0000-4000-8000-000000000000', fieldsHash: lienFieldsHash(FIELDS), recordedByName: 'Taunya' }

  it('reads the mode and the witness word off the row, and treats anything else as a press or nothing', () => {
    expect(lienSignatureModeOf('pen')).toBe('pen')
    expect(lienSignatureModeOf('draw')).toBe('draw')
    expect(lienSignatureModeOf('type')).toBe('type')
    expect(lienSignatureModeOf(null)).toBe('type')
    expect(lienPenWitnessHowOf('page')).toBe('page')
    expect(lienPenWitnessHowOf('guess')).toBeNull()
  })

  it('a pen signature: no mark, the day without a clock, the record ID, and the sentence that names who wrote it down and how they know', () => {
    const sig = lienNoticeSignatureFromRow(pen(), opts)
    expect(sig).not.toBeNull()
    expect(sig!.mode).toBe('pen')
    expect(sig!.pngDataUrl).toBeNull()
    expect(sig!.onDeviceOf).toBeNull()
    expect(sig!.recordId).toBe('L878-4C2E91')
    expect(sig!.signedWords).toBe('Signed by pen October 9, 2026')
    expect(sig!.auditLine).toBe('Signed by pen by Robert Douglas on October 9, 2026, on the paper as printed. Recorded by Taunya, who watched him sign.')
    expect(sig!.pen).toEqual({ recordedByName: 'Taunya', how: 'watched', confirmedAtIso: null })
    expect(toFilingSignature(sig!).mode).toBe('pen')
  })

  it('the three ways the office knows, and the office by name or not', () => {
    expect(lienPenWitnessWords('watched', 'Taunya')).toBe('Taunya, who watched him sign')
    expect(lienPenWitnessWords('told', 'Taunya')).toBe('Taunya, who was told by him that he had signed')
    expect(lienPenWitnessWords('page', 'Taunya')).toBe('Taunya, who has the signed page')
    expect(lienPenWitnessWords('told', null)).toBe('the office, who was told by him that he had signed')
    expect(lienNoticeSignatureFromRow(pen({ signed_witness_how: 'page' }), { ...opts, recordedByName: null })!.auditLine).toContain('Recorded by the office, who has the signed page.')
  })

  it('the leader’s confirmation from his phone joins the sentence; its absence blocks nothing', () => {
    const sig = lienNoticeSignatureFromRow(pen({ signed_leader_confirmed_at: '2026-10-12T23:00:00.000Z' }), opts)
    expect(sig!.pen!.confirmedAtIso).toBe('2026-10-12T23:00:00.000Z')
    expect(sig!.auditLine).toBe('Signed by pen by Robert Douglas on October 9, 2026, on the paper as printed. Recorded by Taunya, who watched him sign. Confirmed by Robert Douglas from his own sign-in on October 12, 2026.')
    expect(lienChipSigned(pen(), lienFieldsHash(FIELDS))).toEqual({ at: SIGNED_AT, mode: 'pen', recordedBy: 'u-taunya', confirmedAt: null })
  })

  it('a pen signature is bound to the paper as printed: an edit after it reads as unsigned, like the electronic ones', () => {
    expect(lienNoticeSignatureFromRow(pen(), { ...opts, fieldsHash: lienFieldsHash({ ...FIELDS, gcEmail: 'x@example.com' }) })).toBeNull()
  })

  it('the run dresses a notice the moment the pen record is written, and the clearing patch nulls all ten columns', () => {
    const sig = lienNoticeSignatureAfterSigning({ mode: 'pen', printedName: 'Robert Douglas', pngDataUrl: null, signedAtIso: SIGNED_AT, jobNumber: '878', itemId: '4c2e91aa-0000-4000-8000-000000000000', onDeviceName: 'Taunya', pen: { recordedByName: 'Taunya', how: 'told' } })
    expect(sig.mode).toBe('pen')
    expect(sig.onDeviceOf).toBeNull()
    expect(sig.signedWords).toBe('Signed by pen October 9, 2026')
    expect(sig.auditLine).toContain('Recorded by Taunya, who was told by him that he had signed.')
    expect(Object.keys(LIEN_DESK_SIGNATURE_CLEAR)).toHaveLength(10)
    expect(LIEN_DESK_SIGNATURE_CLEAR.signed_witness_how).toBeNull()
  })
})

describe('a pen record awaiting the leader’s word (the pen train, PR 3)', () => {
  const pen = (over: Partial<LienDeskSignatureColumns> = {}) => signed({ signer_signature_mode: 'pen', signed_recorded_by: 'u-taunya', signed_witness_how: 'watched', ...over })
  it('the chip carries the mode, who wrote it down and the confirmation; awaiting is a pen record with no confirmation and a draft that still matches', () => {
    const hash = lienFieldsHash(FIELDS)
    expect(lienChipSigned(pen(), hash)).toEqual({ at: SIGNED_AT, mode: 'pen', recordedBy: 'u-taunya', confirmedAt: null })
    expect(lienChipSigned(signed(), hash)).toEqual({ at: SIGNED_AT, mode: 'type', recordedBy: null, confirmedAt: null })
    expect(lienPenAwaitsConfirm(pen(), hash)).toBe(true)
    expect(lienPenAwaitsConfirm(pen({ signed_leader_confirmed_at: '2026-10-12T22:00:00Z' }), hash)).toBe(false)
    expect(lienPenAwaitsConfirm(signed(), hash)).toBe(false)
    expect(lienPenAwaitsConfirm(pen(), lienFieldsHash({ ...FIELDS, gcEmail: 'x' }))).toBe(false)
  })
})

describe('a signature by code (v2.5788): his own code on someone else’s screen', () => {
  const code = (over: Partial<LienDeskSignatureColumns> = {}) => signed({ signer_signature_mode: 'code', signed_on_device_of: 'u-robert', ...over })
  const opts = { jobNumber: '878', itemId: '4c2e91aa-0000-4000-8000-000000000000', fieldsHash: lienFieldsHash(FIELDS) }
  it('reads as mode code, prints in cursive with the audit line naming the code and the screen, and carries his confirmation once he gives it', () => {
    expect(lienSignatureModeOf('code')).toBe('code')
    const sig = lienNoticeSignatureFromRow(code(), { ...opts, onDeviceName: 'Robert' })
    expect(sig?.mode).toBe('code')
    expect(sig?.pngDataUrl).toBeNull()
    expect(sig?.onDeviceOf).toBe('Robert')
    expect(sig?.signedWords).toBe('Signed October 9, 2026 at 2:14 PM CT')
    expect(sig?.auditLine).toBe('Typed by Robert Douglas with his signing code in ClickTooling on October 9, 2026 at 2:14 PM CT, on Robert’s screen.')
    const confirmed = lienNoticeSignatureFromRow(code({ signed_leader_confirmed_at: '2026-10-12T22:00:00Z' }), { ...opts, onDeviceName: 'Robert' })
    expect(confirmed?.auditLine).toContain('Confirmed by Robert Douglas from his own sign-in on October 12, 2026.')
    const hash = lienFieldsHash(FIELDS)
    expect(lienChipSigned(code(), hash)).toEqual({ at: SIGNED_AT, mode: 'code', recordedBy: null, confirmedAt: null })
    expect(lienPenAwaitsConfirm(code(), hash)).toBe(true)
    expect(lienPenAwaitsConfirm(code({ signed_leader_confirmed_at: '2026-10-12T22:00:00Z' }), hash)).toBe(false)
    expect(lienNoticeSignatureFromRow(code(), { ...opts, fieldsHash: lienFieldsHash({ ...FIELDS, gcEmail: 'x' }) })).toBeNull()
  })
})
