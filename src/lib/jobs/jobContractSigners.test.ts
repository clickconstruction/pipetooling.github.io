import { describe, expect, it } from 'vitest'
import { frameAsSignerRow, framesLabel, framesProgress, openFrames, signerFrames } from './jobContractSigners'

const one = { recipient_name: 'Sam Owner', signer_printed_name: null, signer_mode: null, signer_consented_at: null, signed_at: null }
const two = { ...one, co_signer_name: 'Alex Owner', co_signer_email: 'alex@example.com' }

describe('jobContractSigners — one agreement, two frames', () => {
  it('one frame when no second signer is named; nothing to count', () => {
    expect(signerFrames(one)).toHaveLength(1)
    expect(signerFrames(one)[0]!).toMatchObject({ key: 'primary', expectedName: 'Sam Owner', signedAt: null })
    expect(framesProgress(one)).toBeNull()
    expect(framesLabel(one)).toBe('')
    // a one-frame row signed the old way: the frame's stamp is signed_at
    const signed = { ...one, signer_printed_name: 'Sam Owner', signer_mode: 'type', signer_consented_at: '2026-09-21T14:29:00Z', signed_at: '2026-09-21T14:30:00Z' }
    expect(signerFrames(signed)[0]!.signedAt).toBe('2026-09-21T14:29:00Z')
    expect(openFrames(signed)).toHaveLength(0)
    // an older signed row without a consent stamp still reads its signed_at
    expect(signerFrames({ ...signed, signer_consented_at: null })[0]!.signedAt).toBe('2026-09-21T14:30:00Z')
  })

  it('two frames, both open: 0 of 2, waiting on both, in the order the page offers them', () => {
    const frames = signerFrames(two)
    expect(frames.map((f) => f.key)).toEqual(['primary', 'co'])
    expect(frames[1]!).toMatchObject({ expectedName: 'Alex Owner', signedAt: null })
    expect(framesProgress(two)).toEqual({ done: 0, of: 2, waitingOn: ['Sam Owner', 'Alex Owner'] })
    expect(framesLabel(two)).toBe('0 of 2 signed')
    expect(openFrames(two).map((f) => f.key)).toEqual(['primary', 'co'])
  })

  it('the first frame filled while the agreement is still out: 1 of 2, waiting on the second; signed_at stays empty', () => {
    const half = { ...two, signer_printed_name: 'Sam Owner', signer_mode: 'draw', signer_consented_at: '2026-09-21T14:29:00Z', signed_at: null }
    expect(framesProgress(half)).toEqual({ done: 1, of: 2, waitingOn: ['Alex Owner'] })
    expect(openFrames(half).map((f) => f.key)).toEqual(['co'])
    expect(signerFrames(half)[0]!.signedAt).toBe('2026-09-21T14:29:00Z')
    expect(frameAsSignerRow(signerFrames(half)[0]!)).toEqual({ signed_at: '2026-09-21T14:29:00Z', signer_printed_name: 'Sam Owner', signer_mode: 'draw', signer_consented_at: '2026-09-21T14:29:00Z' })
  })

  it('the second frame filled first: 1 of 2, waiting on the first', () => {
    const coFirst = { ...two, co_signed_at: '2026-09-21T09:00:00Z', co_signer_printed_name: 'Alex Owner', co_signer_mode: 'type', co_signer_consented_at: '2026-09-21T09:00:00Z' }
    expect(framesProgress(coFirst)).toEqual({ done: 1, of: 2, waitingOn: ['Sam Owner'] })
    expect(openFrames(coFirst).map((f) => f.key)).toEqual(['primary'])
    // both filled: 2 of 2, nothing open; a nameless second signer is named by its role
    const both = { ...coFirst, signer_printed_name: 'Sam Owner', signer_mode: 'type', signer_consented_at: '2026-09-21T10:00:00Z', signed_at: '2026-09-21T10:00:00Z' }
    expect(framesLabel(both)).toBe('2 of 2 signed')
    expect(openFrames(both)).toHaveLength(0)
    expect(framesProgress({ ...two, co_signer_name: ' ', recipient_name: null })).toBeNull()
  })
})
