import { describe, expect, it } from 'vitest'
import { JOB_STEPPER_ORDER, jobStepperMoveDisabledReason } from './jobStatusStepper'

describe('jobStepperMoveDisabledReason', () => {
  it('offers exactly the RPC-legal single hops', () => {
    const allowed: Array<[string, string]> = []
    for (const from of JOB_STEPPER_ORDER) {
      for (const to of JOB_STEPPER_ORDER) {
        if (jobStepperMoveDisabledReason(from, to) == null) allowed.push([from, to])
      }
    }
    expect(allowed.sort()).toEqual(
      [
        ['waiting', 'working'],
        ['working', 'waiting'],
        ['working', 'ready_to_bill'],
        ['ready_to_bill', 'working'],
        ['ready_to_bill', 'billed'],
        ['billed', 'paid'],
        ['paid', 'billed'],
      ].sort(),
    )
  })

  it('keeps billed → ready_to_bill board-only (Stripe void prep)', () => {
    expect(jobStepperMoveDisabledReason('billed', 'ready_to_bill')).toContain('Send back')
  })

  it('explains skipped stages', () => {
    expect(jobStepperMoveDisabledReason('waiting', 'paid')).toContain('Bill the job first')
    expect(jobStepperMoveDisabledReason('waiting', 'billed')).toContain('Ready to bill')
    expect(jobStepperMoveDisabledReason('billed', 'billed')).toContain('current stage')
  })
})
