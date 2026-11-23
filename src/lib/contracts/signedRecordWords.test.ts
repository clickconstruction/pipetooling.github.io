import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { SIGNED_RECORD_LAYOUT_DID_NOT_READ, SIGNED_RECORD_PDF_RULE, SIGNED_RECORD_SIGNATURE_DID_NOT_OPEN } from './signedRecordWords'

describe('the Signed contract window’s words about its reads', () => {
  it('says a layout that did not read, and where the answers still are', () => {
    expect(SIGNED_RECORD_LAYOUT_DID_NOT_READ).toBe('The form’s layout did not read, so its answers are not listed here. The PDF holds them.')
  })

  it('no longer says the signature’s image is kept for the office: an estimator reads an outside company’s', () => {
    expect(SIGNED_RECORD_SIGNATURE_DID_NOT_OPEN).not.toContain('kept for the office')
    expect(SIGNED_RECORD_SIGNATURE_DID_NOT_OPEN).toContain('an estimator on an outside company’s paper')
  })

  it('says who opens the signed PDF, a training estimator among those who do not', () => {
    expect(SIGNED_RECORD_PDF_RULE).toContain('An estimator opens an outside company’s.')
    expect(SIGNED_RECORD_PDF_RULE.endsWith('A training estimator opens none.')).toBe(true)
  })

  it('each is plain words', () => {
    for (const words of [SIGNED_RECORD_LAYOUT_DID_NOT_READ, SIGNED_RECORD_SIGNATURE_DID_NOT_OPEN, SIGNED_RECORD_PDF_RULE]) {
      expect(plainWordsFailures(words)).toEqual([])
    }
  })
})
