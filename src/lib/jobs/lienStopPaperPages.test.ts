import { describe, expect, it } from 'vitest'
import { filingSnapshotPage } from './lienStopPaperPages'
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
