import { describe, expect, it } from 'vitest'
import {
  derivePaymentMethod,
  defaultSortDir,
  filterPayRunPayments,
  paymentWindowStartYmd,
  payRunPaymentTotals,
  payRunPaymentsSummaryLine,
  sortPayRunPayments,
  type PayRunPaymentRow,
} from './payRunPayments'

const row = (id: string, over: Partial<PayRunPaymentRow> & { person?: string; period?: string } = {}): PayRunPaymentRow => ({
  id,
  paidAt: '2026-09-16T17:00:00+00:00',
  amount: 100,
  memo: null,
  createdBy: 'grace',
  createdAt: '2026-09-16T17:05:00+00:00',
  stub: { id: `s-${id}`, personName: over.person ?? 'Paige', periodStart: over.period ?? '2026-09-06', periodEnd: '2026-09-12' },
  ...over,
})

// The newest eight in prod on 2026-09-17, as the mock-up drew them.
const ROWS: PayRunPaymentRow[] = [
  row('a', { amount: 291.55 }),
  row('b', { amount: 100, memo: 'Cash App #D-P7PRK45K6', person: 'Taunya', period: '2026-07-26' }),
  row('c', { amount: 100, memo: 'Cash App #D-P7PR5RMVV', person: 'Malachi', period: '2026-08-02' }),
  row('d', { amount: 500, paidAt: '2026-09-11T17:00:00+00:00', createdAt: '2026-09-11T17:00:00+00:00' }),
  row('e', { amount: 500, memo: 'CashApp', paidAt: '2026-09-05T17:00:00+00:00', createdAt: '2026-09-05T17:00:00+00:00', period: '2026-08-23' }),
  row('f', { amount: 385.92, memo: 'CashApp', paidAt: '2026-09-05T17:00:00+00:00', createdAt: '2026-09-05T17:00:00+00:00', person: 'Isiah', period: '2026-08-16' }),
  row('g', { amount: 249.95, memo: 'CashApp', paidAt: '2026-09-05T17:00:00+00:00', createdAt: '2026-09-05T17:00:00+00:00', person: 'Grace', period: '2026-08-16' }),
  row('h', { amount: 518.6, memo: 'Cashapp', paidAt: '2026-09-05T17:00:00+00:00', createdAt: '2026-09-05T17:00:00+00:00', person: 'Wendi', period: '2026-08-16' }),
]

describe('paymentWindowStartYmd', () => {
  it('counts back from today, starts the year, or opens all time', () => {
    expect(paymentWindowStartYmd('30d', '2026-09-17')).toBe('2026-08-18')
    expect(paymentWindowStartYmd('90d', '2026-09-17')).toBe('2026-06-19')
    expect(paymentWindowStartYmd('ytd', '2026-09-17')).toBe('2026-01-01')
    expect(paymentWindowStartYmd('all', '2026-09-17')).toBeNull()
  })
})

describe('derivePaymentMethod', () => {
  it('reads the memo\'s first words: Cash App in its spellings, Mercury, check, client-direct; a note is nothing', () => {
    expect(derivePaymentMethod('Cash App #D-P7PRK45K6')).toBe('cash-app')
    expect(derivePaymentMethod('CashApp')).toBe('cash-app')
    expect(derivePaymentMethod('cashapp advance')).toBe('cash-app')
    expect(derivePaymentMethod('Mercury')).toBe('mercury')
    expect(derivePaymentMethod('Check 1044')).toBe('check')
    expect(derivePaymentMethod('Paid via Client Mehow')).toBe('client')
    expect(derivePaymentMethod('1190-781.91=408.09 remaining from client to be applied')).toBeNull()
    expect(derivePaymentMethod(null)).toBeNull()
  })
})

describe('filterPayRunPayments', () => {
  it('matches the person or the memo, case-insensitively; blank keeps all', () => {
    expect(filterPayRunPayments(ROWS, '').length).toBe(8)
    expect(filterPayRunPayments(ROWS, 'paige').map((r) => r.id)).toEqual(['a', 'd', 'e'])
    expect(filterPayRunPayments(ROWS, 'D-P7PR').map((r) => r.id)).toEqual(['b', 'c'])
  })
})

describe('sortPayRunPayments', () => {
  it('opens dates and amounts newest / largest first and text A → Z', () => {
    expect(defaultSortDir('paid')).toBe('desc')
    expect(defaultSortDir('amount')).toBe('desc')
    expect(defaultSortDir('person')).toBe('asc')
  })
  it('sorts by each key with a stable paid-at tiebreak', () => {
    expect(sortPayRunPayments(ROWS, 'amount', 'desc').map((r) => r.id)).toEqual(['h', 'd', 'e', 'f', 'a', 'g', 'b', 'c'])
    expect(sortPayRunPayments(ROWS, 'person', 'asc').map((r) => r.stub.personName)).toEqual(['Grace', 'Isiah', 'Malachi', 'Paige', 'Paige', 'Paige', 'Taunya', 'Wendi'])
    expect(sortPayRunPayments(ROWS, 'period', 'asc').map((r) => r.id)[0]).toBe('b')
    expect(sortPayRunPayments(ROWS, 'paid', 'desc').map((r) => r.id).slice(0, 3)).toEqual(['a', 'b', 'c'])
    expect(sortPayRunPayments(ROWS, 'memo', 'asc').map((r) => r.id).slice(0, 2)).toEqual(['a', 'd']) // blanks first
  })
})

describe('totals + summary line', () => {
  it('counts, sums to the cent, counts distinct people and finds the newest day', () => {
    const t = payRunPaymentTotals(ROWS)
    expect(t).toEqual({ count: 8, sumUsd: 2646.02, people: 6, newestYmd: '2026-09-16' })
    expect(payRunPaymentsSummaryLine(t, '90d', (n) => `$${n.toFixed(2)}`, (y) => y.slice(5))).toBe('8 payments · $2646.02 in the last 90 days · 6 people · newest 09-16')
    expect(payRunPaymentsSummaryLine(payRunPaymentTotals([]), 'all', String, String)).toBe('no payments recorded')
  })
})
