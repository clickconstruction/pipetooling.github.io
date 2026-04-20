import { describe, expect, it } from 'vitest'
import { wouldEnsureNothingLeftToBillForJob } from './wouldEnsureNothingLeftToBillForJob'

const JOB = '11111111-1111-1111-1111-111111111111'

describe('wouldEnsureNothingLeftToBillForJob', () => {
  it('returns false when job is null (show Prepare Bill)', () => {
    expect(wouldEnsureNothingLeftToBillForJob(JOB, null, [])).toBe(false)
  })

  it('returns false when unallocated > 0 and no RTB rows', () => {
    expect(
      wouldEnsureNothingLeftToBillForJob(
        JOB,
        { revenue: 1000, payments_made: 0 },
        [{ job_id: JOB, status: 'billed', amount: 500 }],
      ),
    ).toBe(false)
  })

  it('returns true when unalloc <= 0 and no RTB rows (only billed lines)', () => {
    expect(
      wouldEnsureNothingLeftToBillForJob(
        JOB,
        { revenue: 1000, payments_made: 0 },
        [{ job_id: JOB, status: 'billed', amount: 1000 }],
      ),
    ).toBe(true)
  })

  it('returns false when unalloc is 0 but an RTB row exists', () => {
    expect(
      wouldEnsureNothingLeftToBillForJob(
        JOB,
        { revenue: 1000, payments_made: 0 },
        [
          { job_id: JOB, status: 'billed', amount: 1000 },
          { job_id: JOB, status: 'ready_to_bill', amount: 0 },
        ],
      ),
    ).toBe(false)
  })
})
