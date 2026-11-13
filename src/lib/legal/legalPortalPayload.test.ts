import { describe, expect, it } from 'vitest'
import { makeInvoice, makeJob } from '../../test/renderSmokeMocks'
import { buildMatterPacket, parseLegalPortalPayload, portalFeeModel } from './legalPortalPayload'

const firm = { id: 'f1', name: 'Example Law Firm, PLLC', handling_name: 'A. Attorney', email: 'a@x.test', phone: '', contingency_pct: 30, filing_cost: 400, active: true }

function matterRaw() {
  const job = makeJob({ id: 'job-a', hcp_number: '717', status: 'billed', collections_at: '2026-08-20T15:00:00Z', collections_note: 'Theft of service.', customer_id: 'tle', customer_name: 'The Reading Corner', customer_email: 'aaron@tle.test', invoices: [makeInvoice({ id: 'inv-a', job_id: 'job-a', amount: 7502, status: 'billed', billed_at: '2026-04-17T12:00:00Z', stripe_invoice_status: 'open' })] })
  return {
    id: 'm1',
    stage: 'referred',
    payer: { key: 'c:tle', name: 'The Reading Corner', customerId: 'tle' },
    handling: 'A. Attorney',
    noteToFirm: 'Pursue the GC first.',
    releasedAt: '2026-09-11',
    sharedOverrides: { 'contact:c0': false },
    jobs: [job],
    customer: { id: 'tle', name: 'The Reading Corner', address: '15054 State Hwy 71', contact_info: {}, customer_type: 'commercial', payment_terms: 'standard', payment_terms_note: null },
    contacts: [],
    contactEntries: [{ id: 'c0', ymd: '2026-03-28', method: 'Site visit', by: 'Malachi', text: 'Walked the scope.' }, { id: 'c2', ymd: '2026-05-05', method: 'Phone', by: 'Taunya', text: 'Retainage.' }],
    addresses: [],
    contracts: [],
    signedEstimates: [],
    demandLetters: [],
    lienFilings: [],
    promises: [{ id: 'pr1', jobId: 'job-a', customerId: 'tle', promisedYmd: '2026-05-30', saidBy: 'Aaron', heardByName: 'Malachi', channel: 'phone', source: 'office', note: null, createdAt: '2026-05-20T10:00:00Z', kind: 'promise', method: null, amount: null }],
    promiseRecords: [{ id: 'pr1', jobId: 'job-a', customerId: 'tle', promisedYmd: '2026-05-30', createdAt: '2026-05-20T10:00:00Z', source: 'office', billedTotal: 7502, payments: [] }],
    chaseTouches: [],
    reports: [],
    clockSessions: [{ jobId: 'job-a', workDate: '2026-04-09', clockedInAt: '2026-04-09T13:00:00Z', clockedOutAt: '2026-04-09T17:00:00Z', hasGps: true, approved: true, disqualified: false }],
    threadNotes: [],
    entries: [{ id: 'e1', matter_id: 'm1', kind: 'fee', amount: 450, body: 'Demand letter', occurred_on: '2026-09-11', meta: {}, via_portal: true, created_by: null, acknowledged_at: null, created_at: '2026-09-11T00:00:00Z' }],
  }
}

describe('parseLegalPortalPayload', () => {
  it('rejects shapes that are not the function’s and keeps only boolean overrides', () => {
    expect(parseLegalPortalPayload(null)).toBeNull()
    expect(parseLegalPortalPayload({ firm: { id: 'f' }, matters: [] })).toBeNull()
    const p = parseLegalPortalPayload({ company: { name: 'Click' }, preparedOn: '2026-09-11', firm, particulars: { entity: 'Click, LLC' }, matters: [{ ...matterRaw(), sharedOverrides: { 'contact:c0': false, junk: 'x' } }] })
    expect(p?.matters).toHaveLength(1)
    expect(p?.matters[0]?.sharedOverrides).toEqual({ 'contact:c0': false })
    // #85 item 29: the count of entries the office held back, as the function counted them; 0 from an older function.
    expect(p?.matters[0]?.heldCount).toBe(0)
    expect(parseLegalPortalPayload({ firm, matters: [{ ...matterRaw(), heldCount: 2 }] })?.matters[0]?.heldCount).toBe(2)
    // #85 item 16: pulled-back matters, slim; [] from an older function.
    expect(p?.pulledMatters).toEqual([])
    expect(parseLegalPortalPayload({ firm, matters: [], pulledMatters: [{ id: 'm9', payerName: 'Ridgeway Dental', pulledAt: '2026-10-04', reason: 'Paid in full', entries: [] }, { payerName: 'no id' }] })?.pulledMatters).toEqual([{ id: 'm9', payerName: 'Ridgeway Dental', pulledAt: '2026-10-04', reason: 'Paid in full', entries: [] }])
    expect(p?.particulars.entity).toBe('Click, LLC')
    expect(portalFeeModel(p!)).toEqual({ contingencyPct: 0.3, filingCost: 400 })
  })
})

describe('buildMatterPacket', () => {
  it('runs one matter through the same kernel the desk uses, sharing the pre-bill entry like every other (#85 item 29) and honoring the firm’s fee model', () => {
    const p = parseLegalPortalPayload({ company: { name: 'Click' }, preparedOn: '2026-09-11', firm, particulars: {}, matters: [matterRaw()] })!
    const packet = buildMatterPacket(p.matters[0]!, '2026-09-11', portalFeeModel(p))!
    expect(packet.account.payer.name).toBe('The Reading Corner')
    expect(packet.theory.key).toBe('sworn')
    expect(packet.worth.contingencyPct).toBe(0.3)
    expect(packet.worth.filingCost).toBe(400)
    const c0 = packet.theirWord.timeline.find((e) => e.key === 'contact:c0')
    expect(c0).toEqual(expect.objectContaining({ sharedByDefault: true, shared: true }))
    expect(packet.theirWord.timeline.find((e) => e.key === 'promise:pr1')?.text).toContain('broken')
  })
})

describe('the notice desk items (#41 PR 1b)', () => {
  it('parse through to the packet: the owner\'s call and the attorney’s letter\'s clock land under the envelope they answer', () => {
    const filing = { id: 'f-1', job_id: 'job-a', kind: 'notice_53_056', amount: 7502, months_covered: ['2026-04'], invoice_ids: [], fields: {}, sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '', sent_on: '2026-09-02' }], county: '', recording_number: '', filed_at: null, served_at: null, serve_due: null, created_by: null, created_at: '2026-09-02T15:00:00Z', voided_at: null, by_hand: false, packet_id: null, printed_claim: null, document_url: '', document_note: '' }
    const item = { id: 'it-1', job_id: 'job-a', kind: 'notice_53_056', status: 'sent', sent_at: '2026-09-02T16:00:00Z', sent_filing_id: 'f-1', created_at: '2026-09-01T10:00:00Z', voided_at: null, fields: { letterTwo: null, gcAuthorizedDirectPay: null, ownerCall: { at: '2026-09-10T15:30:00Z', name: 'Taunya', owesGc: 'no', owesAmount: null, reserved: 'never', originalContractCompletedOn: null, note: '' } } }
    const p = parseLegalPortalPayload({ company: { name: 'Click' }, preparedOn: '2026-09-20', firm, particulars: {}, matters: [{ ...matterRaw(), lienFilings: [filing], lienDeskItems: [item, { junk: true }] }] })
    expect(p?.matters[0]?.lienDeskItems).toHaveLength(1)
    const packet = buildMatterPacket(p!.matters[0]!, '2026-09-20', portalFeeModel(p!))
    const [e] = packet!.paper.envelopes
    expect(e?.answers?.pile).toBe('B')
    expect(e?.answers?.letterTwo[0]?.status.state).toBe('owner_called')
  })
  it('read as no answers from an older function that sends none', () => {
    const p = parseLegalPortalPayload({ company: { name: 'Click' }, preparedOn: '2026-09-20', firm, particulars: {}, matters: [matterRaw()] })
    expect(p?.matters[0]?.lienDeskItems).toEqual([])
  })
})

describe('officeContacts (v2.4755)', () => {
  const base = { company: { name: 'Click', phone: '(512) 360-0599' }, preparedOn: '2026-10-06', firm, particulars: {}, recipients: [], firmPaused: false, matters: [] }
  it('reads who the firm calls, and falls back to the letterhead number from an older function', () => {
    const full = parseLegalPortalPayload({ ...base, officeContacts: { phone: '(512) 360-0599', assistants: ['Robin Ortega', 7, ''], controllers: [{ name: 'Robert Douglas', phone: '+1 617 939 6295' }, { name: ' ' }, { name: 'Lee Park', phone: '' }] } })!
    expect(full.officeContacts).toEqual({ phone: '(512) 360-0599', assistants: ['Robin Ortega'], controllers: [{ name: 'Robert Douglas', phone: '+1 617 939 6295' }, { name: 'Lee Park', phone: null }] })
    expect(parseLegalPortalPayload(base)!.officeContacts).toEqual({ phone: '(512) 360-0599', assistants: [], controllers: [] })
  })
})

describe('the claim’s typed lines (v2.6696, punch list #171)', () => {
  const doc = { id: 'd1', title: 'Materials on site — count.pdf', shows: 'the count', mime: 'application/pdf', sizeBytes: 100, addedOn: '2026-10-26', addedByName: 'Taunya', url: 'https://signed.example/d1' }
  const lines = [
    { id: 'l1', kind: 'materials', title: 'Materials left on site', amount: '5310.00', basis: 'contract ¶ 9', document_id: 'd1', added_at: '2026-10-26T15:00:00Z' },
    { id: 'l2', kind: 'damages', title: 'Demobilization', amount: 2800, basis: '', document_id: 'd-held', added_at: '2026-10-27T15:00:00Z', settlement_only: true },
    { junk: true },
  ]
  it('parse as the desk’s rows, a row without an id and a name dropped; [] from an older function', () => {
    const p = parseLegalPortalPayload({ company: { name: 'Click' }, preparedOn: '2026-11-08', firm, particulars: {}, matters: [{ ...matterRaw(), claimLines: lines }] })!
    expect(p.matters[0]!.claimLines).toEqual([
      { id: 'l1', kind: 'materials', title: 'Materials left on site', amount: '5310.00', basis: 'contract ¶ 9', document_id: 'd1', added_at: '2026-10-26T15:00:00Z', settlement_only: false },
      { id: 'l2', kind: 'damages', title: 'Demobilization', amount: 2800, basis: '', document_id: 'd-held', added_at: '2026-10-27T15:00:00Z', settlement_only: true },
    ])
    expect(parseLegalPortalPayload({ firm, matters: [matterRaw()] })!.matters[0]!.claimLines).toEqual([])
  })
  it('ride the worth through the same kernel, the document’s title read off the documents that travelled and a held one not named', () => {
    const p = parseLegalPortalPayload({ company: { name: 'Click' }, preparedOn: '2026-11-08', firm, particulars: {}, matters: [{ ...matterRaw(), claimLines: lines, documents: [doc] }] })!
    const bare = buildMatterPacket(parseLegalPortalPayload({ firm, matters: [matterRaw()] })!.matters[0]!, '2026-11-08', portalFeeModel(p))!
    const packet = buildMatterPacket(p.matters[0]!, '2026-11-08', portalFeeModel(p))!
    expect(packet.worth.claimLines).toEqual([
      { id: 'l1', kind: 'materials', title: 'Materials left on site', amount: 5310, basis: 'contract ¶ 9', documentId: 'd1', documentTitle: 'Materials on site — count.pdf', settlementOnly: false },
      { id: 'l2', kind: 'damages', title: 'Demobilization', amount: 2800, basis: '', documentId: null, documentTitle: '', settlementOnly: true },
    ])
    // v2.6697: the settlement-only line is out of the claim as demanded and inside the claim as settled.
    expect(packet.worth.claimTyped).toBe(5310)
    expect(packet.worth.claimSettlementOnly).toBe(2800)
    expect(packet.worth.claim).toBeCloseTo(bare.worth.claim + 5310, 2)
    expect(packet.worth.claimSettlement).toBeCloseTo(bare.worth.claim + 8110, 2)
  })
})

describe('the proceedings beside the claim (v2.6726, punch list #174)', () => {
  it('parse as the firm reads them, a row without an id and a name dropped; [] from an older function', () => {
    const rows = [
      { id: 'pr1', kind: 'agency_complaint', title: 'Complaint to the State Plumbing Board', agency: 'State Plumbing Board', reference: 'C-2026-0431', contact_name: 'R. Calloway', contact_role: 'president', status: 'answered', status_on: '2026-11-03', document_ids: ['d1'], keep_out: true, added_at: '2026-10-28T15:00:00Z' },
      { junk: true },
    ]
    const p = parseLegalPortalPayload({ company: { name: 'Click' }, preparedOn: '2026-11-08', firm, particulars: {}, matters: [{ ...matterRaw(), proceedings: rows }] })!
    expect(p.matters[0]!.proceedings).toEqual([{ id: 'pr1', kind: 'agency_complaint', title: 'Complaint to the State Plumbing Board', agency: 'State Plumbing Board', reference: 'C-2026-0431', contactName: 'R. Calloway', contactRole: 'president', status: 'answered', statusOn: '2026-11-03', documentIds: ['d1'], keepOut: true }])
    expect(parseLegalPortalPayload({ firm, matters: [matterRaw()] })!.matters[0]!.proceedings).toEqual([])
  })
})
