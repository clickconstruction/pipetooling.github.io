import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))

import { rfqScopeFromCountRows } from './bidRfqScope'

describe('rfqScopeFromCountRows (v2.3526)', () => {
  it('keeps rows with a name and a positive count, and writes the price-free list text', () => {
    const s = rfqScopeFromCountRows('B398 · ZZ Test', [
      { fixture: 'Water closet', count: 4, unit: 'ea' },
      { fixture: 'Lavatory', count: '2' },
      { fixture: '', count: 3 },
      { fixture: 'Floor drain', count: 0 },
      { fixture: 'Hose bibb', count: null },
    ])
    expect(s.lines).toEqual([
      { fixture: 'Water closet', count: 4, unit: 'ea' },
      { fixture: 'Lavatory', count: 2, unit: null },
    ])
    expect(s.text).toBe(['Bid: B398 · ZZ Test', '', 'Water closet — 4 ea', 'Lavatory — 2', '', 'Items: 2'].join('\n'))
    expect(s.text).not.toMatch(/\$/)
  })

  it('is an empty scope when nothing is counted yet', () => {
    const s = rfqScopeFromCountRows('B1', [])
    expect(s.lines).toEqual([])
    expect(s.text).toBe('Bid: B1')
  })
})
