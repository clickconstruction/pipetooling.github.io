import { describe, expect, it } from 'vitest'
import { frameAsSignerRow, framesLabel, framesProgress, framesWaitingLine, joinSignerNames, openFrames, signedNames, signerFrames, signerNamesLine } from './jobContractSigners'

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

describe('signerNamesLine — who signed, in the words after "signed by" (v2.4590)', () => {
  const signedOne = { ...one, signer_printed_name: 'Sam Owner', signer_mode: 'type', signer_consented_at: '2026-09-21T14:29:00Z', signed_at: '2026-09-21T14:30:00Z' }
  const half = { ...two, signer_printed_name: 'Sam Owner', signer_mode: 'draw', signer_consented_at: '2026-09-21T14:29:00Z', signed_at: null }
  const both = { ...half, signed_at: '2026-09-21T15:02:00Z', co_signed_at: '2026-09-21T15:02:00Z', co_signer_printed_name: 'Alex Q. Owner', co_signer_mode: 'type', co_signer_consented_at: '2026-09-21T15:02:00Z' }

  it('one frame reads its printed name, as every surface did before a second signer', () => {
    expect(signerNamesLine(signedOne)).toBe('Sam Owner')
    expect(signedNames(signedOne)).toEqual(['Sam Owner'])
    // a paper filing: the typed "Who signed", whatever it holds
    expect(signerNamesLine({ ...one, signer_printed_name: 'Sam and Alex Owner', signer_mode: 'paper', signed_at: '2026-09-21T12:00:00Z' })).toBe('Sam and Alex Owner')
    expect(signerNamesLine(one)).toBe('')
    expect(framesWaitingLine(signedOne)).toBe('')
  })

  it('both frames filled: both printed names, first frame first, as each signer typed it', () => {
    expect(signedNames(both)).toEqual(['Sam Owner', 'Alex Q. Owner'])
    expect(signerNamesLine(both)).toBe('Sam Owner and Alex Q. Owner')
    expect(framesWaitingLine(both)).toBe('')
  })

  it('one of two: names only who has signed, and says who it waits on', () => {
    expect(signerNamesLine(half)).toBe('Sam Owner')
    expect(framesWaitingLine(half)).toBe('Sam Owner signed · waiting on Alex Owner')
    const coFirst = { ...two, co_signed_at: '2026-09-21T09:00:00Z', co_signer_printed_name: 'Alex Owner', co_signer_mode: 'type', co_signer_consented_at: '2026-09-21T09:00:00Z' }
    expect(signerNamesLine(coFirst)).toBe('Alex Owner')
    expect(framesWaitingLine(coFirst)).toBe('Alex Owner signed · waiting on Sam Owner')
    // nobody yet: nothing to say beyond the count
    expect(framesWaitingLine(two)).toBe('')
  })

  it('a second signer named on a paper filing never signed in the app: only the typed name reads', () => {
    const filed = { ...two, signer_printed_name: 'Sam Owner', signer_mode: 'paper', signed_at: '2026-09-21T12:00:00Z' }
    expect(signerNamesLine(filed)).toBe('Sam Owner')
  })

  it('joins names the one way: blanks dropped, "and" before the last', () => {
    expect(joinSignerNames([])).toBe('')
    expect(joinSignerNames([' Sam ', null, ''])).toBe('Sam')
    expect(joinSignerNames(['Sam', 'Alex'])).toBe('Sam and Alex')
    expect(joinSignerNames(['Sam', 'Alex', 'Jo'])).toBe('Sam, Alex and Jo')
  })
})
