import { describe, expect, it } from 'vitest'
import { buildPortalPropertyNotices, portalNoticeMonthsWords, type PortalNoticeFilingRow, type PortalNoticeJobRow } from '../../../supabase/functions/_shared/portalPropertyNotices'
import { parsePortalPayload } from './portalPayload'

// 9703 Lenox Hl: the viewer owns it; RMC- Dudley Mason is the GC.
const OWNER = 'umar'
const job = (id: string, over: Partial<PortalNoticeJobRow> = {}): PortalNoticeJobRow => ({ id, hcp_number: id.replace('j', ''), click_number: null, job_address: '9703 Lenox Hl, San Antonio, TX', customer_id: OWNER, gc_customer_id: 'rmc', revenue: 17585, payments_made: 0, ...over })
const fields = { claimantName: 'Click Plumbing and Electrical', originalContractorName: 'RMC- Dudley Mason', contactPerson: 'Malachi Whites, Master Plumber' }
const filing = (id: string, jobId: string, over: Partial<PortalNoticeFilingRow> = {}): PortalNoticeFilingRow => ({
  id,
  job_id: jobId,
  kind: 'notice_53_056',
  amount: 17585,
  printed_claim: null,
  months_covered: ['2026-04', '2026-06', '2026-07', '2026-08'],
  packet_id: null,
  created_at: '2026-09-26T15:00:00Z',
  voided_at: null,
  sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9407', sent_on: '2026-09-25' }, { recipient: 'original_contractor', method: 'certified_mail', tracking: '9408', sent_on: '2026-09-25' }],
  fields,
  ...over,
})

describe('portalNoticeMonthsWords', () => {
  it('one year: the months then the year; across years: each with its year', () => {
    expect(portalNoticeMonthsWords(['2026-08', '2026-04', '2026-06', '2026-07'])).toBe('April, June, July and August 2026')
    expect(portalNoticeMonthsWords(['2026-01', '2025-12'])).toBe('December 2025 and January 2026')
    expect(portalNoticeMonthsWords(['2026-08'])).toBe('August 2026')
    expect(portalNoticeMonthsWords([])).toBe('')
  })
})

describe('buildPortalPropertyNotices (v2.3825)', () => {
  it('a recorded notice on the owner’s job: the owner send’s day, the claim, the months and the names', () => {
    const [n] = buildPortalPropertyNotices({ jobs: [job('j273')], filings: [filing('f1', 'j273')], viewerCustomerId: OWNER })
    expect(n).toEqual({
      key: 'f1',
      address: '9703 Lenox Hl, San Antonio, TX',
      jobNumbers: ['273'],
      gcName: 'RMC- Dudley Mason',
      claimantName: 'Click Plumbing and Electrical',
      contactPerson: 'Malachi Whites, Master Plumber',
      claim: 17585,
      months: ['2026-04', '2026-06', '2026-07', '2026-08'],
      mailedOn: '2026-09-25',
    })
  })
  it('never for the GC viewing, a voided filing, another kind, or a job paid off', () => {
    const one = (j: PortalNoticeJobRow, f: PortalNoticeFilingRow, viewer = OWNER) => buildPortalPropertyNotices({ jobs: [j], filings: [f], viewerCustomerId: viewer })
    expect(one(job('j273'), filing('f1', 'j273'), 'rmc')).toEqual([])
    expect(one(job('j273'), filing('f1', 'j273', { voided_at: '2026-09-26T00:00:00Z' }))).toEqual([])
    expect(one(job('j273'), filing('f1', 'j273', { kind: 'affidavit' }))).toEqual([])
    expect(one(job('j273', { payments_made: 17585 }), filing('f1', 'j273'))).toEqual([])
    expect(one(job('j273', { gc_customer_id: null }), filing('f1', 'j273'))).toEqual([])
  })
  it('one paper for several jobs at the property is one card with its printed total', () => {
    const jobs = [job('j858', { revenue: 7902 }), job('j866', { revenue: 3500 })]
    const filings = [
      filing('f2', 'j858', { packet_id: 'p1', amount: 7902, printed_claim: 11402, months_covered: ['2026-08'] }),
      filing('f3', 'j866', { packet_id: 'p1', amount: 3500, printed_claim: 11402, months_covered: ['2026-08'] }),
    ]
    const out = buildPortalPropertyNotices({ jobs, filings, viewerCustomerId: OWNER })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ key: 'p1', jobNumbers: ['858', '866'], claim: 11402, months: ['2026-08'] })
  })
  it('falls back to the filing day when the owner send has no date', () => {
    expect(buildPortalPropertyNotices({ jobs: [job('j273')], filings: [filing('f1', 'j273', { sends: [] })], viewerCustomerId: OWNER })[0]!.mailedOn).toBe('2026-09-26')
  })
})

describe('parsePortalPayload · propertyNotices', () => {
  const base = { company: {}, customerName: 'Umar Khan', audience: 'all', bills: [], sharedBills: [], requestableJobs: [], requestableProperties: [] }
  it('reads the notices, and a function from before them reads none', () => {
    const p = parsePortalPayload({ ...base, propertyNotices: [{ key: 'f1', address: '9703 Lenox Hl', jobNumbers: ['273'], gcName: 'RMC- Dudley Mason', claimantName: 'Click', contactPerson: 'Malachi', claim: 17585, months: ['2026-08'], mailedOn: '2026-09-25' }] })
    expect(p?.propertyNotices).toEqual([{ key: 'f1', address: '9703 Lenox Hl', jobNumbers: ['273'], gcName: 'RMC- Dudley Mason', claimantName: 'Click', contactPerson: 'Malachi', claim: 17585, months: ['2026-08'], mailedOn: '2026-09-25' }])
    expect(parsePortalPayload(base)?.propertyNotices).toEqual([])
  })
})
