import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import { townFromAddress, travelFor } from './gcMap'

/** A company's address, with the drive worked out from it (the owner, 2026-10-05). */
describe("a company's address sets its drive", () => {
  it('keeps the address and measures from the town in it', () => {
    const state = initialGcState()
    const alamo = state.partners.find((p) => p.company === 'Alamo Concrete')!
    const padB = state.projects.find((p) => p.name === 'Boerne Retail Pad B')!
    const before = travelFor(state, alamo, padB).miles
    const address = '210 Main St, Kerrville'
    const after = gcReducer(state, { type: 'setCoverage', partnerId: alamo.id, base: townFromAddress(address), maxMiles: 100, address })
    const moved = after.partners.find((p) => p.id === alamo.id)!
    expect(moved.address).toBe(address)
    expect(moved.base).toBe('Kerrville')
    expect(travelFor(after, moved, padB).miles).not.toBe(before)
    expect(after.log[0]?.text).toContain('from 210 Main St, Kerrville, goes 100 miles')
  })

  it('holds nothing against an address it cannot place', () => {
    const state = initialGcState()
    const alamo = state.partners.find((p) => p.company === 'Alamo Concrete')!
    const padB = state.projects.find((p) => p.name === 'Boerne Retail Pad B')!
    const address = '5 Elm St, Marfa'
    const after = gcReducer(state, { type: 'setCoverage', partnerId: alamo.id, base: townFromAddress(address), maxMiles: 100, address })
    const moved = after.partners.find((p) => p.id === alamo.id)!
    expect(moved.base).toBeNull()
    expect(travelFor(after, moved, padB)).toEqual({ miles: null, inZone: true })
  })

  it('a new company comes in with its address', () => {
    const state = initialGcState()
    const address = '88 Oak Ln, Boerne'
    const after = gcReducer(state, { type: 'addPartner', company: 'Cibolo Flatwork', contact: 'Ana Ruiz', trade: 'Concrete', base: townFromAddress(address), maxMiles: null, address })
    const added = after.partners.find((p) => p.company === 'Cibolo Flatwork')!
    expect(added.address).toBe(address)
    expect(added.base).toBe('Boerne')
  })
})
