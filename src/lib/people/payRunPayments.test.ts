import { describe, expect, it } from 'vitest'
import {
  countPaymentsByMethod,
  derivePaymentMethod,
  defaultSortDir,
  filterPayRunPayments,
  PAY_RUN_METHOD_FILTERS,
  paymentSource,
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
  sourceKind: null,
  sourceId: null,
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

describe('paymentSource (v2.3717)', () => {
  it('prefers the column; falls back to the memo\'s first words and says so; an unknown column value is read like an empty one', () => {
    expect(paymentSource({ sourceKind: 'mercury', memo: 'Cash App #D-1' })).toEqual({ kind: 'mercury', fromMemo: false })
    expect(paymentSource({ sourceKind: 'other', memo: 'Payment "cash"' })).toEqual({ kind: 'other', fromMemo: false })
    expect(paymentSource({ sourceKind: null, memo: 'Cash App #D-1' })).toEqual({ kind: 'cashapp', fromMemo: true })
    expect(paymentSource({ sourceKind: 'venmo', memo: 'Venmo' })).toEqual({ kind: null, fromMemo: false })
    expect(paymentSource({ sourceKind: null, memo: null })).toEqual({ kind: null, fromMemo: false })
    expect(derivePaymentMethod('Paid via Client Mehow')).toBe('client_direct')
  })
})

describe('filterPayRunPayments', () => {
  it('matches the person or the memo, case-insensitively; blank keeps all', () => {
    expect(filterPayRunPayments(ROWS, '').length).toBe(8)
    expect(filterPayRunPayments(ROWS, 'paige').map((r) => r.id)).toEqual(['a', 'd', 'e'])
    expect(filterPayRunPayments(ROWS, 'D-P7PR').map((r) => r.id)).toEqual(['b', 'c'])
  })
  it('keeps one method, or the rows with none, and stacks with the search', () => {
    expect(filterPayRunPayments(ROWS, '', 'cashapp').map((r) => r.id)).toEqual(['b', 'c', 'e', 'f', 'g', 'h'])
    expect(filterPayRunPayments(ROWS, '', 'none').map((r) => r.id)).toEqual(['a', 'd'])
    expect(filterPayRunPayments(ROWS, '', 'mercury')).toEqual([])
    expect(filterPayRunPayments(ROWS, 'paige', 'cashapp').map((r) => r.id)).toEqual(['e'])
  })
  it('counts every chip over the loaded rows, in the picker\'s order', () => {
    expect(PAY_RUN_METHOD_FILTERS.map((f) => f.key)).toEqual(['all', 'cashapp', 'mercury', 'apple_pay', 'client_direct', 'other', 'none'])
    expect(countPaymentsByMethod(ROWS)).toEqual({ all: 8, cashapp: 6, mercury: 0, apple_pay: 0, client_direct: 0, other: 0, none: 2 })
    expect(countPaymentsByMethod([row('x', { sourceKind: 'other' })]).other).toBe(1)
  })
})

describe('sortPayRunPayments', () => {
  it('opens dates and amounts newest / largest first and text A → Z', () => {
    expect(defaultSortDir('paid')).toBe('desc')
    expect(defaultSortDir('amount')).toBe('desc')
    expect(defaultSortDir('person')).toBe('asc')
    expect(defaultSortDir('method')).toBe('asc')
  })
  it('sorts by each key with a stable paid-at tiebreak', () => {
    expect(sortPayRunPayments(ROWS, 'amount', 'desc').map((r) => r.id)).toEqual(['h', 'd', 'e', 'f', 'a', 'g', 'b', 'c'])
    expect(sortPayRunPayments(ROWS, 'person', 'asc').map((r) => r.stub.personName)).toEqual(['Grace', 'Isiah', 'Malachi', 'Paige', 'Paige', 'Paige', 'Taunya', 'Wendi'])
    expect(sortPayRunPayments(ROWS, 'period', 'asc').map((r) => r.id)[0]).toBe('b')
    expect(sortPayRunPayments(ROWS, 'paid', 'desc').map((r) => r.id).slice(0, 3)).toEqual(['a', 'b', 'c'])
    expect(sortPayRunPayments(ROWS, 'memo', 'asc').map((r) => r.id).slice(0, 2)).toEqual(['a', 'd']) // blanks first
  })
  it('sorts by method label, the column and the memo reading side by side', () => {
    const rows = [row('m', { sourceKind: 'mercury', memo: 'Mercury "Week"' }), row('b', { memo: 'Cash App #D-1' }), row('n')]
    expect(sortPayRunPayments(rows, 'method', 'asc').map((r) => r.id)).toEqual(['n', 'b', 'm'])
    expect(sortPayRunPayments(rows, 'method', 'desc').map((r) => r.id)).toEqual(['m', 'b', 'n'])
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
