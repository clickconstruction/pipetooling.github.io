import { describe, expect, it } from 'vitest'
import { allReportFieldLinesForThread, firstNonEmptyFieldValueSummary } from './reportForViewFromJobLedgerRow'
import { REPORT_FIELD_LABEL_JOB_COMPLETION, REPORT_FIELD_LABEL_LEGACY_WHO } from './reportTemplateFieldDisplay'
import { REPORT_SIGNATURE_ON_FILE } from './reportSignatureField'

const base = {
  id: '1',
  template_name: 'Status Report',
  job_display_name: 'J1',
  created_at: new Date().toISOString(),
  created_by_name: 'A',
}

describe('firstNonEmptyFieldValueSummary', () => {
  it('uses sentence for job completion percent', () => {
    expect(
      firstNonEmptyFieldValueSummary({
        ...base,
        field_values: { [REPORT_FIELD_LABEL_JOB_COMPLETION]: '46' },
      }),
    ).toBe('I think the job is 46% complete')
  })

  it('returns raw text for non-percent field', () => {
    expect(
      firstNonEmptyFieldValueSummary({
        ...base,
        field_values: { Notes: '  Something happened  ' },
      }),
    ).toBe('Something happened')
  })

  it('omits legacy Who key when new completion key exists', () => {
    expect(
      firstNonEmptyFieldValueSummary({
        ...base,
        field_values: {
          [REPORT_FIELD_LABEL_LEGACY_WHO]: '99',
          [REPORT_FIELD_LABEL_JOB_COMPLETION]: '10',
        },
      }),
    ).toBe('I think the job is 10% complete')
  })

  it('uses legacy key when new completion key is absent', () => {
    expect(
      firstNonEmptyFieldValueSummary({
        ...base,
        field_values: { [REPORT_FIELD_LABEL_LEGACY_WHO]: '22' },
      }),
    ).toBe('I think the job is 22% complete')
  })

  it('does not flood thread summary with signature base64', () => {
    expect(
      firstNonEmptyFieldValueSummary({
        ...base,
        field_values: { Signature: 'data:image/png;base64,Zm9v' },
      }),
    ).toBe(REPORT_SIGNATURE_ON_FILE)
  })
})

describe('allReportFieldLinesForThread (v2.1046 full inline report)', () => {
  it('returns every non-empty field with labels, formatted values, in order', () => {
    const lines = allReportFieldLinesForThread({
      ...base,
      field_values: {
        'How complete is the job?': '57',
        'What did you do?': 'Trim complete. Fridge may have an internal leak.',
        'Empty field': '   ',
      },
    })
    expect(lines).toEqual([
      { label: 'How complete is the job?', value: '57%' },
      { label: 'What did you do?', value: 'Trim complete. Fridge may have an internal leak.' },
    ])
  })

  it('hides the legacy who-key when the new completion key exists, and maps its label otherwise', () => {
    expect(
      allReportFieldLinesForThread({
        ...base,
        field_values: { [REPORT_FIELD_LABEL_LEGACY_WHO]: '22', 'How complete is the job?': '30' },
      }).map((l) => l.label),
    ).toEqual(['How complete is the job?'])
    expect(
      allReportFieldLinesForThread({
        ...base,
        field_values: { [REPORT_FIELD_LABEL_LEGACY_WHO]: '22' },
      }),
    ).toEqual([{ label: 'How complete is the job?', value: '22%' }])
  })

  it('drops the label for UUID field keys — value renders alone (v2.1048)', () => {
    expect(
      allReportFieldLinesForThread({
        ...base,
        field_values: { 'e4e6647f-a430-42d7-ab51-a37229a015fd': '[HCP] camera for toilet issues' },
      }),
    ).toEqual([{ label: '', value: '[HCP] camera for toilet issues' }])
  })

  it('replaces signature images with the on-file placeholder', () => {
    expect(
      allReportFieldLinesForThread({
        ...base,
        field_values: { Signature: 'data:image/png;base64,Zm9v' },
      }),
    ).toEqual([{ label: 'Signature', value: REPORT_SIGNATURE_ON_FILE }])
  })
})
