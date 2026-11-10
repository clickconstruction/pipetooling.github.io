import { describe, expect, it } from 'vitest'
import { inKindCostLabel, inKindCostLines, inKindCostTotal } from './inKindCost'

describe('inKindCostLines', () => {
  it('keeps a live line with an amount and names who gave it', () => {
    expect(
      inKindCostLines([
        { id: 'l1', given_on: '2026-11-04', amount: '885.00', memo: ' 6 yards of 3000 psi ', cost_job_id: null, removed_at: null, arrangement: { partner_name: 'Lone Oak Concrete' } },
        { id: 'l2', given_on: '2026-10-22', amount: 1475, memo: '10 yards', cost_job_id: 'oak', removed_at: null, arrangement: [{ partner_name: 'Lone Oak Concrete' }] },
      ]),
    ).toEqual([
      { id: 'l1', givenOn: '2026-11-04', amount: 885, memo: '6 yards of 3000 psi', partner: 'Lone Oak Concrete', costJobId: null },
      { id: 'l2', givenOn: '2026-10-22', amount: 1475, memo: '10 yards', partner: 'Lone Oak Concrete', costJobId: 'oak' },
    ])
  })
  it('counts nothing for a line taken back or a month with no credit', () => {
    expect(
      inKindCostLines([
        { id: 'gone', given_on: '2026-11-04', amount: 885, memo: 'x', cost_job_id: null, removed_at: '2026-11-05T00:00:00Z' },
        { id: 'zero', given_on: '2026-10-31', amount: 0, memo: 'No credit', cost_job_id: null },
      ]),
    ).toEqual([])
    expect(inKindCostLines(null)).toEqual([])
  })
})

describe('inKindCostLabel / inKindCostTotal', () => {
  it('names the partner and what was given', () => {
    expect(inKindCostLabel({ partner: 'Lone Oak Concrete', memo: '6 yards' })).toBe('Lone Oak Concrete: 6 yards')
    expect(inKindCostLabel({ partner: '', memo: '6 yards' })).toBe('6 yards')
    expect(inKindCostLabel({ partner: '', memo: '' })).toBe('Given in kind')
  })
  it('sums to the cent', () => {
    expect(inKindCostTotal([{ amount: 885 }, { amount: 1180.1 }, { amount: 0.2 }])).toBe(2065.3)
    expect(inKindCostTotal([])).toBe(0)
  })
})
