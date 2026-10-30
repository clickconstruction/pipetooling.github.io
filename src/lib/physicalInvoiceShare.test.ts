import { describe, expect, it } from 'vitest'
import { buildBillableServiceLinesFromFixtures, resolvePhysicalInvoiceLinePresentation } from './physicalInvoiceLineItems'
import { contractLineWords, progressBillShare, shareColumnHeads, shareHeadline, shareMoney, sharePct, stripeShareTail } from './physicalInvoiceShare'

const fixtures = [
  { name: 'Water closet, wall-hung', count: 24, line_unit_price: 1180, line_description: null, sequence_order: 0 },
  { name: 'Lavatory, undermount', count: 18, line_unit_price: 854, line_description: 'Under the counter', sequence_order: 1 },
  { name: 'Water heater, 100 gal', count: 2, line_unit_price: 9820, line_description: null, sequence_order: 2 },
]

describe("a progress bill's share of the contract (punch list #217, outside-1)", () => {
  it('pairs the scaled lines with the contract lines they came from and says the share once', () => {
    const r = resolvePhysicalInvoiceLinePresentation(20_266, '', 'x', fixtures, [])
    expect(r.breakdownMatches).toBe(false)
    const share = progressBillShare(buildBillableServiceLinesFromFixtures(fixtures), r.serviceLines)!
    expect(share.pct).toBe(32)
    expect([share.contract, share.bill]).toEqual([63_332, 20_266])
    expect(share.rows.map((x) => [x.description, x.qty, x.unitPrice, x.contract])).toEqual([
      ['Water closet, wall-hung', 24, 1180, 28_320],
      ['Lavatory, undermount\nUnder the counter', 18, 854, 15_372],
      ['Water heater, 100 gal', 2, 9820, 19_640],
    ])
    // The shares are the bill's own lines, so they foot to the bill.
    expect(Math.round(share.rows.reduce((t, x) => t + x.share, 0) * 100) / 100).toBe(20_266)
    expect(share.rows[0]!.share).toBe(r.serviceLines[0]!.amount)
    // The presentation carries it when it scaled, and not when the bill is the whole job.
    expect(r.share).toEqual(share)
    expect(resolvePhysicalInvoiceLinePresentation(63_332, '', 'x', fixtures, []).share).toBeNull()
    expect(resolvePhysicalInvoiceLinePresentation(100, 'One line', 'x', fixtures, []).share).toBeFalsy()
  })

  it('writes the words: the headline, the contract line with its count, the column heads and the Stripe tail', () => {
    const share = progressBillShare(buildBillableServiceLinesFromFixtures(fixtures), resolvePhysicalInvoiceLinePresentation(20_266, '', 'x', fixtures, []).serviceLines)!
    expect(shareHeadline(share)).toBe('This bill: $20,266, 32% of the $63,332 contract.')
    expect(share.rows.map(contractLineWords)).toEqual(['24 × $1,180 = $28,320', '18 × $854 = $15,372', '2 × $9,820 = $19,640'])
    expect(contractLineWords({ description: 'x', qty: 1, unitPrice: 500.5, contract: 500.5, share: 1 })).toBe('$500.50')
    expect(shareColumnHeads(share)).toEqual({ contract: 'In the contract', bill: 'This bill · 32%' })
    expect(stripeShareTail(32, 28_320)).toBe(' · 32% of $28,320')
    expect([shareMoney(1180), shareMoney(5862.4), sharePct(1, 1_000_000), sharePct(0, 100), sharePct(50, 0)]).toEqual(['$1,180', '$5,862.40', 1, 0, 0])
  })

  it('shifts past a line the scaling dropped, and gives up on a line the contract never had', () => {
    const contract = buildBillableServiceLinesFromFixtures(fixtures)
    const scaled = [
      { description: 'Water closet, wall-hung', qty: 1, unitPrice: 10, amount: 10 },
      { description: 'Water heater, 100 gal', qty: 1, unitPrice: 5, amount: 5 },
    ]
    expect(progressBillShare(contract, scaled)!.rows.map((r) => r.description)).toEqual(['Water closet, wall-hung', 'Water heater, 100 gal'])
    expect(progressBillShare(contract, [{ description: 'A fee', qty: 1, unitPrice: 5, amount: 5 }])).toBeNull()
    expect(progressBillShare(contract, [])).toBeNull()
  })
})
