import { describe, expect, it } from 'vitest'
import { jobSummaryDiscountLeakage } from './jobSummaryDiscounts'

const disc = (name: string, dollars: number, reason: string | null) => ({ name, count: 1, line_unit_price: -dollars, line_kind: 'discount', discount_reason: reason })

describe('jobSummaryDiscountLeakage', () => {
  const rows = [
    { job: { id: 'j1', fixtures: [{ name: 'Rough In', count: 1, line_unit_price: 15098 }, disc('Negotiated discount', 3774.5, 'Negotiated')] }, revenueUsd: 33970.5, discountUsd: 3774.5 },
    { job: { id: 'j2', fixtures: [{ name: 'Water heater', count: 1, line_unit_price: 2400 }, disc('Repeat customer discount', 120, 'Repeat customer')] }, revenueUsd: 2280, discountUsd: 120 },
    { job: { id: 'j3', fixtures: [{ name: 'Credit', count: 2, line_unit_price: -50 }] }, revenueUsd: 900, discountUsd: 100 },
    { job: { id: 'j4', fixtures: [{ name: 'Trim', count: 1, line_unit_price: 700 }] }, revenueUsd: 700, discountUsd: 0 },
  ]
  const events = [
    { job_id: 'j1', actor_user_id: 'u-t', detail: { dollars: 3774.5 } },
    { job_id: 'j2', actor_user_id: 'u-t', detail: { dollars: '120' } },
    { job_id: 'j3', actor_user_id: null, detail: { dollars: 100 } },
    { job_id: 'zz', actor_user_id: 'u-r', detail: { dollars: 999 } },
  ]
  const names = new Map([['u-t', 'Taunya']])

  it('the headline: given, revenue, share, and how many jobs', () => {
    const out = jobSummaryDiscountLeakage({ rows, events, actorNames: names })
    expect(out).toMatchObject({ jobs: 3, jobsInView: 4, givenUsd: 3994.5, revenueUsd: 37850.5, sharePct: 10.55 })
  })
  it('by reason from the rows, largest first, legacy negative rows under "No reason given"', () => {
    const out = jobSummaryDiscountLeakage({ rows, events, actorNames: names })
    expect(out.byReason).toEqual([
      { key: 'Negotiated', label: 'Negotiated', jobs: 1, givenUsd: 3774.5, sharePct: 9.97 },
      { key: 'Repeat customer', label: 'Repeat customer', jobs: 1, givenUsd: 120, sharePct: 0.32 },
      { key: 'No reason given', label: 'No reason given', jobs: 1, givenUsd: 100, sharePct: 0.26 },
    ])
  })
  it('by giver from the trail: dollars from the event, share of the giver\'s own jobs, events off-view ignored', () => {
    const out = jobSummaryDiscountLeakage({ rows, events, actorNames: names })
    expect(out.byGiver).toEqual([
      { key: 'u-t', label: 'Taunya', jobs: 2, givenUsd: 3894.5, sharePct: 10.74 },
      { key: 'system', label: 'System', jobs: 1, givenUsd: 100, sharePct: 11.11 },
    ])
  })
  it('no revenue → null shares; nothing discounted → empty tables', () => {
    const out = jobSummaryDiscountLeakage({ rows: [{ job: { id: 'a', fixtures: [] }, revenueUsd: 0, discountUsd: 0 }], events: [], actorNames: new Map() })
    expect(out).toMatchObject({ jobs: 0, givenUsd: 0, sharePct: null, byReason: [], byGiver: [] })
  })
})
