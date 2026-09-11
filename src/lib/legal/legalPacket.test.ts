import { describe, expect, it } from 'vitest'
import { makeInvoice, makeJob } from '../../test/renderSmokeMocks'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { CustomerAddressRow } from '../jobs/lienProperty'
import type { JobDemandLetterRow } from '../jobs/demandLetterTracking'
import type { JobContractRowLike } from '../jobs/jobContractCoverage'
import {
  buildLegalPacket,
  daysBetweenYmd,
  groupCollectionsByPayer,
  invoiceReachedCustomer,
  jobOpenBalance,
  payerForJob,
  quickNet,
  sortAccountsByNet,
  type LegalAccountSummary,
  type LegalPacketInput,
} from './legalPacket'

const TODAY = '2026-09-11'

function billedInvoice(id: string, amount: number, billedAt: string, over: Record<string, unknown> = {}) {
  return makeInvoice({ id, amount, status: 'billed', billed_at: `${billedAt}T12:00:00Z`, external_send_channel: 'stripe', stripe_invoice_status: 'open', sequence_order: 1, ...over })
}

function collectionsJob(p: Partial<Record<string, unknown>>): JobWithDetails {
  return makeJob({ status: 'billed', collections_at: '2026-08-20T15:00:00Z', ...p })
}

function baseInput(account: LegalAccountSummary, over: Partial<LegalPacketInput> = {}): LegalPacketInput {
  return {
    todayYmd: TODAY,
    account,
    customer: null,
    contacts: [],
    contactEntries: [],
    addresses: [],
    contracts: [],
    signedEstimates: [],
    demandLetters: [],
    lienFilings: [],
    promises: [],
    promiseOutcomes: [],
    chaseTouches: [],
    reports: [],
    clockSessions: [],
    threadNotes: [],
    users: [],
    ...over,
  }
}

const gpsSession = (jobId: string, day: string) => ({ jobId, workDate: day, clockedInAt: `${day}T13:00:00Z`, clockedOutAt: `${day}T17:00:00Z`, hasGps: true, approved: true, disqualified: false })

describe('payerForJob', () => {
  it('prefers the GC as the payer when the job has one', () => {
    const job = makeJob({ customer_id: 'cust-1', customer_name: 'Owner', gc_customer_id: 'gc-1', gcCustomer: { id: 'gc-1', name: 'Big GC' } })
    expect(payerForJob(job)).toEqual({ key: 'c:gc-1', customerId: 'gc-1', name: 'Big GC', viaGc: true })
  })
  it('falls back to a name key when the job has no customer record', () => {
    expect(payerForJob(makeJob({ customer_id: null, customer_name: 'Bryan Herber' }))).toEqual({ key: 'n:bryan herber', customerId: null, name: 'Bryan Herber', viaGc: false })
  })
})

describe('jobOpenBalance / invoiceReachedCustomer', () => {
  it('sums open billed lines net of the payments applied to them', () => {
    const job = collectionsJob({ revenue: 9000, payments_made: 500, invoices: [billedInvoice('inv-a', 7502, '2026-04-17'), billedInvoice('inv-b', 1480, '2026-04-17')], payments: [{ id: 'p1', invoice_id: 'inv-b', amount: 500, paid_on: '2026-05-01' }] })
    expect(jobOpenBalance(job)).toBe(8482)
  })
  it('uses the job-level remainder when the billed job has no bill line', () => {
    expect(jobOpenBalance(collectionsJob({ revenue: 1239, payments_made: 0, invoices: [] }))).toBe(1239)
  })
  it('a draft Stripe invoice never sent did not reach the customer', () => {
    expect(invoiceReachedCustomer({ sent_to_customer_at: null, stripe_invoice_status: 'draft', external_send_channel: null })).toBe(false)
    expect(invoiceReachedCustomer({ sent_to_customer_at: null, stripe_invoice_status: 'open', external_send_channel: null })).toBe(true)
    expect(invoiceReachedCustomer({ sent_to_customer_at: '2026-05-01T00:00:00Z', stripe_invoice_status: null, external_send_channel: null })).toBe(true)
  })
})

describe('groupCollectionsByPayer + sortAccountsByNet', () => {
  it('folds two jobs for one customer into one account and ages from the first bill or the flag', () => {
    const j1 = collectionsJob({ customer_id: 'tle', customer_name: 'The Learning Experience', invoices: [billedInvoice('i1', 7502, '2026-04-17')] })
    const j2 = collectionsJob({ customer_id: 'tle', customer_name: 'The Learning Experience', invoices: [billedInvoice('i2', 1480, '2026-04-17')] })
    const j3 = collectionsJob({ customer_id: null, customer_name: 'Bryan Herber', revenue: 1239, invoices: [] })
    const accounts = groupCollectionsByPayer([j3, j1, j2], new Map(), TODAY)
    expect(accounts.map((a) => [a.name, a.jobs.length, a.balance])).toEqual([
      ['The Learning Experience', 2, 8982],
      ['Bryan Herber', 1, 1239],
    ])
    expect(accounts[0]?.oldestDays).toBe(daysBetweenYmd('2026-04-17', TODAY))
    expect(accounts[1]?.oldestDays).toBe(daysBetweenYmd('2026-08-20', TODAY))
    expect(accounts[0]?.reviewDays).toBe(daysBetweenYmd('2026-08-20', TODAY))
    const byNet = sortAccountsByNet(accounts, (a) => quickNet(a.balance))
    expect(byNet[0]?.name).toBe('The Learning Experience')
    expect(quickNet(1239)).toBeCloseTo(1239 - 1239 * 0.33 - 350, 2)
  })
})

describe('buildLegalPacket', () => {
  const tleJobA = collectionsJob({
    id: 'job-a', hcp_number: '717', job_name: 'The Learning Experience', customer_id: 'tle', customer_name: 'The Learning Experience', customer_email: 'aaron@tle.test',
    collections_note: 'Customer is engaging in theft of service.', collections_by: 'u-taunya',
    invoices: [billedInvoice('inv-a', 7502, '2026-04-17')],
  })
  const tleJobB = collectionsJob({
    id: 'job-b', hcp_number: '718', job_name: 'The Learning Experience', customer_id: 'tle', customer_name: 'The Learning Experience', collections_note: null,
    invoices: [billedInvoice('inv-b', 1480, '2026-04-17')],
    payments: [{ id: 'p1', invoice_id: 'inv-b', amount: 200, paid_on: '2026-06-02', payment_type: 'check', reference_number: '1044' }],
  })
  const account = groupCollectionsByPayer([tleJobA, tleJobB], new Map(), TODAY)[0] as LegalAccountSummary
  const withEvidence = { clockSessions: [gpsSession('job-a', '2026-04-09'), gpsSession('job-b', '2026-04-10')] }

  it('assembles the account: contacts, ledger in date order, totals, aging, primary invoice', () => {
    const packet = buildLegalPacket(
      baseInput(account, {
        customer: { id: 'tle', name: 'The Learning Experience', address: '15054 State Hwy 71, Bee Cave, TX', contact_info: { phone: '512-555-0100' }, customer_type: 'commercial', payment_terms: 'no_new_work_past_promise', payment_terms_note: null },
        contacts: [{ name: 'Aaron', email: 'aaron@tle.test', phone: null, note: null }],
        users: [{ id: 'u-taunya', name: 'Taunya' }],
      }),
    )
    expect(packet.account.emails).toEqual(['aaron@tle.test'])
    expect(packet.account.phones).toEqual(['512-555-0100'])
    expect(packet.account.paymentTerms).toBe('No new work past a broken promise')
    expect(packet.account.totals).toEqual({ billed: 8982, paid: 200, writtenDown: 0, balance: 8782, oldestDays: daysBetweenYmd('2026-04-17', TODAY) })
    expect(packet.account.ledger.map((e) => [e.kind, e.ymd, e.amount])).toEqual([
      ['invoice', '2026-04-17', 7502],
      ['invoice', '2026-04-17', 1480],
      ['payment', '2026-06-02', -200],
    ])
    expect(packet.account.jobs.find((j) => j.jobId === 'job-a')?.primaryInvoiceId).toBe('inv-a')
    expect(packet.theirWord.firstBillYmd).toBe('2026-04-17')
    expect(packet.theirWord.timeline.find((e) => e.kind === 'note')).toEqual(expect.objectContaining({ key: 'note:job-a', by: 'Taunya', shared: true }))
  })

  it('theory: no contract and no evidence is a red stop with "none yet"; GPS evidence makes it a sworn account (amber)', () => {
    const bare = buildLegalPacket(baseInput(account))
    expect(bare.theory.key).toBe('none')
    expect(bare.gaps.filter((g) => g.key.startsWith('contract:')).map((g) => g.severity)).toEqual(['stop', 'stop'])
    expect(bare.gaps.find((g) => g.key === 'contract:job-a')?.detail).toMatch(/field evidence on the property/)
    expect(bare.readiness.stops).toBe(2)
    const sworn = buildLegalPacket(baseInput(account, withEvidence))
    expect(sworn.theory.key).toBe('sworn')
    expect(sworn.gaps.filter((g) => g.key.startsWith('contract:')).map((g) => g.severity)).toEqual(['warn', 'warn'])
    expect(sworn.readiness.stops).toBe(0)
    // Evidence on one job only: the theory holds on that job; the other stays a red gap.
    const partial = buildLegalPacket(baseInput(account, { clockSessions: [gpsSession('job-b', '2026-04-10')] }))
    expect(partial.theory).toEqual(expect.objectContaining({ key: 'sworn', basis: expect.stringContaining('on 1 of 2 jobs') }))
    expect(partial.gaps.find((g) => g.key === 'contract:job-a')?.severity).toBe('stop')
    expect(partial.gaps.find((g) => g.key === 'contract:job-b')?.severity).toBe('warn')
    expect(partial.worth.verdict).toBe('worth it')
  })

  it('a dispute on record breaks the sworn account; a signed paper contract restores the theory and letters the exhibit', () => {
    const disputed = buildLegalPacket(
      baseInput(account, { ...withEvidence, chaseTouches: [{ id: 't1', customerId: 'tle', jobId: null, outcome: 'dispute', note: 'says GC owes it', promisedYmd: null, snoozeDays: null, resolvedAt: null, createdAt: '2026-06-18T10:00:00Z', createdByName: 'Taunya' }] }),
    )
    expect(disputed.theory.key).toBe('none')
    expect(disputed.worth.flags).toContain('dispute on record')
    const contract: JobContractRowLike = { id: 'c1', job_id: 'job-a', status: 'signed', revision: 1, recipient_email: null, sent_at: null, last_sent_at: null, view_count: 0, signed_at: '2026-04-01T10:00:00Z', signer_printed_name: 'Aaron Smith', signer_mode: 'paper', voided_at: null }
    const signed = buildLegalPacket(baseInput(account, { ...withEvidence, contracts: [contract] }))
    expect(signed.theory.key).toBe('contract')
    expect(signed.gaps.map((g) => g.key)).not.toContain('contract:job-a')
    expect(signed.exhibits.map((e) => [e.letter, e.title])).toEqual([
      ['A', 'Invoices and payments'],
      ['B', 'Signed agreements'],
      ['C', 'What was said — contacts, promises, calls'],
      ['D', 'Field reports and clock sessions'],
    ])
  })

  it('worth: balance after the cut and cost, flags from the notes, and a "no money" note is never worth it', () => {
    const packet = buildLegalPacket(baseInput(account, withEvidence))
    expect(packet.worth.balance).toBe(8782)
    expect(packet.worth.fee).toBeCloseTo(8782 * 0.33, 2)
    expect(packet.worth.net).toBeCloseTo(8782 - 8782 * 0.33 - 350, 2)
    expect(packet.worth.verdict).toBe('worth it')
    const broke = groupCollectionsByPayer([collectionsJob({ id: 'job-h', hcp_number: '981', customer_id: 'herb', customer_name: 'Bryan Herber', customer_phone: '830', revenue: 1239, invoices: [], collections_note: 'He does not have the money to pay.' })], new Map(), TODAY)[0] as LegalAccountSummary
    const hp = buildLegalPacket(baseInput(broke))
    expect(hp.worth.flags).toContain('“no money” note')
    expect(hp.worth.verdict).toBe('not worth it')
    expect(hp.gaps.find((g) => g.key === 'worth')).toEqual(expect.objectContaining({ fix: 'write_down' }))
  })

  it('lien clock: an original contractor has no monthly notice; the affidavit window is the 15th of the 4th month after the last work', () => {
    const packet = buildLegalPacket(baseInput(account, { clockSessions: [gpsSession('job-a', '2026-06-12'), gpsSession('job-b', '2026-04-10')] }))
    const a = packet.paper.lienClock.find((c) => c.jobId === 'job-a')
    expect(a).toEqual(expect.objectContaining({ lastWorkYmd: '2026-06-12', noticeDeadline: '', filingDeadline: '2026-10-15', status: 'affidavit_open' }))
    expect(a?.filingLeft).toBe(daysBetweenYmd(TODAY, '2026-10-15'))
    expect(packet.paper.lienClock.find((c) => c.jobId === 'job-b')?.status).toBe('closed')
    expect(packet.gaps.find((g) => g.key === 'lienfile:job-a')?.label).toMatch(/affidavit possible until 2026-10-15/)
    // Subcontractor (GC pays): the monthly notice clock runs.
    const subJob = collectionsJob({ id: 'job-s', hcp_number: '905', customer_id: 'own', customer_name: 'Owner', gc_customer_id: 'gc', gcCustomer: { id: 'gc', name: 'Hilltop' }, invoices: [billedInvoice('inv-s', 6200, '2026-05-30')] })
    const subAcc = groupCollectionsByPayer([subJob], new Map(), TODAY)[0] as LegalAccountSummary
    const sub = buildLegalPacket(baseInput(subAcc, { clockSessions: [gpsSession('job-s', '2026-07-29')] }))
    expect(sub.paper.lienClock[0]).toEqual(expect.objectContaining({ noticeDeadline: '2026-10-15', status: 'notice_open' }))
    expect(sub.gaps.find((g) => g.key === 'lien:job-s')?.label).toMatch(/§ 53.056 notice due 2026-10-15/)
  })

  it('their word: one timeline, entries before the first bill held by default, overrides win both ways', () => {
    const packet = buildLegalPacket(
      baseInput(account, {
        contactEntries: [
          { id: 'c1', ymd: '2026-03-28', method: 'Site visit', by: 'Malachi', text: 'Walked the scope.' },
          { id: 'c2', ymd: '2026-05-05', method: 'Phone', by: 'Taunya', text: 'GC holding retainage.' },
        ],
        promises: [{ id: 'pr1', jobId: 'job-a', customerId: 'tle', promisedYmd: '2026-05-30', saidBy: 'Aaron', heardByName: 'Malachi', channel: 'phone', source: 'office', note: null, createdAt: '2026-05-20T10:00:00Z' }],
        promiseOutcomes: [{ id: 'pr1', jobId: 'job-a', customerId: 'tle', promisedYmd: '2026-05-30', createdAt: '2026-05-20T10:00:00Z', source: 'office', state: 'broken', deadlineYmd: '2026-06-03', paidOffYmd: null, daysLate: null, rePromised: false, promiseIndexOnJob: 0 }],
        chaseTouches: [{ id: 't1', customerId: 'tle', jobId: null, outcome: 'cant_reach', note: 'voicemail', promisedYmd: null, snoozeDays: null, resolvedAt: null, createdAt: '2026-05-10T10:00:00Z', createdByName: 'Taunya' }],
        holdOverrides: { 'contact:c2': true, 'contact:c1': false },
      }),
    )
    expect(packet.theirWord.timeline.map((e) => [e.key, e.sharedByDefault, e.shared])).toEqual([
      ['contact:c1', false, true],
      ['contact:c2', true, false],
      ['call:t1', true, true],
      ['promise:pr1', true, true],
      ['note:job-a', true, true],
    ])
    expect(packet.theirWord.heldCount).toBe(1)
    expect(packet.theirWord).toEqual(expect.objectContaining({ kept: 0, decided: 1, broken: 1 }))
    expect(packet.worth.flags).toContain('1 broken promise')
    expect(packet.feesAndSteps.steps.some((s) => s.text.includes('GC holding retainage'))).toBe(false)
    expect(packet.gaps.map((g) => g.key)).not.toContain('never_asked')
  })

  it('a sent demand with a passed deadline shows on Paper; an open deadline warns; voided letters never count', () => {
    const sent: JobDemandLetterRow = { id: 'd1', job_id: 'job-a', amount: 7502, created_at: '2026-08-12T00:00:00Z', created_by: null, deadline_date: '2026-08-26', fields: {}, invoice_ids: ['inv-a'], recipient_address: '', recipient_email: 'aaron@tle.test', recipient_name: 'The Learning Experience', sent_at: '2026-08-12T16:00:00Z', sent_method: 'certified_mail', tracking_number: '9407 1118 9922', voided_at: null }
    const packet = buildLegalPacket(baseInput(account, { demandLetters: [sent] }))
    expect(packet.paper.demandLetters).toEqual([expect.objectContaining({ jobLabel: '717', method: 'Certified mail', deadlinePassed: true, sentYmd: '2026-08-12' })])
    expect(packet.gaps.map((g) => g.key)).not.toContain('demand')
    expect(buildLegalPacket(baseInput(account, { demandLetters: [{ ...sent, deadline_date: '2026-09-30' }] })).gaps.map((g) => g.key)).toContain('demand_open')
    expect(buildLegalPacket(baseInput(account, { demandLetters: [{ ...sent, voided_at: '2026-08-13T00:00:00Z' }] })).paper.demandLetters).toHaveLength(0)
  })

  it('property records: incomplete warns with what is missing; complete is silent and lien-ready', () => {
    const addr = (over: Partial<CustomerAddressRow>): CustomerAddressRow =>
      ({ id: 'a1', customer_id: 'tle', address: '15054 State Hwy 71, Bee Cave, TX', county: 'Travis', county_source: 'manual', legal_description: 'Lot 4, Block B', owner_mode: 'company', owner_name: '', owner_company: 'TLE Holdings', owner_mailing_address: 'PO Box 1', parcel_id: 'R123', parcel_source: 'cad', parcel_tax_year: '2026', parcel_looked_up_at: null, homestead: false, property_kind: 'non_residential', is_primary: true, note: null, sequence_order: 0, created_at: null, updated_at: null, ...over }) as CustomerAddressRow
    const complete = buildLegalPacket(baseInput(account, { addresses: [addr({})] }))
    expect(complete.account.properties[0]).toEqual(expect.objectContaining({ lienReady: true, gaps: [] }))
    expect(complete.gaps.some((g) => g.key.startsWith('property'))).toBe(false)
    const partial = buildLegalPacket(baseInput(account, { addresses: [addr({ county: '', legal_description: '' })] }))
    expect(partial.gaps.find((g) => g.key.startsWith('property:'))?.detail).toMatch(/Missing/)
  })
})
