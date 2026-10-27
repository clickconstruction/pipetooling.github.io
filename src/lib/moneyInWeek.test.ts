import { describe, expect, it } from 'vitest'
import {
  addBusinessDays,
  buildMoneyInWeek,
  dayColumnLabel,
  dayWord,
  isCustomerDeposit,
  penAppliesTo,
  penContextLine,
  penQuickDays,
  weekMondayContaining,
  type MoneyInDeposit,
  type MoneyInPayment,
  type MoneyInReturn,
  type MoneyInRow,
  type MoneyInUnlinkedPayment,
  type MoneyInWeekInput,
  type MoneyInWeekView,
} from './moneyInWeek'
import type { CollectBillRead } from './bridge/collect/collectPile'
import type { PaidClaim } from './jobs/paidClaims'

// Monday, the mock-up's day: the carry is the story.
const TODAY = '2026-10-26'

const payment = (over: Partial<MoneyInPayment> & { paymentId: string }): MoneyInPayment => ({
  jobId: null,
  usd: 100,
  paidOnYmd: TODAY,
  paymentType: 'Check',
  note: null,
  referenceNumber: null,
  payerName: 'Ridgeway Builders',
  bankTransactionId: null,
  ...over,
})

const unlinked = (over: Partial<MoneyInUnlinkedPayment> & { paymentId: string }): MoneyInUnlinkedPayment => ({
  jobId: null,
  usd: 7250,
  paidOnYmd: '2026-10-23',
  paymentType: 'Check',
  referenceNumber: '4471',
  payerName: 'Cedar Ridge Builders',
  ...over,
})

const deposit = (over: Partial<MoneyInDeposit> & { mercuryTransactionId: string }): MoneyInDeposit => ({
  usd: 4980,
  kind: 'checkDeposit',
  counterpartyName: null,
  state: 'pending',
  dayYmd: '2026-10-23',
  ...over,
})

const bill = (over: Partial<CollectBillRead> & { key: string }): CollectBillRead => ({
  jobId: `job-${over.key}`,
  payerId: 'c1',
  payerName: 'Barton Creek Builders',
  billedYmd: '2026-10-12',
  usd: 12400,
  state: 'notdue',
  isGc: false,
  gcByRecord: false,
  paceDays: 14,
  paceSource: 'own',
  paceSamples: 4,
  expectedYmd: '2026-10-30',
  daysPastExpected: null,
  ageDays: 14,
  promise: null,
  ...over,
})

const claim = (over: Partial<PaidClaim> & { id: string; jobId: string }): PaidClaim => ({
  jobNumber: '1291',
  jobName: 'Westlake pool house',
  jobStatus: 'billed',
  bidId: null,
  customerId: 'c9',
  customerName: 'Westlake Custom Pools',
  payerCustomerId: 'c9',
  paidYmd: '2026-10-22',
  method: 'check_mailed',
  amount: null,
  saidBy: null,
  heardById: null,
  heardByName: 'Taunya',
  channel: 'phone',
  note: null,
  createdAt: '2026-10-22T15:00:00Z',
  landedSince: 0,
  landedOn: null,
  ...over,
})

const returned = (over: Partial<MoneyInReturn> & { id: string }): MoneyInReturn => ({
  payerName: 'Hill Country Electric',
  usd: 3150,
  cameBackYmd: '2026-10-22',
  chip: 'came back · Insufficient funds',
  livePaymentIds: [],
  jobId: null,
  ...over,
})

const input = (over: Partial<MoneyInWeekInput>): MoneyInWeekInput => ({
  payments: [],
  unlinked: [],
  deposits: [],
  linkedDeposits: new Map(),
  returns: [],
  unbankedCount: 0,
  pile: [],
  claims: null,
  stripeOpenInvoiceIds: new Set<string>(),
  payout: null,
  todayYmd: TODAY,
  ...over,
})

const allRows = (v: MoneyInWeekView): MoneyInRow[] => v.days.flatMap((d) => d.rows)
const day = (v: MoneyInWeekView, ymd: string) => v.days.find((d) => d.ymd === ymd)!

describe('week math', () => {
  it('finds the Monday of a week from any day in it', () => {
    expect(weekMondayContaining('2026-10-26')).toBe('2026-10-26')
    expect(weekMondayContaining('2026-10-28')).toBe('2026-10-26')
    expect(weekMondayContaining('2026-11-01')).toBe('2026-10-26')
    expect(weekMondayContaining('2026-10-25')).toBe('2026-10-19')
  })
  it('says today, a weekday word two weeks around, a date beyond', () => {
    expect(dayWord('2026-10-26', TODAY)).toBe('today')
    expect(dayWord('2026-10-28', TODAY)).toBe('Wed')
    expect(dayWord('2026-10-23', TODAY)).toBe('Fri')
    expect(dayWord('2026-10-12', TODAY)).toBe('Oct 12')
    expect(dayColumnLabel('2026-10-26')).toBe('Mon 26')
  })
  it('counts bank days past a weekend', () => {
    expect(addBusinessDays('2026-10-23', 2)).toBe('2026-10-27') // Fri → Tue
    expect(addBusinessDays('2026-10-26', 2)).toBe('2026-10-28') // Mon → Wed
  })
})

describe('the mock-up week', () => {
  // Every row of to-dos/money-in-this-week/mockup.html, made-up names and all.
  const view = buildMoneyInWeek(
    input({
      payments: [
        payment({ paymentId: 'p-ridgeway', jobId: 'j-ridgeway', usd: 9800, note: 'Stripe', paymentType: null }),
        payment({ paymentId: 'p-lakeside', jobId: 'j-lakeside', usd: 6240, paidOnYmd: '2026-10-23', referenceNumber: '4417', payerName: 'Lakeside Commons', bankTransactionId: 'm-lakeside' }),
        payment({ paymentId: 'p-hill', jobId: 'j-hill', usd: 3150, paidOnYmd: '2026-10-19', payerName: 'Hill Country Electric', bankTransactionId: 'm-hill' }),
      ],
      linkedDeposits: new Map([
        ['m-lakeside', { postedYmd: '2026-10-26', kind: 'checkDeposit' }],
        ['m-hill', { postedYmd: '2026-10-20', kind: 'checkDeposit' }],
      ]),
      unlinked: [
        unlinked({ paymentId: 'u-cedar', jobId: 'j-cedar' }),
        unlinked({ paymentId: 'u-pecan', jobId: 'j-pecan', usd: 2100, paidOnYmd: '2026-10-24', referenceNumber: '1182', payerName: 'Pecan Valley HOA' }),
        unlinked({ paymentId: 'u-alamo', jobId: 'j-alamo', usd: 4980, paidOnYmd: '2026-10-23', referenceNumber: '3310', payerName: 'Alamo Heights Remodel' }),
      ],
      deposits: [deposit({ mercuryTransactionId: 'm-alamo' })],
      returns: [returned({ id: 'r-hill', livePaymentIds: ['p-hill'], jobId: 'j-hill' })],
      claims: [claim({ id: 'cl-westlake', jobId: 'j-westlake' })],
      pile: [
        bill({ key: 'inv:riverbend', payerName: 'Riverbend Office Park', usd: 6300, expectedYmd: '2026-10-27' }),
        bill({ key: 'inv:westlake', jobId: 'j-westlake', payerName: 'Westlake Custom Pools', usd: 6800, expectedYmd: '2026-10-29' }),
        bill({ key: 'inv:longhorn', payerName: 'Longhorn Fabrication', usd: 4200, expectedYmd: '2026-10-28' }),
        bill({ key: 'inv:mesa', payerName: 'Mesa Verde Dental', usd: 5600, expectedYmd: '2026-10-29', billedYmd: '2026-10-22' }),
        bill({ key: 'inv:juniper', payerName: 'Juniper Hill Builders', usd: 7900, expectedYmd: '2026-10-29' }),
        bill({ key: 'inv:barton', usd: 12400, expectedYmd: '2026-10-30', state: 'promised', promise: { promisedYmd: '2026-10-30', markedByName: 'Taunya' } }),
        bill({ key: 'inv:kestrel', payerName: 'Kestrel Property Group', usd: 3300, expectedYmd: '2026-10-30' }),
        bill({ key: 'inv:bluebonnet', payerName: 'Bluebonnet Homes', usd: 9380, expectedYmd: '2026-10-23', state: 'promised', daysPastExpected: 3, promise: { promisedYmd: '2026-10-23', markedByName: 'Taunya' } }),
        bill({ key: 'inv:caldwell', payerName: 'Caldwell & Sons', usd: 5900, expectedYmd: '2026-10-22', state: 'late', daysPastExpected: 4 }),
      ],
      stripeOpenInvoiceIds: new Set(['mesa']),
      payout: { usd: 9310, arrivalYmd: '2026-10-28' },
    }),
  )

  it('reads the closed bar the mock-up draws', () => {
    expect(view.cameIn).toEqual({ usd: 16040, count: 2 })
    expect(view.expected).toEqual({ usd: 60830, count: 10 })
    expect(view.carried.stillOutUsd).toBe(18430)
    expect(view.carried.count).toBe(3)
    expect(view.returnedCount).toBe(1)
  })

  it('puts today’s two landings on Monday, Stripe first by size', () => {
    const monday = day(view, TODAY)
    expect(monday.isToday).toBe(true)
    expect(monday.landedUsd).toBe(16040)
    expect(monday.expectedUsd).toBe(0)
    expect(monday.rows.map((r) => r.tag)).toEqual(['Landed · Stripe', 'Landed · check #4417'])
  })

  it('shelves the two checks in the drawer, oldest first, and sends the third to the bank', () => {
    expect(view.drawer.rows.map((r) => [r.payerName, r.reference, r.usd])).toEqual([
      ['Cedar Ridge Builders', '4471', 7250],
      ['Pecan Valley HOA', '1182', 2100],
    ])
    expect(view.drawer.usd).toBe(9350)
    const bank = allRows(view).find((r) => r.kind === 'bank')!
    expect(bank.payerName).toBe('Alamo Heights Remodel')
    expect(bank.dayYmd).toBe('2026-10-27')
    expect(bank.sub).toBe('check #3310 · deposited Fri · posts ~Tue')
  })

  it('draws the payout on Wednesday without adding it in', () => {
    const wed = day(view, '2026-10-28')
    expect(wed.rows.map((r) => r.kind)).toEqual(['pace', 'stripe-payout'])
    expect(wed.expectedUsd).toBe(4200)
  })

  it('carries last week: the check that came back, the broken word, the payer past pace', () => {
    expect(view.carried.rows.map((r) => r.tag)).toEqual(['Came back · Insufficient funds', 'Their word · 3 days past', 'Past their pace'])
    expect(view.carried.rows[2]!.sub).toBe('expected Thu')
  })

  it('reads a promise as their word, and a Stripe bill with no word as the pace guess it is', () => {
    const fri = day(view, '2026-10-30')
    expect(fri.rows.map((r) => r.tag)).toEqual(['Their word', 'Pace · a guess'])
    expect(fri.rows[0]!.coversOpen).toBe(true)
    const thu = day(view, '2026-10-29')
    expect(thu.rows.map((r) => [r.tag, r.payerName, r.sub])).toEqual([
      ['Pace · a guess', 'Juniper Hill Builders', ''],
      ['Pace · a guess', 'Mesa Verde Dental', 'Stripe invoice · sent Thu'],
    ])
  })

  it('names the deposit kind on a matched payment that never said how it was paid', () => {
    const v = buildMoneyInWeek(
      input({
        payments: [payment({ paymentId: 'p1', usd: 900, paymentType: null, bankTransactionId: 'm1' }), payment({ paymentId: 'p2', usd: 400, paymentType: null, bankTransactionId: 'm2' })],
        linkedDeposits: new Map([
          ['m1', { postedYmd: TODAY, kind: 'externalTransfer' }],
          ['m2', { postedYmd: TODAY, kind: 'checkDeposit' }],
        ]),
      }),
    )
    expect(allRows(v).map((r) => r.tag)).toEqual(['Landed · bank transfer', 'Landed · check'])
  })

  it('lets the claim speak for Westlake: its bill draws no second chip', () => {
    const rows = allRows(view).filter((r) => r.payerName === 'Westlake Custom Pools')
    expect(rows.map((r) => r.kind)).toEqual(['sent-claim'])
    expect(rows[0]!.usd).toBe(6800)
    expect(rows[0]!.sub).toBe('"check mailed Thu" · heard by Taunya')
  })
})

describe('one place per dollar', () => {
  it('never counts a check typed in this week twice: it is in the drawer, not landed', () => {
    const v = buildMoneyInWeek(
      input({
        payments: [payment({ paymentId: 'u1', usd: 500, referenceNumber: '77' })],
        unlinked: [unlinked({ paymentId: 'u1', usd: 500, paidOnYmd: TODAY, referenceNumber: '77' })],
      }),
    )
    expect(v.cameIn.usd).toBe(0)
    expect(v.drawer.count).toBe(1)
    expect(v.expected.usd).toBe(500)
  })

  it('lands a typed-in ACH on the day recorded, and moves it to the day its deposit posts', () => {
    const typed = unlinked({ paymentId: 'ach1', usd: 2000, paidOnYmd: TODAY, paymentType: 'ACH', referenceNumber: null, payerName: 'Hill Country Electric' })
    const before = buildMoneyInWeek(input({ unlinked: [typed], todayYmd: '2026-10-27' }))
    expect(before.cameIn).toEqual({ usd: 2000, count: 1 })
    expect(allRows(before)[0]!.tag).toBe('Landed · ACH')
    const after = buildMoneyInWeek(
      input({ unlinked: [typed], deposits: [deposit({ mercuryTransactionId: 'm1', usd: 2000, kind: 'externalTransfer', state: 'posted', dayYmd: '2026-10-27' })], todayYmd: '2026-10-27' }),
    )
    expect(after.cameIn).toEqual({ usd: 2000, count: 1 })
    expect(allRows(after)[0]!.dayYmd).toBe('2026-10-27')
    expect(allRows(after)[0]!.sub).toBe('posted today · not applied yet')
  })

  it('lands a payment matched at Accounts Receivable on the day its deposit posted, not the day typed', () => {
    const p = payment({ paymentId: 'p1', usd: 900, paidOnYmd: '2026-10-21', bankTransactionId: 'm1' })
    const thisWeek = buildMoneyInWeek(input({ payments: [p], linkedDeposits: new Map([['m1', { postedYmd: TODAY, kind: 'checkDeposit' }]]) }))
    expect(thisWeek.cameIn.usd).toBe(900)
    const lastWeek = buildMoneyInWeek(input({ payments: [p], linkedDeposits: new Map([['m1', { postedYmd: '2026-10-22', kind: 'checkDeposit' }]]) }))
    expect(lastWeek.cameIn.usd).toBe(0)
  })

  it('names a pending deposit by the open bill it can only be, and draws that bill no second chip', () => {
    const v = buildMoneyInWeek(
      input({
        deposits: [deposit({ mercuryTransactionId: 'm1', usd: 12400, kind: 'externalTransfer', counterpartyName: 'BARTON CREEK BLDRS', dayYmd: TODAY })],
        pile: [bill({ key: 'inv:barton' }), bill({ key: 'inv:other', payerName: 'Kestrel Property Group', usd: 3300 })],
      }),
    )
    const rows = allRows(v)
    expect(rows.map((r) => r.kind).sort()).toEqual(['bank', 'pace'])
    expect(rows.find((r) => r.kind === 'bank')!.payerName).toBe('Barton Creek Builders')
    expect(v.expected.usd).toBe(12400 + 3300)
  })

  it('leaves two same-sized bills alone when the deposit could be either', () => {
    const v = buildMoneyInWeek(
      input({
        deposits: [deposit({ mercuryTransactionId: 'm1', usd: 5000, kind: 'externalTransfer', counterpartyName: 'ACME', dayYmd: TODAY })],
        pile: [bill({ key: 'inv:a', payerName: 'Ridgeway Builders', usd: 5000 }), bill({ key: 'inv:b', payerName: 'Pecan Valley HOA', usd: 5000 })],
      }),
    )
    expect(allRows(v).find((r) => r.kind === 'bank')!.payerName).toBe('ACME')
    expect(allRows(v).filter((r) => r.kind === 'pace')).toHaveLength(2)
  })

  it('ignores a Stripe payout reaching Mercury: the payout chip already carries it', () => {
    const v = buildMoneyInWeek(input({ deposits: [deposit({ mercuryTransactionId: 'm1', usd: 9310, kind: 'externalTransfer', counterpartyName: 'STRIPE TRANSFER', dayYmd: TODAY })] }))
    expect(allRows(v)).toHaveLength(0)
    expect(v.expected.usd).toBe(0)
  })

  it('never lands money that came back, and draws this week’s return red without counting it', () => {
    const v = buildMoneyInWeek(
      input({
        payments: [payment({ paymentId: 'p1', usd: 3150, bankTransactionId: 'm1' })],
        linkedDeposits: new Map([['m1', { postedYmd: TODAY, kind: 'checkDeposit' }]]),
        returns: [returned({ id: 'r1', cameBackYmd: TODAY, livePaymentIds: ['p1'] })],
      }),
    )
    expect(v.cameIn.usd).toBe(0)
    const red = allRows(v).find((r) => r.kind === 'returned')!
    expect(red.counted).toBe(false)
    expect(v.expected.usd).toBe(0)
    expect(v.returnedCount).toBe(1)
  })

  it('keeps a deposit that posted last week off this week, and out of the drawer', () => {
    const v = buildMoneyInWeek(
      input({
        unlinked: [unlinked({ paymentId: 'u1', usd: 700, paidOnYmd: '2026-10-21' })],
        deposits: [deposit({ mercuryTransactionId: 'm1', usd: 700, state: 'posted', dayYmd: '2026-10-22' })],
      }),
    )
    expect(allRows(v)).toHaveLength(0)
    expect(v.drawer.count).toBe(0)
  })

  it('lands a posted deposit nobody has applied yet, by the bank’s name for it', () => {
    const v = buildMoneyInWeek(input({ deposits: [deposit({ mercuryTransactionId: 'm1', usd: 640, kind: 'incomingDomesticWire', counterpartyName: 'JUNIPER HILL', state: 'posted', dayYmd: TODAY })] }))
    const row = allRows(v)[0]!
    expect(row.tag).toBe('Landed · not applied yet')
    expect(row.payerName).toBe('JUNIPER HILL')
    expect(row.door).toBe('deposits')
    expect(v.cameIn.usd).toBe(640)
  })
})

describe('the drawer', () => {
  it('holds checks for ten days, then leaves them to Accounts Receivable’s cases', () => {
    const v = buildMoneyInWeek(
      input({
        unlinked: [unlinked({ paymentId: 'fresh', paidOnYmd: '2026-10-16' }), unlinked({ paymentId: 'old', paidOnYmd: '2026-10-15' })],
        unbankedCount: 4,
      }),
    )
    expect(v.drawer.rows.map((r) => r.key)).toEqual(['drawer:fresh'])
    expect(v.drawer.olderUnbankedCount).toBe(4)
  })
  it('ignores a typed-in non-check from before this week', () => {
    const v = buildMoneyInWeek(input({ unlinked: [unlinked({ paymentId: 'w', paymentType: 'Wire', paidOnYmd: '2026-10-20' })] }))
    expect(allRows(v)).toHaveLength(0)
    expect(v.drawer.count).toBe(0)
  })
})

describe('their word and their pace', () => {
  it('slides an expected day that passed this week to today, remembering the real day', () => {
    const v = buildMoneyInWeek(input({ pile: [bill({ key: 'inv:a', expectedYmd: '2026-10-27' })], todayYmd: '2026-10-28' }))
    const row = allRows(v)[0]!
    expect(row.dayYmd).toBe('2026-10-28')
    expect(row.wasYmd).toBe('2026-10-27')
  })
  it('leaves a bill expected next week, or weeks ago, off the line', () => {
    const v = buildMoneyInWeek(input({ pile: [bill({ key: 'inv:a', expectedYmd: '2026-11-03' }), bill({ key: 'inv:b', expectedYmd: '2026-10-05' })] }))
    expect(allRows(v)).toHaveLength(0)
    expect(v.carried.count).toBe(0)
  })
  it('skips a claim whose job has nothing open: the money already landed', () => {
    const v = buildMoneyInWeek(input({ claims: [claim({ id: 'c1', jobId: 'j-paid' })] }))
    expect(allRows(v)).toHaveLength(0)
  })
  it('caps a claim’s stated amount at what is still open', () => {
    const v = buildMoneyInWeek(input({ claims: [claim({ id: 'c1', jobId: 'j1', amount: 9000 })], pile: [bill({ key: 'inv:x', jobId: 'j1', usd: 6000, expectedYmd: '2026-10-29' })] }))
    const row = allRows(v).find((r) => r.kind === 'sent-claim')!
    expect(row.usd).toBe(6000)
    expect(row.coversOpen).toBe(false)
  })
  it('carries a claim whose mail should have come last week', () => {
    const v = buildMoneyInWeek(input({ claims: [claim({ id: 'c1', jobId: 'j1', paidYmd: '2026-10-15' })], pile: [bill({ key: 'inv:x', jobId: 'j1', usd: 6000, expectedYmd: '2026-10-29' })] }))
    expect(v.carried.rows.map((r) => r.kind)).toEqual(['sent-claim'])
    expect(allRows(v)).toHaveLength(0)
  })
})

describe('customer deposits', () => {
  const filter = { kinds: ['checkDeposit', 'externalTransfer'], excludeCounterpartyContains: ['owner loan'], excludeNoteContains: ['refund'] }
  it('keeps what the Accounts Receivable filter keeps, and never a Stripe payout or our own transfer', () => {
    expect(isCustomerDeposit({ usd: 10, kind: 'checkDeposit', counterpartyName: null }, filter)).toBe(true)
    expect(isCustomerDeposit({ usd: 10, kind: 'incomingDomesticWire', counterpartyName: null }, filter)).toBe(false)
    expect(isCustomerDeposit({ usd: 10, kind: 'externalTransfer', counterpartyName: 'Owner Loan LLC' }, filter)).toBe(false)
    expect(isCustomerDeposit({ usd: 10, kind: 'externalTransfer', counterpartyName: 'Acme', note: 'Refund from supplier' }, filter)).toBe(false)
    expect(isCustomerDeposit({ usd: 10, kind: 'externalTransfer', counterpartyName: 'Stripe' }, null)).toBe(false)
    expect(isCustomerDeposit({ usd: 10, kind: 'internalTransfer', counterpartyName: null }, null)).toBe(false)
    expect(isCustomerDeposit({ usd: -10, kind: 'checkDeposit', counterpartyName: null }, null)).toBe(false)
  })
})

describe('the pen', () => {
  it('offers the next three bank days and next Monday', () => {
    expect(penQuickDays(TODAY)).toEqual([
      { ymd: '2026-10-27', label: 'Tue 27' },
      { ymd: '2026-10-28', label: 'Wed 28' },
      { ymd: '2026-10-29', label: 'Thu 29' },
      { ymd: '2026-11-02', label: 'Mon Nov 2' },
    ])
  })
  it('crosses the weekend on a Friday, without naming Monday twice', () => {
    expect(penQuickDays('2026-10-30').map((d) => d.label)).toEqual(['Mon Nov 2', 'Tue Nov 3', 'Wed Nov 4'])
  })
  it('says where the day stands now', () => {
    expect(penContextLine({ kind: 'word', eventYmd: '2026-10-30', dayYmd: '2026-10-30', wasYmd: null })).toBe('Their word now: Fri Oct 30.')
    expect(penContextLine({ kind: 'pace', eventYmd: '2026-10-12', dayYmd: '2026-10-29', wasYmd: null })).toBe('Now a guess from their usual pace: Thu Oct 29.')
    expect(penContextLine({ kind: 'pace', eventYmd: '2026-10-12', dayYmd: null, wasYmd: '2026-10-22' })).toBe('Their usual pace said Thu Oct 22. Nothing came.')
    expect(penContextLine({ kind: 'word', eventYmd: '2026-10-23', dayYmd: null, wasYmd: '2026-10-23' })).toBe('Their word was Fri Oct 23. Nothing came.')
    expect(penContextLine({ kind: 'bank', eventYmd: null, dayYmd: TODAY, wasYmd: null })).toBeNull()
  })
  it('moves only their word and a pace guess, on a job', () => {
    expect(penAppliesTo({ kind: 'pace', jobId: 'j1' })).toBe(true)
    expect(penAppliesTo({ kind: 'word', jobId: 'j1' })).toBe(true)
    expect(penAppliesTo({ kind: 'pace', jobId: null })).toBe(false)
    expect(penAppliesTo({ kind: 'bank', jobId: 'j1' })).toBe(false)
    expect(penAppliesTo({ kind: 'sent-claim', jobId: 'j1' })).toBe(false)
  })
})
