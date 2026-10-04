import { describe, expect, it } from 'vitest'
import {
  exclusionName,
  exclusionRows,
  exclusionsFor,
  gcReducer,
  initialGcState,
  leveledTotal,
  partnerById,
  partnerExclusionHabits,
  type GcState,
} from './gcModel'

const site = (state: GcState) => state.projects.find((p) => p.id === 'boerne')?.packages.find((k) => k.id === 'site')

function withHillsideQuote(): GcState {
  return gcReducer(initialGcState(), {
    type: 'tradeSubmitBid',
    projectId: 'boerne',
    packageId: 'site',
    inviteId: 'site-hillside',
    amount: 186_500,
    includes: { 'site-1': 'yes', 'site-2': 'yes', 'site-3': 'yes', 'site-4': 'yes' },
    note: '',
    exclusions: [{ name: 'permit fees' }, { name: 'Sales tax' }],
    exclusionsAnswered: ['Permits and fees', 'Dewatering', 'Sales tax'],
  })
}

describe('each company\'s exclusions (the owner, 2026-10-04)', () => {
  it('folds what people write onto one name', () => {
    expect(exclusionName('permits')).toBe('Permits and fees')
    expect(exclusionName('Permit fees')).toBe('Permits and fees')
    expect(exclusionName('rock')).toBe('Rock excavation')
    expect(exclusionName('crane time')).toBe('Crane time')
    expect(exclusionsFor('Sitework').slice(0, 2)).toEqual(['Dewatering', 'Rock excavation'])
  })

  it('lines the companies up on every exclusion any of them names', () => {
    const pkg = site(withHillsideQuote())
    if (!pkg) throw new Error('no sitework')
    const rows = exclusionRows(pkg)
    expect(rows.map((r) => r.name)).toEqual(['Permits and fees', 'Sales tax'])
    const permits = rows[0]?.cells.map((c) => [c.invite.partnerId, c.state])
    // Hillside excluded it; Lonestar and Tri-County quoted before the form asked, so they have not said.
    expect(permits).toEqual([
      ['lonestar', 'unsaid'],
      ['tricounty', 'unsaid'],
      ['hillside', 'excluded'],
    ])
  })

  it('a cover cost goes into the all-in number, and a company that answered reads included', () => {
    let state = withHillsideQuote()
    const before = site(state)?.invites.find((i) => i.id === 'site-hillside')
    state = gcReducer(state, { type: 'setExclusionCover', projectId: 'boerne', packageId: 'site', inviteId: 'site-hillside', name: 'Permits and fees', amount: 4_200 })
    const pkg = site(state)
    const after = pkg?.invites.find((i) => i.id === 'site-hillside')
    if (!pkg || !before || !after) throw new Error('missing')
    expect((leveledTotal(pkg, after) ?? 0) - (leveledTotal(pkg, before) ?? 0)).toBe(4_200)
    state = gcReducer(state, { type: 'setQuoteExclusion', projectId: 'boerne', packageId: 'site', inviteId: 'site-lonestar', name: 'Sales tax', excluded: false })
    const tax = exclusionRows(site(state) ?? pkg).find((r) => r.name === 'Sales tax')
    expect(tax?.cells.find((c) => c.invite.partnerId === 'lonestar')?.state).toBe('included')
  })

  it('a company keeps a record across its quotes, and the contract carries what it will not do', () => {
    let state = withHillsideQuote()
    const hillside = partnerById(state, 'hillside')
    if (!hillside) throw new Error('no hillside')
    expect(partnerExclusionHabits(state, hillside).map((h) => `${h.name} ${h.excluded} of ${h.of}`)).toEqual(['Permits and fees 1 of 1', 'Sales tax 1 of 1'])
    state = gcReducer(state, { type: 'award', projectId: 'boerne', packageId: 'site', inviteId: 'site-hillside' })
    expect(site(state)?.sow?.excluded?.map((x) => x.name)).toEqual(['Permits and fees', 'Sales tax'])
  })
})
