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
  jobOpenBalance,
  payerForJob,
  type LegalAccountSummary,
  type LegalPacketInput,
} from './legalPacket'

const TODAY = '2026-09-11'

function billedInvoice(id: string, amount: number, billedAt: string) {
  return makeInvoice({ id, amount, status: 'billed', billed_at: `${billedAt}T12:00:00Z`, external_send_channel: 'stripe', sequence_order: 1 })
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

describe('payerForJob', () => {
  it('prefers the GC as the payer when the job has one', () => {
    const job = makeJob({ customer_id: 'cust-1', customer_name: 'Owner', gc_customer_id: 'gc-1', gcCustomer: { id: 'gc-1', name: 'Big GC' } })
    expect(payerForJob(job)).toEqual({ key: 'c:gc-1', customerId: 'gc-1', name: 'Big GC', viaGc: true })
  })
  it('falls back to a name key when the job has no customer record', () => {
    const job = makeJob({ customer_id: null, customer_name: 'Bryan Herber' })
    expect(payerForJob(job)).toEqual({ key: 'n:bryan herber', customerId: null, name: 'Bryan Herber', viaGc: false })
  })
})

describe('jobOpenBalance', () => {
  it('sums open billed lines net of the payments applied to them', () => {
    const job = collectionsJob({
      revenue: 9000,
      payments_made: 500,
      invoices: [billedInvoice('inv-a', 7502, '2026-04-17'), billedInvoice('inv-b', 1480, '2026-04-17')],
      payments: [{ id: 'p1', invoice_id: 'inv-b', amount: 500, paid_on: '2026-05-01' }],
    })
    expect(jobOpenBalance(job)).toBe(8482)
  })
  it('uses the job-level remainder when the billed job has no bill line', () => {
    const job = collectionsJob({ revenue: 1239, payments_made: 0, invoices: [] })
    expect(jobOpenBalance(job)).toBe(1239)
  })
})

describe('groupCollectionsByPayer', () => {
  it('folds two jobs for the same customer into one account and sorts by balance', () => {
    const j1 = collectionsJob({ customer_id: 'tle', customer_name: 'The Learning Experience', invoices: [billedInvoice('i1', 7502, '2026-04-17')] })
    const j2 = collectionsJob({ customer_id: 'tle', customer_name: 'The Learning Experience', invoices: [billedInvoice('i2', 1480, '2026-04-17')] })
    const j3 = collectionsJob({ customer_id: null, customer_name: 'Bryan Herber', revenue: 1239, invoices: [] })
    const accounts = groupCollectionsByPayer([j3, j1, j2], new Map(), TODAY)
    expect(accounts.map((a) => [a.name, a.jobs.length, a.balance])).toEqual([
      ['The Learning Experience', 2, 8982],
      ['Bryan Herber', 1, 1239],
    ])
    expect(accounts[0]?.oldestDays).toBe(daysBetweenYmd('2026-04-17', TODAY))
    // No bill line: ages from the collections flag.
    expect(accounts[1]?.oldestDays).toBe(daysBetweenYmd('2026-08-20', TODAY))
  })
})

describe('buildLegalPacket', () => {
  const tleJobA = collectionsJob({
    id: 'job-a',
    hcp_number: '717',
    job_name: 'The Learning Experience',
    customer_id: 'tle',
    customer_name: 'The Learning Experience',
    customer_email: 'aaron@tle.test',
    collections_note: 'Customer is engaging in theft of service.',
    collections_by: 'u-taunya',
    invoices: [billedInvoice('inv-a', 7502, '2026-04-17')],
  })
  const tleJobB = collectionsJob({
    id: 'job-b',
    hcp_number: '718',
    job_name: 'The Learning Experience',
    customer_id: 'tle',
    customer_name: 'The Learning Experience',
    collections_note: null,
    invoices: [billedInvoice('inv-b', 1480, '2026-04-17')],
    payments: [{ id: 'p1', invoice_id: 'inv-b', amount: 200, paid_on: '2026-06-02', payment_type: 'check', reference_number: '1044' }],
  })
  const account = groupCollectionsByPayer([tleJobA, tleJobB], new Map(), TODAY)[0] as LegalAccountSummary

  it('assembles the account: contacts, ledger in date order, totals and aging', () => {
    const packet = buildLegalPacket(
      baseInput(account, {
        customer: { id: 'tle', name: 'The Learning Experience', address: '15054 State Hwy 71, Bee Cave, TX', contact_info: { phone: '512-555-0100' }, payment_terms: 'no_new_work_past_promise', payment_terms_note: null },
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
    expect(packet.theirWord.collectionsNotes).toEqual([
      { jobLabel: '717', note: 'Customer is engaging in theft of service.', by: 'Taunya', ymd: '2026-08-20' },
    ])
  })

  it('names the gaps an attorney asks for first, stops before warnings', () => {
    const packet = buildLegalPacket(baseInput(account))
    const keys = packet.gaps.map((g) => `${g.severity}:${g.key}`)
    expect(keys).toContain('stop:contract:job-a')
    expect(keys).toContain('stop:contract:job-b')
    expect(keys).toContain('warn:note:job-b')
    expect(keys).toContain('warn:demand')
    expect(keys).toContain('warn:property')
    expect(keys).toContain('warn:never_asked')
    expect(keys).toContain('warn:evidence:job-a')
    // No customer row, but the job carries an email → not a contact stop.
    expect(keys).not.toContain('stop:contact')
    expect(packet.gaps.findIndex((g) => g.severity === 'warn')).toBeGreaterThan(packet.gaps.map((g) => g.severity).lastIndexOf('stop'))
    expect(packet.readiness.stops).toBe(2)
    expect(packet.readiness.label).toBe('2 things an attorney will ask for first')
  })

  it('a signed paper contract clears the contract stop and letters the exhibit', () => {
    const contract: JobContractRowLike = {
      id: 'c1',
      job_id: 'job-a',
      status: 'signed',
      revision: 1,
      recipient_email: null,
      sent_at: null,
      last_sent_at: null,
      view_count: 0,
      signed_at: '2026-04-01T10:00:00Z',
      signer_printed_name: 'Aaron Smith',
      signer_mode: 'paper',
      voided_at: null,
    }
    const packet = buildLegalPacket(baseInput(account, { contracts: [contract] }))
    expect(packet.gaps.map((g) => g.key)).not.toContain('contract:job-a')
    expect(packet.gaps.map((g) => g.key)).toContain('contract:job-b')
    expect(packet.paper.agreements).toHaveLength(1)
    expect(packet.exhibits.map((e) => [e.letter, e.title])).toEqual([
      ['A', 'Invoices and payments'],
      ['B', 'Signed agreements'],
    ])
    expect(packet.feesAndSteps.steps.some((s) => s.kind === 'contract' && s.text.includes('Aaron Smith'))).toBe(true)
  })

  it('a sent demand with a passed deadline shows on Paper and in the steps; an open deadline warns', () => {
    const sent: JobDemandLetterRow = {
      id: 'd1',
      job_id: 'job-a',
      amount: 7502,
      created_at: '2026-08-12T00:00:00Z',
      created_by: null,
      deadline_date: '2026-08-26',
      fields: {},
      invoice_ids: ['inv-a'],
      recipient_address: '',
      recipient_email: 'aaron@tle.test',
      recipient_name: 'The Learning Experience',
      sent_at: '2026-08-12T16:00:00Z',
      sent_method: 'certified_mail',
      tracking_number: '9407 1118 9922',
      voided_at: null,
    }
    const packet = buildLegalPacket(baseInput(account, { demandLetters: [sent] }))
    expect(packet.paper.demandLetters).toEqual([
      expect.objectContaining({ jobLabel: '717', method: 'Certified mail', tracking: '9407 1118 9922', deadlinePassed: true, sentYmd: '2026-08-12' }),
    ])
    expect(packet.gaps.map((g) => g.key)).not.toContain('demand')
    const open = buildLegalPacket(baseInput(account, { demandLetters: [{ ...sent, deadline_date: '2026-09-30' }] }))
    expect(open.gaps.map((g) => g.key)).toContain('demand_open')
    // Voided letters never count.
    const voided = buildLegalPacket(baseInput(account, { demandLetters: [{ ...sent, voided_at: '2026-08-13T00:00:00Z' }] }))
    expect(voided.paper.demandLetters).toHaveLength(0)
  })

  it('property records: an incomplete one warns with what is missing, a complete one is silent', () => {
    const addr = (over: Partial<CustomerAddressRow>): CustomerAddressRow =>
      ({
        id: 'a1',
        customer_id: 'tle',
        address: '15054 State Hwy 71, Bee Cave, TX',
        county: 'Travis',
        county_source: 'manual',
        legal_description: 'Lot 4, Block B, Bee Cave Commercial',
        owner_mode: 'company',
        owner_name: '',
        owner_company: 'TLE Bee Cave Holdings',
        owner_mailing_address: 'PO Box 1, Bee Cave, TX',
        parcel_id: 'R123',
        parcel_source: 'cad',
        parcel_tax_year: '2026',
        parcel_looked_up_at: null,
        homestead: false,
        property_kind: 'non_residential',
        is_primary: true,
        note: null,
        sequence_order: 0,
        created_at: null,
        updated_at: null,
        ...over,
      }) as CustomerAddressRow
    const complete = buildLegalPacket(baseInput(account, { addresses: [addr({})] }))
    expect(complete.account.properties[0]?.gaps).toEqual([])
    expect(complete.gaps.some((g) => g.key.startsWith('property'))).toBe(false)
    const partial = buildLegalPacket(baseInput(account, { addresses: [addr({ county: '', legal_description: '' })] }))
    const gap = partial.gaps.find((g) => g.key.startsWith('property:'))
    expect(gap?.severity).toBe('warn')
    expect(gap?.detail).toMatch(/Missing/)
  })

  it('their word: promise outcomes count kept / broken; touches attach by job or by customer', () => {
    const packet = buildLegalPacket(
      baseInput(account, {
        promises: [
          { id: 'pr1', jobId: 'job-a', customerId: 'tle', promisedYmd: '2026-05-30', saidBy: 'Aaron', heardByName: 'Malachi', channel: 'phone', source: 'office', note: null, createdAt: '2026-05-20T10:00:00Z' },
        ],
        promiseOutcomes: [
          { id: 'pr1', jobId: 'job-a', customerId: 'tle', promisedYmd: '2026-05-30', createdAt: '2026-05-20T10:00:00Z', source: 'office', state: 'broken', deadlineYmd: '2026-06-03', paidOffYmd: null, daysLate: null, rePromised: false, promiseIndexOnJob: 0 },
          { id: 'pr2', jobId: 'job-b', customerId: 'tle', promisedYmd: '2026-06-15', createdAt: '2026-06-01T10:00:00Z', source: 'customer', state: 'kept', deadlineYmd: '2026-06-18', paidOffYmd: '2026-06-02', daysLate: -13, rePromised: false, promiseIndexOnJob: 0 },
        ],
        chaseTouches: [
          { id: 't1', customerId: 'tle', jobId: null, outcome: 'cant_reach', note: 'voicemail', promisedYmd: null, snoozeDays: null, resolvedAt: null, createdAt: '2026-05-10T10:00:00Z', createdByName: 'Taunya' },
          { id: 't2', customerId: 'other', jobId: 'job-z', outcome: 'note', note: 'not ours', promisedYmd: null, snoozeDays: null, resolvedAt: null, createdAt: '2026-05-11T10:00:00Z', createdByName: 'Taunya' },
        ],
      }),
    )
    expect(packet.theirWord.promises).toEqual([expect.objectContaining({ jobLabel: '717', saidBy: 'Aaron', heardBy: 'Malachi', state: 'broken' })])
    expect(packet.theirWord).toEqual(expect.objectContaining({ kept: 1, decided: 2, broken: 1 }))
    expect(packet.theirWord.touches).toEqual([expect.objectContaining({ outcome: 'cant_reach', by: 'Taunya', jobLabel: null })])
    expect(packet.gaps.map((g) => g.key)).not.toContain('never_asked')
    const stepKinds = packet.feesAndSteps.steps.map((s) => s.kind)
    expect(stepKinds.indexOf('call')).toBeLessThan(stepKinds.indexOf('promise'))
  })

  it('evidence: hours, GPS counts and disqualified sessions per job', () => {
    const packet = buildLegalPacket(
      baseInput(account, {
        reports: [{ jobId: 'job-a', createdAt: '2026-04-10T09:00:00Z', authorName: 'Malachi', templateName: 'Rough-in', hasGps: true }],
        clockSessions: [
          { jobId: 'job-a', workDate: '2026-04-09', clockedInAt: '2026-04-09T13:00:00Z', clockedOutAt: '2026-04-09T17:30:00Z', hasGps: true, approved: true, disqualified: false },
          { jobId: 'job-a', workDate: '2026-04-10', clockedInAt: '2026-04-10T13:00:00Z', clockedOutAt: '2026-04-10T15:00:00Z', hasGps: false, approved: false, disqualified: false },
          { jobId: 'job-a', workDate: '2026-04-11', clockedInAt: '2026-04-11T13:00:00Z', clockedOutAt: '2026-04-11T20:00:00Z', hasGps: true, approved: false, disqualified: true },
        ],
      }),
    )
    const a = packet.evidence.find((e) => e.jobId === 'job-a')
    expect(a).toEqual(
      expect.objectContaining({ reports: 1, reportsWithGps: 1, sessions: 2, approvedSessions: 1, sessionsWithGps: 1, hours: 6.5, firstWorkYmd: '2026-04-09', lastWorkYmd: '2026-04-10' }),
    )
    expect(packet.gaps.map((g) => g.key)).not.toContain('evidence:job-a')
    expect(packet.gaps.map((g) => g.key)).toContain('evidence:job-b')
  })
})
