import { describe, expect, it } from 'vitest'
import {
  BILLS_PAID_CSV_HEAD,
  billsPaidCellCount,
  billsPaidCellCredit,
  billsPaidCellLabel,
  billsPaidCellMoney,
  billsPaidChips,
  billsPaidCsv,
  billsPaidCsvFileName,
  billsPaidDayGroups,
  billsPaidDayHeading,
  billsPaidEmptyDay,
  billsPaidFilter,
  billsPaidGroupWords,
  billsPaidHowOf,
  billsPaidLines,
  billsPaidMonthCells,
  billsPaidMonthHtml,
  billsPaidMonthLabel,
  billsPaidMonthName,
  billsPaidMonthOf,
  billsPaidMonthSpan,
  billsPaidOpeningDay,
  billsPaidPayoutOf,
  billsPaidPayoutWords,
  billsPaidRange,
  billsPaidShiftMonth,
  billsPaidStepLabel,
  billsPaidSum,
  billsPaidTiles,
  billsPaidTime,
  billsPaidTookWords,
  isBillsPaidChip,
  type BillsPaidBill,
  type BillsPaidInput,
  type BillsPaidPayment,
} from './billsPaidDays'

// Made-up data throughout: no live bill, job, customer, check number or amount.
const B = (n: number) => `bbbbbbbb-0000-4000-8000-00000000000${n}`
const J = (n: number) => `aaaaaaaa-0000-4000-8000-00000000000${n}`

const payment = (over: Partial<BillsPaidPayment>): BillsPaidPayment => ({
  id: 'p1',
  billId: B(1),
  jobId: J(1),
  amount: 2480,
  paidOn: '2026-11-18',
  createdAtIso: '2026-11-18T15:14:00.000Z',
  paymentType: null,
  note: null,
  referenceNumber: null,
  bankTransactionId: null,
  stripeCreditNoteId: null,
  ...over,
})
const bill = (n: number, over: Partial<BillsPaidBill> = {}): BillsPaidBill => ({ id: B(n), jobId: J(n), amount: 2480, status: 'paid', billedAtIso: '2026-11-16T15:00:00.000Z', ...over })

const input = (payments: BillsPaidPayment[], over: Partial<BillsPaidInput> = {}): BillsPaidInput => ({
  payments,
  bills: new Map([
    [B(1), bill(1, { stripeInvoiceId: 'in_made_up', stripeInvoiceStatus: 'paid', externalSendChannel: 'stripe' })],
    [B(2), bill(2)],
    [B(3), bill(3)],
    [B(4), bill(4, { status: 'billed' })],
    [B(5), bill(5, { stripeMode: 'test' })],
  ]),
  jobs: new Map([
    [J(1), { id: J(1), hcp_number: '1420', click_number: null, job_name: 'Marlow kitchen rough', customer_name: 'Elena Marlow' }],
    [J(2), { id: J(2), hcp_number: '1412', click_number: null, job_name: 'Sable Ridge Lot 3 finish', customer_name: 'Sable Ridge Builders' }],
    [J(3), { id: J(3), hcp_number: '1409', click_number: null, job_name: 'Sable Ridge Lot 2 finish', customer_name: 'Sable Ridge Builders' }],
    [J(4), { id: J(4), hcp_number: '1431', click_number: null, job_name: 'Hollis Dental fit-out', customer_name: 'Hollis Dental Group' }],
  ]),
  numbers: new Map([
    [B(1), '1420-0001'],
    [B(2), '1412-0002'],
  ]),
  firstSent: new Map([
    [B(1), '2026-11-16T15:14:00.000Z'],
    [B(2), '2026-11-10T16:20:00.000Z'],
  ]),
  ...over,
})

// One month: a Stripe payment on the 18th, one check that paid two bills on the 20th, a part payment and a
// credit in kind on the 23rd, a payment on a test-mode bill, and cash on a job with no bill named.
const month = input([
  payment({ id: 's1', note: 'Stripe', paidOn: '2026-11-18', createdAtIso: '2026-11-18T15:14:00.000Z' }),
  payment({ id: 'c1', billId: B(2), jobId: J(2), amount: 4410, paidOn: '2026-11-20', paymentType: 'checkDeposit', referenceNumber: '4417', bankTransactionId: 'dep-f' }),
  payment({ id: 'c2', billId: B(3), jobId: J(3), amount: 2260, paidOn: '2026-11-20', paymentType: 'checkDeposit', referenceNumber: '4417', bankTransactionId: 'dep-f' }),
  payment({ id: 'h1', billId: B(4), jobId: J(4), amount: 1500, paidOn: '2026-11-23', paymentType: 'Check', referenceNumber: '2291' }),
  payment({ id: 'k1', billId: B(3), jobId: J(3), amount: 900, paidOn: '2026-11-23', paymentType: 'In kind', note: 'Rent credit' }),
  payment({ id: 't1', billId: B(5), jobId: null, amount: 50, paidOn: '2026-11-19', note: 'Stripe' }),
  payment({ id: 'n1', billId: null, jobId: J(4), amount: 385, paidOn: '2026-11-06', paymentType: 'Cash' }),
])
const lines = billsPaidLines(month)

describe('billsPaidHowOf', () => {
  it('sorts a payment by how the money came', () => {
    expect(billsPaidHowOf({ note: 'Stripe', paymentType: null, bankTransactionId: null })).toBe('stripe')
    expect(billsPaidHowOf({ note: null, paymentType: 'checkDeposit', bankTransactionId: 'm1' })).toBe('check')
    expect(billsPaidHowOf({ note: null, paymentType: 'Cheque', bankTransactionId: null })).toBe('check')
    expect(billsPaidHowOf({ note: null, paymentType: 'Cash', bankTransactionId: null })).toBe('cash')
    // A matched deposit that is no check is a transfer, and so is a wire or an ACH someone typed.
    expect(billsPaidHowOf({ note: null, paymentType: 'other', bankTransactionId: 'm1' })).toBe('bank')
    expect(billsPaidHowOf({ note: null, paymentType: 'Wire', bankTransactionId: null })).toBe('bank')
    expect(billsPaidHowOf({ note: null, paymentType: 'ACH', bankTransactionId: null })).toBe('bank')
    expect(billsPaidHowOf({ note: null, paymentType: 'Card (external)', bankTransactionId: null })).toBe('other')
    expect(billsPaidHowOf({ note: 'Rent credit', paymentType: 'In kind', bankTransactionId: null })).toBe('other')
  })
  it('knows its chips', () => {
    expect(['all', 'stripe', 'check', 'bank', 'cash', 'other'].every(isBillsPaidChip)).toBe(true)
    expect([null, undefined, '', 'card', 'paid'].some(isBillsPaidChip)).toBe(false)
  })
})

describe('billsPaidLines', () => {
  it('draws each payment on its day, newest day first, and leaves out a test-mode bill', () => {
    expect(lines.map((l) => [l.id, l.ymd, l.how])).toEqual([
      ['h1', '2026-11-23', 'check'],
      ['k1', '2026-11-23', 'other'],
      ['c1', '2026-11-20', 'check'],
      ['c2', '2026-11-20', 'check'],
      ['s1', '2026-11-18', 'stripe'],
      ['n1', '2026-11-06', 'cash'],
    ])
  })
  it('words a Stripe payment with its bill, its job, who paid, its time and how long the money took', () => {
    const stripe = lines.find((l) => l.id === 's1')!
    expect(stripe).toMatchObject({ what: 'Bill 1420-0001', jobWords: 'J1420 · Marlow kitchen rough', jobTo: `/jobs?edit=${J(1)}`, payer: 'Elena Marlow', wayWords: 'Card · Stripe', amount: 2480, sentYmd: '2026-11-16', took: 2, inKind: false, partOfBill: false })
    // 9:14 AM Central.
    expect(billsPaidTime(stripe)).toBe('9:14 AM')
    expect(billsPaidTookWords(stripe)).toBe('2 days after it went')
  })
  it('says a check with its number, and no time: its row is written when the office gets to it', () => {
    const check = lines.find((l) => l.id === 'c1')!
    expect(check).toMatchObject({ wayWords: 'Check 4417 · bank deposit', reference: '4417', depositId: 'dep-f', atIso: null, took: 10 })
    expect(billsPaidTime(check)).toBe('')
  })
  it('falls back to the bill’s own stamp for the day it went, and says nothing when there is none', () => {
    // Bill 3 has no sent copy: the day it was made stands in.
    expect(lines.find((l) => l.id === 'c2')).toMatchObject({ what: 'Bill', sentYmd: '2026-11-16', took: 4 })
    const none = billsPaidLines(input([payment({})], { bills: new Map([[B(1), bill(1, { billedAtIso: null })]]), firstSent: new Map() }))[0]!
    expect(none).toMatchObject({ sentYmd: '', took: null })
    expect(billsPaidTookWords(none)).toBe('')
    expect(billsPaidTookWords({ took: 0 })).toBe('the same day')
    expect(billsPaidTookWords({ took: 1 })).toBe('1 day after it went')
  })
  it('marks a payment that is part of a bill still open, and a credit in kind', () => {
    expect(lines.find((l) => l.id === 'h1')).toMatchObject({ partOfBill: true, wayWords: 'Check 2291 · typed by hand' })
    // A payment that covers its billed bill alone is not part of it: nothing is left out.
    const whole = billsPaidLines(input([payment({ id: 'w1', billId: B(4), jobId: J(4), amount: 2480, paymentType: 'Check' })]))
    expect(whole[0]).toMatchObject({ partOfBill: false })
    expect(lines.find((l) => l.id === 'k1')).toMatchObject({ inKind: true, wayWords: 'In kind · typed by hand' })
  })
  it('lists money on a job with no bill named', () => {
    expect(lines.find((l) => l.id === 'n1')).toMatchObject({ what: 'Payment', billId: null, jobWords: 'J1431 · Hollis Dental fit-out', payer: 'Hollis Dental Group', partOfBill: false })
    // A bill names who it went to, from its sent copy, over the job's customer: a builder pays for a homeowner's job.
    const billed = billsPaidLines(input([payment({ id: 's1', note: 'Stripe' }), payment({ id: 'n1', billId: null, jobId: J(4), amount: 385, paymentType: 'Cash' })], { sentTo: new Map([[B(1), ' Sable Ridge Builders ']]) }))
    expect(billed.find((l) => l.id === 's1')!.payer).toBe('Sable Ridge Builders')
    // A payment with no bill, and a bill with no named send, keep the job's customer.
    expect(billed.find((l) => l.id === 'n1')!.payer).toBe('Hollis Dental Group')
    expect(billsPaidLines(input([payment({ id: 's1', note: 'Stripe' })], { sentTo: new Map() }))[0]!.payer).toBe('Elena Marlow')
  })
  it('puts a Stripe payment first in its day, newest first, and keeps one deposit’s payments together', () => {
    const day = billsPaidLines(
      input([
        payment({ id: 'a', billId: B(2), jobId: J(2), paymentType: 'checkDeposit', bankTransactionId: 'dep-b' }),
        payment({ id: 'b', billId: B(3), jobId: J(3), paymentType: 'checkDeposit', bankTransactionId: 'dep-a' }),
        payment({ id: 'c', note: 'Stripe', createdAtIso: '2026-11-18T15:00:00.000Z' }),
        payment({ id: 'd', billId: B(2), jobId: J(2), paymentType: 'checkDeposit', bankTransactionId: 'dep-a' }),
        payment({ id: 'e', note: 'Stripe', createdAtIso: '2026-11-18T20:00:00.000Z' }),
      ]),
    )
    expect(day.map((l) => l.id)).toEqual(['e', 'c', 'b', 'd', 'a'])
  })
  it('leaves out a payment with no day and one with nothing to add', () => {
    expect(billsPaidLines(input([payment({ paidOn: null, createdAtIso: null }), payment({ id: 'z', amount: 0 })]))).toEqual([])
  })
})

describe('billsPaid — sums, chips and tiles', () => {
  it('adds money and never a credit in kind', () => {
    expect(billsPaidSum(lines)).toEqual({ payments: 5, total: 11035 })
    expect(billsPaidSum(lines.filter((l) => l.ymd === '2026-11-23'))).toEqual({ payments: 1, total: 1500 })
    expect(billsPaidSum([])).toEqual({ payments: 0, total: 0 })
  })
  it('narrows to one way, and offers every way some payment came by, Stripe always', () => {
    expect(billsPaidFilter(lines, 'stripe').map((l) => l.id)).toEqual(['s1'])
    expect(billsPaidFilter(lines, 'all')).toHaveLength(6)
    expect(billsPaidChips(lines).map((c) => c.label)).toEqual(['All', 'Stripe', 'Check', 'Cash', 'Other'])
    expect(billsPaidChips([]).map((c) => c.key)).toEqual(['all', 'stripe'])
  })
  it('sums today, the week that began on Sunday, and the month', () => {
    // Mon, Nov 23: the week began Sun, Nov 22.
    expect(billsPaidTiles(lines, '2026-11', '2026-11-23')).toEqual({ today: { payments: 1, total: 1500 }, week: { payments: 1, total: 1500 }, month: { payments: 5, total: 11035 } })
    // Sat, Nov 21: the week of Nov 15 holds the 18th and the 20th.
    expect(billsPaidTiles(lines, '2026-11', '2026-11-21').week).toEqual({ payments: 3, total: 9150 })
    // A month that is not this one has no today and no week.
    expect(billsPaidTiles(lines, '2026-10', '2026-11-23')).toEqual({ today: null, week: null, month: { payments: 0, total: 0 } })
  })
})

describe('billsPaid — the month', () => {
  it('names and steps months', () => {
    expect(billsPaidMonthOf('2026-11-18')).toBe('2026-11')
    expect(billsPaidMonthOf('2026-11')).toBe('2026-11')
    expect([billsPaidMonthOf(''), billsPaidMonthOf(null), billsPaidMonthOf('2026-13'), billsPaidMonthOf('Nov')]).toEqual(['', '', '', ''])
    expect(billsPaidMonthLabel('2026-11')).toBe('November 2026')
    expect(billsPaidMonthName('2026-02')).toBe('February')
    expect(billsPaidShiftMonth('2026-01', -1)).toBe('2025-12')
    expect(billsPaidShiftMonth('2026-12', 1)).toBe('2027-01')
    // A step's words: the month it opens, short, with the year only when the step leaves this one.
    expect(billsPaidStepLabel('2026-11', -1)).toBe('Oct')
    expect(billsPaidStepLabel('2026-11', 1)).toBe('Dec')
    expect(billsPaidStepLabel('2026-01', -1)).toBe('Dec 2025')
    expect(billsPaidStepLabel('2026-12', 1)).toBe('Jan 2027')
    expect(billsPaidStepLabel('nope', 1)).toBe('')
    expect(billsPaidMonthSpan('2026-11')).toEqual({ first: '2026-11-01', last: '2026-11-30' })
    expect(billsPaidMonthSpan('2028-02').last).toBe('2028-02-29')
  })
  it('reads this month back to the Sunday that began this week, and any other month whole', () => {
    // Tue, Dec 1, 2026: the week began Sun, Nov 29.
    expect(billsPaidRange('2026-12', '2026-12-01')).toEqual({ from: '2026-11-29', to: '2026-12-31' })
    expect(billsPaidRange('2026-11', '2026-11-23')).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(billsPaidRange('2026-10', '2026-11-23')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
  })
  it('lays the month on a grid whose weeks begin on Sunday', () => {
    const grid = billsPaidMonthCells(lines, '2026-11', '2026-11-23')
    // Nov 1, 2026 is a Sunday.
    expect(grid.blanks).toBe(0)
    expect(grid.cells).toHaveLength(30)
    expect(grid.cells[17]).toEqual({ ymd: '2026-11-18', day: 18, sum: { payments: 1, total: 2480 }, today: false, later: false, credits: 0 })
    expect(grid.cells[19]!.sum).toEqual({ payments: 2, total: 6670 })
    expect(grid.cells[22]).toMatchObject({ day: 23, today: true, later: false, sum: { payments: 1, total: 1500 } })
    expect(grid.cells[23]).toMatchObject({ day: 24, later: true })
    // Dec 1, 2026 is a Tuesday: two blanks before it.
    expect(billsPaidMonthCells([], '2026-12', '2026-11-23').blanks).toBe(2)
    expect(billsPaidMonthCells([], 'nope', '2026-11-23')).toEqual({ blanks: 0, cells: [] })
  })
  it('opens this month on today, and an older month on the newest day money came', () => {
    expect(billsPaidOpeningDay(lines, '2026-11', '2026-11-23')).toBe('2026-11-23')
    expect(billsPaidOpeningDay(lines, '2026-11', '2026-12-04')).toBe('2026-11-23')
    // A credit in kind is no money: it does not pick the day.
    expect(billsPaidOpeningDay(lines.filter((l) => l.id !== 'h1'), '2026-11', '2026-12-04')).toBe('2026-11-20')
    expect(billsPaidOpeningDay([], '2026-10', '2026-11-23')).toBe('2026-10-31')
  })
  it('writes a day’s amount to fit its cell, and says the day whole to a screen reader', () => {
    expect([640, 5825, 7935.4, 9999, 10175, 13035, 104000].map((n) => billsPaidCellMoney(n, false))).toEqual(['$640', '$5,825', '$7,935', '$9,999', '$10.2k', '$13k', '$104k'])
    expect([640, 980, 5825, 6040, 9949, 9960, 10175, 13035, 104000].map((n) => billsPaidCellMoney(n, true))).toEqual(['$640', '$980', '$5.8k', '$6k', '$9.9k', '$10k', '$10k', '$13k', '$104k'])
    expect(billsPaidCellCount({ payments: 3 })).toBe('3 paid')
    expect(billsPaidCellLabel({ ymd: '2026-11-20', sum: { payments: 2, total: 6670 } })).toBe('Fri, Nov 20, $6,670.00, 2 payments')
    expect(billsPaidCellLabel({ ymd: '2026-11-19', sum: { payments: 0, total: 0 } })).toBe('Thu, Nov 19, nothing came in')
    // A day with a credit in kind and no money is marked, in the cell and for a screen reader.
    expect(billsPaidCellCredit({ sum: { payments: 0, total: 0 }, credits: 1 })).toBe('1 credit')
    expect(billsPaidCellCredit({ sum: { payments: 0, total: 0 }, credits: 2 })).toBe('2 credits')
    expect(billsPaidCellCredit({ sum: { payments: 1, total: 1500 }, credits: 1 })).toBe('')
    expect(billsPaidCellCredit({ sum: { payments: 0, total: 0 } })).toBe('')
    expect(billsPaidCellLabel({ ymd: '2026-11-19', sum: { payments: 0, total: 0 }, credits: 1 })).toBe('Thu, Nov 19, 1 credit in kind, not added')
    // The month's own cells count them: the 23rd holds a check and a credit, and a day alone with a credit is marked.
    expect(billsPaidMonthCells(lines, '2026-11', '2026-11-30').cells.find((c) => c.day === 23)).toMatchObject({ credits: 1, sum: { payments: 1 } })
    const creditOnly = billsPaidMonthCells(lines.filter((l) => l.inKind), '2026-11', '2026-11-30').cells.find((c) => c.day === 23)!
    expect([creditOnly.sum.payments, billsPaidCellCredit(creditOnly)]).toEqual([0, '1 credit'])
  })
})

describe('billsPaid — the next payout', () => {
  it('tells a payout on its way from none, and from no answer', () => {
    expect(billsPaidPayoutOf({ nextPayout: { usd: 2980.37, arrivalYmd: '2026-11-25' } }, false)).toEqual({ state: 'coming', usd: 2980.37, arrivalYmd: '2026-11-25' })
    expect(billsPaidPayoutOf({ nextPayout: { usd: 12 } }, false)).toEqual({ state: 'coming', usd: 12, arrivalYmd: null })
    // Stripe answered, and nothing is on its way.
    expect(billsPaidPayoutOf({ nextPayout: null }, false)).toEqual({ state: 'none' })
    expect(billsPaidPayoutOf({ nextPayout: { usd: 0 } }, false)).toEqual({ state: 'none' })
    // No answer: the call failed, the function refused, or the body is not one.
    expect(billsPaidPayoutOf({ nextPayout: { usd: 50 } }, true)).toEqual({ state: 'unread' })
    expect(billsPaidPayoutOf({ error: 'Forbidden' }, false)).toEqual({ state: 'unread' })
    expect(billsPaidPayoutOf(null, false)).toEqual({ state: 'unread' })
  })
  it('words the tile when no payout is coming', () => {
    expect(billsPaidPayoutWords({ state: 'none' })).toBe('None on its way')
    expect(billsPaidPayoutWords({ state: 'unread' })).toBe('Stripe did not answer')
    expect(billsPaidPayoutWords({ state: 'coming', usd: 5, arrivalYmd: null })).toBe('')
  })
})

describe('billsPaid — a day', () => {
  it('draws one deposit that paid two bills once, with its bills under it', () => {
    const groups = billsPaidDayGroups(lines.filter((l) => l.ymd === '2026-11-20'))
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ depositId: 'dep-f', total: 6670, checkWords: 'Check 4417' })
    expect(billsPaidGroupWords(groups[0]!)).toBe('One deposit · Check 4417 · 2 bills')
  })
  it('gives a payment that stands alone no heading, and names no check for a transfer', () => {
    const alone = billsPaidDayGroups(lines.filter((l) => l.ymd === '2026-11-23'))
    expect(alone.map((g) => [g.lines.length, billsPaidGroupWords(g)])).toEqual([
      [1, ''],
      [1, ''],
    ])
    const transfer = billsPaidDayGroups(
      billsPaidLines(
        input([
          payment({ id: 'a', billId: B(2), jobId: J(2), paymentType: 'other', bankTransactionId: 'dep-b' }),
          payment({ id: 'b', billId: B(3), jobId: J(3), paymentType: 'other', bankTransactionId: 'dep-b' }),
        ]),
      ),
    )
    expect(billsPaidGroupWords(transfer[0]!)).toBe('One deposit · 2 bills')
    // A check deposit whose reference is the bank match's own id names no number, on the heading or on a line.
    const matched = billsPaidDayGroups(
      billsPaidLines(
        input([
          payment({ id: 'a', billId: B(2), jobId: J(2), paymentType: 'checkDeposit', referenceNumber: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', bankTransactionId: 'dep-c' }),
          payment({ id: 'b', billId: B(3), jobId: J(3), paymentType: 'checkDeposit', referenceNumber: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', bankTransactionId: 'dep-c' }),
        ]),
      ),
    )
    expect(billsPaidGroupWords(matched[0]!)).toBe('One deposit · 2 bills')
    expect(matched[0]!.lines.map((l) => l.wayWords)).toEqual(['Check · bank deposit', 'Check · bank deposit'])
  })
  it('heads a day, and says an empty one with the press that leads out of it', () => {
    expect(billsPaidDayHeading('2026-11-23', '2026-11-23')).toBe('Today · Mon, Nov 23')
    expect(billsPaidDayHeading('2026-11-18', '2026-11-23')).toBe('Wed, Nov 18')
    // The chip hid what came in: offer every way.
    expect(billsPaidEmptyDay({ ymd: '2026-11-20', how: 'stripe', everyWay: 2, todayYmd: '2026-11-23' })).toEqual({ main: 'Nothing came in from Stripe on Fri, Nov 20.', next: 'Show every way that day' })
    // Nothing came in any way: offer today.
    expect(billsPaidEmptyDay({ ymd: '2026-11-19', how: 'all', everyWay: 0, todayYmd: '2026-11-23' })).toEqual({ main: 'Nothing came in on Thu, Nov 19.', next: 'Go to today' })
    expect(billsPaidEmptyDay({ ymd: '2026-11-19', how: 'check', everyWay: 0, todayYmd: '2026-11-23' })).toEqual({ main: 'Nothing came in by check on Thu, Nov 19.', next: 'Go to today' })
    // Today itself: nowhere better to send the reader.
    expect(billsPaidEmptyDay({ ymd: '2026-11-23', how: 'all', everyWay: 0, todayYmd: '2026-11-23' }).next).toBe('')
  })
})

describe('billsPaid — out of the app', () => {
  it('writes one row a payment, with a letter the payments of one deposit share', () => {
    const rows = billsPaidCsv(lines).trimEnd().split('\r\n')
    expect(rows[0]).toBe(BILLS_PAID_CSV_HEAD.join(','))
    expect(rows).toHaveLength(7)
    expect(rows[1]).toBe('2026-11-23,,Bill,J1431 · Hollis Dental fit-out,Hollis Dental Group,1500.00,yes,Check 2291 · typed by hand,,2026-11-16,7,yes')
    // A credit in kind is listed and is in no day's total.
    expect(rows[2]).toContain(',900.00,no,In kind · typed by hand,')
    expect(rows[3]).toBe('2026-11-20,,Bill 1412-0002,J1412 · Sable Ridge Lot 3 finish,Sable Ridge Builders,4410.00,yes,Check 4417 · bank deposit,2026-11-20 A,2026-11-10,10,no')
    expect(rows[4]).toContain(',2260.00,yes,Check 4417 · bank deposit,2026-11-20 A,')
    expect(rows[5]).toBe('2026-11-18,9:14 AM,Bill 1420-0001,J1420 · Marlow kitchen rough,Elena Marlow,2480.00,yes,Card · Stripe,,2026-11-16,2,no')
    expect(billsPaidCsvFileName('2026-11', 'all')).toBe('bills-paid-2026-11.csv')
    expect(billsPaidCsvFileName('2026-11', 'stripe')).toBe('bills-paid-2026-11-stripe.csv')
  })
  it('prints the month a day at a time, and says so when nothing came in', () => {
    const html = billsPaidMonthHtml(lines, { month: '2026-11', how: 'all', printedAtIso: '2026-11-23T21:00:00.000Z' })
    expect(html).toContain('<h1>Bills paid · November 2026</h1>')
    expect(html).toContain('All. 5 payments, $11,035.00. Newest day first.')
    expect(html).toContain('<b>Fri, Nov 20</b> <span>2 payments</span></td><td class="amt">$6,670.00</td>')
    expect(html).toContain('<b>Bill 1420-0001</b> · J1420 · Marlow kitchen rough · Elena Marlow<br>Card · Stripe · paid 9:14 AM · sent Mon, Nov 16 · 2 days after it went')
    expect(html).toContain('in kind, not added')
    expect(html).toContain('part of the bill')
    expect(html).toContain('Printed Mon, Nov 23 · 3:00 PM.')
    // The month's grid leads the page: a week a row from Sunday, a day money came with its figure to the cent.
    const cal = html.slice(html.indexOf('<table class="cal">'), html.indexOf('</table>') + 8)
    expect(html.indexOf('<table class="cal">')).toBeGreaterThan(html.indexOf('Newest day first.'))
    expect(html.indexOf('<table class="cal">')).toBeLessThan(html.indexOf('<tr class="day">'))
    expect(cal).toContain('<th>Sun</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th>')
    // November 2026 begins on a Sunday and runs five weeks, the last one filled out to Saturday.
    expect(cal.match(/<tr>/g)?.length).toBe(6)
    expect(cal.match(/<td /g)?.length).toBe(35)
    expect(cal.match(/class="blank"/g)?.length).toBe(5)
    expect(cal).toContain('<td class="in"><i>20</i><b>$6,670.00</b><span>2 paid</span></td>')
    // A day with nothing is a number alone, and a day after the print is marked as not come.
    expect(cal).toContain('<td class="none"><i>21</i></td>')
    expect(cal).toContain('<td class="later"><i>24</i></td>')
    // A day that holds a credit and no money says so in its cell.
    const credits = billsPaidMonthHtml(lines.filter((l) => l.inKind || l.ymd === '2026-11-18'), { month: '2026-11', how: 'all', printedAtIso: '2026-11-23T21:00:00.000Z' })
    expect(credits).toContain('<td class="none"><i>23</i><span>1 credit</span></td>')
    const none = billsPaidMonthHtml(billsPaidFilter(lines, 'bank'), { month: '2026-11', how: 'bank', printedAtIso: '2026-11-23T21:00:00.000Z' })
    expect(none).toContain('Nothing came in by bank transfer in November 2026.')
    expect(none).not.toContain('<table class="cal">')
  })
})
