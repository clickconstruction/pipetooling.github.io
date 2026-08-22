import { describe, expect, it } from 'vitest'
import { buildStepperReportFieldValues } from './stepperReportFieldValues'

const STATUS_TEMPLATE_FIELDS = [
  { label: 'What is the status of the job?', input_type: 'long_text' },
  { label: 'What needs to be done to get to the next stage?', input_type: 'long_text' },
  { label: 'How complete is the job?', input_type: 'percent_0_100' },
]

describe('buildStepperReportFieldValues', () => {
  it('maps pct to the percent field and the note to the status field', () => {
    expect(buildStepperReportFieldValues(STATUS_TEMPLATE_FIELDS, 100, ' Wrapped the trim, customer walked it ')).toEqual({
      'What is the status of the job?': 'Wrapped the trim, customer walked it',
      'What needs to be done to get to the next stage?': '',
      'How complete is the job?': '100',
    })
  })

  it('empty note leaves the status field blank; pct is clamped and rounded', () => {
    expect(buildStepperReportFieldValues(STATUS_TEMPLATE_FIELDS, 64.6, '')).toEqual({
      'What is the status of the job?': '',
      'What needs to be done to get to the next stage?': '',
      'How complete is the job?': '65',
    })
    expect(buildStepperReportFieldValues(STATUS_TEMPLATE_FIELDS, 250, 'x')['How complete is the job?']).toBe('100')
  })

  it('falls back to the first long-text field when the canonical status label is missing', () => {
    const fields = [
      { label: 'Notes', input_type: 'long_text' },
      { label: 'How complete is the job?', input_type: 'percent_0_100' },
    ]
    expect(buildStepperReportFieldValues(fields, 40, 'halfway there')).toEqual({
      Notes: 'halfway there',
      'How complete is the job?': '40',
    })
  })

  it('recognizes a percent field by the legacy label even without input_type', () => {
    const fields = [{ label: 'Who was on the job?' }, { label: 'Notes' }]
    expect(buildStepperReportFieldValues(fields, 80, 'n')).toEqual({
      'Who was on the job?': '80',
      Notes: 'n',
    })
  })
})
