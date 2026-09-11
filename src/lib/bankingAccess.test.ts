import { describe, expect, it } from 'vitest'
import { BANKING_ROLES, canAccessBanking, isStaffBankingRole } from './bankingAccess'
import { ROLES } from './userRoles'

describe('canAccessBanking (v2.3305 — controller and above)', () => {
  it('admits dev, master_technician and controller only', () => {
    const allowed = ROLES.filter((r) => canAccessBanking(r))
    expect(allowed.sort()).toEqual([...BANKING_ROLES].sort())
  })

  it('refuses plain assistants — the 2026-09-11 owner call', () => {
    expect(canAccessBanking('assistant')).toBe(false)
  })

  it('refuses field, estimator, primary and superintendent roles, and no role', () => {
    for (const r of ['subcontractor', 'helpers', 'estimator', 'primary', 'superintendent'] as const) {
      expect(canAccessBanking(r), r).toBe(false)
    }
    expect(canAccessBanking(null)).toBe(false)
    expect(canAccessBanking(undefined)).toBe(false)
  })
})

describe('isStaffBankingRole', () => {
  it('is the non-dev slice of the Banking audience', () => {
    for (const r of ROLES) {
      expect(isStaffBankingRole(r), r).toBe(canAccessBanking(r) && r !== 'dev')
    }
  })
})
