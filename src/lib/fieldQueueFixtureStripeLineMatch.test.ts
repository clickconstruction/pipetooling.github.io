import { describe, expect, it } from 'vitest'
import type { StripeInvoiceLineDetail } from './stripeInvoiceDetailsResponse'
import { matchedFixtureIdsForFieldQueue, type FieldQueueFixtureForMatch } from './fieldQueueFixtureStripeLineMatch'

const fx = (over: Partial<FieldQueueFixtureForMatch> & Pick<FieldQueueFixtureForMatch, 'id' | 'name'>): FieldQueueFixtureForMatch => ({
  id: over.id,
  name: over.name,
  count: over.count ?? 1,
  line_unit_price: over.line_unit_price ?? null,
  line_description: over.line_description ?? null,
  sequence_order: over.sequence_order ?? 0,
})

const stripeLine = (description: string, amount: number, quantity: number | null = 1): StripeInvoiceLineDetail => ({
  description,
  quantity,
  amount,
})

describe('matchedFixtureIdsForFieldQueue', () => {
  it('matches when fixture name is substring of Stripe description', () => {
    const fixtures = [fx({ id: 'a', name: 'Water heater', sequence_order: 0 })]
    const lines = [stripeLine('Water heater install — labor and parts', 15000)]
    expect(matchedFixtureIdsForFieldQueue(fixtures, lines)).toEqual(new Set(['a']))
  })

  it('matches when Stripe description is substring of fixture name', () => {
    const fixtures = [fx({ id: 'b', name: 'Rough-in plumbing scope', sequence_order: 0 })]
    const lines = [stripeLine('Rough-in plumbing', 8000)]
    expect(matchedFixtureIdsForFieldQueue(fixtures, lines)).toEqual(new Set(['b']))
  })

  it('matches on amount when text does not overlap', () => {
    const fixtures = [fx({ id: 'c', name: 'Fixture A', count: 2, line_unit_price: 50, sequence_order: 0 })]
    const lines = [stripeLine('Something else entirely', 10000)]
    expect(matchedFixtureIdsForFieldQueue(fixtures, lines)).toEqual(new Set(['c']))
  })

  it('consumes each Stripe line at most once (order by sequence_order)', () => {
    const fixtures = [
      fx({ id: '1', name: 'First', sequence_order: 0 }),
      fx({ id: '2', name: 'Second', sequence_order: 1 }),
    ]
    const lines = [stripeLine('First line item', 1000), stripeLine('Second line item', 2000)]
    expect(matchedFixtureIdsForFieldQueue(fixtures, lines)).toEqual(new Set(['1', '2']))
  })

  it('first fixture takes first matching line; second gets next', () => {
    const fixtures = [
      fx({ id: 'x', name: 'Alpha', sequence_order: 0 }),
      fx({ id: 'y', name: 'Beta', sequence_order: 1 }),
    ]
    const lines = [stripeLine('Alpha + Beta bundle', 5000), stripeLine('Beta only', 3000)]
    const m = matchedFixtureIdsForFieldQueue(fixtures, lines)
    expect(m.has('x')).toBe(true)
    expect(m.has('y')).toBe(true)
  })

  it('returns empty set when Stripe has no lines but fixtures exist', () => {
    const fixtures = [fx({ id: 'z', name: 'Orphan', sequence_order: 0 })]
    expect(matchedFixtureIdsForFieldQueue(fixtures, [])).toEqual(new Set())
  })

  it('uses line_description in text match', () => {
    const fixtures = [
      fx({
        id: 'd',
        name: 'Item',
        line_description: 'Basement rough-in notes',
        sequence_order: 0,
      }),
    ]
    const lines = [stripeLine('Basement rough-in notes — extra', 4200)]
    expect(matchedFixtureIdsForFieldQueue(fixtures, lines)).toEqual(new Set(['d']))
  })

  it('does not match very short names for substring rule only', () => {
    const fixtures = [fx({ id: 's', name: 'AB', sequence_order: 0 })]
    const lines = [stripeLine('AB extra text', 100)]
    expect(matchedFixtureIdsForFieldQueue(fixtures, lines)).toEqual(new Set())
  })
})
