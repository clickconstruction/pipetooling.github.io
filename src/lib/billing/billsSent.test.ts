import { describe, expect, it } from 'vitest'
import {
  billNumberFromTitle,
  billsSentAgainWords,
  billsSentDayExtras,
  billsSentDays,
  billsSentFilter,
  billsSentLines,
  billsSentSumWords,
  billsSentTiles,
  canOpenBillsSent,
  isBillsSentKind,
  ordinal,
  type BillsSentCopy,
  type BillsSentInput,
} from './billsSent'

// Made-up data throughout: no live bill, job, customer or address.
const BILL_A = 'aaaaaaaa-1111-4111-8111-111111111111'
const BILL_B = 'bbbbbbbb-2222-4222-8222-222222222222'
const JOB_A = 'aaaaaaaa-9999-4999-8999-999999999991'
const JOB_B = 'bbbbbbbb-9999-4999-8999-999999999992'

const copy = (over: Partial<BillsSentCopy>): BillsSentCopy => ({
  id: 'c1',
  kind: 'bill',
  title: 'Invoice #1412-0002 from Northgate Plumbing Co.',
  how: 'email',
  recipientName: 'Sable Ridge Builders',
  recipientEmails: ['hal@sableridge.example'],
  subject: 'Invoice #1412-0002 from Northgate Plumbing Co.',
  sourceTable: 'jobs_ledger_invoices',
  sourceId: BILL_A,
  copyPath: 'c1/copy.html',
  copyType: 'text/html',
  copyHash: 'h1',
  attachments: [],
  // 9:28 AM Central on Thu, Nov 12, 2026.
  sentAt: '2026-11-12T15:28:00.000Z',
  sentByName: 'Priya',
  sourceSnapshot: null,
  jobIds: [JOB_A],
  bidId: null,
  resendEmailId: 're_1',
  ...over,
})

const input = (copies: BillsSentCopy[], over: Partial<BillsSentInput> = {}): BillsSentInput => ({
  copies,
  bills: new Map([
    [BILL_A, { id: BILL_A, jobId: JOB_A, amount: 4860, status: 'billed' }],
    [BILL_B, { id: BILL_B, jobId: JOB_B, amount: 9750, status: 'paid' }],
  ]),
  jobs: new Map([
    [JOB_A, { id: JOB_A, hcp_number: '1412', click_number: null, job_name: 'Sable Ridge Lot 14', job_address: '208 Juniper Bend', customer_name: 'Sable Ridge Builders' }],
    [JOB_B, { id: JOB_B, hcp_number: '1398', click_number: null, job_name: 'Larkfield Clinic', job_address: '4410 Mesa Verde Dr', customer_name: 'Larkfield Construction' }],
  ]),
  statements: new Map(),
  earlier: [],
  ...over,
})

describe('billsSent — who and which papers', () => {
  it('opens for the people who read sent copies', () => {
    expect(['dev', 'master_technician', 'assistant', 'controller'].map(canOpenBillsSent)).toEqual([true, true, true, true])
    expect(['estimator', 'primary', 'helpers', 'subcontractor', 'superintendent', null, undefined].map(canOpenBillsSent)).toEqual([false, false, false, false, false, false, false])
  })
  it('reads every bill kind, a statement and a pay application, and nothing else', () => {
    expect(['bill', 'bill_copy', 'bill_resent', 'bill_pay_code', 'bill_gc_pay_app', 'gc_statement', 'gc_statement_print', 'pay_application'].every(isBillsSentKind)).toBe(true)
    expect(['estimate', 'lien_notice', 'test_report', 'statement_of_charges', 'self_test'].some(isBillsSentKind)).toBe(false)
  })
  it('reads the number the payer saw from the email title', () => {
    expect(billNumberFromTitle('Invoice #1412-0002 from Northgate Plumbing Co.')).toBe('1412-0002')
    expect(billNumberFromTitle('[Test] Invoice #AB12-7 from Northgate')).toBe('AB12-7')
    expect(billNumberFromTitle('Pay code · Bill $3,410.00 · Whitfield repipe')).toBe('')
  })
  it('counts in words', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 103].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '103rd'])
  })
})

describe('billsSentLines', () => {
  it('draws an emailed bill with its number, job, payer, amount, address and sender', () => {
    const [line] = billsSentLines(input([copy({})]))
    expect(line).toMatchObject({
      what: 'Bill 1412-0002',
      route: 'email',
      routeWords: 'Email',
      jobWords: 'J1412 · Sable Ridge Lot 14',
      jobTo: `/jobs?edit=${JOB_A}`,
      payer: 'Sable Ridge Builders',
      amount: 4860,
      counts: true,
      paid: false,
      toName: 'Sable Ridge Builders',
      toAddresses: ['hal@sableridge.example'],
      by: 'Priya',
      nth: 1,
      firstAtIso: null,
      note: '',
    })
  })

  it('makes a second send its own line, says when the first went, and counts the bill once', () => {
    const first = copy({ id: 'c1', sentAt: '2026-11-03T22:41:00.000Z' })
    const second = copy({ id: 'c2', sentAt: '2026-11-12T17:02:00.000Z' })
    const lines = billsSentLines(input([second, first]))
    expect(lines.map((l) => [l.id, l.nth, l.routeWords, l.counts])).toEqual([
      ['c2', 2, 'Email, sent again', false],
      ['c1', 1, 'Email', true],
    ])
    expect(billsSentAgainWords(lines[0]!)).toBe('2nd send. First sent Tue, Nov 3.')
    expect(billsSentAgainWords(lines[1]!)).toBe('')
  })

  it('knows a line is a second send when the first is off the page', () => {
    const second = copy({ id: 'c2', sentAt: '2026-11-12T17:02:00.000Z' })
    const [line] = billsSentLines(input([second], { earlier: [{ billId: BILL_A, atIso: '2026-11-03T22:41:00.000Z' }, { billId: BILL_A, atIso: '2026-11-12T17:02:00.000Z' }] }))
    expect(line).toMatchObject({ nth: 2, counts: false, routeWords: 'Email, sent again' })
    expect(billsSentAgainWords(line!)).toBe('2nd send. First sent Tue, Nov 3.')
  })

  it('folds a copy to the copy list into the send it rode with', () => {
    const send = copy({})
    const rider = copy({ id: 'c9', kind: 'bill_copy', recipientName: '', recipientEmails: ['pm@sableridge.example'], sentAt: '2026-11-12T15:28:04.000Z' })
    const lines = billsSentLines(input([send, rider]))
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ id: 'c1', copyTo: ['pm@sableridge.example'], nth: 1 })
    expect(lines[0]!.copies.map((c) => c.id)).toEqual(['c9'])
  })

  it('leaves a copy with no send near it as its own line', () => {
    const rider = copy({ id: 'c9', kind: 'bill_copy', recipientEmails: ['pm@sableridge.example'], sentAt: '2026-11-12T19:00:00.000Z' })
    const lines = billsSentLines(input([copy({}), rider]))
    expect(lines.map((l) => l.id)).toEqual(['c9', 'c1'])
  })

  it('says what the app cannot know about a print', () => {
    const [line] = billsSentLines(input([copy({ kind: 'bill_pay_code', how: 'print', title: 'Pay code · Bill $4,860.00 · Sable Ridge Lot 14', recipientName: '', recipientEmails: [], jobIds: [] })]))
    expect(line).toMatchObject({ route: 'printed', routeWords: 'Printed', what: 'Bill', amount: 4860, counts: true, jobWords: 'J1412 · Sable Ridge Lot 14', payer: 'Sable Ridge Builders' })
    expect(line!.note).toBe('The pay sheet was printed. The app cannot know who it was handed to.')
  })

  it('lists a statement with its total and job count and never adds it', () => {
    const statement = copy({ id: 's1', kind: 'gc_statement', title: 'Statement for Ridgeway Builders', recipientName: 'Ridgeway Builders', recipientEmails: ['billing@ridgeway.example'], sourceTable: '', sourceId: null, jobIds: [], resendEmailId: 're_s' })
    const [line] = billsSentLines(input([statement], { statements: new Map([['re_s', { resendEmailId: 're_s', total: 48210, jobCount: 12 }]]) }))
    expect(line).toMatchObject({ what: 'Statement', route: 'statement', routeWords: 'Statement', amount: 48210, counts: false, jobWords: '12 jobs', jobTo: null, billId: null })
    expect(line!.note).toBe('Lists bills already sent. Not in the day’s total.')
  })

  it('reads a pay application from the figures filed with it', () => {
    const app = copy({ id: 'p1', kind: 'pay_application', how: 'download', title: 'Pay application 4 · AIA G702-G703', recipientName: '', recipientEmails: [], sourceTable: 'job_pay_applications', sourceId: 'x', sourceSnapshot: { applicationNumber: 4, currentPaymentDue: 21400 } })
    const [line] = billsSentLines(input([app]))
    expect(line).toMatchObject({ what: 'Pay application 4', route: 'other', routeWords: 'Saved as a file', amount: 21400, counts: false })
    expect(line!.note).toBe('Saved as a file. The app cannot know where it went.')
  })

  it('names a GC mode paper by its kind and leaves out what is not a bill', () => {
    const lines = billsSentLines(input([copy({ id: 'g1', kind: 'bill_gc_reminder', sourceTable: 'gc_owner_pay_reminders', sourceId: 'r' }), copy({ id: 'e1', kind: 'estimate' })]))
    expect(lines.map((l) => [l.id, l.what, l.amount, l.counts])).toEqual([['g1', 'Reminder', null, false]])
  })

  it('marks a bill that is paid today', () => {
    const [line] = billsSentLines(input([copy({ sourceId: BILL_B, jobIds: [JOB_B] })]))
    expect(line).toMatchObject({ paid: true, amount: 9750, jobWords: 'J1398 · Larkfield Clinic' })
  })
})

describe('billsSent — days, tiles and the search', () => {
  const lines = billsSentLines(
    input([
      copy({ id: 'a2', sentAt: '2026-11-12T17:02:00.000Z', sourceId: BILL_B, jobIds: [JOB_B], recipientName: 'Larkfield Construction', recipientEmails: ['ap@larkfield.example'], title: 'Invoice #1398-0003 from Northgate Plumbing Co.' }),
      copy({ id: 'a1', sentAt: '2026-11-12T15:28:00.000Z' }),
      copy({ id: 's1', kind: 'gc_statement', title: 'Statement for Ridgeway Builders', sentAt: '2026-11-12T13:00:00.000Z', sourceTable: '', sourceId: null, jobIds: [], recipientName: 'Ridgeway Builders', recipientEmails: ['billing@ridgeway.example'], resendEmailId: 're_s' }),
      copy({ id: 'b1', sentAt: '2026-11-03T22:41:00.000Z', sourceId: BILL_B, jobIds: [JOB_B], recipientName: 'Larkfield Construction', recipientEmails: ['ap@larkfield.example'], title: 'Invoice #1398-0003 from Northgate Plumbing Co.' }),
    ]),
  )

  it('bands the lines by day, counts each bill on its first day, and names the rest', () => {
    const days = billsSentDays(lines, '2026-11-12')
    expect(days.map((d) => [d.label, d.lines.length, billsSentSumWords(d.sum), billsSentDayExtras(d)])).toEqual([
      ['Today · Thu, Nov 12', 3, '1 bill · $4,860.00', '1 sent again · 1 statement'],
      ['Tue, Nov 3', 1, '1 bill · $9,750.00', ''],
    ])
  })

  it('sums today and the week that began on Sunday', () => {
    expect(billsSentTiles(lines, '2026-11-12')).toEqual({ today: { bills: 1, total: 4860 }, week: { bills: 1, total: 4860 } })
    // Nov 3 is in the week before: it is out of this week's tile and in its own.
    expect(billsSentTiles(lines, '2026-11-06').week).toEqual({ bills: 1, total: 9750 })
  })

  it('finds a line by its job, its payer, an address, a street or a bill number, every word', () => {
    const ids = (typed: string, route: 'all' | 'email' | 'printed' | 'statement' = 'all') => billsSentFilter(lines, route, typed).map((l) => l.id)
    expect(ids('larkfield')).toEqual(['a2', 'b1'])
    expect(ids('1412-0002')).toEqual(['a1'])
    expect(ids('juniper bend')).toEqual(['a1'])
    expect(ids('AP@Larkfield.example')).toEqual(['a2', 'b1'])
    expect(ids('larkfield juniper')).toEqual([])
    expect(ids('', 'statement')).toEqual(['s1'])
    expect(ids('', 'email')).toEqual(['a2', 'a1', 'b1'])
    expect(ids('', 'printed')).toEqual([])
  })
})
