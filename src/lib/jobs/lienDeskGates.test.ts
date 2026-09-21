import { describe, expect, it } from 'vitest'
import { buildLienDeskGates, lienGateMark, type LienDeskGatesInput } from './lienDeskGates'

const clear: LienDeskGatesInput = {
  ownerName: 'Sabra Texas Holdings Lp',
  ownerMailingAddress: '18500 Von Karman Ave Ste 550, Irvine, CA 92612',
  gcName: 'TF Harper',
  gcAddress: '',
  propertyKind: 'commercial',
  county: 'Comal',
  monthLabels: ['Jul'],
  pickedMonthsCount: 1,
  pendingSessions: 0,
}

describe('buildLienDeskGates', () => {
  it('keeps the four gates in their fixed slots', () => {
    const { gates } = buildLienDeskGates(clear)
    expect(gates.map((g) => [g.n, g.key])).toEqual([[1, 'owner'], [2, 'gc'], [3, 'kind'], [4, 'months']])
  })

  it('all clear reads ready, with the names as the values', () => {
    const { gates, verdict } = buildLienDeskGates(clear)
    expect(verdict).toEqual({ ready: true, blockers: 0, checks: 0, headline: 'Ready to go out', summary: 'All 4 clear' })
    expect(gates.map((g) => g.value)).toEqual(['Sabra Texas Holdings Lp', 'TF Harper', 'Commercial · Comal', 'Jul'])
  })

  it('a missing owner blocks; an unknown property kind is only a check', () => {
    const { gates, verdict } = buildLienDeskGates({ ...clear, ownerName: '', ownerMailingAddress: '', propertyKind: null })
    expect(gates[0]).toMatchObject({ tone: 'blocker', value: 'Missing' })
    expect(gates[2]).toMatchObject({ tone: 'check', value: 'Unknown' })
    expect(verdict).toMatchObject({ ready: false, blockers: 1, checks: 1, headline: "Can't go out yet", summary: '1 blocker · 1 to check' })
  })

  it('an unknown property kind alone still goes out', () => {
    const { verdict } = buildLienDeskGates({ ...clear, propertyKind: '' })
    expect(verdict).toMatchObject({ ready: true, headline: 'Ready to go out', summary: '1 to check' })
  })

  it('an owner with no mailing address, a public owner, no GC and no month each block', () => {
    expect(buildLienDeskGates({ ...clear, ownerMailingAddress: ' ' }).gates[0]).toMatchObject({ tone: 'blocker', value: 'No mailing address' })
    expect(buildLienDeskGates({ ...clear, ownerName: 'City of New Braunfels' }).gates[0]).toMatchObject({ tone: 'blocker', value: 'Public property' })
    expect(buildLienDeskGates({ ...clear, gcName: '' }).gates[1]).toMatchObject({ tone: 'blocker', value: 'No GC on the job' })
    const none = buildLienDeskGates({ ...clear, gcName: '', pickedMonthsCount: 0 })
    expect(none.gates[3]).toMatchObject({ tone: 'blocker', value: 'No month picked' })
    expect(none.verdict.summary).toBe('2 blockers')
  })

  it('residential names its clock and pending sessions ride in the months tooltip', () => {
    const { gates } = buildLienDeskGates({ ...clear, propertyKind: 'residential', county: '', pendingSessions: 2 })
    expect(gates[2]).toMatchObject({ value: 'Residential', title: 'Residential — the 2nd-month clock' })
    expect(gates[3]?.title).toBe('2 sessions awaiting approval not counted')
  })

  it('marks', () => {
    expect([lienGateMark('ok'), lienGateMark('blocker'), lienGateMark('check')]).toEqual(['✓', '✗', '!'])
  })
})
