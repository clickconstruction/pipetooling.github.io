import { describe, expect, it } from 'vitest'
import { BILLS_TEST_NOTE, isBillsTestRow } from './billTestRows'
import { billsSentCsv, billsSentDays, billsSentFilter, billsSentGaps, billsSentLines, billsSentRecord, billsSentTiles, type BillsSentCopy, type BillsSentInput } from './billsSent'
import { billsPaidLines, billsPaidSum, type BillsPaidInput, type BillsPaidPayment } from './billsPaidDays'
import type { BillPaidState } from './billsPaid'

// Made-up data throughout: no live bill, job, customer or address.
const REAL = 'aaaaaaaa-1111-4111-8111-111111111111'
const TEST_MODE = 'bbbbbbbb-2222-4222-8222-222222222222'
const ZZ = 'cccccccc-3333-4333-8333-333333333333'
const JOB = 'aaaaaaaa-9999-4999-8999-999999999991'
const JOB_T = 'bbbbbbbb-9999-4999-8999-999999999992'
const JOB_ZZ = 'cccccccc-9999-4999-8999-999999999993'

describe('isBillsTestRow, the one rule both views read', () => {
  it('calls a bill made in Stripe’s test mode a test, whatever its job', () => {
    expect(isBillsTestRow({ stripeMode: 'test' }, { job_name: 'Larkfield Clinic', customer_name: 'Larkfield Construction' })).toBe(true)
    expect(isBillsTestRow({ stripeMode: ' test ' }, null)).toBe(true)
  })
  it('calls a bill or a payment on a ZZ test job a test, whatever its mode', () => {
    expect(isBillsTestRow({ stripeMode: 'live' }, { job_name: 'ZZ Test sink', customer_name: 'Larkfield Construction' })).toBe(true)
    expect(isBillsTestRow(null, { job_name: 'Shop repipe', customer_name: 'zz test customer' })).toBe(true)
  })
  it('leaves every other row alone', () => {
    expect(isBillsTestRow({ stripeMode: 'live' }, { job_name: 'Larkfield Clinic', customer_name: 'Larkfield Construction' })).toBe(false)
    expect(isBillsTestRow({ stripeMode: null }, undefined)).toBe(false)
    expect(isBillsTestRow(undefined, undefined)).toBe(false)
    // A name that only holds the letters is no test.
    expect(isBillsTestRow(null, { job_name: 'Pizza oven gas line', customer_name: 'Buzz Mechanical' })).toBe(false)
  })
})

const copy = (id: string, billId: string, jobId: string, sentAt: string): BillsSentCopy => ({
  id,
  kind: 'bill',
  title: 'Invoice #1412-0002 from Northgate Plumbing Co.',
  how: 'email',
  recipientName: 'Sable Ridge Builders',
  recipientEmails: ['hal@sableridge.example'],
  subject: '',
  sourceTable: 'jobs_ledger_invoices',
  sourceId: billId,
  copyPath: `${id}/copy.html`,
  copyType: 'text/html',
  copyHash: id,
  attachments: [],
  sentAt,
  sentByName: 'Priya',
  sourceSnapshot: null,
  jobIds: [jobId],
  bidId: null,
  resendEmailId: null,
})
const open = (out: number): BillPaidState => ({ kind: 'open', paidOn: null, paidAmount: 0, outAmount: out, wayWords: '', paidAtIso: null, payments: [] })
const paid = (ymd: string): BillPaidState => ({ kind: 'paid', paidOn: ymd, paidAmount: 50, outAmount: 0, wayWords: 'Card · Stripe', paidAtIso: null, payments: [] })

// Nov 9: a real bill, not paid, and a test-mode bill, not paid. Nov 8: a bill on a ZZ test job, paid by card.
const sent: BillsSentInput = {
  copies: [copy('c-real', REAL, JOB, '2026-11-09T16:00:00.000Z'), copy('c-mode', TEST_MODE, JOB_T, '2026-11-09T17:00:00.000Z'), copy('c-zz', ZZ, JOB_ZZ, '2026-11-08T17:00:00.000Z')],
  bills: new Map([
    [REAL, { id: REAL, jobId: JOB, amount: 4860, status: 'billed' }],
    [TEST_MODE, { id: TEST_MODE, jobId: JOB_T, amount: 50, status: 'billed', stripeMode: 'test' }],
    [ZZ, { id: ZZ, jobId: JOB_ZZ, amount: 75, status: 'paid' }],
  ]),
  jobs: new Map([
    [JOB, { id: JOB, hcp_number: '1412', click_number: null, job_name: 'Sable Ridge Lot 14', customer_name: 'Sable Ridge Builders' }],
    [JOB_T, { id: JOB_T, hcp_number: '1500', click_number: null, job_name: 'Hollis Dental fit-out', customer_name: 'Hollis Dental Group' }],
    [JOB_ZZ, { id: JOB_ZZ, hcp_number: '1501', click_number: null, job_name: 'ZZ Test sink', customer_name: 'ZZ Test Customer' }],
  ]),
  statements: new Map(),
  earlier: [],
  paid: new Map([
    [REAL, open(4860)],
    [TEST_MODE, open(50)],
    [ZZ, paid('2026-11-08')],
  ]),
}
const lines = billsSentLines(sent, { todayYmd: '2026-11-12' })
const line = (id: string) => lines.find((l) => l.id === id)!

describe('By day sent: a test bill is listed, marked, and in no total', () => {
  it('keeps the send on the list and says it is a test', () => {
    expect(lines.map((l) => [l.id, l.test])).toEqual([
      ['c-mode', true],
      ['c-real', false],
      ['c-zz', true],
    ])
    expect(line('c-mode').note).toBe(BILLS_TEST_NOTE)
    expect(line('c-zz').note).toBe(BILLS_TEST_NOTE)
    expect(line('c-real').note).toBe('')
  })
  it('adds a test bill to no day’s total and no day’s paid count', () => {
    const days = billsSentDays(lines, '2026-11-12')
    expect(days.map((d) => [d.ymd, d.sum.bills, d.sum.total, d.back])).toEqual([
      ['2026-11-09', 1, 4860, { bills: 1, paid: 0, out: 4860 }],
      ['2026-11-08', 0, 0, { bills: 0, paid: 0, out: 0 }],
    ])
  })
  it('leaves a test bill out of the Not paid tile and both payment chips, and stamps it neither paid nor not', () => {
    expect(billsSentTiles(lines, '2026-11-12').unpaid).toEqual({ bills: 1, total: 4860 })
    expect(billsSentFilter(lines, 'unpaid', '').map((l) => l.id)).toEqual(['c-real'])
    expect(billsSentFilter(lines, 'paid', '').map((l) => l.id)).toEqual([])
    expect([line('c-mode').pay, line('c-zz').pay, line('c-zz').paid]).toEqual([null, null, false])
    // Every send is still under All, and the search still finds it.
    expect(billsSentFilter(lines, 'all', 'zz test').map((l) => l.id)).toEqual(['c-zz'])
  })
  it('never counts a test bill’s bounce among the sends that did not arrive', () => {
    const bounced = billsSentLines({ ...sent, marks: new Map([['c-mode', { id: 'c-mode', lastEvent: 'bounced', lastEventAtIso: '2026-11-09T17:01:00.000Z', emailType: null, paidOn: null, paidHow: null }]]) }, { todayYmd: '2026-11-12' })
    expect(bounced.find((l) => l.id === 'c-mode')).toMatchObject({ delivery: 'Bounced. It did not arrive.', stillMissed: false })
  })
  it('says so in the spreadsheet and on the bill’s record', () => {
    const csv = billsSentCsv(lines).split('\r\n')
    expect(csv[1]).toContain(',no,')
    expect(csv[1]).toContain(BILLS_TEST_NOTE)
    expect(billsSentRecord(ZZ, lines, sent)?.stateWords).toBe('Test bill')
    expect(billsSentRecord(REAL, lines, sent)?.stateWords).toBe('Not paid')
  })
  it('keeps a bill on a ZZ test job out of the bills with no send on record', () => {
    const gaps = billsSentGaps({ unsent: [{ billId: 'u-real', jobId: JOB, amount: 900, status: 'billed', billedAtIso: '2026-11-10T15:00:00.000Z' }, { billId: 'u-zz', jobId: JOB_ZZ, amount: 20, status: 'billed', billedAtIso: '2026-11-10T16:00:00.000Z' }], jobs: sent.jobs }, [])
    expect(gaps.open.map((g) => g.billId)).toEqual(['u-real'])
  })
})

const payment = (over: Partial<BillsPaidPayment>): BillsPaidPayment => ({ id: 'p1', billId: REAL, jobId: JOB, amount: 4860, paidOn: '2026-11-10', createdAtIso: '2026-11-10T15:14:00.000Z', paymentType: 'Check', note: null, referenceNumber: null, bankTransactionId: null, stripeCreditNoteId: null, ...over })
const paidInput: BillsPaidInput = {
  payments: [
    payment({ id: 'real' }),
    // A card payment on a test-mode bill, Sunday evening.
    payment({ id: 'mode', billId: TEST_MODE, jobId: JOB_T, amount: 50, paidOn: '2026-11-08', note: 'Stripe' }),
    // Typed by hand on a ZZ test job, on its bill and on the job alone.
    payment({ id: 'zz-bill', billId: ZZ, jobId: JOB_ZZ, amount: 75, paidOn: '2026-10-28', paymentType: 'Cash' }),
    payment({ id: 'zz-job', billId: null, jobId: JOB_ZZ, amount: 20, paidOn: '2026-10-28', paymentType: 'Cash' }),
  ],
  bills: new Map([
    [REAL, { id: REAL, jobId: JOB, amount: 4860, status: 'paid' }],
    [TEST_MODE, { id: TEST_MODE, jobId: JOB_T, amount: 50, status: 'paid', stripeMode: 'test' }],
    [ZZ, { id: ZZ, jobId: JOB_ZZ, amount: 75, status: 'paid' }],
  ]),
  jobs: sent.jobs,
}

describe('By day paid: a test payment is no money', () => {
  it('leaves out a payment on a test-mode bill and every payment on a ZZ test job', () => {
    const paidLines = billsPaidLines(paidInput)
    expect(paidLines.map((l) => l.id)).toEqual(['real'])
    expect(billsPaidSum(paidLines)).toEqual({ payments: 1, total: 4860 })
  })
  it('agrees with By day sent on which bills are tests', () => {
    const paidBills = new Set(billsPaidLines(paidInput).map((l) => l.billId))
    const countedBills = new Set(lines.filter((l) => !l.test).map((l) => l.billId))
    expect([...paidBills]).toEqual([REAL])
    expect([...countedBills]).toEqual([REAL])
  })
})
