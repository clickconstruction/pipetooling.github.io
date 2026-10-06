/**
 * The Lien grid's rows, stripped (punch list #85, item 2): a whole table row in,
 * dates and dollars out — and the client's grid still assembles from what is left.
 */
import { describe, expect, it } from 'vitest'
import { LIEN_BOOK_COUNSEL_SELECT, shapeLienBookForCounsel } from './legalLienBookShape'
import { assembleLienBookInput, parseLienBookRaw } from '../jobs/lienTimelineBookAssemble'

const deskItem = {
  id: 'it1', job_id: 'j1', kind: 'notice', status: 'held', months: ['2026-05'], sent_at: null, sent_filing_id: null, hold_until: '2026-10-20', created_at: '2026-09-01T00:00:00Z', voided_at: null,
  fields: { skipReason: 'Owner asked us not to', skippedBy: 'Taunya', coverLetter: 'Dear …', ownerCall: { said: 'will pay' } },
  hold_reason: 'The GC called and asked for a week', word_note: 'Pat says the draw funds Friday', word_channel: 'phone', cover_note: true,
  drafted_by: 'u1', approved_by: 'u2', held_by: 'u1', printed_by: null, pulled_back_by: null, approval_mode: 'leader', drafted_at: '2026-09-01', approved_at: null, held_at: '2026-09-02', printed_at: null, submitted_at: null, pulled_back_at: null, updated_at: '2026-09-02',
}
const filing = {
  id: 'f1', job_id: 'j1', kind: 'affidavit', filed_at: '2026-09-15', served_at: null, serve_due: '2026-09-20', months_covered: ['2026-05'], county: 'Hays', amount: 14400, recording_number: '2026-0001', created_at: '2026-09-15T00:00:00Z', voided_at: null,
  document_note: 'copy in the blue folder', document_url: 'https://drive.example/x', fields: { printedClaim: 14400 }, sends: [{ to: 'owner@example.com' }], invoice_ids: ['inv1'], by_hand: false, packet_id: null, printed_claim: 14400, created_by: 'u1',
}
const owner = { job_id: 'j1', owner_mode: 'company', owner_name: 'Sam Owner', company_name: 'Sample Holdings LLC', mailing_address: '1 Main St', owner_email: 'sam@example.com' }
const address = {
  id: 'a1', customer_id: 'c1', address: '200 Sample Pkwy', county: 'Hays', legal_description: 'Lot 1', property_kind: 'non_residential', homestead: false, owner_mode: 'company', owner_name: '', owner_company: 'Sample Holdings LLC', owner_mailing_address: '1 Main St', parcel_id: 'R123', is_primary: true, sequence_order: 0,
  note: 'Gate code 4411, ask for Pat', county_source: 'typed', owner_confirmed_at: null, owner_confirmed_by: null, parcel_looked_up_at: null, parcel_source: '', parcel_tax_year: '', created_at: null, updated_at: null,
}
const gc = { id: 'g1', name: 'Sample Contracting', lien_notice_policy: 'hold', contact_info: { email: 'pat@example.com' }, notes: 'slow payer' }

describe('shapeLienBookForCounsel', () => {
  const shaped = shapeLienBookForCounsel({ rows: [], affidavitRows: [], items: [deskItem], filings: [filing], jobs: [], gcs: [gc], addresses: [address], owners: [owner] })

  it('drops everything anyone said and every private detail', () => {
    const flat = JSON.stringify(shaped)
    for (const secret of ['skipReason', 'Owner asked us not to', 'coverLetter', 'ownerCall', 'The GC called', 'Pat says', 'word_channel', 'drafted_by', 'approved_by', 'held_by', 'blue folder', 'drive.example', 'owner@example.com', 'sam@example.com', 'Gate code', 'pat@example.com', 'slow payer', 'invoice_ids']) {
      expect(flat, secret).not.toContain(secret)
    }
  })

  it('keeps the dates, dollars, property and owner of record the grid draws', () => {
    expect(shaped.items[0]).toEqual({ id: 'it1', job_id: 'j1', kind: 'notice', status: 'held', months: ['2026-05'], sent_at: null, sent_filing_id: null, hold_until: '2026-10-20', created_at: '2026-09-01T00:00:00Z', voided_at: null })
    expect(shaped.filings[0]).toMatchObject({ kind: 'affidavit', filed_at: '2026-09-15', county: 'Hays', amount: 14400, recording_number: '2026-0001', months_covered: ['2026-05'] })
    expect(shaped.owners[0]).toEqual({ job_id: 'j1', owner_mode: 'company', owner_name: 'Sam Owner', company_name: 'Sample Holdings LLC', mailing_address: '1 Main St' })
    expect(shaped.addresses[0]).toMatchObject({ address: '200 Sample Pkwy', county: 'Hays', legal_description: 'Lot 1', property_kind: 'non_residential', owner_company: 'Sample Holdings LLC', parcel_id: 'R123' })
    expect(shaped.gcs[0]).toEqual({ id: 'g1', name: 'Sample Contracting', lien_notice_policy: 'hold' })
  })

  it('names the same columns in the selects the function runs', () => {
    expect(LIEN_BOOK_COUNSEL_SELECT.deskItems).toBe(Object.keys(shaped.items[0]).join(', '))
    expect(LIEN_BOOK_COUNSEL_SELECT.filings).toBe(Object.keys(shaped.filings[0]).join(', '))
    expect(LIEN_BOOK_COUNSEL_SELECT.owners).toBe(Object.keys(shaped.owners[0]).join(', '))
    expect(LIEN_BOOK_COUNSEL_SELECT.addresses).toBe(Object.keys(shaped.addresses[0]).join(', '))
    expect(LIEN_BOOK_COUNSEL_SELECT.gcs).toBe(Object.keys(shaped.gcs[0]).join(', '))
  })

  it('still assembles into the grid’s book on the client', () => {
    const job = { id: 'j1', hcp_number: '1042', click_number: null, job_name: 'Tenant finish-out', job_address: '200 Sample Pkwy', gc_customer_id: 'g1', customer_address_id: 'a1', revenue: 18400, payments_made: 4000, last_work_date: '2026-05-29', lien_payment_bond: null, lien_contract_ended_on: null }
    const raw = parseLienBookRaw(JSON.parse(JSON.stringify({ ...shaped, jobs: [job] })))
    expect(raw).not.toBeNull()
    const input = assembleLienBookInput(raw!, '2026-10-05')
    expect(input.jobs.j1).toMatchObject({ label: '1042 · Tenant finish-out', county: 'Hays', ownerName: 'Sam Owner', openBalance: 14400, gcName: 'Sample Contracting', homestead: false })
    expect(input.policyByCustomer.g1).toBe('hold')
    expect(input.filingsByJob.j1).toHaveLength(1)
  })
})
