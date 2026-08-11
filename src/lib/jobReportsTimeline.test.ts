import { describe, expect, it } from 'vitest'
import {
  buildJobReportsTimelineItems,
  jobReportAuthorInitials,
  jobReportsPercentArc,
} from './jobReportsTimeline'

const REPORT = (id: string, name: string | null, fields: Record<string, string> | null) => ({
  id,
  created_by_name: name,
  field_values: fields,
})

describe('jobReportAuthorInitials', () => {
  it('takes first and last initials, uppercased', () => {
    expect(jobReportAuthorInitials('Paige Bloomer')).toBe('PB')
    expect(jobReportAuthorInitials('Abraham')).toBe('A')
    expect(jobReportAuthorInitials('  ')).toBe('?')
    expect(jobReportAuthorInitials(null)).toBe('?')
  })
})

describe('buildJobReportsTimelineItems', () => {
  it('extracts percent and a one-line preview, skipping percent and signature fields', () => {
    const items = buildJobReportsTimelineItems([
      REPORT('r1', 'Abraham', {
        'How complete is the job?': '0',
        'What is the status of the job?': 'Not complete\ncouldn’t find clean out',
      }),
    ])
    expect(items[0]).toMatchObject({
      initials: 'A',
      percent: 0,
      previewLine: 'Not complete',
    })
  })

  it('handles reports with no fields', () => {
    const items = buildJobReportsTimelineItems([REPORT('r1', null, null)])
    expect(items[0]).toMatchObject({ initials: '?', percent: null, previewLine: '' })
  })

  it('skips signature data-url values for the preview', () => {
    const items = buildJobReportsTimelineItems([
      REPORT('r1', 'Paige', {
        Signature: 'data:image/png;base64,AAAA',
        Notes: 'Toilet pulled',
      }),
    ])
    expect(items[0]?.previewLine).toBe('Toilet pulled')
  })
})

describe('jobReportsPercentArc', () => {
  it('reads oldest → newest from newest-first input', () => {
    const arc = jobReportsPercentArc([
      REPORT('new', 'P', { 'How complete is the job?': '60' }),
      REPORT('mid', 'A', { Notes: 'no percent here' }),
      REPORT('old', 'A', { 'How complete is the job?': '0' }),
    ])
    expect(arc).toEqual({ fromPercent: 0, toPercent: 60 })
  })

  it('null when no report has a percent; single value collapses', () => {
    expect(jobReportsPercentArc([REPORT('a', 'x', { Notes: 'hi' })])).toBeNull()
    expect(jobReportsPercentArc([REPORT('a', 'x', { 'How complete is the job?': '40' })])).toEqual({
      fromPercent: 40,
      toPercent: 40,
    })
  })
})
