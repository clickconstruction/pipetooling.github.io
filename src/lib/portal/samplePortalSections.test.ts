import { describe, expect, it } from 'vitest'
import { sampleCustomerPortalResponse, sampleNoticeFilings, sampleOwnerGcRows, samplePortalMoneyRows } from '../../../supabase/functions/_shared/customerSampleFixtures'
import { PORTAL_COMPANY } from '../../../supabase/functions/_shared/portalCompany'
import { buildPortalPropertyNotices } from '../../../supabase/functions/_shared/portalPropertyNotices'
import { buildPortalProperties } from '../../../supabase/functions/_shared/portalProperties'
import { testReportShortLabel, testReportTitle } from '../../../supabase/functions/_shared/testReport'
import { gcPortalJobs, type PortalGcJob } from '../../../supabase/functions/_shared/gcPortal'
import type { PortalPropertyNotice } from '../../../supabase/functions/_shared/portalPropertyNotices'
import type { PortalProperty } from '../../../supabase/functions/_shared/portalProperties'
import { SAMPLE_OWNER, type SampleState } from '../../../supabase/functions/_shared/customerSample'
import { parsePortalPayload } from './portalPayload'

/**
 * The sample portals' remaining sections, through the kernels a real portal runs (What customers
 * see #103, PR 3): the recorded § 53.056 notice, the visit picker's properties, the test-report
 * labels, the agreements' signer lines, the promise, the owner's records and the owner's GC job.
 * Each is the kernel's output on the sample's own rows, called as `customer-portal` calls them,
 * and the page reads them.
 */
const today = '2026-10-25'
const origin = 'https://app.example'

/** The keys this suite reads off a sample answer, as the function sends them. */
type SampleAnswer = {
  propertyNotices: PortalPropertyNotice[]
  requestableProperties: PortalProperty[]
  bills: { jobLabel: string }[]
  checks: { jobs: { id: string }[] }
  totalDue: number
  promise: { promisedYmd: string; source: string } | null
  ownerRecords: Record<string, unknown> | null
  gcJobs: PortalGcJob[]
  testReports: { reportLabel: string; title: string }[]
  agreements: { signerName: string | null; signingProgress: string | null }[]
}
const answer = (state: SampleState) => sampleCustomerPortalResponse(PORTAL_COMPANY, state, today, origin) as unknown as SampleAnswer

describe('the sample portals’ sections, through the portal’s own kernels (#103 PR 3)', () => {
  it.each(['live', 'done', 'gc', 'owner'] as const)('%s: the notices and the visit picker’s properties are the kernels’ output on the sample rows', (state) => {
    const a = answer(state)
    const r = samplePortalMoneyRows(state, today, origin)
    expect(a.propertyNotices).toEqual(buildPortalPropertyNotices({ jobs: r.jobs, filings: sampleNoticeFilings(state, today, PORTAL_COMPANY.name), viewerCustomerId: r.viewerCustomerId }))
    expect(a.requestableProperties).toEqual(buildPortalProperties(r.jobs.map((j) => ({ id: j.id, status: j.status, job_address: j.job_address, hcp_number: j.hcp_number, click_number: j.click_number }))))
  })

  it('the homeowner: the recorded notice on the bath remodel, and nothing of that job on the money', () => {
    const a = answer('live')
    expect(a.propertyNotices).toHaveLength(1)
    const n = a.propertyNotices[0]!
    expect([n.gcName, n.claimantName, n.contactPerson, n.claim, n.jobNumbers, n.months, n.mailedOn]).toEqual([
      'Summit Builders LLC',
      PORTAL_COMPANY.name,
      'Malachi Whites, Master Plumber',
      8_900,
      ['0989'],
      ['2026-08', '2026-09'],
      '2026-10-17',
    ])
    // Billed to the GC with nothing billed yet: the remodel never reaches the money sections.
    expect(a.bills.some((b: { jobLabel: string }) => b.jobLabel.includes('Primary bath remodel'))).toBe(false)
    expect(a.checks.jobs.some((j: { id: string }) => j.id === 'sample-job-notice')).toBe(false)
    expect(a.totalDue).toBe(4_940)
    // One address across the three jobs, so the picker still offers one property, behind the newest job.
    expect(a.requestableProperties).toEqual([{ jobId: 'sample-job-open', street: '100 Sample St', city: 'Kyle' }])
  })

  it('the GC: no notice (the paper is the owner’s), both properties, no promise and no GC jobs on a scoped link', () => {
    const a = answer('gc')
    expect(a.propertyNotices).toEqual([])
    expect(a.requestableProperties).toEqual([
      { jobId: 'sample-job-open', street: '2530 Hunter Rd', city: 'San Marcos' },
      { jobId: 'sample-job-paid', street: '1900 Hunter Rd', city: 'San Marcos' },
    ])
    expect(a.promise).toBeNull()
    expect(a.ownerRecords).toBeNull()
    expect(a.gcJobs).toEqual([])
  })

  it('the homeowner’s promise: the pay-by date they gave us, a week out', () => {
    expect(answer('live').promise).toEqual({ promisedYmd: '2026-11-01', source: 'customer' })
  })

  it('the test-report labels are the report kernel’s words on each row’s type and system', () => {
    expect(answer('live').testReports.map((t: { reportLabel: string; title: string }) => [t.reportLabel, t.title])).toEqual([[testReportShortLabel('gas', null), testReportTitle('gas', null)]])
    expect(answer('gc').testReports.map((t: { reportLabel: string; title: string }) => [t.reportLabel, t.title])).toEqual([
      [testReportShortLabel('pre_test', 'sewer'), testReportTitle('pre_test', 'sewer')],
      [testReportShortLabel('post_test', 'sewer'), testReportTitle('post_test', 'sewer')],
    ])
    // The kernel's words are the ones the hand-written sample used to carry.
    expect(answer('gc').testReports[0]!.reportLabel).toBe('Sewer Pre-Test Hydrostatic')
    expect(answer('gc').testReports[0]!.title).toBe('Sewer Pre-Test Hydrostatic Test Report')
  })

  it('the agreements’ signer lines come from the frames kernel: one filled frame, no waiting line', () => {
    const live = answer('live').agreements[0]!
    expect([live.signerName, live.signingProgress]).toEqual(['Sam Sample', null])
    const gc = answer('gc').agreements[0]!
    expect([gc.signerName, gc.signingProgress]).toEqual(['Pat Sample', null])
  })

  it('the owner’s GC job is gcPortalJobs’ output on the sample rows, the schedule and the page laid on after the read', () => {
    const a = answer('owner')
    const kernel = gcPortalJobs(sampleOwnerGcRows(today, origin), 'sample-owner')
    expect(kernel).toHaveLength(1)
    expect(a.gcJobs).toHaveLength(1)
    const { schedule, page, ...rest } = a.gcJobs[0]!
    expect(rest).toEqual(kernel[0])
    // The presses the sample shows: our contract to sign, the change order, Accept the work.
    expect(rest.contract).toMatchObject({ state: 'toSign', total: 187_000, retainagePct: 10, retainageStep: { atPct: 50, toPct: 5, way: 'rest' }, payDays: 30 })
    expect(rest.changeOrders.map((c: { number: number; price: number; days: number }) => [c.number, c.price, c.days])).toEqual([[2, 1_100, 3]])
    expect(rest.canAccept).toBe(true)
    expect(schedule?.stages?.length).toBeGreaterThan(0)
    expect(page?.architect).toBe('Rivera Design Studio')
  })

  it('the owner: the records request offered and signed here, and the property through the picker’s kernel', () => {
    const a = answer('owner')
    expect(a.ownerRecords).toEqual({ id: 'sample-owner-records', address: SAMPLE_OWNER.address, ownerName: SAMPLE_OWNER.company, offeredOn: '2026-10-22', signed: { on: '2026-10-24', name: SAMPLE_OWNER.contact }, sent: null })
    expect(a.requestableProperties).toEqual([{ jobId: 'sample-job-owner', street: '400 Sample Pkwy', city: 'Kyle' }])
    expect(a.propertyNotices).toEqual([])
    expect(a.promise).toBeNull()
  })

  it('the page parses each sample: the notice, the promise, the records and the GC job', () => {
    const live = parsePortalPayload(answer('live'))!
    expect(live.propertyNotices).toHaveLength(1)
    expect(live.promise).toEqual({ promisedYmd: '2026-11-01', source: 'customer' })
    expect(live.gcJobs).toEqual([])
    const owner = parsePortalPayload(answer('owner'))!
    expect(owner.ownerRecords?.signed?.name).toBe(SAMPLE_OWNER.contact)
    expect(owner.gcJobs).toHaveLength(1)
    expect(owner.gcJobs[0]!.contract?.state).toBe('toSign')
    const gc = parsePortalPayload(answer('gc'))!
    expect(gc.propertyNotices).toEqual([])
    expect(gc.promise).toBeNull()
  })
})
