import { describe, expect, it } from 'vitest'
import { buildCustomerTimeline, emptyCustomerTimelineInput, type TimelineCard, type TimelineRow } from './customerTimeline'

/** The review on the Customer Hub's timeline (v2.5946, punch list #185 PR 4). */
const CUST = { id: 'c-dana', name: 'Dana Whitfield', createdAt: '2026-09-01T16:00:00Z', dateMet: null }

function timeline(reviews: NonNullable<ReturnType<typeof emptyCustomerTimelineInput>['reviews']>) {
  const input = emptyCustomerTimelineInput(CUST)
  input.jobs = [
    {
      id: 'job-1312',
      hcpNumber: null,
      clickNumber: '1312',
      jobName: 'Water heater',
      jobAddress: '1208 Mesquite Ln, Kyle, TX',
      status: 'paid',
      revenue: 1850,
      paymentsMade: 1850,
      createdAt: '2026-10-20T15:00:00Z',
      customerId: CUST.id,
      customerName: CUST.name,
      gcCustomerId: null,
      collectionsAt: null,
      collectionsNote: null,
      uncollectibleAt: null,
      uncollectibleReason: null,
    },
  ]
  input.reviews = reviews
  return buildCustomerTimeline(input, '2026-10-28', Date.parse('2026-10-28T17:00:00Z'))
}

const cardsOf = (rows: TimelineRow[]): TimelineCard[] => rows.flatMap((r) => (r.kind === 'day' ? [...r.office, ...r.field] : []))

describe('the review card on the timeline', () => {
  it('draws the stars on the day they answered, their words as the quote, and the Google press and the call', () => {
    const t = timeline([{ id: 'r-1', jobId: 'job-1312', answeredAt: '2026-10-28T14:21:00Z', score: 2, words: 'The floor was left a mess.', googlePressedAt: '2026-10-28T14:22:00Z', calledAt: '2026-10-28T16:00:00Z' }])
    const review = cardsOf(t.rows).find((c) => c.kind === 'review')
    expect(review).toMatchObject({ key: 'review:r-1', ymd: '2026-10-28', side: 'office', jobId: 'job-1312', title: 'Left 2 stars', quote: 'The floor was left a mess.' })
    expect(review?.lines).toEqual(['pressed Post it on Google', expect.stringMatching(/^the office called /)])
  })

  it('leaves out a review about a job that is not this customer’s', () => {
    const t = timeline([{ id: 'r-2', jobId: 'someone-elses', answeredAt: '2026-10-28T14:21:00Z', score: 5, words: '', googlePressedAt: null, calledAt: null }])
    expect(cardsOf(t.rows).some((c) => c.kind === 'review')).toBe(false)
  })
})
