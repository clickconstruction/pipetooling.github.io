import { describe, expect, it } from 'vitest'
import { firstNonEmptyFieldValueSummary } from './reportForViewFromJobLedgerRow'
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
