import { describe, expect, it } from 'vitest'
import {
  shouldResyncJobsAfterUpdateJobStatusFailure,
  toastForUpdateJobStatusFailure,
} from './updateJobStatusClientFeedback'

describe('toastForUpdateJobStatusFailure', () => {
  it('maps transition guard to warning', () => {
    const r = toastForUpdateJobStatusFailure('Job must be in Ready to Bill to send back to Working')
    expect(r.variant).toBe('warning')
    expect(r.text).toContain('refreshed')
  })

  it('maps not authorized to error', () => {
    const r = toastForUpdateJobStatusFailure('Not authorized to update job status')
    expect(r.variant).toBe('error')
    expect(r.text).toContain('allowed')
  })
})

describe('shouldResyncJobsAfterUpdateJobStatusFailure', () => {
  it('returns false for empty message', () => {
    expect(shouldResyncJobsAfterUpdateJobStatusFailure('')).toBe(false)
    expect(shouldResyncJobsAfterUpdateJobStatusFailure('   ')).toBe(false)
  })

  it('returns true for non-empty message', () => {
    expect(shouldResyncJobsAfterUpdateJobStatusFailure('x')).toBe(true)
  })
})
