import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { LIEN_DESK_SIGNATURE_CLEAR, lienFieldsHash, lienItemUnsigned } from './lienNoticeSignature'
import {
  LIEN_SIGN_AGAIN_CONFIRM_LABEL,
  LIEN_SIGN_AGAIN_GONE,
  LIEN_SIGN_AGAIN_LABEL,
  canClearSignatureRow,
  fieldsWithSignatureCleared,
  signAgainConfirmWords,
  signAgainDoneWords,
  signAgainHow,
  signAgainJobWords,
  signAgainOffered,
  signatureClearedOf,
  signatureClearedRecord,
  signatureClearedWords,
} from './lienSignAgain'

/** Sign it again (v2.7502): when the press is offered, the words, and the line the notice keeps. Made-up people and jobs. */
const FIELDS = { notice: { claimAmount: '2400.00' }, gcEmail: 'zz@example.test' }
const signed = (over: Record<string, unknown> = {}) => ({
  id: 'it1',
  status: 'approved',
  printed_at: null,
  voided_at: null,
  fields: FIELDS,
  signed_at: '2026-11-16T21:00:00Z',
  signed_by: 'u-avery',
  signer_printed_name: 'Avery Stone',
  signer_signature_mode: 'draw',
  signer_signature_storage_path: 'desk/it1/ink.png',
  signed_on_device_of: 'u-dana',
  signed_fields_hash: lienFieldsHash(FIELDS),
  ...over,
})

describe('signAgainOffered', () => {
  it('the office and a leader get it on an approved notice whose signature stands', () => {
    expect(signAgainOffered({ item: signed(), office: true, leader: false })).toBe(true)
    expect(signAgainOffered({ item: signed(), office: false, leader: true })).toBe(true)
    expect(signAgainOffered({ item: signed({ signer_signature_mode: 'type', signer_signature_storage_path: null }), office: true, leader: false })).toBe(true)
  })

  it('nobody else gets it, and no item gets nothing', () => {
    expect(signAgainOffered({ item: signed(), office: false, leader: false })).toBe(false)
    expect(signAgainOffered({ item: null, office: true, leader: true })).toBe(false)
  })

  it('not on a printed, sent, set aside, held, awaiting or drafted notice', () => {
    for (const over of [{ printed_at: '2026-11-16T18:05:00Z' }, { status: 'sent' }, { voided_at: '2026-11-16T18:05:00Z' }, { status: 'held' }, { status: 'awaiting_approval' }, { status: 'drafted' }]) {
      expect(signAgainOffered({ item: signed(over), office: true, leader: true })).toBe(false)
    }
  })

  it('not on an unsigned notice, nor on one the draft has outgrown: its signing line is back already', () => {
    expect(signAgainOffered({ item: signed(LIEN_DESK_SIGNATURE_CLEAR), office: true, leader: true })).toBe(false)
    expect(signAgainOffered({ item: signed({ fields: { ...FIELDS, gcEmail: 'other@example.test' } }), office: true, leader: true })).toBe(false)
  })

  it('left out while the leader’s own Not me is drawn for the same signature', () => {
    expect(signAgainOffered({ item: signed({ signer_signature_mode: 'code' }), office: false, leader: true, disownOffered: true })).toBe(false)
  })
})

describe('canClearSignatureRow', () => {
  it('approved, unprinted, live and signed, whatever the draft has done since', () => {
    expect(canClearSignatureRow(signed())).toBe(true)
    expect(canClearSignatureRow(signed({ signed_fields_hash: 'stale' }))).toBe(true)
    expect(canClearSignatureRow(signed({ signed_at: null }))).toBe(false)
    expect(canClearSignatureRow(signed({ printed_at: '2026-11-16T18:05:00Z' }))).toBe(false)
    expect(canClearSignatureRow(signed({ status: 'sent' }))).toBe(false)
    expect(canClearSignatureRow(signed({ voided_at: '2026-11-16T18:05:00Z' }))).toBe(false)
    expect(canClearSignatureRow(null)).toBe(false)
  })
})

describe('the line the notice keeps', () => {
  const by = { userId: 'u-dana', userName: ' Dana ' }
  const record = signatureClearedRecord(signed(), by, '2026-11-17T15:30:00Z')

  it('names who cleared it, when, and the signature that came off, with its stored drawing', () => {
    expect(record).toEqual({ at: '2026-11-17T15:30:00Z', by: 'u-dana', byName: 'Dana', signedAt: '2026-11-16T21:00:00Z', signedBy: 'u-avery', signerName: 'Avery Stone', mode: 'draw', storagePath: 'desk/it1/ink.png' })
  })

  it('rides the fields with every other field kept, and reads back', () => {
    const fields = fieldsWithSignatureCleared({ ...FIELDS, runTakenBack: { at: '2026-11-16T18:09:00Z' } }, record)
    expect(fields.notice).toEqual(FIELDS.notice)
    expect(fields.runTakenBack).toEqual({ at: '2026-11-16T18:09:00Z' })
    expect(signatureClearedOf(fields)).toEqual(record)
    expect(signatureClearedOf(FIELDS)).toBeNull()
    expect(signatureClearedOf({ signatureCleared: { by: 'u-dana' } })).toBeNull()
    expect(signatureClearedOf(null)).toBeNull()
  })

  it('a cleared row with the line reads unsigned', () => {
    expect(lienItemUnsigned({ ...signed(LIEN_DESK_SIGNATURE_CLEAR), fields: fieldsWithSignatureCleared(FIELDS, record) })).toBe(true)
  })

  it('says so under the paper', () => {
    expect(signatureClearedWords(record)).toBe('Signature cleared Nov 17 by Dana. It was a drawn signature by Avery Stone from Nov 16.')
    expect(signatureClearedWords({ ...record, byName: null, mode: 'type' })).toBe('Signature cleared Nov 17. It was a signature by Avery Stone from Nov 16.')
    expect(signatureClearedWords({ ...record, mode: 'pen', signerName: null })).toBe('Signature cleared Nov 17 by Dana. It was a pen signature from Nov 16.')
    expect(signatureClearedWords({ ...record, mode: 'code' })).toBe('Signature cleared Nov 17 by Dana. It was a signature by code by Avery Stone from Nov 16.')
    expect(signatureClearedWords({ ...record, signedAt: null })).toBe('Signature cleared Nov 17 by Dana.')
    expect(signatureClearedWords(null)).toBeNull()
  })
})

describe('the words', () => {
  it('the link and the button name the act', () => {
    expect(LIEN_SIGN_AGAIN_LABEL).toBe('Sign it again…')
    expect(LIEN_SIGN_AGAIN_CONFIRM_LABEL).toBe('Clear the signature')
  })

  it('how it gets signed next follows who is at the screen', () => {
    expect(signAgainHow({ leader: true, otherScreen: false })).toBe('self')
    expect(signAgainHow({ leader: true, otherScreen: true })).toBe('here_or_his_screen')
    expect(signAgainHow({ leader: false, otherScreen: true })).toBe('here_or_his_screen')
    expect(signAgainHow({ leader: false, otherScreen: false })).toBe('his_screen')
  })

  it('the job by name and number', () => {
    expect(signAgainJobWords('4120', 'Halden Yard')).toBe('Halden Yard, job 4120')
    expect(signAgainJobWords('4120', '')).toBe('job 4120')
    expect(signAgainJobWords('', 'Halden Yard')).toBe('Halden Yard')
    expect(signAgainJobWords(null, null)).toBe('this job')
  })

  const base = { jobWords: 'Halden Yard, job 4120', signedAtIso: '2026-11-16T21:00:00Z', signerName: 'Avery Stone', leaderName: 'Avery Stone' }

  it('to the office on another screen: whose signature, that the approval stands, that the run holds it, and how he signs', () => {
    expect(signAgainConfirmWords({ ...base, ownSignature: false, how: 'here_or_his_screen' })).toEqual({
      title: 'Sign the notice again for Halden Yard, job 4120?',
      message:
        'Avery Stone’s signature from Nov 16 comes off this notice. The approval stands. The run holds the notice until it is signed again. Avery signs it on his own screen, or here with his code or his hand. The notice keeps a line saying who cleared it and when.',
      confirmLabel: 'Clear the signature',
    })
  })

  it('to the leader himself: his own signature, and the signing box opens', () => {
    expect(signAgainConfirmWords({ ...base, ownSignature: true, how: 'self' }).message).toBe(
      'Your signature from Nov 16 comes off this notice. The approval stands. The run holds the notice until you sign it again. The signing box opens here for you. The notice keeps a line saying who cleared it and when.',
    )
  })

  it('with no master on the job and no name on the mark, the leader stands in', () => {
    expect(signAgainConfirmWords({ jobWords: 'this job', signedAtIso: null, signerName: null, leaderName: null, ownSignature: false, how: 'his_screen' }).message).toBe(
      'The leader’s signature comes off this notice. The approval stands. The run holds the notice until it is signed again. The leader signs it on his own screen. The notice keeps a line saying who cleared it and when.',
    )
  })

  it('afterwards: the notice waits to be signed again', () => {
    expect(signAgainDoneWords({ how: 'self', leaderName: 'Avery Stone' })).toBe('Cleared. The signing box is open. Sign the notice again.')
    expect(signAgainDoneWords({ how: 'here_or_his_screen', leaderName: 'Avery Stone' })).toBe('Cleared. The notice waits for Avery to sign it again.')
    expect(signAgainDoneWords({ how: 'his_screen', leaderName: null })).toBe('Cleared. The notice waits for the leader to sign it again.')
  })

  it('every sentence is plain words', () => {
    const all = [
      ...(['self', 'here_or_his_screen', 'his_screen'] as const).flatMap((how) => {
        const w = signAgainConfirmWords({ ...base, ownSignature: how === 'self', how })
        return [w.title, w.message, w.confirmLabel, signAgainDoneWords({ how, leaderName: base.leaderName })]
      }),
      LIEN_SIGN_AGAIN_GONE,
      signatureClearedWords(signatureClearedRecord(signed(), { userId: 'u-dana', userName: 'Dana' }, '2026-11-17T15:30:00Z')) ?? '',
    ]
    for (const words of all) expect(plainWordsFailures(words), words).toEqual([])
  })
})
