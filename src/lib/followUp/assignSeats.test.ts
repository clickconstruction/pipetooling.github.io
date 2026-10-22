import { describe, expect, it } from 'vitest'
import type { ContactKind } from '../contacts/names'
import { CUSTOMER_SEAT_KINDS, NO_SEATS, whoGetsIt, type AssignRuleSeats } from './assignSeats'

// Rosa holds the Customers seat and Robert the trade partners'; Tom answered last and is here today.
const SEATS: AssignRuleSeats = { customer: 'u-rosa', trade: 'u-robert', arch: null }
const HERE = new Set(['u-rosa', 'u-robert', 'u-tom'])
const got = (kind: ContactKind, seats: AssignRuleSeats = SEATS, answeredLastBy: string | null = null) => whoGetsIt({ kind, answeredLastBy, hereToday: HERE, seats })

describe('followUp/assignSeats: the four kinds with no seat of their own', () => {
  it('sends a lead’s new message to the Customers seat', () => {
    expect(got('lead')).toBe('u-rosa')
  })

  it('sends a sub’s new message to the Customers seat', () => {
    expect(got('sub')).toBe('u-rosa')
  })

  it('sends a supply house’s new message to the Customers seat', () => {
    expect(got('supply_house')).toBe('u-rosa')
  })

  it('sends a candidate’s new message to the Customers seat', () => {
    expect(got('candidate')).toBe('u-rosa')
  })

  it('sends each to nobody while the Customers seat is empty, as a customer’s', () => {
    for (const kind of ['customer', 'lead', 'sub', 'supply_house', 'candidate'] as const) expect(got(kind, { ...NO_SEATS, trade: 'u-robert' })).toBeNull()
  })

  it('still gives it first to whoever answered them last, when here today', () => {
    for (const kind of ['lead', 'sub', 'supply_house', 'candidate'] as const) expect(got(kind, SEATS, 'u-tom')).toBe('u-tom')
    expect(got('lead', SEATS, 'u-wendi')).toBe('u-rosa')
  })

  it('leaves the trade partners, the architects and a number nobody knows as they were', () => {
    expect([got('trade'), got('arch'), got('unknown')]).toEqual(['u-robert', 'u-robert', null])
    expect([...CUSTOMER_SEAT_KINDS].sort()).toEqual(['candidate', 'customer', 'lead', 'sub', 'supply_house'])
  })

  it('hands the walk kit’s contact to nobody, whoever answered last and whatever the seats (punch list #142 PR 6)', () => {
    expect(whoGetsIt({ kind: 'customer', answeredLastBy: 'u-tom', hereToday: HERE, seats: SEATS, walkKit: true })).toBeNull()
    expect(whoGetsIt({ kind: 'trade', answeredLastBy: null, hereToday: HERE, seats: SEATS, walkKit: true })).toBeNull()
    expect(whoGetsIt({ kind: 'customer', answeredLastBy: null, hereToday: HERE, seats: SEATS, walkKit: false })).toBe('u-rosa')
  })
})
