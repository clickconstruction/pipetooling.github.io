/**
 * Punch list #85, item 23: a referred matter reaches the firm with only the columns its page reads.
 * Whole rows go in with every secret the old payload carried; none come out; and the shaped matter
 * still builds the same packet the page draws.
 */
import { describe, expect, it } from 'vitest'
import {
  MATTER_ADDRESS_COLUMNS,
  MATTER_CONTRACT_COLUMNS,
  MATTER_COUNSEL_SELECT,
  MATTER_DEMAND_COLUMNS,
  MATTER_ENTRY_COLUMNS,
  MATTER_FILING_COLUMNS,
  MATTER_CUSTOMER_COLUMNS,
  MATTER_ENTRY_PENDING_COLUMNS,
  MATTER_INVOICE_COLUMNS,
  MATTER_JOB_COLUMNS,
  shapeMatterForCounsel,
} from './legalMatterShape'
import { sampleLegalPortalResponse } from '../../../supabase/functions/_shared/customerSampleFixtures'
import { buildMatterPacket, parseLegalPortalPayload, portalFeeModel } from './legalPortalPayload'

const company = { name: 'Click Plumbing and Electrical', cityLine: 'Kyle, TX', licenseLine: '', phone: '(512) 555-0100', email: 'office@example.com' }
const TODAY = '2026-10-05'

type Row = Record<string, unknown>

/** The sample matter with the columns the old `select('*')` and wide selects also sent, secrets included. */
function wholeRowMatter(): Row {
  const payload = sampleLegalPortalResponse(company, TODAY) as { matters: Row[] }
  const m = structuredClone(payload.matters[0]!) as Row & { jobs: Row[] }
  const jobId = (m.jobs[0] as Row).id as string
  m.jobs = m.jobs.map((j) => ({
    ...j,
    status: 'billed',
    job_pictures_link: 'https://photos.example.com/secret-album',
    google_drive_link: 'https://drive.google.com/drive/folders/SECRET',
    invoices: ((j.invoices as Row[]) ?? []).map((i) => ({ ...i, stripe_invoice_id: 'in_SECRET', sequence_order: 0 })),
  }))
  m.customer = { ...(m.customer as Row), payment_terms_note: 'Slow payer, credit on hold — SECRET', contact_info: { ...((m.customer as Row).contact_info as Row), notes: 'owner is in a divorce SECRET', portal_token: 'SECRET' } }
  m.addresses = [{ id: 'addr-1', customer_id: 'gc', address: '200 Sample Pkwy', county: 'Hays', legal_description: 'Lot 4', property_kind: 'commercial', homestead: false, owner_mode: 'building_owner', owner_name: 'Jordan Sample', owner_company: 'Sample Holdings LLC', owner_mailing_address: 'PO Box 1', parcel_id: 'R1', is_primary: true, sequence_order: 0, note: 'gate code 4321 SECRET', county_source: 'cad', owner_confirmed_by: 'u-1', parcel_source: 'SECRET-source' }]
  m.contracts = ((m.contracts as Row[]) ?? []).map((c) => ({ ...c, signed_pdf_path: 'contracts/SECRET.pdf', paper_upload_path: 'paper/SECRET.pdf', signed_document_url: 'https://docs.google.com/SECRET' }))
  m.signedEstimates = [{ id: 'e-1', job_ledger_id: jobId, bid_id: null, doc_kind: 'estimate', status: 'customer_accepted', acceptor_consented_at: null, acceptor_printed_name: null, estimate_number: 'E-1', total_cents: 999_999 }]
  // A demand letter and a § 53.056 notice as the tables hold them (the sample may carry neither).
  const demands = ((m.demandLetters as Row[]) ?? []).length ? (m.demandLetters as Row[]) : [{ id: 'd-1', job_id: jobId, amount: 14_400, sent_at: '2026-09-07T15:00:00Z', sent_method: 'certified_mail', tracking_number: '9407 SAMPLE 0028', deadline_date: '2026-09-17', recipient_name: 'Sample Contracting', fields: { feeClockYmd: '2026-09-07' }, voided_at: null, created_at: '2026-09-06T15:00:00Z' }]
  const filings = ((m.lienFilings as Row[]) ?? []).length ? (m.lienFilings as Row[]) : [{ id: 'f-1', job_id: jobId, kind: 'notice_53_056', amount: 14_400, months_covered: ['2026-07'], filed_at: null, served_at: null, serve_due: null, county: 'Hays', recording_number: '', sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9407 SAMPLE 0040', sent_on: '2026-08-26' }], document_url: '', packet_id: null, printed_claim: null, by_hand: false, voided_at: null, created_at: '2026-08-26T14:00:00Z' }]
  m.demandLetters = demands.map((d) => ({ ...d, recipient_address: '410 Sample Commerce Dr SECRET', recipient_email: 'pat@SECRET.example.com', debtor_party: 'gc', invoice_ids: ['inv-SECRET'], created_by: 'u-SECRET', exhibits: [{ path: 'exhibits/SECRET.pdf' }], fields: { ...((d.fields as Row) ?? {}), body: 'Draft letter text SECRET', recipientAddress: 'SECRET', enclosures: [{ label: 'A', kind: 'invoice', title: 'Invoice 1042-1', pages: 1, blobPath: 'SECRET' }] } }))
  m.lienFilings = filings.map((f) => ({ ...f, document_note: 'office note on the copy SECRET', fields: { draft: 'SECRET' }, invoice_ids: ['inv-SECRET'], created_by: 'u-SECRET', sends: ((f.sends as Row[]) ?? []).map((s) => ({ ...s, address: '1 Owner Way SECRET', email: 'owner@SECRET.example.com' })) }))
  m.threadNotes = [{ jobId, body: 'Internal: the GC owner is going under SECRET', createdAt: '2026-08-01T12:00:00Z', authorName: 'Taunya SECRET' }]
  m.entries = ((m.entries as Row[]) ?? []).map((e) => ({ ...e, created_by: 'u-SECRET', internal_flag: 'SECRET' }))
  return m
}

describe('shapeMatterForCounsel', () => {
  it('lets none of the old payload’s secrets out', () => {
    const shaped = JSON.stringify(shapeMatterForCounsel(wholeRowMatter()))
    expect(shaped).not.toMatch(/SECRET/)
    // recipient_email is a contract column the coverage kernel reads (who the agreement went to); the demand letter's is not kept.
    expect(Object.keys((JSON.parse(shaped) as { demandLetters: Row[] }).demandLetters[0]!)).not.toContain('recipient_email')
    for (const k of ['job_pictures_link', 'google_drive_link', 'stripe_invoice_id', 'payment_terms_note', 'signed_pdf_path', 'paper_upload_path', 'signed_document_url', 'total_cents', 'recipient_address', 'debtor_party', 'document_note', 'invoice_ids', 'created_by', 'county_source']) expect(shaped).not.toContain(`"${k}"`)
  })

  it('keeps exactly the listed columns on each row', () => {
    const shaped = shapeMatterForCounsel(wholeRowMatter()) as Row & { jobs: Row[]; addresses: Row[]; contracts: Row[]; demandLetters: Row[]; lienFilings: Row[]; entries: Row[] }
    expect(Object.keys(shaped.jobs[0]!).sort()).toEqual([...MATTER_JOB_COLUMNS, 'invoices', 'payments', 'gcCustomer', 'collections_by_name'].sort())
    expect(Object.keys(shaped.addresses[0]!).sort()).toEqual([...MATTER_ADDRESS_COLUMNS].sort())
    expect(Object.keys(shaped.contracts[0]!).sort()).toEqual([...MATTER_CONTRACT_COLUMNS].sort())
    expect(Object.keys(shaped.demandLetters[0]!).sort()).toEqual([...MATTER_DEMAND_COLUMNS].sort())
    expect(shaped.demandLetters[0]!.fields).toEqual({ feeClockYmd: expect.any(String), enclosures: [{ label: 'A', kind: 'invoice', title: 'Invoice 1042-1', pages: 1 }] })
    expect(Object.keys(shaped.lienFilings[0]!).sort()).toEqual([...MATTER_FILING_COLUMNS].sort())
    expect(Object.keys((shaped.lienFilings[0]!.sends as Row[])[0]!).sort()).toEqual(['method', 'recipient', 'sent_on', 'tracking'])
    expect(Object.keys(shaped.entries[0]!).sort()).toEqual([...MATTER_ENTRY_COLUMNS].sort())
    expect(shaped.threadNotes).toEqual([{ jobId: expect.any(String), createdAt: '2026-08-01T12:00:00Z', body: '', authorName: null }])
    expect((shaped.customer as Row).contact_info).toEqual({ email: expect.any(String), billing_email: null, ap_email: null, phone: expect.any(String), mobile: null, office_phone: null })
  })

  it('keeps item 6’s columns: the job’s property record id, and owners without their email', () => {
    expect(MATTER_JOB_COLUMNS).toContain('customer_address_id')
    expect(MATTER_COUNSEL_SELECT.jobOwners).not.toContain('owner_email')
    const shaped = shapeMatterForCounsel({ jobs: [], jobOwners: [{ job_id: 'j', owner_mode: 'homeowner', owner_name: 'Sam', company_name: null, mailing_address: '1 St', owner_email: 'sam@SECRET.example.com' }], jobAddresses: [{ id: 'a', address: '1 St', county: 'Hays', note: 'gate code 1234 SECRET' }] })
    expect(JSON.stringify(shaped)).not.toMatch(/SECRET|owner_email/)
    expect(shaped).not.toHaveProperty('propertyOwners')
    expect((shaped.jobAddresses as Row[])[0]).toMatchObject({ id: 'a', county: 'Hays' })
  })

  it('carries what the other items read: bill order and creation day, no-agreement-needed, the void columns, no credit terms', () => {
    expect(MATTER_INVOICE_COLUMNS).toEqual(expect.arrayContaining(['sequence_order', 'created_at']))
    expect(MATTER_JOB_COLUMNS).toEqual(expect.arrayContaining(['contract_not_needed_at', 'contract_not_needed_reason']))
    expect(MATTER_ENTRY_COLUMNS).toEqual(expect.arrayContaining(['voided_at', 'voided_via_portal', 'void_reason']))
    // Selected only once item 18 PR 2's migration exists.
    for (const c of MATTER_ENTRY_PENDING_COLUMNS) expect(MATTER_COUNSEL_SELECT.entries.split(', ')).not.toContain(c)
    expect(MATTER_CUSTOMER_COLUMNS).not.toEqual(expect.arrayContaining(['payment_terms']))
    expect(MATTER_COUNSEL_SELECT.matters).not.toContain('*')
  })

  it('selects every column it keeps, plus only the storage paths the function signs', () => {
    expect(MATTER_COUNSEL_SELECT.jobs.split(', ')).toEqual([...MATTER_JOB_COLUMNS])
    expect(MATTER_COUNSEL_SELECT.contracts.split(', ').sort()).toEqual([...MATTER_CONTRACT_COLUMNS.filter((c) => c !== 'signedPdfUrl'), 'signed_pdf_path', 'paper_upload_path'].sort())
    for (const sel of Object.values(MATTER_COUNSEL_SELECT)) expect(sel).not.toContain('*')
  })

  it('builds the same packet the page draws from the shaped matter as from whole rows', () => {
    const whole = wholeRowMatter()
    const parsedWhole = parseLegalPortalPayload({ ...sampleLegalPortalResponse(company, TODAY), matters: [whole] })!
    const parsedShaped = parseLegalPortalPayload({ ...sampleLegalPortalResponse(company, TODAY), matters: [shapeMatterForCounsel(whole)] })!
    // Two read-but-undrawn fields are the only differences: the contract's Doc link (coverage's `documentUrl`) and a
    // filing's office note (an envelope's `documentNote`). No portal view or print draws either.
    const noDocLink = (p: unknown) =>
      JSON.parse(JSON.stringify(p, (_k, v: unknown) => {
        if (!v || typeof v !== 'object' || Array.isArray(v)) return v
        const r = v as Row
        if ('contractId' in r) return { ...r, documentUrl: null }
        if ('documentNote' in r) return { ...r, documentNote: '' }
        return v
      })) as ReturnType<typeof buildMatterPacket> & object
    const a = noDocLink(buildMatterPacket(parsedWhole.matters[0]!, TODAY, portalFeeModel(parsedWhole))!)
    const b = noDocLink(buildMatterPacket(parsedShaped.matters[0]!, TODAY, portalFeeModel(parsedShaped))!)
    expect(b.account.totals).toEqual(a.account.totals)
    expect(b.account.ledger).toEqual(a.account.ledger)
    expect(b.account.emails).toEqual(a.account.emails)
    expect(b.account.phones).toEqual(a.account.phones)
    expect(b.account.properties).toEqual(a.account.properties)
    expect(b.account.jobs).toEqual(a.account.jobs)
    expect(b.paper).toEqual(a.paper)
    expect(b.theirWord).toEqual(a.theirWord)
    expect(b.feesAndSteps).toEqual(a.feesAndSteps)
    expect(b.theory).toEqual(a.theory)
    expect(b.exhibits).toEqual(a.exhibits)
    expect(b.evidence.map((e) => [e.jobId, e.reports, e.sessions, e.hours, e.threadNotes])).toEqual(a.evidence.map((e) => [e.jobId, e.reports, e.sessions, e.hours, e.threadNotes]))
  })
})

describe('documents from the office (v2.4810)', () => {
  it('travel cut to their keys: never the storage path or a hold reason', () => {
    const out = shapeMatterForCounsel({ jobs: [], documents: [{ id: 'd', title: 'Billing report', shows: 'x', mime: 'application/pdf', sizeBytes: 1, addedOn: '2026-10-07', addedByName: 'R', url: 'https://x', storage_path: 'm/d.pdf', held_reason: 'no' }] })
    expect(out.documents).toEqual([{ id: 'd', title: 'Billing report', shows: 'x', mime: 'application/pdf', sizeBytes: 1, addedOn: '2026-10-07', addedByName: 'R', url: 'https://x' }])
  })
})
