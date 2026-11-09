import { describe, expect, it } from 'vitest'
import { affidavitStopPages, filingSnapshotPage } from './lienStopPaperPages'
import type { LienDeskData } from '../../hooks/useLienDeskData'
import { buildLienNoticeFieldsForJob } from './lienNoticeDraft'
import type { JobLienFilingRow } from './lienDeadlines'

const filing = (partial: Partial<JobLienFilingRow>): JobLienFilingRow =>
  ({ id: 'f1', job_id: 'j650', kind: 'notice_53_056', amount: 27_199, by_hand: false, county: 'Williamson', created_at: '2026-10-03T15:00:00Z', created_by: null, document_note: '', document_url: '', fields: {}, filed_at: '2026-10-03', invoice_ids: [], months_covered: ['2026-07', '2026-08'], packet_id: null, printed_claim: null, recording_number: '', sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9407 1234', sent_on: '2026-10-03' }], serve_due: null, served_at: null, voided_at: null, ...partial }) as JobLienFilingRow

describe('filingSnapshotPage', () => {
  it('rebuilds a mailed notice from the fields the filing stored, with the sends it recorded', () => {
    const fields = buildLienNoticeFieldsForJob({ jobName: 'Take 5- Liberty Hill', jobAddress: '11730 TX-29, Liberty Hill, TX 78642', homesteadStatement: false, originalContractorName: 'Burd & Assoc.', openBalance: 27_199, contactPerson: 'Robert Douglas, Master Plumber', issuer: null, todayYmd: '2026-10-03', retainageHeld: null, serviceTypeName: 'Plumbing' })
    const page = filingSnapshotPage(filing({ fields: fields as unknown as JobLienFilingRow['fields'] }), { issuer: null, jobNumber: '891' })
    expect(page?.key).toBe('filing:f1')
    expect(page?.label).toBe('As it went out · the notice')
    expect(page?.html).toContain('Burd &amp; Assoc.')
    expect(page?.html).toContain('Job #891')
    expect(page?.html).toContain('Work month 2026-07, 2026-08')
    expect(page?.html).toContain('certified mail, return receipt · 9407 1234')
  })

  it('names the paper by the filing’s kind, and is null when the row stores no snapshot', () => {
    const fields = buildLienNoticeFieldsForJob({ jobName: 'Take 5', jobAddress: '', homesteadStatement: false, originalContractorName: 'Burd & Assoc.', openBalance: 1_000, contactPerson: 'Robert Douglas', issuer: null, todayYmd: '2026-10-03', retainageHeld: 100, serviceTypeName: 'Plumbing' })
    expect(filingSnapshotPage(filing({ kind: 'retainage_53_057', months_covered: [], fields: fields as unknown as JobLienFilingRow['fields'] }), { issuer: null, jobNumber: '891' })?.label).toBe('As it went out · the § 53.057 notice')
    expect(filingSnapshotPage(filing({ fields: null as unknown as JobLienFilingRow['fields'] }), { issuer: null, jobNumber: '891' })).toBeNull()
  })
})

describe('affidavitStopPages · a stop’s window prints the pane’s affidavit', () => {
  // The desk's data for one job billed in stages: $5,000, the sent bills owe $2,000 (the RPC's open_balance), $500 off by hand.
  const data = (over: { gcCustomerId?: string | null; isSub?: boolean; correction?: boolean } = {}) =>
    ({
      affidavits: { entries: [{ jobId: 'j1', isSub: over.isSub ?? true, gcCustomerId: over.gcCustomerId === undefined ? 'gc1' : over.gcCustomerId, openBalance: 2000, lastMonth: '2026-08', gates: [{ key: 'notice', ok: true, label: '' }] }] },
      jobsById: { j1: { id: 'j1', hcp_number: '700', click_number: null, job_name: 'Sample Remodel', job_address: '12 Sample Rd, San Antonio, TX 78209', customer_name: 'Pat Owner', revenue: 5000, payments_made: 0, customer_address_id: null, master_user_id: null, created_at: '2026-08-18T05:40:28Z' } },
      gcsById: { gc1: { id: 'gc1', name: 'Harborline Builders', address: '9 Yard St, Devine TX 78016' } },
      addressesById: {},
      ownerByJob: {},
      claimCorrectionsByJob: over.correction ? { j1: { jobId: 'j1', amountOff: 500, perMonth: null, reason: 'disputed', carry: true, setByName: 'Rey', setAt: '2026-11-03T16:00:00Z', lookedAt: null, lookedByName: '' } } : {},
    }) as unknown as LienDeskData
  const text = (d: LienDeskData) => (affidavitStopPages({ data: d, jobId: 'j1', issuer: { companyName: 'Sample Plumbing LLC', addressText: '1 Shop Rd\nSan Antonio, TX 78201' } as never, signerNameFor: () => 'Rey Master', todayYmd: '2026-11-09' })?.[0]?.html ?? '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ')

  it('swears what the sent bills owe, less the claim set by hand, never the job’s whole balance', () => {
    expect(text(data())).toContain('The amount currently due and unpaid is $2,000.00.')
    expect(text(data())).not.toContain('due and unpaid is $5,000.00')
    expect(text(data({ correction: true }))).toContain('The amount currently due and unpaid is $1,500.00.')
  })

  it('names the GC on a job under one, and our own company on a job contracted with the owner', () => {
    expect(text(data())).toContain('The name and address of the original contractor is: Harborline Builders, 9 Yard St, Devine TX 78016.')
    expect(text(data({ isSub: false, gcCustomerId: null }))).toContain('The name and address of the original contractor is: Sample Plumbing LLC, 1 Shop Rd, San Antonio, TX 78201.')
  })
})

