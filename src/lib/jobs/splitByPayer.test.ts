import { describe, expect, it } from 'vitest'
import { linePayer, payerTagCounts, planPayerCarves, type PayerTaggedLine } from './splitByPayer'
import type { JobDollarCoverage } from './jobSegmentsCoverage'

const line = (over: Partial<PayerTaggedLine> & { id: string }): PayerTaggedLine => ({
  name: `Line ${over.id}`,
  count: 1,
  line_unit_price: 100,
  invoice_id: null,
  line_kind: 'work',
  ...over,
})

describe('linePayer', () => {
  it('reads the tag, defaults to the customer, and never tags a discount row', () => {
    expect(linePayer({ bill_to_party: 'gc' })).toBe('gc')
    expect(linePayer({ bill_to_party: 'customer' })).toBe('customer')
    expect(linePayer({ bill_to_party: null })).toBe('customer')
    expect(linePayer({ bill_to_party: 'gc', line_kind: 'discount' })).toBe('customer')
  })
})

describe('planPayerCarves', () => {
  it('groups unbilled work rows by payer, GC first, and sizes each carve net of coverage', () => {
    const fixtures = [
      line({ id: 'rough', bill_to_party: 'gc', line_unit_price: 6900 }),
      line({ id: 'test', bill_to_party: 'gc', line_unit_price: 1500 }),
      line({ id: 'heater', bill_to_party: 'customer', line_unit_price: 2400 }),
      line({ id: 'gas', bill_to_party: null, line_unit_price: 750 }),
      line({ id: 'billed', bill_to_party: 'gc', line_unit_price: 999, invoice_id: 'inv-1' }),
    ]
    const coverage = { bySegmentKey: { heater: { coveredDollars: 400, fullyCovered: false } }, remainingDollars: 99999 } as unknown as JobDollarCoverage
    const carves = planPayerCarves(fixtures, coverage)
    expect(carves.map((c) => [c.party, c.fixtureIds, c.count, c.netDollars])).toEqual([
      ['gc', ['rough', 'test'], 2, 8400],
      ['customer', ['heater', 'gas'], 2, 2750],
    ])
  })

  it('never carves a discount row, whatever tag it carries', () => {
    const fixtures = [
      line({ id: 'work', bill_to_party: 'gc', line_unit_price: 1000 }),
      line({ id: 'disc', line_kind: 'discount', line_unit_price: -100, bill_to_party: 'gc' }),
    ]
    const carves = planPayerCarves(fixtures, null)
    expect(carves.flatMap((c) => c.fixtureIds)).toEqual(['work'])
    expect(carves[0]?.netDollars).toBeLessThan(1000) // the discount's share nets the work row down
  })

  it('skips a party with nothing left to bill', () => {
    const fixtures = [
      line({ id: 'a', bill_to_party: 'gc', line_unit_price: 100, invoice_id: 'inv' }),
      line({ id: 'b', bill_to_party: 'customer', line_unit_price: 50 }),
    ]
    expect(planPayerCarves(fixtures, null).map((c) => c.party)).toEqual(['customer'])
    expect(planPayerCarves([], null)).toEqual([])
  })
})

describe('payerTagCounts', () => {
  it('counts named work rows by tag', () => {
    const fixtures = [
      line({ id: 'a', bill_to_party: 'gc' }),
      line({ id: 'b', bill_to_party: 'customer', invoice_id: 'x' }),
      line({ id: 'c' }),
      line({ id: 'd', name: '   ' }),
      line({ id: 'e', line_kind: 'discount' }),
    ]
    expect(payerTagCounts(fixtures)).toEqual({ gc: 1, customer: 1, untagged: 1 })
  })
})
