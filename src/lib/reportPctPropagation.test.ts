import { describe, expect, it } from 'vitest'
import { reportPctToPropagate } from './reportPctPropagation'
import {
  REPORT_FIELD_LABEL_JOB_COMPLETION,
  REPORT_FIELD_LABEL_LEGACY_WHO,
} from './reportTemplateFieldDisplay'

describe('reportPctToPropagate', () => {
  it('propagates the report percent when the job has none recorded', () => {
    expect(reportPctToPropagate({ [REPORT_FIELD_LABEL_JOB_COMPLETION]: '100' }, null)).toBe(100)
  })

  it('propagates when the report differs from the current value', () => {
    expect(reportPctToPropagate({ [REPORT_FIELD_LABEL_JOB_COMPLETION]: '75' }, 40)).toBe(75)
  })

  it('propagates downward corrections — the report is the newest field statement', () => {
    expect(reportPctToPropagate({ [REPORT_FIELD_LABEL_JOB_COMPLETION]: '50' }, 80)).toBe(50)
  })

  it('skips when the report matches the current value (no redundant thread note)', () => {
    expect(reportPctToPropagate({ [REPORT_FIELD_LABEL_JOB_COMPLETION]: '60' }, 60)).toBeNull()
  })

  it('skips reports with no completion field', () => {
    expect(reportPctToPropagate({ 'What got done today?': 'set fixtures' }, 40)).toBeNull()
  })

  it('skips unparseable percent values', () => {
    expect(reportPctToPropagate({ [REPORT_FIELD_LABEL_JOB_COMPLETION]: 'almost done' }, 40)).toBeNull()
  })

  it('skips null/undefined field_values', () => {
    expect(reportPctToPropagate(null, 40)).toBeNull()
    expect(reportPctToPropagate(undefined, null)).toBeNull()
  })

  it('reads the legacy "Who was on the job?" key when the new key is absent', () => {
    expect(reportPctToPropagate({ [REPORT_FIELD_LABEL_LEGACY_WHO]: '90' }, null)).toBe(90)
  })

  it('prefers the new key when both are present', () => {
    expect(
      reportPctToPropagate(
        { [REPORT_FIELD_LABEL_JOB_COMPLETION]: '30', [REPORT_FIELD_LABEL_LEGACY_WHO]: '90' },
        null,
      ),
    ).toBe(30)
  })
})
