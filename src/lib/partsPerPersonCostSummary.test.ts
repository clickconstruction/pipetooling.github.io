import { describe, expect, it } from 'vitest'
import { buildPartsPerPersonCostRows, tallyLineTotal } from './partsPerPersonCostSummary'

describe('partsPerPersonCostSummary', () => {
  it('tallies line item cost: fixture uses fixture_cost * qty', () => {
    expect(
      tallyLineTotal({
        part_id: null,
        quantity: 2,
        price_at_time: 100,
        fixture_cost: 5,
        created_by_user_id: 'u1',
        created_by_name: 'A',
      }),
    ).toBe(10)
  })

  it('groups tally by user, job row for other+invoice, card by attribution', () => {
    const { rows, footer, sumsOk } = buildPartsPerPersonCostRows({
      parts: [
        {
          part_id: 'p1',
          quantity: 1,
          price_at_time: 10,
          fixture_cost: null,
          created_by_user_id: 'u1',
          created_by_name: 'Alice',
        },
      ],
      billedMaterialsSum: 20,
      invoiceJobTotal: 30,
      mercuryRows: [
        { amount: 5, attributionDisplayName: 'Bob' },
        { amount: -3, attributionDisplayName: null },
      ],
      parentCardTotal: 8,
    })
    const alice = rows.find((r) => r.key === 't:u1')
    expect(alice?.partsFromTally).toBe(10)
    const bob = rows.find((r) => r.displayName === 'Bob')
    expect(bob?.cardCharges).toBe(5)
    const u = rows.find((r) => r.displayName === 'Unattributed')
    expect(u?.cardCharges).toBe(3)
    expect(rows.some((r) => r.key === 'g:job')).toBe(false)
    expect(footer.otherJobCharges).toBe(20)
    expect(footer.invoicesFromSupply).toBe(30)
    expect(sumsOk).toBe(true)
    expect(footer.partsFromTally + footer.invoicesFromSupply + footer.cardCharges + footer.otherJobCharges).toBe(
      10 + 30 + 8 + 20,
    )
  })

  it('hides g:job when it is the only body row (duplicates Total)', () => {
    const { rows, footer, sumsOk } = buildPartsPerPersonCostRows({
      parts: [],
      billedMaterialsSum: 0,
      invoiceJobTotal: 12502.73,
      mercuryRows: [],
      parentCardTotal: 0,
    })
    expect(rows).toEqual([])
    expect(footer.invoicesFromSupply).toBe(12502.73)
    expect(footer.partsFromTally).toBe(0)
    expect(footer.cardCharges).toBe(0)
    expect(footer.otherJobCharges).toBe(0)
    expect(sumsOk).toBe(true)
  })

  it('hides g:job from body even when per-person rows exist (totals in footer only)', () => {
    const { rows, footer } = buildPartsPerPersonCostRows({
      parts: [
        {
          part_id: 'p1',
          quantity: 1,
          price_at_time: 5,
          fixture_cost: null,
          created_by_user_id: 'u1',
          created_by_name: 'A',
        },
      ],
      billedMaterialsSum: 0,
      invoiceJobTotal: 100,
      mercuryRows: [],
    })
    expect(rows.some((r) => r.key === 'g:job')).toBe(false)
    expect(footer.invoicesFromSupply).toBe(100)
  })
})
