import { describe, expect, it } from 'vitest'
import { buildPortalPropertyNotices, ownerCourtesyOn, type PortalNoticeFilingRow, type PortalNoticeJobRow } from '../../../supabase/functions/_shared/portalPropertyNotices'
import { parsePortalPayload } from './portalPayload'

/** The owner's portal card says the reminder reached them (punch list #231, PR 3). */

const OWNER = 'umar'
const job: PortalNoticeJobRow = { id: 'j858', hcp_number: '858', click_number: null, job_address: '9703 Lenox Hl, San Antonio, TX', customer_id: OWNER, gc_customer_id: 'rmc', revenue: 17585, payments_made: 0 }
const filing: PortalNoticeFilingRow = { id: 'f1', job_id: 'j858', kind: 'notice_53_056', amount: 17585, printed_claim: null, months_covered: ['2026-08'], packet_id: null, created_at: '2026-10-14T15:00:00Z', voided_at: null, sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '', sent_on: '2026-10-14' }], fields: { claimantName: 'Click', originalContractorName: 'RMC', contactPerson: 'M' } }
const to = (who: string, ok = true) => ({ who, channel: 'email', address: 'x', ok, id: ok ? 'e' : null, reason: '' })

describe('ownerCourtesyOn', () => {
  it('is the newest day a courtesy email reached the owner, off the notice’s items; a GC-only send, a failed one, a voided item or another filing’s item does not count', () => {
    const ids = new Set(['f1'])
    expect(ownerCourtesyOn([], ids)).toBe('')
    expect(ownerCourtesyOn([{ sent_filing_id: 'f1', voided_at: null, fields: { courtesy: [{ at: '2026-10-23T15:00:00Z', to: [to('original_contractor')] }] } }], ids)).toBe('')
    expect(ownerCourtesyOn([{ sent_filing_id: 'f1', voided_at: null, fields: { courtesy: [{ at: '2026-10-23T15:00:00Z', to: [to('owner', false)] }] } }], ids)).toBe('')
    expect(ownerCourtesyOn([{ sent_filing_id: 'f1', voided_at: '2026-11-01', fields: { courtesy: [{ at: '2026-10-23T15:00:00Z', to: [to('owner')] }] } }], ids)).toBe('')
    expect(ownerCourtesyOn([{ sent_filing_id: 'f2', voided_at: null, fields: { courtesy: [{ at: '2026-10-23T15:00:00Z', to: [to('owner')] }] } }], ids)).toBe('')
    expect(ownerCourtesyOn([{ sent_filing_id: 'f1', voided_at: null, fields: { courtesy: [{ at: '2026-10-23T15:00:00Z', to: [to('owner')] }, { at: '2026-10-31T15:00:00Z', to: [to('owner')] }] } }], ids)).toBe('2026-10-31')
  })

  it('rides the card and survives the payload parse; an older function without it reads as none', () => {
    const [n] = buildPortalPropertyNotices({ jobs: [job], filings: [filing], viewerCustomerId: OWNER, items: [{ sent_filing_id: 'f1', voided_at: null, fields: { courtesy: [{ at: '2026-10-31T15:00:00Z', to: [to('owner')] }] } }] })
    expect(n!.courtesyOn).toBe('2026-10-31')
    expect(buildPortalPropertyNotices({ jobs: [job], filings: [filing], viewerCustomerId: OWNER })[0]!.courtesyOn).toBe('')
    const parsed = parsePortalPayload({ company: { name: 'Click', phone: '', email: '', address: '' }, customerName: 'U', bills: [], propertyNotices: [{ ...n, courtesyOn: '2026-10-31' }, { ...n, key: 'k2', courtesyOn: undefined }] })
    expect(parsed!.propertyNotices.map((x) => x.courtesyOn)).toEqual(['2026-10-31', ''])
  })
})
