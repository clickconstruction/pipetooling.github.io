/**
 * The Lien grid's rows, stripped (punch list #85, item 2): a whole table row in,
 * dates and dollars out — and the client's grid still assembles from what is left.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LIEN_BOOK_COUNSEL_SELECT, LIEN_BOOK_FILING_KINDS, LIEN_BOOK_JOB_COLUMNS_SENT, LIEN_BOOK_OWNER_CALL_SELECT, LIEN_BOOK_SEND_KEYS, shapeLienBookForCounsel } from './legalLienBookShape'
import { lienAffidavitOwnerSends } from '../jobs/lienAffidavitNotices'
import { lienTimelineMonthsWithNoticeRecords } from '../jobs/lienTimelineDesk'
import { buildLienTimelineBook } from '../jobs/lienTimelineBook'
import { assembleLienBookInput, LIEN_BOOK_JOB_COLUMNS, parseLienBookRaw } from '../jobs/lienTimelineBookAssemble'

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

  it('sends the owner’s answers as four values a job, and nothing else off the call (v2.8315)', () => {
    const call = { at: '2026-10-01T16:30:00Z', name: 'Taunya Sample', owesGc: 'yes', owesAmount: 12000, reserved: 'held', originalContractCompletedOn: '2026-08-30', note: 'Jordan said the GC is slow', told: ['card one'], wantsToPayUs: true }
    const notice = (job_id: string) => ({ job_id, kind: 'notice_53_056', voided_at: null, fields: { notice: { ownerName: 'Sam Owner' }, coverLetter: 'Dear …', ownerCall: call } })
    const jobs = [{ id: 'j1', job_name: 'Tenant finish-out', customer_name: 'Sample Contracting', gc_customer_id: 'g1' }, { id: 'jz', job_name: 'ZZ test job', customer_name: 'Sample Contracting', gc_customer_id: 'g1' }]
    const out = shapeLienBookForCounsel({ rows: [], affidavitRows: [], items: [deskItem], filings: [], jobs, gcs: [gc], addresses: [], owners: [], ownerCallItems: [notice('j1'), notice('jz')] })
    // The kept job's facts, cut to their keys; the ZZ job's call leaves with the job.
    expect(out.ownerFacts).toEqual({ j1: { paidOut: 'no', owesAmount: 12000, reserved: 'held', releasedOn: null } })
    const flat = JSON.stringify(out)
    for (const secret of ['ownerCall', 'Taunya Sample', 'Jordan said', 'card one', 'wantsToPayUs', '2026-10-01T16:30', '2026-08-30', 'coverLetter', 'Dear …']) expect(flat, secret).not.toContain(secret)
    // With no call read, the key is there and empty: the client then knows not to look in its items.
    expect(shaped.ownerFacts).toEqual({})
    expect(LIEN_BOOK_OWNER_CALL_SELECT).toBe('job_id, kind, voided_at, fields')
    expect(LIEN_BOOK_COUNSEL_SELECT.deskItems).not.toContain('fields')
  })

  it('a recorded § 53.056 notice travels with the day each copy went, and nothing else of its sends (punch list #415)', () => {
    const notice = {
      ...filing,
      id: 'n1',
      kind: 'notice_53_056',
      filed_at: null,
      recording_number: null,
      months_covered: ['2026-08'],
      created_at: '2026-09-16T15:00:00Z',
      sends: [
        { recipient: 'owner', method: 'certified_mail', tracking: '9407 1118 0000', sent_on: '2026-09-14', name: 'Sam Owner', address: '1 Main St', email: 'owner@example.com' },
        { recipient: 'original_contractor', method: 'hand', tracking: '', sent_on: '2026-09-15', name: 'Pat at Sample Contracting' },
        { recipient: 'owner', method: 'certified_mail', tracking: '9407 2222', sent_on: 'later' },
        null,
      ],
    }
    const out = shapeLienBookForCounsel({ rows: [], affidavitRows: [], items: [], filings: [notice, filing], jobs: [], gcs: [], addresses: [], owners: [] })
    expect(out.filings[0]).toMatchObject({ id: 'n1', kind: 'notice_53_056', months_covered: ['2026-08'] })
    // Who, how and the day. A send with no day is dropped: it says nothing the grid draws.
    expect(out.filings[0]!.sends).toEqual([
      { recipient: 'owner', method: 'certified_mail', sent_on: '2026-09-14' },
      { recipient: 'original_contractor', method: 'hand', sent_on: '2026-09-15' },
    ])
    // No other kind's sends travel.
    expect(out.filings[1]!.sends).toBeNull()
    const flat = JSON.stringify(out)
    for (const secret of ['9407', 'Sam Owner', '1 Main St', 'owner@example.com', 'Pat at Sample', 'tracking', 'blue folder', 'drive.example']) expect(flat, secret).not.toContain(secret)
    expect(LIEN_BOOK_FILING_KINDS).toEqual(['affidavit', 'release_of_record', 'notice_53_056'])
    expect(LIEN_BOOK_SEND_KEYS).toEqual(Object.keys((out.filings[0]!.sends as Array<Record<string, unknown>>)[0]!))

    // On the client the same kernels the app's book runs read it: the month is sent on the day its packet left.
    const cut = JSON.parse(JSON.stringify(out.filings)) as Parameters<typeof lienTimelineMonthsWithNoticeRecords>[1]
    expect(lienTimelineMonthsWithNoticeRecords([], cut)).toMatchObject([{ key: '2026-08', outcome: 'sent', at: '2026-09-14' }])
    expect(lienAffidavitOwnerSends(cut as Parameters<typeof lienAffidavitOwnerSends>[0])).toEqual([{ method: 'certified_mail', sentOn: '2026-09-14' }])
  })

  it('the firm’s book says the notice went, on a job whose month the reader has dropped (punch list #415)', () => {
    // A notice kept by hand: no desk paper, and the months reader drops a noticed month a week after its day. The job
    // is still in the book through its affidavit window.
    const job = { id: 'j1', hcp_number: '1042', click_number: null, job_name: 'Tenant finish-out', job_address: '200 Sample Pkwy', gc_customer_id: 'g1', customer_address_id: 'a1', revenue: 18400, payments_made: 4000, last_work_date: '2026-08-29', lien_payment_bond: null, lien_contract_ended_on: null }
    const window = { job_id: 'j1', last_month: '2026-08', deadline: '2026-12-15', is_sub: true, noticed: true, filed: false, open_balance: 14400, customer_id: 'c1', gc_customer_id: 'g1', property_kind: 'non_residential', has_owner: true, has_legal: true, homestead: false }
    const notice = { ...filing, id: 'n1', kind: 'notice_53_056', filed_at: null, recording_number: null, months_covered: ['2026-08'], created_at: '2026-09-16T15:00:00Z', sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9407 1118', sent_on: '2026-09-14' }] }
    const bookOf = (filings: unknown[]) => {
      const out = shapeLienBookForCounsel({ rows: [], affidavitRows: [window], items: [], filings, jobs: [job], gcs: [gc], addresses: [address], owners: [owner] })
      return buildLienTimelineBook(assembleLienBookInput(parseLienBookRaw(JSON.parse(JSON.stringify(out)))!, '2026-11-25'))
    }
    // As the function read it before: affidavits and releases alone, so no month and no day.
    const before = bookOf([]).rows.find((r) => r.jobId === 'j1')!
    expect(before.months).toEqual([])
    expect(before.noticeSentOn).toEqual([])
    const after = bookOf([notice]).rows.find((r) => r.jobId === 'j1')!
    expect(after.months).toMatchObject([{ key: '2026-08', outcome: 'sent', at: '2026-09-14' }])
    expect(after.noticeSentOn).toEqual(['2026-09-14'])
  })

  it('names the same columns in the selects the function runs', () => {
    expect(LIEN_BOOK_COUNSEL_SELECT.deskItems).toBe(Object.keys(shaped.items[0] ?? {}).join(', '))
    expect(LIEN_BOOK_COUNSEL_SELECT.filings).toBe(Object.keys(shaped.filings[0] ?? {}).join(', '))
    expect(LIEN_BOOK_COUNSEL_SELECT.owners).toBe(Object.keys(shaped.owners[0] ?? {}).join(', '))
    expect(LIEN_BOOK_COUNSEL_SELECT.addresses).toBe(Object.keys(shaped.addresses[0] ?? {}).join(', '))
    expect(LIEN_BOOK_COUNSEL_SELECT.gcs).toBe(Object.keys(shaped.gcs[0] ?? {}).join(', '))
  })

  it('still assembles into the grid’s book on the client', () => {
    const job = { id: 'j1', hcp_number: '1042', click_number: null, job_name: 'Tenant finish-out', job_address: '200 Sample Pkwy', gc_customer_id: 'g1', customer_address_id: 'a1', revenue: 18400, payments_made: 4000, last_work_date: '2026-05-29', lien_payment_bond: null, lien_contract_ended_on: null }
    const raw = parseLienBookRaw(JSON.parse(JSON.stringify({ ...shaped, jobs: [job] })))
    expect(raw).not.toBeNull()
    const input = assembleLienBookInput(raw!, '2026-10-05')
    expect(input.jobs.j1).toMatchObject({ label: '1042 · Tenant finish-out', county: 'Hays', ownerName: 'Sam Owner', openBalance: 14400, gcName: 'Sample Contracting', homestead: false })
    expect(input.policyByCustomer.g1).toBe('hold')
    // v2.8315: the facts ride into the book's input; a payload from an older function has no key and hands none.
    expect(input.ownerFactsByJob).toEqual({})
    const withFacts = assembleLienBookInput(parseLienBookRaw(JSON.parse(JSON.stringify({ ...shaped, jobs: [job], ownerFacts: { j1: { paidOut: 'yes', owesAmount: null, reserved: 'never', releasedOn: null, note: 'x' } } })))!, '2026-10-05')
    expect(withFacts.ownerFactsByJob).toEqual({ j1: { paidOut: 'yes', owesAmount: null, reserved: 'never', releasedOn: null } })
    const { ownerFacts: _gone, ...older } = shaped
    expect(assembleLienBookInput(parseLienBookRaw(JSON.parse(JSON.stringify({ ...older, jobs: [job] })))!, '2026-10-05').ownerFactsByJob).toBeUndefined()
    expect(input.filingsByJob.j1).toHaveLength(1)
  })
})

describe('shapeLienBookForCounsel · ZZ test jobs (punch list #61, v2.5124)', () => {
  const job = (id: string, jobName: string, customerName: string, gcId: string, addressId: string) => ({
    id, hcp_number: id, click_number: null, job_name: jobName, customer_name: customerName, job_address: '', gc_customer_id: gcId, customer_address_id: addressId,
    revenue: 1000, payments_made: 0, last_work_date: '2026-08-01', lien_payment_bond: null, lien_contract_ended_on: null,
  })
  const month = (jobId: string) => ({ job_id: jobId, work_month: '2026-08', deadline: '2026-10-15', open_balance: 1000 })
  const forJob = (jobId: string) => ({ ...deskItem, id: `it-${jobId}`, job_id: jobId })
  // j1 is real. j2 is a ZZ job by its own name, j3 by its customer's, j4 by its GC's. j5 is real and shares j2's property.
  const shaped = shapeLienBookForCounsel({
    rows: ['j1', 'j2', 'j3', 'j4', 'j5'].map(month),
    affidavitRows: [month('j1'), month('j3')],
    items: [forJob('j1'), forJob('j2')],
    filings: [{ ...filing, job_id: 'j3' }, filing],
    jobs: [
      job('j1', '101 Hill Street', 'Ann Lee', 'g1', 'a1'),
      job('j2', 'ZZ TEST lien', 'Ann Lee', 'g1', 'a2'),
      job('j3', 'Hill Street remodel', ' zz Test Customer', 'g3', 'a3'),
      job('j4', '9 Oak Road', 'Ann Lee', 'g2', 'a4'),
      job('j5', '12 Oak Road', 'Bo Diaz', 'g1', 'a2'),
    ],
    gcs: [gc, { ...gc, id: 'g2', name: 'ZZ Test GC' }, { ...gc, id: 'g3', name: 'Only Test Contracting' }],
    addresses: ['a1', 'a2', 'a3', 'a4'].map((id) => ({ ...address, id })),
    owners: [owner, { ...owner, job_id: 'j4' }],
  })
  const jobIds = (list: unknown[]) => list.map((r) => (r as { job_id: string }).job_id)

  it('drops a ZZ job, by its own, its customer’s or its GC’s name, from every list', () => {
    expect((shaped.jobs as { id: string }[]).map((j) => j.id)).toEqual(['j1', 'j5'])
    expect(jobIds(shaped.rows)).toEqual(['j1', 'j5'])
    expect(jobIds(shaped.affidavitRows)).toEqual(['j1'])
    expect(jobIds(shaped.items)).toEqual(['j1'])
    expect(jobIds(shaped.filings)).toEqual(['j1'])
    expect(jobIds(shaped.owners)).toEqual(['j1'])
  })

  it('drops the ZZ GC and a GC or property only test jobs point at, and keeps a property a real job shares', () => {
    expect(shaped.gcs.map((g) => g.id)).toEqual(['g1'])
    expect(shaped.addresses.map((a) => a.id)).toEqual(['a1', 'a2'])
  })

  it('sends no customer name and no ZZ name', () => {
    const flat = JSON.stringify(shaped)
    expect(flat).not.toContain('customer_name')
    expect(flat).not.toMatch(/zz/i)
  })
})

describe('shapeLienBookForCounsel · a job paid in kind (the owner’s rule of 2026-11-14)', () => {
  const job = (id: string, gcId: string, addressId: string, deal: string | null) => ({
    id, hcp_number: id, click_number: null, job_name: `${id} Hill Street`, customer_name: 'Ann Lee', job_address: '', gc_customer_id: gcId, customer_address_id: addressId,
    revenue: 1000, payments_made: 0, last_work_date: '2026-08-01', lien_payment_bond: null, lien_contract_ended_on: null, in_kind_arrangement_id: deal,
  })
  const month = (jobId: string) => ({ job_id: jobId, work_month: '2026-08', deadline: '2026-10-15', open_balance: 1000 })
  const forJob = (jobId: string) => ({ ...deskItem, id: `it-${jobId}`, job_id: jobId })
  // j1 is on no deal. j2 is on an open deal and shares j1's GC and property. j3 is on the deal with a GC and a property of its own.
  const book = (deal: string | null) =>
    shapeLienBookForCounsel({
      rows: ['j1', 'j2', 'j3'].map(month),
      affidavitRows: ['j1', 'j2'].map(month),
      items: ['j1', 'j2', 'j3'].map(forJob),
      filings: [filing, { ...filing, id: 'f2', job_id: 'j2' }],
      jobs: [job('j1', 'g1', 'a1', null), job('j2', 'g1', 'a1', deal), job('j3', 'g2', 'a2', deal)],
      gcs: [gc, { ...gc, id: 'g2', name: 'Second Contracting' }],
      addresses: ['a1', 'a2'].map((id) => ({ ...address, id })),
      owners: ['j1', 'j2', 'j3'].map((id) => ({ ...owner, job_id: id })),
    })
  const jobIds = (list: unknown[]) => list.map((r) => (r as { job_id: string }).job_id)
  const ids = (list: unknown[]) => list.map((r) => (r as { id: string }).id)

  it('drops a job on an open deal from every list, as the office’s By job book does', () => {
    const shaped = book('deal-1')
    expect(ids(shaped.jobs)).toEqual(['j1'])
    expect(jobIds(shaped.rows)).toEqual(['j1'])
    expect(jobIds(shaped.affidavitRows)).toEqual(['j1'])
    expect(jobIds(shaped.items)).toEqual(['j1'])
    expect(jobIds(shaped.filings)).toEqual(['j1'])
    expect(jobIds(shaped.owners)).toEqual(['j1'])
  })

  it('drops a GC and a property only such jobs point at, and keeps the ones a job on the book shares', () => {
    const shaped = book('deal-1')
    expect(ids(shaped.gcs)).toEqual(['g1'])
    expect(ids(shaped.addresses)).toEqual(['a1'])
  })

  it('brings the job back when the deal ends and its link is cleared', () => {
    const shaped = book(null)
    expect(ids(shaped.jobs)).toEqual(['j1', 'j2', 'j3'])
    expect(jobIds(shaped.rows)).toEqual(['j1', 'j2', 'j3'])
    expect(jobIds(shaped.affidavitRows)).toEqual(['j1', 'j2'])
    expect(jobIds(shaped.items)).toEqual(['j1', 'j2', 'j3'])
    expect(jobIds(shaped.filings)).toEqual(['j1', 'j2'])
    expect(ids(shaped.gcs)).toEqual(['g1', 'g2'])
    expect(ids(shaped.addresses)).toEqual(['a1', 'a2'])
  })

  it('sends the firm no link to a deal, with the link set or cleared', () => {
    for (const deal of ['deal-1', null]) {
      const flat = JSON.stringify(book(deal))
      expect(flat).not.toContain('in_kind_arrangement_id')
      expect(flat).not.toContain('deal-1')
      expect(flat).not.toContain('customer_name')
    }
  })

  it('reads the jobs with the app’s own columns, the deal’s link among them', () => {
    expect(LIEN_BOOK_COUNSEL_SELECT.jobs).toBe(LIEN_BOOK_JOB_COLUMNS)
    expect(LIEN_BOOK_COUNSEL_SELECT.jobs.split(', ')).toEqual([...LIEN_BOOK_JOB_COLUMNS_SENT, 'customer_name', 'in_kind_arrangement_id', 'lien_path_answer'])
    expect(Object.keys((book(null).jobs as Record<string, unknown>[])[0] ?? {})).toEqual([...LIEN_BOOK_JOB_COLUMNS_SENT])
  })

  it('is the select the function runs: no column list of its own, so the link cannot be forgotten', () => {
    const source = readFileSync(resolve(__dirname, '../../../supabase/functions/legal-portal/index.ts'), 'utf8')
    expect(source).toContain(".from('jobs_ledger').select(LIEN_BOOK_COUNSEL_SELECT.jobs).in('id', jobIds)")
  })

  it('drops a job a person took off the lien path the same way, sends no answer, and brings it back once it is put back (v2.7521)', () => {
    const offPath = (answer: string | null) =>
      shapeLienBookForCounsel({
        rows: ['j1', 'j2'].map(month),
        affidavitRows: ['j1', 'j2'].map(month),
        items: ['j1', 'j2'].map(forJob),
        filings: [filing, { ...filing, id: 'f2', job_id: 'j2' }],
        jobs: [{ ...job('j1', 'g1', 'a1', null), lien_path_answer: null }, { ...job('j2', 'g2', 'a2', null), lien_path_answer: answer }],
        gcs: [gc, { ...gc, id: 'g2', name: 'Second Contracting' }],
        addresses: ['a1', 'a2'].map((id) => ({ ...address, id })),
        owners: ['j1', 'j2'].map((id) => ({ ...owner, job_id: id })),
      })
    const off = offPath('off_path')
    expect(ids(off.jobs)).toEqual(['j1'])
    expect(jobIds(off.rows)).toEqual(['j1'])
    expect(jobIds(off.affidavitRows)).toEqual(['j1'])
    expect(jobIds(off.items)).toEqual(['j1'])
    expect(jobIds(off.filings)).toEqual(['j1'])
    expect(jobIds(off.owners)).toEqual(['j1'])
    expect(ids(off.gcs)).toEqual(['g1'])
    expect(ids(off.addresses)).toEqual(['a1'])
    expect(JSON.stringify(off)).not.toContain('lien_path_answer')
    const back = offPath(null)
    expect(ids(back.jobs)).toEqual(['j1', 'j2'])
    expect(JSON.stringify(back)).not.toContain('lien_path_answer')
  })
})
