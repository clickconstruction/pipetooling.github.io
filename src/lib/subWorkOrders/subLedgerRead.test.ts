import { describe, expect, it } from 'vitest'
import { subLedgerReadFailure } from './subLedgerRead'

describe('subLedgerReadFailure', () => {
  it('is null when both reads came back', () => {
    expect(subLedgerReadFailure({ lines: null, payments: null })).toBeNull()
    expect(subLedgerReadFailure({ lines: undefined, payments: undefined })).toBeNull()
  })

  it('names the payments, what a draw without them would say, and the reason', () => {
    expect(subLedgerReadFailure({ lines: null, payments: { message: 'permission denied for table people_labor_job_payments' } })).toBe(
      'The sub sheets were not read again: their payments did not load, and without them every sheet would read unpaid. permission denied for table people_labor_job_payments. Reload the page to try again.',
    )
  })

  it('names the lines when the money came back', () => {
    expect(subLedgerReadFailure({ lines: { message: 'statement timeout.' }, payments: null })).toBe(
      'The sub sheets were not read again: their lines did not load, and without them every sheet would read as agreed at nothing. statement timeout. Reload the page to try again.',
    )
  })

  it('leads with the payments when both failed', () => {
    expect(subLedgerReadFailure({ lines: { message: 'a' }, payments: { message: 'b' } })).toContain('their payments did not load')
  })

  it('still stops the draw when the refusal carries no words', () => {
    expect(subLedgerReadFailure({ lines: null, payments: {} })).toMatch(/^The sub sheets were not read again: their payments did not load/)
  })
})
