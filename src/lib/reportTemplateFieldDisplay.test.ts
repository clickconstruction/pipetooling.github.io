import { describe, expect, it } from 'vitest'
import {
  fieldValueForSubmit,
  formatReportFieldValueForRead,
  formatReportFieldValueForThreadSummary,
  normalizePercentFieldValueToString,
  REPORT_FIELD_LABEL_JOB_COMPLETION,
  REPORT_FIELD_LABEL_LEGACY_WHO,
} from './reportTemplateFieldDisplay'
import { REPORT_SIGNATURE_ON_FILE } from './reportSignatureField'

describe('reportTemplateFieldDisplay', () => {
  it('normalizes percent submit', () => {
    expect(normalizePercentFieldValueToString('42')).toBe('42')
    expect(normalizePercentFieldValueToString('150')).toBe('100')
    expect(normalizePercentFieldValueToString('')).toBe('0')
    expect(normalizePercentFieldValueToString('x')).toBe('0')
  })

  it('fieldValueForSubmit', () => {
    expect(
      fieldValueForSubmit(
        { label: 'A', input_type: 'percent_0_100' },
        { A: '7' },
      ),
    ).toBe('7')
    expect(
      fieldValueForSubmit(
        { label: 'A', input_type: 'long_text' },
        { A: ' hi ' },
      ),
    ).toBe(' hi ')
    expect(
      fieldValueForSubmit(
        { label: 'S', input_type: 'signature_png' },
        { S: 'data:image/png;base64,x' },
      ),
    ).toBe('data:image/png;base64,x')
  })

  it('formatReportFieldValueForRead', () => {
    expect(
      formatReportFieldValueForRead(REPORT_FIELD_LABEL_JOB_COMPLETION, '50', { inputType: 'percent_0_100' }),
    ).toBe('50%')
    expect(
      formatReportFieldValueForRead(REPORT_FIELD_LABEL_LEGACY_WHO, '3', { inputType: undefined }),
    ).toBe('3%')
    expect(
      formatReportFieldValueForRead('Other', 'hello', { inputType: 'long_text' }),
    ).toBe('hello')
    expect(
      formatReportFieldValueForRead('Signature', 'data:image/png;base64,x', { inputType: 'signature_png' }),
    ).toBe('')
  })

  it('formatReportFieldValueForThreadSummary', () => {
    expect(formatReportFieldValueForThreadSummary(REPORT_FIELD_LABEL_JOB_COMPLETION, '46')).toBe(
      'I think the job is 46% complete',
    )
    expect(formatReportFieldValueForThreadSummary(REPORT_FIELD_LABEL_LEGACY_WHO, '0')).toBe('I think the job is 0% complete')
    expect(formatReportFieldValueForThreadSummary('Details', 'Still working')).toBe('Still working')
    expect(
      formatReportFieldValueForThreadSummary(REPORT_FIELD_LABEL_LEGACY_WHO, 'not a number'),
    ).toBe('not a number')
    expect(
      formatReportFieldValueForThreadSummary('Signature', 'data:image/png;base64,x'),
    ).toBe(REPORT_SIGNATURE_ON_FILE)
  })
})
