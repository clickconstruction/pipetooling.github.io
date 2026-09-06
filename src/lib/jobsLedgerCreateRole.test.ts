import { describe, expect, it } from 'vitest'
import { canCreateJobsLedgerRow } from './jobsLedgerCreateRole'

describe('canCreateJobsLedgerRow', () => {
  it('admits exactly the roles in the jobs_ledger INSERT policy', () => {
    expect(canCreateJobsLedgerRow('dev')).toBe(true)
    expect(canCreateJobsLedgerRow('master_technician')).toBe(true)
    expect(canCreateJobsLedgerRow('assistant')).toBe(true)
    // 20260906010000_role_sweep_predicates: the INSERT policy's array gained controller beside assistant.
    expect(canCreateJobsLedgerRow('controller')).toBe(true)
  })

  it('refuses the roles the policy refuses (the per-project Create Job link was a dead door for them)', () => {
    for (const role of ['superintendent', 'primary', 'estimator', 'subcontractor', 'helpers', null, undefined, '']) {
      expect(canCreateJobsLedgerRow(role)).toBe(false)
    }
  })
})
