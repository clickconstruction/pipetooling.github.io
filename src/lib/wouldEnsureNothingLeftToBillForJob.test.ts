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

describe('v2.3775 — a partly paid billed line counts for what is still unpaid on it', () => {
  it('job 978: $3,630 bid, $2,999 paid, one $1,072.50 billed line with $1,018.87 applied → Prepare bill stays', () => {
    expect(
      wouldEnsureNothingLeftToBillForJob(
        JOB,
        { revenue: 3630, payments_made: 2999 },
        [{ job_id: JOB, status: 'billed', amount: 1072.5, invoice_payments: [{ amount: 1018.87 }] }],
      ),
    ).toBe(false)
    // Without its payments the same line reads as the whole $1,072.50 → nothing left (the bug).
    expect(
      wouldEnsureNothingLeftToBillForJob(JOB, { revenue: 3630, payments_made: 2999 }, [
        { job_id: JOB, status: 'billed', amount: 1072.5 },
      ]),
    ).toBe(true)
  })
})
