import { describe, expect, it } from 'vitest'
import { buildNeedsYouItems, type NeedsYouInputs } from './dashboardNeedsYou'

function inputs(overrides: Partial<NeedsYouInputs> = {}): NeedsYouInputs {
  return {
    role: 'dev',
    arBankUnallocatedCount: 0,
    arBankEnabled: true,
    tallyStaleUnlinkedCount: 0,
    tallyStaffStalePeopleCount: 0,
    tallyStaffStaleTxCount: 0,
    tallyStaffEligible: true,
    tallyMinAgeDays: 2,
    lostBidNudge: null,
    lostBidNudgeLoading: false,
    ...overrides,
  }
}

describe('buildNeedsYouItems', () => {
  it('returns nothing when every source is quiet', () => {
    expect(buildNeedsYouItems(inputs())).toEqual([])
  })

  it('mirrors the banner gating: loading sources contribute no item', () => {
    const items = buildNeedsYouItems(
      inputs({ arBankUnallocatedCount: null, tallyStaleUnlinkedCount: null, lostBidNudge: { count: 61, value: 8_700_000 }, lostBidNudgeLoading: true }),
    )
    expect(items).toEqual([])
  })

  it('builds all four items in banner-stack order with faithful copy', () => {
    const items = buildNeedsYouItems(
      inputs({
        arBankUnallocatedCount: 2,
        tallyStaleUnlinkedCount: 89,
        tallyStaffStalePeopleCount: 3,
        tallyStaffStaleTxCount: 41,
        lostBidNudge: { count: 61, value: 8_700_000 },
      }),
    )
    expect(items.map((i) => i.key)).toEqual(['ar-deposits', 'tally-self', 'tally-team', 'lost-bids'])
    expect(items[0]?.title).toBe('Allocate 2 bank deposits')
    expect(items[0]?.figure).toBe('2')
    expect(items[1]?.title).toBe('89 purchases need a job')
    expect(items[2]?.detail).toContain('3 people have 41 purchases')
    expect(items[3]?.detail).toContain('unexplained')
  })

  it('respects role/eligibility gates (AR + team tally off, sub keeps own tally)', () => {
    const items = buildNeedsYouItems(
      inputs({
        role: 'subcontractor',
        arBankEnabled: false,
        arBankUnallocatedCount: 5,
        tallyStaleUnlinkedCount: 6,
        tallyStaffEligible: false,
        tallyStaffStalePeopleCount: 3,
        tallyStaffStaleTxCount: 41,
      }),
    )
    expect(items.map((i) => i.key)).toEqual(['tally-self'])
  })

  it('team tally needs BOTH counts > 0, like the banner it replaces', () => {
    expect(buildNeedsYouItems(inputs({ tallyStaffStalePeopleCount: 3, tallyStaffStaleTxCount: 0 }))).toEqual([])
    expect(buildNeedsYouItems(inputs({ tallyStaffStalePeopleCount: 0, tallyStaffStaleTxCount: 5 }))).toEqual([])
  })

  it('singular copy reads naturally', () => {
    const items = buildNeedsYouItems(inputs({ arBankUnallocatedCount: 1, tallyStaleUnlinkedCount: 1, lostBidNudge: { count: 1, value: 0 } }))
    expect(items[0]?.title).toBe('Allocate a bank deposit')
    expect(items[1]?.title).toBe('One purchase needs a job')
    expect(items[2]?.title).toBe('One lost bid has no reason recorded')
    expect(items[2]?.detail.startsWith('work them')).toBe(true)
  })
})
