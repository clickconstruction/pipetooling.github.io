/**
 * Main's own tests for vetting a company new to us and the award gate (question 3; the Board's
 * B2-i): where a company stands, who is waiting on the office's word, and why an award stays shut,
 * run through the kernels on the test data. The spike's own cases: on Boerne Retail Shell, Lonestar
 * Earthworks and Tri-County Site both quoted the sitework, Lonestar all in at $184,900.
 */
import { describe, expect, it } from 'vitest'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'
import { awardGate, ourTeam, partnersToVet, vettingOf } from './vetting'

/** Tri-County is new to us; Lonestar is approved up to $150,000 on one award. */
const vetted = (s: GcState): GcState => ({
  ...s,
  partners: s.partners.map((p) =>
    p.id === 'tricounty' ? { ...p, vetting: { status: 'new' as const } } : p.id === 'lonestar' ? { ...p, vetting: { status: 'approved' as const, limit: 150000 } } : p,
  ),
})

describe('vetting a company new to us', () => {
  it('a company we know reads approved; one new to us waits on the office', () => {
    const s = vetted(initialGcState())
    expect(vettingOf(s.partners.find((p) => p.id === 'summit')!)).toEqual({ status: 'approved' })
    expect(vettingOf(s.partners.find((p) => p.id === 'tricounty')!)).toEqual({ status: 'new' })
    expect(partnersToVet(initialGcState())).toEqual([])
    expect(partnersToVet(s).map((p) => p.id)).toEqual(['tricounty'])
  })

  it('the award gate stays shut past a limit and for a company not vetted, and says why', () => {
    const s = vetted(initialGcState())
    const site = s.projects.find((p) => p.id === 'boerne')!.packages.find((k) => k.id === 'site')!
    expect(site.invites.filter((i) => i.bid).map((i) => [i.id, awardGate(s, site, i)])).toEqual([
      ['site-lonestar', { ok: false, why: 'Lonestar Earthworks is approved up to $150,000. This award is $184,900.' }],
      ['site-tricounty', { ok: false, why: 'Tri-County Site is not vetted yet. They have not sent their form.' }],
    ])
    const open = initialGcState().projects.find((p) => p.id === 'boerne')!.packages.find((k) => k.id === 'site')!
    expect(awardGate(initialGcState(), open, open.invites[0]!)).toEqual({ ok: true, why: null })
  })

  it('names the team that decides', () => {
    expect(ourTeam(initialGcState())).toEqual(['Dana Whitaker', 'Marcy Pruett', 'Luis Ortega'])
  })
})
