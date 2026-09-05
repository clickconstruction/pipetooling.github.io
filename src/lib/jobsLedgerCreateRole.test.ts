import { describe, expect, it } from 'vitest'
import { canCreateJobsLedgerRow } from './jobsLedgerCreateRole'

describe('canCreateJobsLedgerRow', () => {
  it('admits exactly the roles in the jobs_ledger INSERT policy', () => {
    expect(canCreateJobsLedgerRow('dev')).toBe(true)
    expect(canCreateJobsLedgerRow('master_technician')).toBe(true)
    expect(canCreateJobsLedgerRow('assistant')).toBe(true)
  })

  it('refuses the roles the policy refuses (the per-project Create Job link was a dead door for them)', () => {
    for (const role of ['superintendent', 'primary', 'estimator', 'controller', 'subcontractor', 'helpers', null, undefined, '']) {
      expect(canCreateJobsLedgerRow(role)).toBe(false)
    }
  })
})
