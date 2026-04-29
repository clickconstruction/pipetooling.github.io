import { describe, expect, it } from 'vitest'
import {
  isReportSignatureImageDataUrl,
  reportSignatureDataUrlDecodedByteLength,
  validateReportSignatureDataUrlForSubmit,
  formatReportFieldValueInlineList,
  REPORT_SIGNATURE_ON_FILE,
} from './reportSignatureField'

describe('reportSignatureField', () => {
  it('detects png data URLs', () => {
    expect(isReportSignatureImageDataUrl('data:image/png;base64,abc+')).toBe(true)
    expect(isReportSignatureImageDataUrl('hello')).toBe(false)
  })

  it('validates decoded byte length', () => {
    const oneByte = 'data:image/png;base64,QQ=='
    expect(reportSignatureDataUrlDecodedByteLength(oneByte)).toBe(1)
    expect(validateReportSignatureDataUrlForSubmit('')).toMatch(/sign/i)
    expect(validateReportSignatureDataUrlForSubmit('data:image/jpeg;base64,QQ==')).toMatch(/PNG/i)
    expect(validateReportSignatureDataUrlForSubmit(oneByte)).toBe(null)
    const oversized = `data:image/png;base64,${'A'.repeat(900_000)}`
    expect(validateReportSignatureDataUrlForSubmit(oversized)).toMatch(/too large/i)
  })

  it('formatReportFieldValueInlineList strips signature blobs', () => {
    expect(formatReportFieldValueInlineList('data:image/png;base64,QQ==')).toBe(REPORT_SIGNATURE_ON_FILE)
    expect(formatReportFieldValueInlineList('notes')).toBe('notes')
  })
})
