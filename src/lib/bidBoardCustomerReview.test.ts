import { describe, expect, it } from 'vitest'
import {
  buildCustomerReviewRows,
  customerReviewGroupKey,
  filterCustomerReviewRows,
  formatCustomerReviewHours,
  sumCustomerReviewRows,
  CUSTOMER_REVIEW_NO_CUSTOMER_LABEL,
  type CustomerReviewBidInput,
} from './bidBoardCustomerReview'

function bid(partial: Partial<CustomerReviewBidInput> & { id: string }): CustomerReviewBidInput {
  return {
    outcome: null,
    bid_date_sent: null,
    customerId: null,
    customerName: null,
    gcBuilderId: null,
    gcBuilderName: null,
    ...partial,
  }
}

describe('customerReviewGroupKey', () => {
  it('prefers customer id, falls back to gc builder, then none', () => {
    expect(customerReviewGroupKey({ customerId: 'c1', gcBuilderId: 'g1' })).toBe('c:c1')
    expect(customerReviewGroupKey({ customerId: null, gcBuilderId: 'g1' })).toBe('g:g1')
    expect(customerReviewGroupKey({ customerId: null, gcBuilderId: null })).toBe('none')
  })
})

describe('buildCustomerReviewRows', () => {
  it('counts bids per submission section per customer', () => {
    const rows = buildCustomerReviewRows(
      [
        bid({ id: 'b1', customerId: 'c1', customerName: 'Acme' }), // unsent
        bid({ id: 'b2', customerId: 'c1', customerName: 'Acme', bid_date_sent: '2026-06-01' }), // pending
        bid({ id: 'b3', customerId: 'c1', customerName: 'Acme', outcome: 'won' }),
        bid({ id: 'b4', customerId: 'c1', customerName: 'Acme', outcome: 'started_or_complete' }),
        bid({ id: 'b5', customerId: 'c1', customerName: 'Acme', outcome: 'lost' }),
      ],
      [],
      [],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]!.counts).toEqual({ unsent: 1, pending: 1, won: 1, startedOrComplete: 1, lost: 1 })
    expect(rows[0]!.totalBids).toBe(5)
  })

  it('groups legacy gc-builder bids separately and buckets customer-less bids under No customer', () => {
    const rows = buildCustomerReviewRows(
      [
        bid({ id: 'b1', customerId: 'c1', customerName: 'Acme' }),
        bid({ id: 'b2', gcBuilderId: 'g1', gcBuilderName: 'Legacy GC' }),
        bid({ id: 'b3' }),
      ],
      [],
      [],
    )
    const names = rows.map((r) => r.customerName).sort()
    expect(names).toEqual(['Acme', 'Legacy GC', CUSTOMER_REVIEW_NO_CUSTOMER_LABEL])
  })

  it('sums estimating hours per bid into the bid customer group', () => {
    const rows = buildCustomerReviewRows(
      [
        bid({ id: 'b1', customerId: 'c1', customerName: 'Acme' }),
        bid({ id: 'b2', customerId: 'c1', customerName: 'Acme' }),
      ],
      [
        { bid_id: 'b1', hours: 2.5 },
        { bid_id: 'b2', hours: '1.5' }, // numeric can arrive as string
        { bid_id: 'other', hours: 99 },
      ],
      [],
    )
    expect(rows[0]!.estimatingHours).toBeCloseTo(4)
  })

  it('merges job hours onto the matching customer row and creates rows for job-only customers', () => {
    const rows = buildCustomerReviewRows(
      [bid({ id: 'b1', customerId: 'c1', customerName: 'Acme' })],
      [{ bid_id: 'b1', hours: 3 }],
      [
        { customer_id: 'c1', customer_name: 'Acme', hours: 10 },
        { customer_id: 'c2', customer_name: 'Jobs Only Inc', hours: 7 },
      ],
    )
    const acme = rows.find((r) => r.customerName === 'Acme')!
    const jobsOnly = rows.find((r) => r.customerName === 'Jobs Only Inc')!
    expect(acme.estimatingHours).toBe(3)
    expect(acme.jobHours).toBe(10)
    expect(acme.totalHours).toBe(13)
    expect(jobsOnly.totalBids).toBe(0)
    expect(jobsOnly.jobHours).toBe(7)
  })

  it('ignores null/negative/unparseable hours', () => {
    const rows = buildCustomerReviewRows(
      [bid({ id: 'b1', customerId: 'c1', customerName: 'Acme' })],
      [{ bid_id: 'b1', hours: null }],
      [
        { customer_id: 'c1', customer_name: 'Acme', hours: -4 },
        { customer_id: 'c1', customer_name: 'Acme', hours: 'nope' },
      ],
    )
    expect(rows[0]!.totalHours).toBe(0)
  })

  it('sorts by total hours desc, then bid count desc, then name asc', () => {
    const rows = buildCustomerReviewRows(
      [
        bid({ id: 'b1', customerId: 'c1', customerName: 'Zeta' }),
        bid({ id: 'b2', customerId: 'c2', customerName: 'Alpha' }),
        bid({ id: 'b3', customerId: 'c3', customerName: 'Mid' }),
        bid({ id: 'b4', customerId: 'c3', customerName: 'Mid' }),
      ],
      [{ bid_id: 'b2', hours: 5 }],
      [],
    )
    expect(rows.map((r) => r.customerName)).toEqual(['Alpha', 'Mid', 'Zeta'])
  })
})

describe('filterCustomerReviewRows', () => {
  it('filters case-insensitively by customer name and returns all rows for blank query', () => {
    const rows = buildCustomerReviewRows(
      [bid({ id: 'b1', customerId: 'c1', customerName: 'Acme Builders' }), bid({ id: 'b2', customerId: 'c2', customerName: 'Other' })],
      [],
      [],
    )
    expect(filterCustomerReviewRows(rows, 'acme')).toHaveLength(1)
    expect(filterCustomerReviewRows(rows, '  ')).toHaveLength(2)
    expect(filterCustomerReviewRows(rows, 'zzz')).toHaveLength(0)
  })
})

describe('sumCustomerReviewRows', () => {
  it('totals counts and hours across rows', () => {
    const rows = buildCustomerReviewRows(
      [
        bid({ id: 'b1', customerId: 'c1', customerName: 'Acme', outcome: 'won' }),
        bid({ id: 'b2', customerId: 'c2', customerName: 'Other' }),
      ],
      [{ bid_id: 'b1', hours: 2 }],
      [{ customer_id: 'c2', customer_name: 'Other', hours: 8 }],
    )
    const total = sumCustomerReviewRows(rows)
    expect(total.counts.won).toBe(1)
    expect(total.counts.unsent).toBe(1)
    expect(total.totalBids).toBe(2)
    expect(total.estimatingHours).toBe(2)
    expect(total.jobHours).toBe(8)
    expect(total.totalHours).toBe(10)
  })
})

describe('formatCustomerReviewHours', () => {
  it('renders dash for zero/invalid, one decimal under 10, rounded with separators above', () => {
    expect(formatCustomerReviewHours(0)).toBe('—')
    expect(formatCustomerReviewHours(Number.NaN)).toBe('—')
    expect(formatCustomerReviewHours(2.25)).toBe('2.3')
    expect(formatCustomerReviewHours(4)).toBe('4')
    expect(formatCustomerReviewHours(1234.6)).toBe('1,235')
  })
})
