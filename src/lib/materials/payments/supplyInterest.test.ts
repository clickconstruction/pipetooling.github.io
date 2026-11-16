import { describe, expect, it } from 'vitest'
import { interestByHouse, interestTitle } from './supplyInterest'

// Made-up houses and bills.
const houses = [
  { id: 'h1', name: 'Pecan Supply' },
  { id: 'h2', name: 'Cedar Fork Supply' },
  { id: 'h3', name: 'Juniper Pipe' },
]
const bills = [
  { id: 'a', invoice_number: 'S4398120' },
  { id: 'b', invoice_number: 'S4402277' },
]

describe('how an interest bill is named', () => {
  it('names the bill that ran late, when one is tied to it', () => {
    expect(interestTitle({ is_interest: true, late_invoice_id: 'a' }, bills)).toBe('Interest on S4398120')
  })

  it('says what it is when no late bill is named, or the late bill is gone', () => {
    expect(interestTitle({ is_interest: true, late_invoice_id: null }, bills)).toBe('Interest or a late fee')
    expect(interestTitle({ is_interest: true, late_invoice_id: 'gone' }, bills)).toBe('Interest or a late fee')
  })

  it('says nothing for an ordinary bill', () => {
    expect(interestTitle({ is_interest: false, late_invoice_id: null }, bills)).toBeNull()
    expect(interestTitle({}, bills)).toBeNull()
  })
})

describe('the year’s interest by house', () => {
  const invoices = [
    { supply_house_id: 'h1', amount: 18.6, invoice_date: '2026-11-01', is_interest: true },
    { supply_house_id: 'h2', amount: 30.1, invoice_date: '2026-03-09', is_interest: true },
    { supply_house_id: 'h2', amount: 12.5, invoice_date: '2026-08-02', is_interest: true },
    // Last year's, an ordinary bill, and a row read without the column: none of them counts.
    { supply_house_id: 'h1', amount: 99, invoice_date: '2025-12-30', is_interest: true },
    { supply_house_id: 'h1', amount: 4000, invoice_date: '2026-11-01', is_interest: false },
    { supply_house_id: 'h3', amount: 7, invoice_date: '2026-11-01' },
  ]

  it('adds up each house, the most first, and says it in one line', () => {
    const y = interestByHouse(invoices, houses, '2026')
    expect(y.total).toBe(61.2)
    expect(y.houses).toEqual([
      { supplyHouseId: 'h2', name: 'Cedar Fork Supply', amount: 42.6, count: 2 },
      { supplyHouseId: 'h1', name: 'Pecan Supply', amount: 18.6, count: 1 },
    ])
    expect(y.words).toBe('Interest and late fees in 2026: $61.20 · Cedar Fork Supply $42.60 · Pecan Supply $18.60')
  })

  it('names the one house when only one charged any', () => {
    expect(interestByHouse(invoices, houses, '2025').words).toBe('Interest and late fees in 2025: $99.00 at Pecan Supply')
  })

  it('says nothing in a year with none', () => {
    expect(interestByHouse(invoices, houses, '2024')).toEqual({ year: '2024', total: 0, houses: [], words: '' })
  })
})
