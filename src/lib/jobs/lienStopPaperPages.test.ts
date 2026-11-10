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
  const data = (over: { gcCustomerId?: string | null; isSub?: boolean; correction?: boolean; item?: unknown } = {}) =>
    ({
      affidavits: { entries: [{ jobId: 'j1', isSub: over.isSub ?? true, gcCustomerId: over.gcCustomerId === undefined ? 'gc1' : over.gcCustomerId, openBalance: 2000, lastMonth: '2026-08', gates: [{ key: 'notice', ok: true, label: '' }], item: over.item ?? null }] },
      filingsByJob: { j1: [{ kind: 'notice_53_056', months_covered: ['2026-07', '2026-08'], voided_at: null, sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9407 1', sent_on: '2026-09-14' }, { recipient: 'original_contractor', method: 'certified_mail', tracking: '9407 2', sent_on: '2026-09-14' }] }] },
      jobsById: { j1: { id: 'j1', hcp_number: '700', click_number: null, job_name: 'Sample Remodel', job_address: '12 Sample Rd, San Antonio, TX 78209', customer_name: 'Pat Owner', revenue: 5000, payments_made: 0, customer_address_id: null, master_user_id: null, created_at: '2026-07-01T05:40:28Z', first_work_date: '2026-07-06', last_work_date: '2026-08-20' } },
      gcsById: { gc1: { id: 'gc1', name: 'Harborline Builders', address: '9 Yard St, Devine TX 78016' } },
      addressesById: {},
      ownerByJob: {},
      claimCorrectionsByJob: over.correction ? { j1: { jobId: 'j1', amountOff: 500, perMonth: null, reason: 'disputed', carry: true, setByName: 'Rey', setAt: '2026-11-03T16:00:00Z', lookedAt: null, lookedByName: '' } } : {},
    }) as unknown as LienDeskData
  const text = (d: LienDeskData) => (affidavitStopPages({ data: d, jobId: 'j1', issuer: { companyName: 'Sample Plumbing LLC', addressText: '1 Shop Rd\nSan Antonio, TX 78201' } as never, signerNameFor: () => 'Rey Master', todayYmd: '2026-11-09' })?.[0]?.html ?? '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ')

  it('swears what the sent bills owe, less the claim set by hand, never the job’s whole balance', () => {
    expect(text(data())).toContain('The amount of the claim is $2,000.00.')
    expect(text(data())).not.toContain('$5,000.00')
    expect(text(data({ correction: true }))).toContain('The amount of the claim is $1,500.00.')
  })

  it('names the GC with its address on a job under one, and the owner on a job contracted with the owner', () => {
    expect(text(data())).toContain('3. Claimant did so under a contract with Harborline Builders, 9 Yard St, Devine TX 78016, the original contractor.')
    expect(text(data({ isSub: false, gcCustomerId: null }))).toContain('Claimant is the original contractor.')
  })

  it('the short form names the months and the sends of the notices on record, with nothing above the title (punch list #305)', () => {
    const page = text(data())
    expect(page).toContain('5. Payment is requested for work done and materials furnished in July and August 2026.')
    expect(page).toContain('6. Notice of the claim was sent to the owner by certified mail on September 14, 2026.')
    expect(page).not.toContain('Job #700')
    expect(page).not.toContain('Last work month')
  })

  it('a paper drafted before the short form keeps the earlier form: its desk item carries no mark', () => {
    const earlier = text(data({ item: { kind: 'affidavit', status: 'approved', fields: { notice: {} }, voided_at: null } }))
    expect(earlier).toContain('The amount currently due and unpaid is $2,000.00.')
    expect(earlier).toContain('The name and address of the original contractor is: Harborline Builders, 9 Yard St, Devine TX 78016.')
    expect(earlier).toContain('Job #700')
    // Redrawn on purpose, the same item carries the mark and reads as the short form.
    expect(text(data({ item: { kind: 'affidavit', status: 'drafted', fields: { notice: {}, affidavitForm: 'short' }, voided_at: null } }))).toContain('The amount of the claim is $2,000.00.')
  })
})

