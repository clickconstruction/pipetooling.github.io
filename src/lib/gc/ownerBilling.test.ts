/**
 * The tests of `gcOwnerBilling.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (Owner Billing's O2a). The data is `schedule/testState.ts`. The tests that play the
 * prototype's reducer or read a kernel O2b moves stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { nextOwnerBillDay, ownerAccount, ownerRetainageOn, ownerRetainageWords } from './ownerBilling'
import { ownerFinishRisk } from './ownerBillingFinish'
import { ownerInterest } from './ownerBillingInterest'
import { initialGcState } from './schedule/testState'
import type { GcProject, GcState } from './types'

describe('Fair Oaks D: three months billed to Cibolo, and a pay application we sent back', () => {
  const fairOaksOf = (state: GcState) => {
    const p = state.projects.find((x) => x.id === 'fairoaksd')
    if (!p) throw new Error('fixture has no fairoaksd')
    return p
  }

  const cents = (n: number) => Math.round(n * 100) / 100

  it('reads the account off the three pay applications, the same as the record says', () => {
    const project = fairOaksOf(initialGcState())
    const account = ownerAccount(project)
    expect(account && [cents(account.billed), cents(account.retainageHeld), cents(account.paid), cents(account.owed)]).toEqual([956_327.91, 95_632.79, 571_816.61, 288_878.51])
    expect(project.ownerBilling && [project.ownerBilling.billed, project.ownerBilling.retainageHeld, project.ownerBilling.paid]).toEqual([956_327.91, 95_632.79, 571_816.61])
  })

  it('every made-up pay application adds up to the cent', () => {
    for (const project of initialGcState().projects) {
      let asked = 0
      for (const app of project.ownerBilling?.payApps ?? []) {
        const lines = Object.values(app.doneToDate).reduce((s, x) => s + x, 0)
        expect(cents(lines)).toBe(app.workToDate)
        expect(cents((app.workToDate * app.retainagePct) / 100)).toBe(app.retainage)
        expect(cents(app.workToDate - app.retainage - asked)).toBe(app.due)
        asked = cents(asked + app.due)
      }
    }
  })
})

describe('retainage that drops partway, ours to choose per job', () => {
  const step = (way: 'after' | 'all') => ({ atPct: 50, toPct: 5, way })

  it('holds the full percent to the point, then the lower one on the rest or on all of it', () => {
    expect(ownerRetainageOn(10, undefined, 640_000, 1_000_000)).toBe(64_000)
    expect(ownerRetainageOn(10, step('after'), 640_000, 1_000_000)).toBe(57_000)
    expect(ownerRetainageOn(10, step('all'), 640_000, 1_000_000)).toBe(32_000)
    expect(ownerRetainageOn(10, step('all'), 400_000, 1_000_000)).toBe(40_000)
    expect(ownerRetainageWords(10, undefined)).toBe('10% of every bill until the end')
    expect(ownerRetainageWords(10, step('after'))).toBe('10% until the work is half done, then 5% on the rest')
    expect(ownerRetainageWords(10, { atPct: 75, toPct: 0, way: 'all' })).toBe('10% until the work is 75% done, then 0% on all of it')
  })
})

describe('interest on late bills, ours to choose per job', () => {
  const fairOaks = (state: GcState) => state.projects.find((p) => p.id === 'fairoaksd') as GcProject

  it('is off until we choose it', () => {
    const state = initialGcState()
    expect(ownerInterest(state, fairOaks(state))).toMatchObject({ pctPerMonth: null, bills: [], builtUp: 0, toBill: 0 })
  })
})

describe('finishing late against the owner contract', () => {
  const fairOaks = (state: GcState) => state.projects.find((p) => p.id === 'fairoaksd') as GcProject

  it('Fair Oaks D finishes on the contract day at today’s pace: three days behind, none to spare', () => {
    const state = initialGcState()
    const f = ownerFinishRisk(state, fairOaks(state))
    expect([f.contract?.on, f.schedule?.on, f.schedule?.from, f.schedule?.behind, f.past, f.atRisk]).toEqual(['2026-12-11', '2026-12-11', 'pace', 3, 0, 0])
  })
})

describe('nextOwnerBillDay', () => {
  it('is the 25th of this month until it passes, then next month’s', () => {
    expect(nextOwnerBillDay('2026-10-02')).toBe('2026-10-25')
    expect(nextOwnerBillDay('2026-10-25')).toBe('2026-10-25')
    expect(nextOwnerBillDay('2026-10-26')).toBe('2026-11-25')
    expect(nextOwnerBillDay('2026-12-30')).toBe('2027-01-25')
  })
})
