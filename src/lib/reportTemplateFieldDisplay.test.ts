import { describe, expect, it } from 'vitest'
import {
  fieldValueForSubmit,
  formatReportFieldValueForRead,
  formatReportFieldValueForThreadSummary,
  normalizePercentFieldValueToString,
  percentFieldValueForSubmit,
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

  // The percent an untouched Save files (punch list #189, PR 5a): the job's number the form opened on, whichever
  // moment the press lands in — a Save before the seed effect ran filed 0 while the field said 40 (CI, 2026-10-30).
  describe('percentFieldValueForSubmit', () => {
    it('an untouched field with a seed files the seed', () => {
      expect(percentFieldValueForSubmit(undefined, 40)).toBe('40')
      expect(percentFieldValueForSubmit(null, 40)).toBe('40')
      expect(percentFieldValueForSubmit(undefined, 0)).toBe('0')
    })

    it('a pick files the pick, never the seed', () => {
      expect(percentFieldValueForSubmit('75', 40)).toBe('75')
      expect(percentFieldValueForSubmit('0', 40)).toBe('0')
      expect(percentFieldValueForSubmit(' 12 ', 40)).toBe('12')
    })

    it('with no seed an untouched field files 0', () => {
      expect(percentFieldValueForSubmit(undefined, null)).toBe('0')
      expect(percentFieldValueForSubmit(undefined, undefined)).toBe('0')
      expect(percentFieldValueForSubmit('', null)).toBe('0')
    })

    it('with the lines active the seed never applies: the field is read as it is', () => {
      expect(percentFieldValueForSubmit(undefined, 40, true)).toBe('0')
      expect(percentFieldValueForSubmit('60', 40, true)).toBe('60')
    })

    it('the seed is clamped like a pick', () => {
      expect(percentFieldValueForSubmit(undefined, 140)).toBe('100')
      expect(percentFieldValueForSubmit(undefined, -5)).toBe('0')
    })

    it('fieldValueForSubmit seeds only the percent field, and only when asked', () => {
      const pct = { label: REPORT_FIELD_LABEL_JOB_COMPLETION, input_type: 'percent_0_100' }
      expect(fieldValueForSubmit(pct, {}, { percentSeed: 40 })).toBe('40')
      expect(fieldValueForSubmit(pct, {}, { percentSeed: 40, linesActive: true })).toBe('0')
      expect(fieldValueForSubmit(pct, { [REPORT_FIELD_LABEL_JOB_COMPLETION]: '75' }, { percentSeed: 40 })).toBe('75')
      expect(fieldValueForSubmit(pct, {})).toBe('0')
      expect(fieldValueForSubmit({ label: 'Notes', input_type: 'long_text' }, {}, { percentSeed: 40 })).toBe('')
    })
  })
})
