import { describe, expect, it } from 'vitest'
import {
  billNumberFromTitle,
  billsSentGapFilter,
  billsSentGapHeading,
  billsSentGaps,
  BILLS_SENT_CSV_HEAD,
  billsSentAgainWords,
  billsSentByWords,
  billsSentCsv,
  billsSentCsvFileName,
  billsSentDayExtras,
  billsSentDays,
  billsSentFilter,
  billsSentLines,
  billsSentListHtml,
  billsSentBackWords,
  billsSentPaidWords,
  billsSentPayPlain,
  billsSentPayWords,
  billsSentPhoneWords,
  billsSentRecord,
  billsSentRecordHtml,
  billsSentRecordPath,
  byHandDayOffered,
  byHandDayPicks,
  byHandFiling,
  byHandOthers,
  byHandOthersHeading,
  byHandOutcome,
  byHandProblem,
  byHandReadBack,
  byHandReadBackLead,
  byHandRecordLabel,
  billsSentSumWords,
  billsSentTiles,
  canOpenBillsSent,
  isBillsSentKind,
  ordinal,
  type BillsSentCopy,
  type BillsSentInput,
} from './billsSent'
import type { BillPaidState } from './billsPaid'

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
    // Not paid counts the one open bill on the list; the paid one adds nothing.
    expect(billsSentTiles(lines, '2026-11-12')).toEqual({ today: { bills: 1, total: 4860 }, week: { bills: 1, total: 4860 }, unpaid: { bills: 1, total: 4860 } })
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

describe('billsSent — sends that kept no copy (PR 2)', () => {
  it('does not draw a send-log row twice when its copy is on the page', () => {
    const lines = billsSentLines(input([copy({})], { stripeRows: [{ id: 'r1', billId: BILL_A, atIso: '2026-11-12T15:28:01.000Z', copyEmails: [] }] }))
    expect(lines.map((l) => l.id)).toEqual(['c1'])
    expect(lines[0]).toMatchObject({ nth: 1, counts: true })
  })

  it('draws an email from before the copies began with its time and says the address was not kept', () => {
    const lines = billsSentLines(
      input([copy({ sentAt: '2026-11-12T15:28:00.000Z' })], {
        stripeRows: [
          { id: 'r0', billId: BILL_A, atIso: '2026-09-02T14:05:00.000Z', copyEmails: ['pm@sableridge.example'] },
          { id: 'r1', billId: BILL_A, atIso: '2026-11-12T15:28:02.000Z', copyEmails: [] },
        ],
      }),
    )
    expect(lines.map((l) => [l.id, l.nth, l.routeWords, l.counts])).toEqual([
      ['c1', 2, 'Email, sent again', false],
      ['row:r0', 1, 'Email', true],
    ])
    expect(lines[1]).toMatchObject({ what: 'Bill 1412-0002', copy: null, toAddresses: [], copyTo: ['pm@sableridge.example'], amount: 4860, jobWords: 'J1412 · Sable Ridge Lot 14', payer: 'Sable Ridge Builders', dayOnly: false })
    expect(lines[1]!.note).toBe('The address was not kept. The app kept no copy of a send before Oct 5, 2026.')
  })

  it('says a later send with no copy has no address on record', () => {
    const [line] = billsSentLines(input([], { stripeRows: [{ id: 'r9', billId: BILL_B, atIso: '2026-11-02T19:28:00.000Z', copyEmails: [] }] }))
    expect(line).toMatchObject({ id: 'row:r9', what: 'Bill', route: 'email', paid: true, amount: 9750 })
    expect(line!.note).toBe('No copy of this send was kept, so the address is not on record.')
  })

  it('draws a Housecall Pro bill on its day with no time, and leaves the stamp out when a copy is the record', () => {
    const lines = billsSentLines(
      input([copy({})], {
        stamps: [
          { billId: BILL_B, atIso: '2026-11-11T18:00:00.000Z', channel: 'housecallpro' },
          { billId: BILL_A, atIso: '2026-11-12T18:00:00.000Z', channel: 'physical' },
        ],
      }),
    )
    expect(lines.map((l) => l.id)).toEqual(['c1', `stamp:${BILL_B}`])
    expect(lines[1]).toMatchObject({ route: 'housecall_pro', routeWords: 'Housecall Pro', dayOnly: true, by: '', toAddresses: [], amount: 9750, counts: true, copy: null })
    expect(lines[1]!.note).toBe('Sent from Housecall Pro. The app has the day only. It has no address, no sender and no copy.')
  })

  it('draws a text with the pay link as a send of its bill, with the number and Quo\u2019s answer', () => {
    const lines = billsSentLines(
      input([copy({ sentAt: '2026-11-10T21:40:00.000Z' })], {
        texts: [
          { id: 't1', atIso: '2026-11-12T20:14:00.000Z', billId: BILL_A, jobId: JOB_A, number: '(512) 555-0142', toName: 'Hal Jensen', by: 'Priya', delivery: 'delivered' },
          { id: 't2', atIso: '2026-11-12T20:20:00.000Z', billId: null, jobId: null, number: '(512) 555-0199', toName: '', by: 'Priya', delivery: 'failed' },
        ],
      }),
    )
    expect(lines.map((l) => [l.id, l.route, l.nth, l.counts, l.delivery])).toEqual([
      ['text:t2', 'text', 1, false, 'Not delivered'],
      ['text:t1', 'text', 2, false, 'Delivered'],
      ['c1', 'email', 1, true, ''],
    ])
    expect(lines[1]).toMatchObject({ routeWords: 'Text with pay link', toName: 'Hal Jensen', toAddresses: ['(512) 555-0142'], by: 'Priya', what: 'Bill 1412-0002', note: '' })
    expect(billsSentAgainWords(lines[1]!)).toBe('2nd send. First sent Tue, Nov 10.')
    expect(lines[0]!.note).toBe('The pay link in this text no longer names a bill.')
    expect(billsSentFilter(lines, 'text', '').map((l) => l.id)).toEqual(['text:t2', 'text:t1'])
    expect(billsSentFilter(lines, 'gap', '')).toEqual([])
  })
})

describe('billsSentGaps (PR 2)', () => {
  const unsent = [
    { billId: BILL_A, jobId: JOB_A, amount: 4860, status: 'billed', billedAtIso: '2026-11-09T21:26:00.000Z' },
    { billId: BILL_B, jobId: JOB_B, amount: 9750, status: 'paid', billedAtIso: '2026-11-10T16:00:00.000Z' },
  ]
  it('lists a bill with no send on record, open apart from paid', () => {
    const data = input([], { unsent })
    const gaps = billsSentGaps(data, billsSentLines(data))
    expect(gaps.open).toHaveLength(1)
    expect(gaps.open[0]).toMatchObject({ billId: BILL_A, jobWords: 'J1412 · Sable Ridge Lot 14', jobTo: `/jobs?edit=${JOB_A}`, payer: 'Sable Ridge Builders', amount: 4860, paid: false, billedWords: 'Billed Mon, Nov 9 at 3:26 PM.', billedYmd: '2026-11-09' })
    expect(gaps.paid.map((g) => g.billId)).toEqual([BILL_B])
    expect(billsSentGapHeading(1)).toBe('1 bill is billed with no send on record')
    expect(billsSentGapHeading(3)).toBe('3 bills are billed with no send on record')
  })
  it('never calls a bill a gap when a line on the list is a send of it', () => {
    const data = input([], { unsent, texts: [{ id: 't1', atIso: '2026-11-12T20:14:00.000Z', billId: BILL_A, jobId: JOB_A, number: '(512) 555-0142', toName: '', by: 'Priya', delivery: null }] })
    const gaps = billsSentGaps(data, billsSentLines(data))
    expect(gaps.open).toEqual([])
    expect(gaps.paid.map((g) => g.billId)).toEqual([BILL_B])
  })
  it('narrows with the search box', () => {
    const data = input([], { unsent })
    const { open } = billsSentGaps(data, [])
    expect(billsSentGapFilter(open, 'juniper').map((g) => g.billId)).toEqual([BILL_A])
    expect(billsSentGapFilter(open, 'larkfield')).toEqual([])
  })
})

describe('billsSent — whether a send arrived (PR 3)', () => {
  const mark = (id: string, lastEvent: string | null, lastEventAtIso: string | null, over: Partial<{ emailType: string; paidOn: string; paidHow: string }> = {}) =>
    [id, { id, lastEvent, lastEventAtIso, emailType: over.emailType ?? 'stripe_bill', paidOn: over.paidOn ?? null, paidHow: over.paidHow ?? null }] as const

  it('says what the mail service last said, in the line\u2019s words', () => {
    const copies = [
      copy({ id: 'd1', sentAt: '2026-11-12T15:28:00.000Z' }),
      copy({ id: 'o1', sentAt: '2026-11-10T15:28:00.000Z' }),
      copy({ id: 'w1', sentAt: '2026-11-09T15:28:00.000Z' }),
      copy({ id: 'n1', sentAt: '2026-11-08T15:28:00.000Z' }),
    ]
    const marks = new Map([mark('d1', 'delivered', '2026-11-12T15:28:20.000Z'), mark('o1', 'opened', '2026-11-11T14:12:00.000Z'), mark('w1', 'sent', '2026-11-09T15:28:00.000Z'), mark('n1', null, null)])
    const lines = billsSentLines(input(copies, { marks }))
    expect(lines.map((l) => [l.id, l.delivery, l.deliveryTone, l.stillMissed])).toEqual([
      ['d1', 'Delivered 9:28 AM', 'ok', false],
      ['o1', 'Opened Wed, Nov 11 at 8:12 AM', 'ok', false],
      ['w1', 'Sent. Their mail server has not answered yet.', 'quiet', false],
      ['n1', '', '', false],
    ])
  })

  it('marks a bounce on an open bill until a later send arrives', () => {
    const bounced = copy({ id: 'b1', sentAt: '2026-11-11T22:47:00.000Z' })
    const marks = new Map([mark('b1', 'bounced', '2026-11-11T22:47:05.000Z')])
    const [alone] = billsSentLines(input([bounced], { marks }))
    expect(alone).toMatchObject({ delivery: 'Bounced. It did not arrive.', deliveryTone: 'bad', stillMissed: true })

    const again = copy({ id: 'b2', sentAt: '2026-11-12T15:28:00.000Z' })
    const lines = billsSentLines(input([again, bounced], { marks: new Map([...marks, mark('b2', 'delivered', '2026-11-12T15:28:10.000Z')]) }))
    expect(lines.map((l) => [l.id, l.deliveryTone, l.stillMissed])).toEqual([
      ['b2', 'ok', false],
      ['b1', 'bad', false],
    ])
    expect(billsSentFilter(billsSentLines(input([bounced], { marks })), 'missed', '').map((l) => l.id)).toEqual(['b1'])
    expect(billsSentFilter(lines, 'missed', '')).toEqual([])
    expect(billsSentDayExtras(billsSentDays(lines, '2026-11-12')[1]!)).toBe('1 did not arrive')
  })

  it('does not chase a bounce on a bill that is paid', () => {
    const [line] = billsSentLines(input([copy({ id: 'p1', sourceId: BILL_B, jobIds: [JOB_B] })], { marks: new Map([mark('p1', 'bounced', '2026-11-12T15:28:05.000Z', { paidOn: '2026-11-09', paidHow: 'card' })]) }))
    expect(line).toMatchObject({ deliveryTone: 'bad', stillMissed: false, paidOn: '2026-11-09' })
    expect(billsSentPaidWords(line!)).toBe('Paid Nov 9')
  })

  it('says a paid bill is paid when the day is not known, and nothing for an open one', () => {
    expect(billsSentPaidWords({ paid: true, paidOn: null })).toBe('Paid since')
    expect(billsSentPaidWords({ paid: false, paidOn: null })).toBe('')
  })

  it('says a statement on the schedule went by the app', () => {
    const statement = copy({ id: 's1', kind: 'gc_statement', title: 'Statement for Ridgeway Builders', sourceTable: '', sourceId: null, jobIds: [], sentByName: 'Marcus' })
    const [line] = billsSentLines(input([statement], { marks: new Map([mark('s1', 'delivered', '2026-11-12T15:28:05.000Z', { emailType: 'gc_statement_scheduled' })]) }))
    expect(billsSentByWords(line!)).toBe('by the app, on Marcus’s schedule')
    expect(billsSentByWords({ by: 'Priya', bySchedule: false })).toBe('by Priya')
    expect(billsSentByWords({ by: '', bySchedule: true })).toBe('by the app, on a schedule')
    expect(billsSentByWords({ by: '', bySchedule: false })).toBe('')
  })

  it('reads a text Quo could not deliver as a send that did not arrive', () => {
    const data = input([], { texts: [{ id: 't1', atIso: '2026-11-12T20:14:00.000Z', billId: BILL_A, jobId: JOB_A, number: '(512) 555-0142', toName: '', by: 'Priya', delivery: 'failed' }] })
    expect(billsSentLines(data)[0]).toMatchObject({ delivery: 'Not delivered', deliveryTone: 'bad', stillMissed: true })
  })
})

describe('billsSentRecord (PR 4)', () => {
  const data = input(
    [copy({ id: 'c2', sentAt: '2026-11-12T17:02:00.000Z' }), copy({ id: 'c1', sentAt: '2026-11-03T22:41:00.000Z' }), copy({ id: 'x1', sourceId: BILL_B, jobIds: [JOB_B] })],
    {
      bills: new Map([
        [BILL_A, { id: BILL_A, jobId: JOB_A, amount: 4860, status: 'billed', billedAtIso: '2026-11-03T22:38:00.000Z' }],
        [BILL_B, { id: BILL_B, jobId: JOB_B, amount: 9750, status: 'paid' }],
      ]),
      texts: [{ id: 't1', atIso: '2026-11-10T20:14:00.000Z', billId: BILL_A, jobId: JOB_A, number: '(512) 555-0142', toName: 'Hal Jensen', by: 'Priya', delivery: 'delivered' }],
      marks: new Map([
        ['c2', { id: 'c2', lastEvent: 'delivered', lastEventAtIso: '2026-11-12T17:02:09.000Z', emailType: 'stripe_bill', paidOn: null, paidHow: null }],
        ['c1', { id: 'c1', lastEvent: 'opened', lastEventAtIso: '2026-11-04T14:12:00.000Z', emailType: 'stripe_bill', paidOn: null, paidHow: null }],
      ]),
    },
  )
  const lines = billsSentLines(data)

  it('puts every send of one bill in order, newest first, with who it went to and whether it arrived', () => {
    const record = billsSentRecord(BILL_A, lines, data)!
    expect(record).toMatchObject({ what: 'Bill 1412-0002', jobWords: 'J1412 · Sable Ridge Lot 14', payer: 'Sable Ridge Builders', amount: 4860, stateWords: 'Not paid', madeWords: 'Bill made Tue, Nov 3 at 4:38 PM.' })
    expect(record.events.map((e) => [e.when, e.head, e.detail])).toEqual([
      ['Thu, Nov 12 · 11:02 AM', 'Emailed again by Priya', 'To Sable Ridge Builders, hal@sableridge.example. Delivered 11:02 AM.'],
      ['Tue, Nov 10 · 2:14 PM', 'Texted the pay link by Priya', 'To Hal Jensen, (512) 555-0142. Delivered.'],
      ['Tue, Nov 3 · 4:41 PM', 'Emailed by Priya', 'To Sable Ridge Builders, hal@sableridge.example. Opened Wed, Nov 4 at 8:12 AM.'],
    ])
    expect(billsSentRecordPath(BILL_A)).toBe(`/bills-sent?bill=${BILL_A}`)
  })

  it('still has a record for a bill with no send, and none for a bill the page does not know', () => {
    const bare = billsSentRecord(BILL_A, [], data)!
    expect(bare.events).toEqual([])
    expect(bare).toMatchObject({ what: 'Bill', jobWords: 'J1412 · Sable Ridge Lot 14', stateWords: 'Not paid' })
    expect(billsSentRecord('ffffffff-0000-4000-8000-000000000000', lines, data)).toBeNull()
    expect(billsSentRecord(BILL_B, lines, data)).toMatchObject({ stateWords: 'Paid', madeWords: '' })
  })

  it('prints as one page, with the words escaped and what Delivered means', () => {
    const record = billsSentRecord(BILL_A, lines, data)!
    const html = billsSentRecordHtml({ ...record, payer: 'Sable <Ridge> & Co' }, '2026-11-12T21:00:00.000Z')
    expect(html).toContain('<h1>Bill 1412-0002 · J1412 · Sable Ridge Lot 14</h1>')
    expect(html).toContain('Sable &lt;Ridge&gt; &amp; Co · $4,860.00 · Not paid')
    expect(html).toContain('<td class="when">Thu, Nov 12 · 11:02 AM</td><td><b>Emailed again by Priya</b>')
    expect(html).toContain('Delivered means their mail server took the email.')
    expect(html).toContain('Printed Thu, Nov 12 · 3:00 PM.')
    expect(billsSentRecordHtml({ ...record, events: [] }, '2026-11-12T21:00:00.000Z')).toContain('No send of this bill is on record.')
  })
})

describe('billsSent — out of the app (PR 5)', () => {
  const data = input(
    [
      copy({ id: 'c2', sentAt: '2026-11-12T17:02:00.000Z', recipientName: '=Sable, "Ridge" Builders' }),
      copy({ id: 'c1', sentAt: '2026-11-03T22:41:00.000Z' }),
    ],
    {
      stamps: [{ billId: BILL_B, atIso: '2026-11-11T18:00:00.000Z', channel: 'housecallpro' }],
      unsent: [{ billId: 'dddddddd-4444-4444-8444-444444444444', jobId: JOB_B, amount: 2140, status: 'billed', billedAtIso: '2026-11-09T21:26:00.000Z' }],
      marks: new Map([['c2', { id: 'c2', lastEvent: 'delivered', lastEventAtIso: '2026-11-12T17:02:09.000Z', emailType: 'stripe_bill', paidOn: null, paidHow: null }]]),
    },
  )
  const lines = billsSentLines(data)
  const gaps = billsSentGaps(data, lines)

  it('writes the lines as a spreadsheet a column of amounts can add, then the bills with no send', () => {
    const rows = billsSentCsv(lines, gaps.open).trimEnd().split('\r\n')
    expect(rows[0]).toBe(BILLS_SENT_CSV_HEAD.join(','))
    expect(rows).toHaveLength(5)
    // A second send: not in the day total, with which send it is. A name that opens like a formula is led with an apostrophe, and its comma and quotes are held.
    expect(rows[1]).toBe('2026-11-12,11:02 AM,Bill 1412-0002,J1412 · Sable Ridge Lot 14,"\'=Sable, ""Ridge"" Builders",4860.00,no,"\'=Sable, ""Ridge"" Builders",hal@sableridge.example,,"Email, sent again",Priya,2,Delivered 11:02 AM,Not paid,,,4860.00,,')
    // A Housecall Pro day: no time, and what the app does not have.
    expect(rows[2]).toBe('2026-11-11,,Bill,J1398 · Larkfield Clinic,Larkfield Construction,9750.00,yes,,,,Housecall Pro,,1,,Paid,,,0.00,,"Sent from Housecall Pro. The app has the day only. It has no address, no sender and no copy."')
    expect(rows[3]).toBe('2026-11-03,4:41 PM,Bill 1412-0002,J1412 · Sable Ridge Lot 14,Sable Ridge Builders,4860.00,yes,Sable Ridge Builders,hal@sableridge.example,,Email,Priya,1,,Not paid,,,4860.00,,')
    expect(rows[4]).toBe(',,Bill,J1398 · Larkfield Clinic,Larkfield Construction,2140.00,no,,,,No send on record,,,,Not paid,,,,,"Billed Mon, Nov 9 at 3:26 PM."')
    expect(billsSentCsvFileName('2026-11-12')).toBe('bills-sent-2026-11-12.csv')
  })

  it('prints what the list shows under its days, with the gaps first', () => {
    const html = billsSentListHtml(billsSentDays(lines, '2026-11-12'), gaps.open, { printedAtIso: '2026-11-12T21:00:00.000Z', shownWords: 'All.' })
    expect(html).toContain('<h1>Bills sent</h1>')
    expect(html).toContain('<h2>1 bill is billed with no send on record</h2>')
    expect(html).toContain('<b>Today · Thu, Nov 12</b> <span>0 bills · 1 sent again</span>')
    expect(html).toContain('<td class="when">11:02 AM</td><td><b>Bill 1412-0002</b> · J1412 · Sable Ridge Lot 14 · =Sable, &quot;Ridge&quot; Builders')
    expect(html).toContain('Email, sent again · by Priya · 2nd send. First sent Tue, Nov 3. · Delivered 11:02 AM')
    expect(html).toContain('<td class="when">Day only</td>')
    expect(html).toContain('Printed Thu, Nov 12 · 3:00 PM.')
    expect(html.indexOf('no send on record')).toBeLessThan(html.indexOf('Today · Thu, Nov 12'))
  })
})

describe('billsSent — who paid, when and how (punch list #422)', () => {
  const BILL_C = 'cccccccc-3333-4333-8333-333333333333'
  const pay = (over: Partial<BillPaidState>): BillPaidState => ({ kind: 'paid', paidOn: '2026-11-10', paidAmount: 9750, outAmount: 0, wayWords: 'Check 4417 · bank deposit', paidAtIso: null, payments: [], ...over })
  const data = input(
    [
      // Bill A: sent Nov 3, sent again Nov 12, not paid.
      copy({ id: 'a2', sentAt: '2026-11-12T17:02:00.000Z' }),
      copy({ id: 'a1', sentAt: '2026-11-03T22:41:00.000Z' }),
      // Bill B: sent Nov 3, paid by check on Nov 10.
      copy({ id: 'b1', sentAt: '2026-11-03T15:00:00.000Z', sourceId: BILL_B, jobIds: [JOB_B], recipientName: 'Larkfield Construction', recipientEmails: ['ap@larkfield.example'] }),
      // Bill C: sent Nov 3, a check for part of it on Nov 9.
      copy({ id: 'c1', sentAt: '2026-11-03T14:00:00.000Z', sourceId: BILL_C, jobIds: [JOB_B] }),
      copy({ id: 's1', kind: 'gc_statement', title: 'Statement for Ridgeway Builders', sentAt: '2026-11-12T13:00:00.000Z', sourceTable: '', sourceId: null, jobIds: [] }),
    ],
    {
      bills: new Map([
        [BILL_A, { id: BILL_A, jobId: JOB_A, amount: 4860, status: 'billed' }],
        [BILL_B, { id: BILL_B, jobId: JOB_B, amount: 9750, status: 'paid' }],
        [BILL_C, { id: BILL_C, jobId: JOB_B, amount: 3120, status: 'billed' }],
      ]),
      paid: new Map([
        [BILL_A, pay({ kind: 'open', paidOn: null, paidAmount: 0, outAmount: 4860, wayWords: '' })],
        [BILL_B, pay({ payments: [{ id: 'p1', ymd: '2026-11-10', amount: 9750, wayWords: 'Check 4417 · bank deposit', atIso: null, stripe: false, inKind: false, bankTransactionId: 'm1' }] })],
        [BILL_C, pay({ kind: 'part', paidOn: '2026-11-09', paidAmount: 1500, outAmount: 1620, wayWords: 'Check 2291 · typed by hand' })],
      ]),
    },
  )
  const lines = billsSentLines(data)
  const by = (id: string) => lines.find((l) => l.id === id)!

  it('puts where the bill stands on every send of it, and nothing on a statement', () => {
    expect(lines.map((l) => [l.id, l.pay?.kind ?? null, l.paid, l.paidOn, l.firstYmd])).toEqual([
      ['a2', 'open', false, null, '2026-11-03'],
      ['s1', null, false, null, '2026-11-12'],
      ['a1', 'open', false, null, '2026-11-03'],
      ['b1', 'paid', true, '2026-11-10', '2026-11-03'],
      ['c1', 'part', false, '2026-11-09', '2026-11-03'],
    ])
  })

  it('says a bill is not paid and how long it has been out, from its first send', () => {
    expect(billsSentPayWords(by('a2'), '2026-11-12')).toEqual({ tone: 'open', stamp: 'Not paid', stampAmount: null, way: '', when: '9 days out', outAmount: null })
    expect(billsSentPayWords(by('a1'), '2026-11-04')!.when).toBe('1 day out')
    expect(billsSentPayWords(by('a1'), '2026-11-03')!.when).toBe('sent today')
    expect(billsSentPayPlain(by('a2'), '2026-11-12')).toBe('Not paid · 9 days out')
  })

  it('says a bill is paid, the day, the way and how long the money took', () => {
    expect(billsSentPayWords(by('b1'), '2026-11-12')).toEqual({ tone: 'paid', stamp: 'Paid Tue, Nov 10', stampAmount: null, way: 'Check 4417 · bank deposit', when: 'in 7 days', outAmount: null })
    expect(billsSentPayWords(by('b1'), '2026-11-10')!.stamp).toBe('Paid today')
    expect(billsSentPayPlain(by('b1'), '2026-11-12')).toBe('Paid Tue, Nov 10 · Check 4417 · bank deposit · in 7 days')
    // Paid the day it went: the same day. Paid with no day on record: the word alone.
    expect(billsSentPayWords({ pay: pay({ paidOn: '2026-11-03' }), firstYmd: '2026-11-03' }, '2026-11-12')!.when).toBe('the same day')
    expect(billsSentPayWords({ pay: pay({ paidOn: null, wayWords: '' }), firstYmd: '2026-11-03' }, '2026-11-12')).toMatchObject({ stamp: 'Paid', way: '', when: '' })
    // A payment dated before the bill first went says no span: the days are never negative.
    expect(billsSentPayWords({ pay: pay({ paidOn: '2026-11-01' }), firstYmd: '2026-11-03' }, '2026-11-12')!.when).toBe('')
  })

  it('says the time of a Stripe payment that landed today, and the days it took on any later day', () => {
    // 8:21 AM Central on Thu, Nov 12.
    const stripe = { pay: pay({ paidOn: '2026-11-12', wayWords: 'Card · Stripe', paidAtIso: '2026-11-12T14:21:00.000Z' }), firstYmd: '2026-11-11' }
    expect(billsSentPayWords(stripe, '2026-11-12')).toMatchObject({ stamp: 'Paid today', way: 'Card · Stripe', when: '8:21 AM' })
    expect(billsSentPayWords(stripe, '2026-11-13')).toMatchObject({ stamp: 'Paid Thu, Nov 12', when: 'in 1 day' })
  })

  it('says a part payment, its day and what is still out', () => {
    expect(billsSentPayWords(by('c1'), '2026-11-12')).toEqual({ tone: 'part', stamp: 'Part paid', stampAmount: 1500, way: 'Check 2291 · typed by hand', when: 'Mon, Nov 9', outAmount: 1620 })
    expect(billsSentPayPlain(by('c1'), '2026-11-09')).toBe('Part paid $1,500.00 · Check 2291 · typed by hand · today · $1,620.00 out')
  })

  it('says nothing on a line that is no bill’s', () => {
    expect(billsSentPayWords(by('s1'), '2026-11-12')).toBeNull()
    expect(billsSentPayPlain(by('s1'), '2026-11-12')).toBe('')
  })

  it('counts on a day band how many of its bills are paid and what is still out', () => {
    const days = billsSentDays(lines, '2026-11-12')
    // Nov 12 holds a second send and a statement: no bill first went that day.
    expect(days.map((d) => [d.ymd, d.back, billsSentBackWords(d.back)])).toEqual([
      ['2026-11-12', { bills: 0, paid: 0, out: 0 }, ''],
      ['2026-11-03', { bills: 3, paid: 1, out: 6480 }, '1 of 3 paid · $6,480.00 still out'],
    ])
    expect(billsSentBackWords({ bills: 2, paid: 2, out: 0 })).toBe('2 of 2 paid')
  })

  it('adds up what is not paid, a part-paid bill for what is left of it, each bill once', () => {
    expect(billsSentTiles(lines, '2026-11-12').unpaid).toEqual({ bills: 2, total: 6480 })
    // A bill whose first send is off the page still counts, by the send that is on it.
    expect(billsSentTiles([by('a2')], '2026-11-12').unpaid).toEqual({ bills: 1, total: 4860 })
  })

  it('narrows the list to what is not paid, and to what is paid', () => {
    expect(billsSentFilter(lines, 'unpaid', '').map((l) => l.id)).toEqual(['a2', 'a1', 'c1'])
    expect(billsSentFilter(lines, 'paid', '').map((l) => l.id)).toEqual(['b1'])
    expect(billsSentFilter(lines, 'unpaid', 'larkfield').map((l) => l.id)).toEqual(['c1'])
  })

  it('puts each payment on the bill’s record, and the state in words', () => {
    const paidRecord = billsSentRecord(BILL_B, lines, data)!
    expect(paidRecord.stateWords).toBe('Paid Tue, Nov 10')
    expect(paidRecord.payments).toEqual([{ id: 'p1', when: 'Tue, Nov 10', amount: 9750, way: 'Check 4417 · bank deposit' }])
    expect(billsSentRecord(BILL_C, lines, data)!.stateWords).toBe('Part paid, $1,620.00 still out')
    expect(billsSentRecord(BILL_A, lines, data)!).toMatchObject({ stateWords: 'Not paid', payments: [] })
    const html = billsSentRecordHtml(paidRecord, '2026-11-12T21:00:00.000Z')
    expect(html).toContain('<h2>Payments, oldest first</h2>')
    expect(html).toContain('<td class="when">Tue, Nov 10</td><td><b>$9,750.00</b> · Check 4417 · bank deposit</td>')
  })

  it('writes the payment into the spreadsheet and the print', () => {
    const rows = billsSentCsv(lines).trimEnd().split('\r\n')
    const tail = (row: string) => row.split(',').slice(-6).join(',')
    // Paid, Paid on, Paid how, Still out, Days to pay, Note.
    expect(tail(rows[4]!)).toBe('Paid,2026-11-10,Check 4417 · bank deposit,0.00,7,')
    expect(tail(rows[5]!)).toBe('Part paid,2026-11-09,Check 2291 · typed by hand,1620.00,,')
    expect(tail(rows[1]!)).toBe('Not paid,,,4860.00,,')
    const html = billsSentListHtml(billsSentDays(lines, '2026-11-12'), [], { printedAtIso: '2026-11-12T21:00:00.000Z', shownWords: 'All.', todayYmd: '2026-11-12' })
    expect(html).toContain('<b>Tue, Nov 3</b> <span>3 bills · $17,730.00 · 1 of 3 paid · $6,480.00 still out</span>')
    expect(html).toContain('Paid Tue, Nov 10 · Check 4417 · bank deposit · in 7 days')
  })

  it('falls back to the bill’s status when the payments did not read', () => {
    const [line] = billsSentLines(input([copy({ id: 'p1', sourceId: BILL_B, jobIds: [JOB_B] })], { marks: new Map([['p1', { id: 'p1', lastEvent: 'delivered', lastEventAtIso: null, emailType: 'stripe_bill', paidOn: '2026-11-09', paidHow: null }]]) }))
    expect(line!.pay).toMatchObject({ kind: 'paid', paidOn: '2026-11-09', wayWords: '' })
    expect(billsSentPayWords(line!, '2026-11-12')).toMatchObject({ stamp: 'Paid Mon, Nov 9', way: '' })
    // A bill sent back to Ready to Bill owes nothing yet: no stamp.
    const [back] = billsSentLines(input([copy({})], { bills: new Map([[BILL_A, { id: BILL_A, jobId: JOB_A, amount: 4860, status: 'ready_to_bill' }]]) }))
    expect(back!.pay).toBeNull()
  })
})

describe('billsSent — a record made by hand (PR 6)', () => {
  const gap = { billId: BILL_A, jobId: JOB_A, jobWords: 'J1412 · Sable Ridge Lot 14' }
  const draft = { how: 'handed' as const, toWhom: ' Hal Jensen, on site ', wentOnYmd: '2026-11-09', note: ' With the permit card. ' }

  it('asks for what is missing, one thing at a time', () => {
    expect(byHandProblem({ ...draft, how: '' }, '2026-11-12')).toBe('Pick how the bill went.')
    expect(byHandProblem({ ...draft, toWhom: '  ' }, '2026-11-12')).toBe('Say who the bill went to.')
    expect(byHandProblem({ ...draft, wentOnYmd: '' }, '2026-11-12')).toBe('Pick the day the bill went.')
    expect(byHandProblem({ ...draft, wentOnYmd: '2026-11-13' }, '2026-11-12')).toBe('The day cannot be after today.')
    expect(byHandProblem(draft, '2026-11-12')).toBe('')
  })

  it('opens the day on the day the bill was made, with Today one press away (R1)', () => {
    // A bill weeks old opens on its own day, never on today's.
    expect(byHandDayOffered('2026-10-22', '2026-11-13')).toBe('2026-10-22')
    expect(byHandDayPicks('2026-10-22', '2026-11-13')).toEqual([
      { ymd: '2026-10-22', label: 'Thu, Oct 22 · the day it was billed', short: 'Thu, Oct 22 · billed' },
      { ymd: '2026-11-13', label: 'Today', short: 'Today' },
    ])
    // A bill made today has one day to offer.
    expect(byHandDayOffered('2026-11-13', '2026-11-13')).toBe('2026-11-13')
    expect(byHandDayPicks('2026-11-13', '2026-11-13')).toEqual([{ ymd: '2026-11-13', label: 'Today', short: 'Today' }])
    // A stamp that does not read, or one after today, leaves today.
    expect(byHandDayOffered('', '2026-11-13')).toBe('2026-11-13')
    expect(byHandDayOffered('2026-11-14', '2026-11-13')).toBe('2026-11-13')
    expect(byHandDayPicks('', '2026-11-13')).toEqual([{ ymd: '2026-11-13', label: 'Today', short: 'Today' }])
    expect(byHandDayPicks('2026-11-14', '2026-11-13')).toEqual([{ ymd: '2026-11-13', label: 'Today', short: 'Today' }])
  })

  it('offers the same person’s other bills, counts the press and words what took (R2)', () => {
    const g = (billId: string, payer: string) => ({ billId, jobId: null, jobWords: '', jobTo: null, payer, amount: 100, paid: false, billedWords: 'Billed.', billedYmd: '', haystack: '' })
    const all = [g('b1', 'Harlan Voss'), g('b2', ' harlan voss '), g('b3', 'Alder Court Homes'), g('b4', 'Harlan Voss'), g('b5', '')]
    // The same name, however it is cased or spaced, in the strip's order, without the form's own bill.
    expect(byHandOthers(all[0]!, all).map((x) => x.billId)).toEqual(['b2', 'b4'])
    expect(byHandOthers(all[2]!, all)).toEqual([])
    // A bill with no name is nobody's.
    expect(byHandOthers(all[4]!, all)).toEqual([])
    expect(byHandOthersHeading(1, 'Harlan Voss')).toBe('1 more bill to Harlan Voss has no send on record.')
    expect(byHandOthersHeading(2, 'Harlan Voss')).toBe('2 more bills to Harlan Voss have no send on record.')
    // The button counts what it will record.
    expect(byHandRecordLabel(1)).toBe('Record how it went')
    expect(byHandRecordLabel(3)).toBe('Record how 3 bills went')
    // A press keeps going past a bill that is refused, and says what took and what did not.
    expect(byHandOutcome(3, 0)).toEqual({ line: 'Recorded 3 bills.', head: null, tone: 'success' })
    expect(byHandOutcome(2, 1)).toEqual({ line: 'Recorded 2 bills. 1 did not record.', head: '1 bill did not record. It stays here with the reason.', tone: 'warning' })
    expect(byHandOutcome(0, 2)).toEqual({ line: 'Nothing recorded. 2 did not record.', head: '2 bills did not record. They stay here with the reason.', tone: 'error' })
  })

  it('reads the record back before the press: the day, the way, the person, the recorder (R3)', () => {
    expect(byHandReadBack(draft, '2026-11-13', ' Priya ')).toBe('Mon, Nov 9 · Handed over · to Hal Jensen, on site · recorded by hand by Priya on Fri, Nov 13.')
    // The way's words are the list's own, as the record will keep them.
    const ways = [{ id: 'w1', key: 'mailed', label: 'Mailed, first class', sentHow: 'mail' as const, sortOrder: 1, retiredAtIso: null, retiredByName: '', createdByName: '', createdAtIso: '' }]
    expect(byHandReadBack({ ...draft, how: 'mailed' }, '2026-11-13', 'Priya', ways)).toBe('Mon, Nov 9 · Mailed, first class · to Hal Jensen, on site · recorded by hand by Priya on Fri, Nov 13.')
    // A name that has not read yet is left out, never guessed.
    expect(byHandReadBack(draft, '2026-11-13', '')).toBe('Mon, Nov 9 · Handed over · to Hal Jensen, on site · recorded by hand on Fri, Nov 13.')
    // Nothing is read back while the form lacks something.
    expect(byHandReadBack({ ...draft, how: '' }, '2026-11-13', 'Priya')).toBe('')
    expect(byHandReadBack({ ...draft, toWhom: ' ' }, '2026-11-13', 'Priya')).toBe('')
    expect(byHandReadBack({ ...draft, wentOnYmd: '2026-11-14' }, '2026-11-13', 'Priya')).toBe('')
    expect(byHandReadBackLead(1)).toBe('The record will read:')
    expect(byHandReadBackLead(3)).toBe('Each record will read:')
  })

  it('files one sent copy with no addresses, the bill as its source and what was said', () => {
    expect(byHandFiling(gap, draft)).toEqual({
      kind: 'bill_by_hand',
      title: 'Bill · J1412 · Sable Ridge Lot 14 · Handed over, recorded by hand',
      how: 'hand',
      recipientName: 'Hal Jensen, on site',
      jobIds: [JOB_A],
      source: { table: 'jobs_ledger_invoices', id: BILL_A },
      sourceSnapshot: { by_hand: true, how: 'handed', how_label: 'Handed over', went_on: '2026-11-09', note: 'With the permit card.' },
    })
    expect(byHandFiling(gap, { ...draft, how: 'mailed' }).how).toBe('mail')
    expect(byHandFiling(gap, { ...draft, how: 'own_mailbox' }).sourceSnapshot).toMatchObject({ how: 'own_mailbox', how_label: 'Emailed from a person\u2019s own mailbox' })
    expect(byHandFiling(gap, { ...draft, how: 'own_mailbox' }).how).toBe('email')
    expect(byHandFiling(gap, { ...draft, how: 'housecall_pro' }).how).toBe('email')
  })

  it('files the way picked from the office\u2019s list: its code, its words and how it went', () => {
    const way = (key: string, label: string, sentHow: 'hand' | 'mail' | 'email' | 'other', retiredAtIso: string | null = null) => ({ id: `id-${key}`, key, label, sentHow, sortOrder: 1, retiredAtIso, retiredByName: '', createdByName: '', createdAtIso: null })
    const ways = [way('mailed', 'Mailed, first class', 'mail'), way('w_3f9a1c2e77', 'Uploaded to the builder\u2019s pay portal', 'other'), way('handed', 'Handed over', 'hand', '2026-11-13T16:00:00Z')]
    // A way the office typed is not by hand, by mail or by email.
    expect(byHandFiling(gap, { ...draft, how: 'w_3f9a1c2e77' }, ways)).toMatchObject({
      title: 'Bill · J1412 · Sable Ridge Lot 14 · Uploaded to the builder\u2019s pay portal, recorded by hand',
      how: 'other',
      sourceSnapshot: { how: 'w_3f9a1c2e77', how_label: 'Uploaded to the builder\u2019s pay portal' },
    })
    // A way the office renamed files the words it has today, under the code it always had.
    expect(byHandFiling(gap, { ...draft, how: 'mailed' }, ways)).toMatchObject({ how: 'mail', sourceSnapshot: { how: 'mailed', how_label: 'Mailed, first class' } })
    // A way taken off the list, or one the list never had, is no pick.
    expect(byHandProblem({ ...draft, how: 'handed' }, '2026-11-12', ways)).toBe('Pick how the bill went.')
    expect(byHandProblem({ ...draft, how: 'own_mailbox' }, '2026-11-12', ways)).toBe('Pick how the bill went.')
    expect(byHandProblem({ ...draft, how: 'mailed' }, '2026-11-12', ways)).toBe('')
  })

  it('reads the record as a line on the day it went, marked as someone\u2019s word, and closes the gap', () => {
    const record = copy({
      id: 'h1',
      kind: 'bill_by_hand',
      how: 'hand',
      title: 'Bill · J1412 · Sable Ridge Lot 14 · Handed over, recorded by hand',
      recipientName: 'Hal Jensen, on site',
      recipientEmails: [],
      copyPath: null,
      copyHash: '',
      sentAt: '2026-11-12T20:30:00.000Z',
      sentByName: 'Priya',
      sourceSnapshot: { by_hand: true, how: 'handed', went_on: '2026-11-09', note: 'With the permit card.' },
      resendEmailId: null,
    })
    const data = input([record], {
      unsent: [{ billId: BILL_A, jobId: JOB_A, amount: 4860, status: 'billed', billedAtIso: '2026-11-09T21:26:00.000Z' }],
      stamps: [{ billId: BILL_A, atIso: '2026-11-08T18:00:00.000Z', channel: 'housecallpro' }],
    })
    const lines = billsSentLines(data)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ id: 'h1', route: 'by_hand', routeWords: 'Handed over', dayOnly: true, toName: 'Hal Jensen, on site', toAddresses: [], by: 'Priya', copy: null, amount: 4860, counts: true, nth: 1 })
    expect(lines[0]!.note).toBe('Recorded by hand on Thu, Nov 12. The app sent nothing and kept no copy. With the permit card.')
    expect(billsSentDays(lines, '2026-11-12').map((d) => d.label)).toEqual(['Mon, Nov 9'])
    expect(billsSentGaps(data, lines)).toEqual({ open: [], paid: [] })
    expect(billsSentFilter(lines, 'by_hand', '').map((l) => l.id)).toEqual(['h1'])
  })

  it('reads a record with the words it was made with, whatever the list says now', () => {
    const made = (id: string, sourceSnapshot: Record<string, unknown>) => copy({ id, kind: 'bill_by_hand', how: 'mail', recipientName: 'Hal Jensen', recipientEmails: [], copyPath: null, sentByName: 'Priya', sourceSnapshot, resendEmailId: null })
    // The list's words for `mailed` are Mailed. This record was made when the way read otherwise, and says so still.
    const renamed = made('h1', { by_hand: true, how: 'mailed', how_label: ' Mailed, first class ', went_on: '2026-11-09', note: '' })
    // A way that is on no list now keeps its words too.
    const gone = made('h2', { by_hand: true, how: 'w_3f9a1c2e', how_label: 'Uploaded to the builder\u2019s pay portal', went_on: '2026-11-10', note: '' })
    // A record made before the words were kept reads the list's words for its code, and a code on no list the route's name.
    const older = made('h3', { by_hand: true, how: 'mailed', went_on: '2026-11-08', note: '' })
    const lost = made('h4', { by_hand: true, how: 'w_0000', how_label: '  ', went_on: '2026-11-07', note: '' })
    const lines = billsSentLines(input([renamed, gone, older, lost]))
    expect(lines.map((l) => [l.id, l.routeWords])).toEqual([
      ['h2', 'Uploaded to the builder\u2019s pay portal'],
      ['h1', 'Mailed, first class'],
      ['h3', 'Mailed'],
      ['h4', 'Recorded by hand'],
    ])
    // Every one is a record by hand, whatever its words, and the search and the spreadsheet read the same words.
    expect(lines.every((l) => l.route === 'by_hand')).toBe(true)
    expect(billsSentFilter(lines, 'all', 'pay portal').map((l) => l.id)).toEqual(['h2'])
    expect(billsSentCsv(lines)).toContain('"Mailed, first class"')
  })
})

describe('billsSentPhoneWords — a line in three rows', () => {
  it('names the work first and leaves the long bill number to the record', () => {
    const [line] = billsSentLines(input([copy({})]))
    expect(billsSentPhoneWords(line!)).toEqual({ main: 'J1412 · Sable Ridge Lot 14 · Sable Ridge Builders', to: 'To hal@sableridge.example', again: '' })
  })

  it('says which send it is, short, and the copy list with the address', () => {
    const first = copy({ id: 'c1', sentAt: '2026-11-03T22:41:00.000Z' })
    const second = copy({ id: 'c2', sentAt: '2026-11-12T17:02:00.000Z' })
    const rider = copy({ id: 'c9', kind: 'bill_copy', recipientName: '', recipientEmails: ['pm@sableridge.example'], sentAt: '2026-11-12T17:02:03.000Z' })
    const [line] = billsSentLines(input([second, rider, first]))
    expect(billsSentPhoneWords(line!)).toEqual({ main: 'J1412 · Sable Ridge Lot 14 · Sable Ridge Builders', to: 'To hal@sableridge.example, copy to pm@sableridge.example', again: '2nd send' })
  })

  it('names the paper when the line is not a bill\u2019s, and the person when there is no address', () => {
    const statement = copy({ id: 's1', kind: 'gc_statement', title: 'Statement for Ridgeway Builders', recipientName: 'Ridgeway Builders', recipientEmails: ['billing@ridgeway.example'], sourceTable: '', sourceId: null, jobIds: [], resendEmailId: 're_s' })
    const [s1] = billsSentLines(input([statement], { statements: new Map([['re_s', { resendEmailId: 're_s', total: 48210, jobCount: 12 }]]) }))
    expect(billsSentPhoneWords(s1!)).toEqual({ main: 'Statement · 12 jobs · Ridgeway Builders', to: 'To billing@ridgeway.example', again: '' })
    const byHand = copy({ id: 'h1', kind: 'bill_by_hand', how: 'hand', recipientName: 'Hal Jensen, on site', recipientEmails: [], copyPath: null, sourceSnapshot: { how: 'handed', went_on: '2026-11-09' } })
    expect(billsSentPhoneWords(billsSentLines(input([byHand]))[0]!)).toMatchObject({ main: 'J1412 · Sable Ridge Lot 14 · Sable Ridge Builders', to: 'To Hal Jensen, on site' })
    // A Housecall Pro day has nobody to name.
    const [stamp] = billsSentLines(input([], { stamps: [{ billId: BILL_B, atIso: '2026-11-11T18:00:00.000Z', channel: 'housecallpro' }] }))
    expect(billsSentPhoneWords(stamp!)).toEqual({ main: 'J1398 · Larkfield Clinic · Larkfield Construction', to: '', again: '' })
  })
})
