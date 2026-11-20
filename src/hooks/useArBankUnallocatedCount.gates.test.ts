import { describe, expect, it } from 'vitest'
import {
  canRoleSeeArBankUnallocatedDashboardBanner,
  canRoleSeeArBankUnallocatedOrgNudge,
  canRoleUseArBankCount,
} from './useArBankUnallocatedCount'

/** Every role the app knows (hooks/useAuth `UserRole`) plus the signed-out shapes. */
const ALL_ROLES = ['dev', 'master_technician', 'assistant', 'controller', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent', null, ''] as const

function admitted(gate: (role: string | null) => boolean): string[] {
  return ALL_ROLES.filter((r): r is Exclude<(typeof ALL_ROLES)[number], null> => r != null && gate(r)).sort()
}

describe('the unallocated bank deposits gates', () => {
  it('the count is asked for by the four roles count_mercury_transactions_for_bank_payments answers', () => {
    // 20261119104000_primary_money_desks.sql (v2.7931): u.role IN ('dev', 'master_technician', 'assistant', 'controller').
    expect(admitted(canRoleUseArBankCount)).toEqual(['assistant', 'controller', 'dev', 'master_technician'])
  })

  it('a primary never asks: the database refuses the role, so the call could only fail', () => {
    expect(canRoleUseArBankCount('primary')).toBe(false)
  })

  it('nobody signed out asks', () => {
    expect(canRoleUseArBankCount(null)).toBe(false)
    expect(canRoleUseArBankCount('')).toBe(false)
  })

  it('the Quickfill and /accounts-receivable nudge is the same office pool', () => {
    expect(admitted(canRoleSeeArBankUnallocatedOrgNudge)).toEqual(admitted(canRoleUseArBankCount))
  })

  it('the Dashboard banner stays narrower: no master, and never wider than the count', () => {
    expect(admitted(canRoleSeeArBankUnallocatedDashboardBanner)).toEqual(['assistant', 'controller', 'dev'])
    for (const role of admitted(canRoleSeeArBankUnallocatedDashboardBanner)) expect(canRoleUseArBankCount(role)).toBe(true)
  })
})
