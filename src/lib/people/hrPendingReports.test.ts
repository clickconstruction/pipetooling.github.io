import { describe, expect, it } from 'vitest'
import { formatHrReportWhen } from './hrPendingReports'

describe('formatHrReportWhen', () => {
  it('separates when it happened from when it was written', () => {
    expect(formatHrReportWhen({ occurred_date: '2026-08-24', created_at: '2026-08-25T12:00:00Z', author_name: 'Malachi Whites' }))
      .toBe('happened Aug 24 · written by Malachi Whites, Aug 25')
  })
  it('omits the author when unknown', () => {
    expect(formatHrReportWhen({ occurred_date: '2026-08-01', created_at: '2026-08-01T09:00:00Z', author_name: '  ' }))
      .toBe('happened Aug 1 · written Aug 1')
  })
  it('passes odd dates through rather than inventing one', () => {
    expect(formatHrReportWhen({ occurred_date: 'unknown', created_at: '2026-12-31T00:00:00Z', author_name: 'R' }))
      .toBe('happened unknown · written by R, Dec 31')
  })
})
