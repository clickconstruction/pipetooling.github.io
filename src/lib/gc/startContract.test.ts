// GC mode, the real build: Get started's $0 guard on our contract (the owner, 2026-10-10).
import { describe, expect, it } from 'vitest'
import { boardStateFromRows } from './boardRows'
import { readyClinicBoardRows } from './boardTestRows'
import { ownerContractWorthNow } from './ownerBilling'
import { contractSignsAtZero, ownerContractTotalNow } from './startContract'
import type { GcProject } from './types'

const clinic = (): GcProject => boardStateFromRows(readyClinicBoardRows()).projects.find((p) => p.id === 'p1')!

describe('our contract’s total today', () => {
  it('is the sum of every line Mark it signed keeps', () => {
    const p = clinic()
    const lines = ownerContractWorthNow(p)
    expect(ownerContractTotalNow(p)).toBe(Object.values(lines).reduce((a, b) => a + b, 0))
    expect(ownerContractTotalNow(p)).toBeGreaterThan(0)
    expect(contractSignsAtZero(p)).toBe(false)
  })

  it('signs at $0 when no trade carries a price and Our number adds nothing', () => {
    const p = clinic()
    // The test project on the walk: no trade carries anything, and Our number is 0%.
    const bare: GcProject = {
      ...p,
      packages: p.packages.map((k) => ({ ...k, carried: null, awardedInviteId: null, budget: 0, sow: null, selfPerform: null })),
      generalConditions: 0,
      contingencyPct: 0,
      feePct: 0,
    }
    expect(ownerContractTotalNow(bare)).toBe(0)
    expect(contractSignsAtZero(bare)).toBe(true)
  })
})
