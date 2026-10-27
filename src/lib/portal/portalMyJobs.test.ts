import { describe, expect, it } from 'vitest'
import { PORTAL_JOB_STAGES, portalMyJobs, SAMPLE_MY_JOBS, type PortalMyJobRating, type PortalMyJobRow } from '../../../supabase/functions/_shared/portalMyJobs'
import { parsePortalMyJobs } from './portalPayload'

const DANA = 'cust-dana'
const job = (p: Partial<PortalMyJobRow> & { id: string }): PortalMyJobRow => ({ customer_id: DANA, gc_customer_id: null, job_name: null, job_address: '1208 Mesquite Ln', status: 'working', click_number: null, hcp_number: null, ...p })
const ask = (p: Partial<PortalMyJobRating>): PortalMyJobRating => ({ job_id: 'j-paid', public_token: 'a'.repeat(32), asked_at: '2026-10-28T14:00:00Z', answered_at: null, score: null, ...p })

describe('Your jobs on the portal (v2.5948, punch list #185)', () => {
  it('reads each stage from the Pipeline status, in the customer’s words', () => {
    const jobs = ['waiting', 'working', 'ready_to_bill', 'billed'].map((status, i) => job({ id: `j${i}`, status, job_name: status }))
    expect(portalMyJobs(jobs, [], DANA).map((j) => [j.label, PORTAL_JOB_STAGES.en[j.stage]])).toEqual([
      ['billed', 'Billed'],
      ['ready_to_bill', 'Done'],
      ['working', 'Working'],
      ['waiting', 'Booked'],
    ])
  })

  it('keeps a paid job only while it was asked for a review, with the link while it is open and the stars after', () => {
    expect(portalMyJobs([job({ id: 'j-paid', status: 'paid' })], [], DANA)).toEqual([])
    const open = portalMyJobs([job({ id: 'j-paid', status: 'paid', job_name: 'Water heater' })], [ask({})], DANA)
    expect(open).toEqual([{ jobId: 'j-paid', label: 'Water heater', address: '1208 Mesquite Ln', stage: 4, rateToken: 'a'.repeat(32), stars: null }])
    const done = portalMyJobs([job({ id: 'j-paid', status: 'paid' })], [ask({ answered_at: '2026-10-28T15:00:00Z', score: 5 })], DANA)
    expect(done[0]).toMatchObject({ rateToken: null, stars: 5, label: '1208 Mesquite Ln' })
  })

  it('never lists a job they GC for someone else, or another customer’s', () => {
    expect(portalMyJobs([job({ id: 'a', gc_customer_id: 'cust-ridgeway' }), job({ id: 'b', customer_id: 'cust-other' })], [], DANA)).toEqual([])
    expect(portalMyJobs([job({ id: 'c', gc_customer_id: DANA })], [], DANA)).toHaveLength(1)
    expect(portalMyJobs([job({ id: 'd', billing_only: true })], [], DANA)).toEqual([])
  })

  it('caps the card, open jobs first', () => {
    const many = Array.from({ length: 9 }, (_, i) => job({ id: `j${i}` }))
    expect(portalMyJobs(many, [], DANA)).toHaveLength(6)
  })

  it('parses the payload defensively, and the sample reads', () => {
    expect(parsePortalMyJobs(SAMPLE_MY_JOBS)).toHaveLength(2)
    expect(parsePortalMyJobs([{ jobId: 'x', label: 'L', stage: 9 }, { label: 'no id' }, null])).toEqual([])
    expect(parsePortalMyJobs(undefined)).toEqual([])
    expect(parsePortalMyJobs([{ jobId: 'x', label: 'L', stage: 2, rateToken: 'tok', stars: 4, address: null }])).toEqual([{ jobId: 'x', label: 'L', address: null, stage: 2, rateToken: 'tok', stars: 4 }])
  })
})
