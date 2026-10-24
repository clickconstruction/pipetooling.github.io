import { describe, expect, it } from 'vitest'
import { benchOriginWords, benchOriginsFrom, showsBenchOrigin } from './benchOrigin'

const prospects = [
  { id: 'p1', converted_gc_company_id: 'co1' },
  { id: 'p2', converted_gc_company_id: null },
  { id: 'p3', converted_gc_company_id: 'co3' },
]
const comments = [
  { prospect_id: 'p1', interaction_type: 'didnt_answer', created_at: '2026-10-27T15:00:00Z', who: 'Marisol' },
  { prospect_id: 'p1', interaction_type: 'answered', created_at: '2026-10-29T15:00:00Z', who: 'Marisol' },
  { prospect_id: 'p1', interaction_type: 'converted', created_at: '2026-10-29T15:05:00Z', who: 'Marisol' },
  { prospect_id: 'p2', interaction_type: 'answered', created_at: '2026-10-29T15:00:00Z', who: 'Grace' },
  { prospect_id: 'p3', interaction_type: 'converted', created_at: '2026-10-30T15:05:00Z', who: null },
]

describe('benchOrigin', () => {
  it('reads one origin a company: who landed it, when, and the calls before it', () => {
    const origins = benchOriginsFrom(prospects, comments)
    expect(Object.keys(origins).sort()).toEqual(['co1', 'co3'])
    expect(origins.co1).toEqual({ prospectId: 'p1', who: 'Marisol', when: '2026-10-29T15:05:00Z', calls: 2, answered: 1 })
    expect(origins.co3!.who).toBeNull()
  })

  it('writes the line under the name', () => {
    const origins = benchOriginsFrom(prospects, comments)
    expect(benchOriginWords(origins.co1!)).toMatch(/^from Prospects · Marisol, \w{3} Oct 29 · answered 1 of 2 calls$/)
    expect(benchOriginWords(origins.co3!)).toMatch(/^from Prospects · \w{3} Oct 30$/)
    expect(benchOriginWords({ prospectId: 'x', who: 'Grace', when: null, calls: 1, answered: 1 })).toBe('from Prospects · Grace · answered 1 of 1 call')
  })

  it('shows the line until the first quote', () => {
    const o = { prospectId: 'p1', who: 'Marisol', when: null, calls: 0, answered: 0 }
    expect(showsBenchOrigin({ bids: 0 }, o)).toBe(true)
    expect(showsBenchOrigin({ bids: 1 }, o)).toBe(false)
    expect(showsBenchOrigin({ bids: 0 }, undefined)).toBe(false)
  })
})
