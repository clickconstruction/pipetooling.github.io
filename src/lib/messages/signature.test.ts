/**
 * The signature card's draft and rules (punch list #207 PR 1): the row's lines read trimmed and two at most, the boxes
 * from what is kept and back, a long line refused in words, and the words themselves plain.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  SIGNATURE_FREE_LINES_MAX,
  SIGNATURE_LINE_MAX,
  SIGNATURE_WORDS,
  freeLinesOf,
  sameSignature,
  signatureDraftFrom,
  signatureDraftProblem,
  signatureKeptOf,
} from './signature'

describe('the two lines as the row holds them', () => {
  it('reads strings trimmed, the empty ones out, two at most; anything else is none', () => {
    expect(freeLinesOf(['  bids@clickplumbing.example ', '', ' TX M-12345', 'a third'])).toEqual(['bids@clickplumbing.example', 'TX M-12345'])
    expect(freeLinesOf(null)).toEqual([])
    expect(freeLinesOf('bids@')).toEqual([])
    expect(freeLinesOf([1, null, 'one'])).toEqual(['one'])
    expect(SIGNATURE_FREE_LINES_MAX).toBe(2)
  })
})

describe('the card’s boxes', () => {
  it('draws the title and two lines from what is kept, blank where none is', () => {
    expect(signatureDraftFrom({ title: 'Estimator', lines: ['bids@clickplumbing.example'] })).toEqual({ title: 'Estimator', lines: ['bids@clickplumbing.example', ''] })
    expect(signatureDraftFrom({ title: null, lines: [] })).toEqual({ title: '', lines: ['', ''] })
  })

  it('saves the title trimmed or null, and the lines with the blank ones out', () => {
    expect(signatureKeptOf({ title: '  Estimator ', lines: ['', ' TX M-12345 '] })).toEqual({ title: 'Estimator', lines: ['TX M-12345'] })
    expect(signatureKeptOf({ title: '   ', lines: ['', ''] })).toEqual({ title: null, lines: [] })
  })

  it('refuses a title or a line past the limit, in words, and lights Save only on a change', () => {
    expect(signatureDraftProblem({ title: 'x'.repeat(SIGNATURE_LINE_MAX), lines: ['', ''] })).toBeNull()
    expect(signatureDraftProblem({ title: 'x'.repeat(SIGNATURE_LINE_MAX + 1), lines: ['', ''] })).toBe(SIGNATURE_WORDS.tooLong)
    expect(signatureDraftProblem({ title: '', lines: ['', 'y'.repeat(SIGNATURE_LINE_MAX + 1)] })).toBe(SIGNATURE_WORDS.tooLong)
    expect(sameSignature({ title: 'Estimator', lines: ['a'] }, signatureKeptOf({ title: 'Estimator ', lines: [' a', ''] }))).toBe(true)
    expect(sameSignature({ title: 'Estimator', lines: ['a'] }, { title: 'Estimator', lines: ['a', 'b'] })).toBe(false)
    expect(sameSignature({ title: null, lines: [] }, { title: 'Office', lines: [] })).toBe(false)
  })
})

describe('plain words', () => {
  it('holds every sentence the card says', () => {
    const sentences = Object.values(SIGNATURE_WORDS)
    expect(sentences.flatMap((s) => plainWordsFailures(s))).toEqual([])
  })
})
