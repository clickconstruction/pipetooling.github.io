import { describe, expect, it } from 'vitest'
import { buildMoneyInWeek, dayWord, weekMondayContaining, type MoneyInMercury, type MoneyInPayment, type MoneyInUnlinkedCheck, type MoneyInWeekInput } from './moneyInWeek'
import type { CollectBillRead } from './bridge/collect/collectPile'
import type { PaidClaim } from './jobs/paidClaims'

// Monday, so the carry is the story — the mock-up's day.
const TODAY = '2026-10-26'

const payment = (over: Partial<MoneyInPayment>): MoneyInPayment => ({
  paymentId: over.paymentId ?? 'p1',
  jobId: null,
  usd: 100,
  paidOnYmd: TODAY,
  paymentType: 'Check',
  note: null,
  referenceNumber: null,
  payerName: 'Ridgeway Builders',
  ...over,
})

const unlinked = (over: Partial<MoneyInUnlinkedCheck>): MoneyInUnlinkedCheck => ({
  paymentId: over.paymentId ?? 'u1',
  jobId: null,
  usd: 7250,
  paidOnYmd: '2026-10-23',
  paymentType: 'Check',
  referenceNumber: '4471',
  payerName: 'Cedar Ridge Builders',
  ...over,
})

const mercury = (over: Partial<MoneyInMercury>): MoneyInMercury => ({
  mercuryTransactionId: over.mercuryTransactionId ?? 'm1',
  usd: 4980,
  kind: 'checkDeposit',
  status: 'pending',
  createdYmd: '2026-10-23',
  postedYmd: null,
  counterpartyName: 'Alamo Heights Remodel',
  failedReason: null,
  failedYmd: null,
  ...over,
})

const bill = (over: Partial<CollectBillRead>): CollectBillRead => ({
  key: over.key ?? 'inv:b1',
  jobId: over.jobId ?? 'j1',
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

const claim = (over: Partial<PaidClaim>): PaidClaim => ({
  id: over.id ?? 'cl1',
  jobId: over.jobId ?? 'j9',
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

const input = (over: Partial<MoneyInWeekInput>): MoneyInWeekInput => ({
  payments: [],
  unlinkedChecks: [],
  mercury: [],
  pile: [],
  claims: null,
  stripeOpenInvoiceIds: new Set<string>(),
  payout: null,
  todayYmd: TODAY,
  ...over,
})

describe('week math', () => {
  it('finds the Monday of a week from any day in it', () => {
    expect(weekMondayContaining('2026-10-26')).toBe('2026-10-26')
    expect(weekMondayContaining('2026-10-28')).toBe('2026-10-26')
    expect(weekMondayContaining('2026-10-25')).toBe('2026-10-19')
  })
  it('says today, a weekday word two weeks around, a date beyond', () => {
    expect(dayWord('2026-10-26', TODAY)).toBe('today')
    expect(dayWord('2026-10-28', TODAY)).toBe('Wed')
    expect(dayWord('2026-10-23', TODAY)).toBe('Fri')
    expect(dayWord('2026-10-12', TODAY)).toBe('Oct 12')
  })
})

describe('came in', () => {
  it('counts payments paid this week and files them on their day', () => {
    const v = buildMoneyInWeek(
      input({
        payments: [
          payment({ paymentId: 'a', usd: 9800, note: 'Stripe', paymentType: null }),
          payment({ paymentId: 'b', usd: 6240, paidOnYmd: '2026-10-22' }), // last week: counted nowhere here
        ],
      }),
    )
    expect(v.cameIn).toEqual({ usd: 9800, count: 1 })
    const monday = v.days[0]!
    expect(monday.isToday).toBe(true)
    expect(monday.rows.map((r) => r.kind)).toEqual(['landed'])
    expect(monday.rows[0]!.sub).toContain('Stripe')
  })
})

describe('the drawer', () => {
  it('lists unlinked checks, and drops one a pending deposit already carries', () => {
    const v = buildMoneyInWeek(
      input({
        unlinkedChecks: [unlinked({}), unlinked({ paymentId: 'u2', usd: 2100, referenceNumber: '1182', payerName: 'Pecan Valley HOA' })],
        mercury: [mercury({ usd: 7250.4 })], // within a dollar of #4471: that check is at the bank
      }),
    )
    expect(v.drawer.count).toBe(1)
    expect(v.drawer.rows[0]!.payerName).toBe('Pecan Valley HOA')
    // The pending deposit still shows as the bank chip, so the money counts once.
    const bankRows = v.days.flatMap((d) => d.rows).filter((r) => r.kind === 'bank')
    expect(bankRows).toHaveLength(1)
    expect(v.expected.usd).toBe(2100 + 7250.4)
  })
  it('ignores unlinked rows that are not checks', () => {
    const v = buildMoneyInWeek(input({ unlinkedChecks: [unlinked({ paymentType: 'ACH' })] }))
    expect(v.drawer.count).toBe(0)
  })
})

describe('at the bank, and what came back', () => {
  it('puts a pending deposit on the day it should post, never before today', () => {
    const v = buildMoneyInWeek(input({ mercury: [mercury({})] })) // created Fri; +2 days fell Sunday, so it reads today
    const row = v.days.flatMap((d) => d.rows).find((r) => r.kind === 'bank')!
    expect(row.dayYmd).toBe(TODAY)
    expect(v.expected.usd).toBe(4980)
  })
  it('draws a failed deposit red on its day without counting it, and carries last week’s', () => {
    const v = buildMoneyInWeek(
      input({
        mercury: [
          mercury({ mercuryTransactionId: 'f1', status: 'failed', failedYmd: TODAY, failedReason: 'NSF' }),
          mercury({ mercuryTransactionId: 'f2', status: 'failed', failedYmd: '2026-10-22', failedReason: 'NSF', usd: 3150 }),
        ],
      }),
    )
    const today = v.days[0]!
    expect(today.rows[0]!.kind).toBe('returned')
    expect(today.rows[0]!.counted).toBe(false)
    expect(v.expected.usd).toBe(0)
    expect(v.carried.returnedCount).toBe(1)
    expect(v.carried.stillOutUsd).toBe(3150)
  })
})

describe('they say it’s sent', () => {
  it('lands a mailed-check claim five days out, covering the job’s open money, and quiets the job’s pace chip', () => {
    const v = buildMoneyInWeek(
      input({
        claims: [claim({})], // mailed Thu Oct 22 → arrives Tue Oct 27
        pile: [bill({ key: 'inv:w1', jobId: 'j9', payerName: 'Westlake Custom Pools', usd: 6800, expectedYmd: '2026-10-29' })],
      }),
    )
    const rows = v.days.flatMap((d) => d.rows)
    const sent = rows.find((r) => r.kind === 'sent-claim')!
    expect(sent.dayYmd).toBe('2026-10-27')
    expect(sent.usd).toBe(6800)
    expect(sent.coversOpen).toBe(true)
    expect(rows.some((r) => r.kind === 'pace')).toBe(false)
    expect(v.expected).toEqual({ usd: 6800, count: 1 })
  })
  it('drops a claim whose money already landed', () => {
    const v = buildMoneyInWeek(input({ claims: [claim({ landedSince: 6800 })] }))
    expect(v.days.flatMap((d) => d.rows)).toHaveLength(0)
  })
})

describe('their word, their pace, Stripe', () => {
  it('files a promise on its day, a pace guess on its, and marks a hosted Stripe bill', () => {
    const v = buildMoneyInWeek(
      input({
        pile: [
          bill({ key: 'inv:a', jobId: 'j1', expectedYmd: '2026-10-30', promise: { promisedYmd: '2026-10-30', markedByName: 'Taunya' }, state: 'promised' }),
          bill({ key: 'inv:b', jobId: 'j2', payerName: 'Riverbend Office Park', usd: 6300, expectedYmd: '2026-10-27' }),
          bill({ key: 'inv:c', jobId: 'j3', payerName: 'Mesa Verde Dental', usd: 5600, expectedYmd: '2026-10-29' }),
        ],
        stripeOpenInvoiceIds: new Set(['c']),
      }),
    )
    const kinds = Object.fromEntries(v.days.flatMap((d) => d.rows).map((r) => [r.kind, r]))
    expect(kinds['word']!.dayYmd).toBe('2026-10-30')
    expect(kinds['word']!.coversOpen).toBe(true)
    expect(kinds['pace']!.dayYmd).toBe('2026-10-27')
    expect(kinds['stripe-open']!.door).toBe('banking')
    expect(v.expected.count).toBe(3)
  })
  it('slides an expected day that already passed this week to today, remembering the real day', () => {
    const wed = buildMoneyInWeek(input({ pile: [bill({ expectedYmd: '2026-10-27' })], todayYmd: '2026-10-28' }))
    const row = wed.days.flatMap((d) => d.rows).find((r) => r.kind === 'pace')!
    expect(row.dayYmd).toBe('2026-10-28')
    expect(row.wasYmd).toBe('2026-10-27')
  })
})

describe('carried from last week', () => {
  it('carries what was expected and never landed, and credits what did', () => {
    const v = buildMoneyInWeek(
      input({
        pile: [
          bill({ key: 'inv:x', jobId: 'jx', payerName: 'Caldwell & Sons', usd: 5900, expectedYmd: '2026-10-22', state: 'late', daysPastExpected: 4 }),
          bill({ key: 'inv:y', jobId: 'jy', payerName: 'Paid Fine Co', usd: 4000, expectedYmd: '2026-10-21', state: 'late' }),
        ],
        payments: [payment({ paymentId: 'lw', jobId: 'jy', usd: 4000, paidOnYmd: '2026-10-23' })],
      }),
    )
    expect(v.carried.expectedUsd).toBe(9900)
    expect(v.carried.landedUsd).toBe(4000)
    expect(v.carried.stillOutUsd).toBe(5900)
    expect(v.carried.rows.map((r) => r.payerName)).toEqual(['Caldwell & Sons'])
    expect(v.carried.rows[0]!.wasYmd).toBe('2026-10-22')
  })
})

describe('the payout', () => {
  it('draws the payout on its day without summing it', () => {
    const v = buildMoneyInWeek(input({ payout: { usd: 9310, arrivalYmd: '2026-10-28' } }))
    const row = v.days.flatMap((d) => d.rows).find((r) => r.kind === 'stripe-payout')!
    expect(row.dayYmd).toBe('2026-10-28')
    expect(row.counted).toBe(false)
    expect(v.expected.usd).toBe(0)
    expect(v.days.find((d) => d.ymd === '2026-10-28')!.usd).toBe(0)
  })
})
