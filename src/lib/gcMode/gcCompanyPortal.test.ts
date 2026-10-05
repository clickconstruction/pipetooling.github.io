import { describe, expect, it } from 'vitest'
import { customerPortalStatus, gcReducer, initialGcState, partnerById, tradePortalStatus, type GcState } from './gcModel'

function trade(state: GcState, id: string) {
  const p = partnerById(state, id)
  if (!p) throw new Error(`no ${id}`)
  return tradePortalStatus(state, p)
}

function customer(state: GcState, id: string) {
  const c = state.customers.find((x) => x.id === id)
  if (!c) throw new Error(`no ${id}`)
  return customerPortalStatus(state, c)
}

describe("a company's portal: active or not yet (the owner, 2026-10-04)", () => {
  it('a trade has no link until its first ask', () => {
    const state = initialGcState()
    expect(trade(state, 'redline')).toMatchObject({ state: 'none', word: 'no link yet', link: null })
  })

  it('an active trade says the last thing it did there', () => {
    const state = initialGcState()
    expect(trade(state, 'pecanvalley')).toMatchObject({
      state: 'active',
      words: 'Last seen Oct 1, yesterday, when they asked for draw 2 on Fair Oaks Shops, Building D.',
    })
    expect(trade(state, 'pecanvalley').link).toMatch(/^clicktooling\.com\/t\/[0-9A-Z]{7}$/)
  })

  it('a new company asked today has not opened its link, and opening it makes it active', () => {
    let state = gcReducer(initialGcState(), { type: 'addPartner', company: 'Brand New Mechanical', contact: 'Ana Ruiz', trade: 'HVAC', base: null, maxMiles: null, known: false })
    const id = state.partners[state.partners.length - 1]?.id ?? ''
    state = gcReducer(state, { type: 'invite', projectId: 'boerne', packageId: 'hvac', partnerId: id })
    expect(trade(state, id)).toMatchObject({ state: 'waiting', word: 'not opened yet', late: false })
    expect(trade(state, id).words).toBe('The link went out Oct 2 with the ask on Boerne Retail Shell, today. They have not opened it.')
    state = gcReducer(state, { type: 'tradeOpenPortal', partnerId: id })
    expect(trade(state, id).state).toBe('active')
  })

  it("a customer's portal is off, then on and not opened, and active once they open it", () => {
    let state = initialGcState()
    expect(customer(state, 'raman')).toMatchObject({ state: 'off', words: 'It is not on yet. Turn it on to send them the link.' })
    // An architect or a customer with no job of ours has nothing to show yet.
    expect(customer(state, 'marshvale').words).toBe('It opens once we win a job for them.')
    state = gcReducer(state, { type: 'setCustomerPortal', customerId: 'raman', on: true })
    expect(customer(state, 'raman')).toMatchObject({ state: 'waiting', word: 'not opened yet' })
    expect(customer(state, 'cibolo')).toMatchObject({ state: 'active', words: 'Last opened Sep 30, 2 days ago.' })
    // Turning it on twice changes nothing.
    expect(gcReducer(state, { type: 'setCustomerPortal', customerId: 'raman', on: true })).toBe(state)
  })
})
