import { describe, expect, it } from 'vitest'
import type { UserRole } from '../../hooks/useAuth'
import { canManageActivityGrants, canPickOfficeJob, canSeePayrollViews, canSeeReviewTab, canSeeScoreboardTab, canSetFleetRules, canUseUsersTags } from './peopleDoorGates'

const ROLES: readonly UserRole[] = ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers']

describe('peopleDoorGates — the People page doors punch list #188 opened', () => {
  it('Review, the office job, the tags and the activity grants open to the owner, a dev and nobody else (rows 2, 56, 57, 58)', () => {
    for (const gate of [canSeeReviewTab, canPickOfficeJob, canUseUsersTags, canManageActivityGrants]) {
      expect(ROLES.filter((r) => gate(false, r))).toEqual(['dev', 'master_technician'])
      // The hook's dev flag opens it too, whatever the role has resolved to.
      expect(gate(true, null)).toBe(true)
      expect(gate(false, null)).toBe(false)
    }
  })
  it('the Scoreboard opens to the owner, a dev and anyone with payroll access (row 3)', () => {
    expect(ROLES.filter((r) => canSeeScoreboardTab(false, false, r))).toEqual(['dev', 'master_technician'])
    expect(canSeeScoreboardTab(false, true, 'controller')).toBe(true)
    expect(canSeeScoreboardTab(false, false, 'controller')).toBe(false)
  })
  it('the Balances and Payments views open to the controller and a dev over payroll access, never without it (row 55)', () => {
    expect(ROLES.filter((r) => canSeePayrollViews(true, r))).toEqual(['dev', 'controller'])
    expect(canSeePayrollViews(false, 'controller')).toBe(false)
    expect(canSeePayrollViews(true, 'master_technician')).toBe(false)
  })
  it('the fleet rules open to the owner and a dev, read off the roster role (row 59)', () => {
    expect(ROLES.filter((r) => canSetFleetRules(r))).toEqual(['dev', 'master_technician'])
    expect(canSetFleetRules(undefined)).toBe(false)
  })
})
