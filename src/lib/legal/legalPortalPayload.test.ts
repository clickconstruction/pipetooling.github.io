import { describe, expect, it } from 'vitest'
import { makeInvoice, makeJob } from '../../test/renderSmokeMocks'
import { buildMatterPacket, parseLegalPortalPayload, portalFeeModel } from './legalPortalPayload'

const firm = { id: 'f1', name: 'Example Law Firm, PLLC', handling_name: 'A. Attorney', email: 'a@x.test', phone: '', contingency_pct: 30, filing_cost: 400, active: true }

function matterRaw() {
  const job = makeJob({ id: 'job-a', hcp_number: '717', status: 'billed', collections_at: '2026-08-20T15:00:00Z', collections_note: 'Theft of service.', customer_id: 'tle', customer_name: 'The Learning Experience', customer_email: 'aaron@tle.test', invoices: [makeInvoice({ id: 'inv-a', job_id: 'job-a', amount: 7502, status: 'billed', billed_at: '2026-04-17T12:00:00Z', stripe_invoice_status: 'open' })] })
  return {
    id: 'm1',
    stage: 'referred',
    payer: { key: 'c:tle', name: 'The Learning Experience', customerId: 'tle' },
    handling: 'A. Attorney',
    noteToFirm: 'Pursue the GC first.',
    releasedAt: '2026-09-11',
    sharedOverrides: { 'contact:c0': false },
    jobs: [job],
    customer: { id: 'tle', name: 'The Learning Experience', address: '15054 State Hwy 71', contact_info: {}, customer_type: 'commercial', payment_terms: 'standard', payment_terms_note: null },
    contacts: [],
    contactEntries: [{ id: 'c0', ymd: '2026-03-28', method: 'Site visit', by: 'Malachi', text: 'Walked the scope.' }, { id: 'c2', ymd: '2026-05-05', method: 'Phone', by: 'Taunya', text: 'Retainage.' }],
    addresses: [],
    contracts: [],
    signedEstimates: [],
    demandLetters: [],
    lienFilings: [],
    promises: [{ id: 'pr1', jobId: 'job-a', customerId: 'tle', promisedYmd: '2026-05-30', saidBy: 'Aaron', heardByName: 'Malachi', channel: 'phone', source: 'office', note: null, createdAt: '2026-05-20T10:00:00Z' }],
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
    expect(p?.particulars.entity).toBe('Click, LLC')
    expect(portalFeeModel(p!)).toEqual({ contingencyPct: 0.3, filingCost: 400 })
  })
})

describe('buildMatterPacket', () => {
  it('runs one matter through the same kernel the desk uses, honoring the shared pre-bill entry and the firm’s fee model', () => {
    const p = parseLegalPortalPayload({ company: { name: 'Click' }, preparedOn: '2026-09-11', firm, particulars: {}, matters: [matterRaw()] })!
    const packet = buildMatterPacket(p.matters[0]!, '2026-09-11', portalFeeModel(p))!
    expect(packet.account.payer.name).toBe('The Learning Experience')
    expect(packet.theory.key).toBe('sworn')
    expect(packet.worth.contingencyPct).toBe(0.3)
    expect(packet.worth.filingCost).toBe(400)
    const c0 = packet.theirWord.timeline.find((e) => e.key === 'contact:c0')
    expect(c0).toEqual(expect.objectContaining({ sharedByDefault: false, shared: true }))
    expect(packet.theirWord.timeline.find((e) => e.key === 'promise:pr1')?.text).toContain('broken')
  })
})

describe('the notice desk items (#41 PR 1b)', () => {
  it('parse through to the packet: the owner\'s call and letter two\'s clock land under the envelope they answer', () => {
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
