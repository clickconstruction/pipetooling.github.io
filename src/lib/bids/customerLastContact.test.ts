import { describe, expect, it } from 'vitest'
import {
  buildCustomerLastContactMap,
  compareCustomersByLastContact,
  type CustomerLastContactBid,
} from './customerLastContact'

function bid(partial: Partial<CustomerLastContactBid> & { id: string }): CustomerLastContactBid {
  return { customer_id: 'c1', last_contact: null, ...partial }
}

describe('buildCustomerLastContactMap', () => {
  it('takes the max across contacts, bid last_contact, and submission entries', () => {
    const map = buildCustomerLastContactMap(
      [bid({ id: 'b1', last_contact: '2026-06-01T10:00:00Z' }), bid({ id: 'b2' })],
      [{ customer_id: 'c1', contact_date: '2026-05-01T10:00:00Z' }],
      { b2: '2026-07-15T10:00:00Z' },
    )
    expect(map.get('c1')).toBe('2026-07-15T10:00:00Z')
  })

  it('keeps customers separate and skips bids with no customer', () => {
    const map = buildCustomerLastContactMap(
      [bid({ id: 'b1', customer_id: 'c1', last_contact: '2026-06-01T00:00:00Z' }), bid({ id: 'b2', customer_id: null, last_contact: '2026-07-01T00:00:00Z' })],
      [{ customer_id: 'c2', contact_date: '2026-04-01T00:00:00Z' }],
      {},
    )
    expect(map.get('c1')).toBe('2026-06-01T00:00:00Z')
    expect(map.get('c2')).toBe('2026-04-01T00:00:00Z')
    expect(map.size).toBe(2)
  })

  it('has no entry for never-contacted customers and ignores garbage dates', () => {
    const map = buildCustomerLastContactMap([bid({ id: 'b1', last_contact: 'garbage' })], [], {})
    expect(map.has('c1')).toBe(false)
  })

  it('compares as instants, not strings (mixed offset formats)', () => {
    // "2026-06-01T12:00:00+05:00" is 07:00Z — earlier than 08:00Z even though it
    // string-compares later. The old string localeCompare would get this wrong.
    const map = buildCustomerLastContactMap(
      [bid({ id: 'b1', last_contact: '2026-06-01T12:00:00+05:00' }), bid({ id: 'b2', last_contact: '2026-06-01T08:00:00Z' })],
      [],
      {},
    )
    expect(map.get('c1')).toBe('2026-06-01T08:00:00Z')
  })
})

describe('compareCustomersByLastContact', () => {
  const map = new Map([
    ['old', '2026-01-01T00:00:00Z'],
    ['fresh', '2026-08-01T00:00:00Z'],
  ])
  const cOld = { id: 'old', name: 'Beta' }
  const cFresh = { id: 'fresh', name: 'Alpha' }
  const cNever1 = { id: 'n1', name: 'Zed' }
  const cNever2 = { id: 'n2', name: 'Ada' }

  it('oldest-first puts stalest contact on top, never-contacted last', () => {
    const sorted = [cNever1, cFresh, cOld, cNever2].sort((a, b) => compareCustomersByLastContact(a, b, map, 'oldest-first'))
    expect(sorted.map((c) => c.id)).toEqual(['old', 'fresh', 'n2', 'n1'])
  })

  it('newest-first flips contacted order but never-contacted stay last', () => {
    const sorted = [cOld, cNever1, cFresh].sort((a, b) => compareCustomersByLastContact(a, b, map, 'newest-first'))
    expect(sorted.map((c) => c.id)).toEqual(['fresh', 'old', 'n1'])
  })
})
