import { describe, expect, it } from 'vitest'
import { companyDouble, doubleLaneParams, prospectFact, type DoubleHomes, type ProspectDoubleRow } from './companyDouble'

const NOW = Date.UTC(2026, 9, 16, 15, 0, 0) // 2026-10-16 15:00Z
const daysBack = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString()

const row = (over: Partial<ProspectDoubleRow>): ProspectDoubleRow => ({
  id: 'p1', name: 'Bexar Fire Protection', phone: '(210) 555-0188', kind: 'sub', status: null, last_contact: daysBack(12), created_at: daysBack(40), updated_at: daysBack(12), ...over,
})

const homes = (over: Partial<DoubleHomes> = {}): DoubleHomes => ({ kind: 'sub', prospects: [], bench: [], customers: [], ...over })

describe('companyDouble', () => {
  it('is null for a company new everywhere, and for an empty form', () => {
    expect(companyDouble('Nobody Like This', '', homes({ prospects: [row({})] }), NOW)).toBeNull()
    expect(companyDouble('', '', homes({ prospects: [row({})] }), NOW)).toBeNull()
    expect(companyDouble('', '555', homes({ prospects: [row({})] }), NOW)).toBeNull()
  })

  it('finds this lane first, by name case-blind, with when it was called', () => {
    const twin = companyDouble('bexar fire protection', '', homes({ prospects: [row({})] }), NOW)
    expect(twin).toMatchObject({ where: 'lane', door: 'open_prospect', kind: 'sub', id: 'p1' })
    expect(twin?.line).toBe('Bexar Fire Protection is already on Subs. Called 12 days ago.')
  })

  it('finds this lane by a phone of seven digits or more', () => {
    const twin = companyDouble('Some Other Spelling', '210-555-0188', homes({ prospects: [row({})] }), NOW)
    expect(twin?.where).toBe('lane')
  })

  it('names another lane and lands the door on it', () => {
    const twin = companyDouble('Ridgeway Builders', '', homes({ kind: 'gc_lead', prospects: [row({ id: 'c1', name: 'Ridgeway Builders', phone: null, kind: 'customer', status: 'converted', updated_at: '2026-03-14T12:00:00Z' })] }), NOW)
    expect(twin).toMatchObject({ where: 'other_lane', kind: 'customer' })
    expect(twin?.line).toBe('Ridgeway Builders is already on Customers. Converted ✓ in March 2026.')
    expect(doubleLaneParams(twin as Extract<typeof twin, { door: 'open_prospect' }>)).toEqual({ kind: null, prospect_id: 'c1' })
    const lead = companyDouble('Hill Country', '', homes({ kind: 'sub', prospects: [row({ id: 'g1', name: 'Hill Country', kind: 'gc_lead', last_contact: null, created_at: daysBack(3) })] }), NOW)
    expect(lead?.line).toBe('Hill Country is already on Jobs to GC. Never called, added 3 days ago.')
    expect(doubleLaneParams(lead as Extract<typeof lead, { door: 'open_prospect' }>)).toEqual({ kind: 'gc-leads', prospect_id: 'g1' })
  })

  it('then the bench, with its trades and vetting', () => {
    const twin = companyDouble('Comal Concrete Works', '', homes({ bench: [{ id: 'b1', name: 'Comal Concrete Works', phone: null, trades: ['Concrete'], vetted: true }] }), NOW)
    expect(twin).toMatchObject({ where: 'bench', door: 'open_bench', id: 'b1' })
    expect(twin?.line).toBe('Comal Concrete Works is already on the bench. Concrete, vetted.')
    const fresh = companyDouble('Comal Concrete Works', '', homes({ bench: [{ id: 'b1', name: 'Comal Concrete Works', phone: null, trades: ['Concrete', 'Masonry'], vetted: false }] }), NOW)
    expect(fresh?.line).toBe('Comal Concrete Works is already on the bench. Concrete, Masonry, new.')
  })

  it('then the customers, with the year they came', () => {
    const twin = companyDouble('Lantana Property Group', '', homes({ customers: [{ id: 'k1', name: 'Lantana Property Group', phone: null, since: '2024-05-02T00:00:00Z' }] }), NOW)
    expect(twin).toMatchObject({ where: 'customer', door: 'customer', id: 'k1' })
    expect(twin?.line).toBe('Lantana Property Group is already a customer. With us since 2024.')
    const bare = companyDouble('Lantana Property Group', '', homes({ customers: [{ id: 'k1', name: 'Lantana Property Group', phone: null }] }), NOW)
    expect(bare?.line).toBe('Lantana Property Group is already a customer.')
  })

  it('keeps the order: this lane beats another lane beats the bench beats the customers', () => {
    const all = homes({
      prospects: [row({ id: 'other', kind: 'customer' }), row({ id: 'mine', kind: 'sub' })],
      bench: [{ id: 'b', name: 'Bexar Fire Protection', phone: null }],
      customers: [{ id: 'k', name: 'Bexar Fire Protection', phone: null }],
    })
    expect(companyDouble('Bexar Fire Protection', '', all, NOW)?.id).toBe('mine')
    expect(companyDouble('Bexar Fire Protection', '', { ...all, prospects: [row({ id: 'other', kind: 'customer' })] }, NOW)?.id).toBe('other')
    expect(companyDouble('Bexar Fire Protection', '', { ...all, prospects: [] }, NOW)?.id).toBe('b')
    expect(companyDouble('Bexar Fire Protection', '', { ...all, prospects: [], bench: [] }, NOW)?.id).toBe('k')
  })
})

describe('prospectFact', () => {
  it('says today, yesterday, and the landed press', () => {
    expect(prospectFact(row({ last_contact: daysBack(0) }), NOW)).toBe('Called today')
    expect(prospectFact(row({ last_contact: daysBack(1) }), NOW)).toBe('Called yesterday')
    expect(prospectFact(row({ status: 'converted', kind: 'sub', updated_at: '2026-10-02T12:00:00Z' }), NOW)).toBe('Add to the bench ✓ in October 2026')
    expect(prospectFact(row({ status: 'cant_reach', last_contact: daysBack(5) }), NOW)).toBe("Can't reach, last tried 5 days ago")
    expect(prospectFact(row({ status: 'not_a_fit' }), NOW)).toBe('Not a fit')
    expect(prospectFact(row({ last_contact: null, created_at: null }), NOW)).toBe('Never called')
  })
})
