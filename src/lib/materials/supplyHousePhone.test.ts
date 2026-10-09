import { describe, expect, it } from 'vitest'
import { ordinalDay, summarizeSupplyHouseBalances, supplyHouseCardMoney, supplyHouseInvoiceTabCounts, supplyHousePhoneInvoiceRows, type SupplyHousePhoneInvoice } from './supplyHousePhone'
import { buildSupplyHouseAgingMatrix } from '../supplyHouseAging'

const houses = [
  { id: 'a', name: 'House A', monthly_payment_day: 10 },
  { id: 'b', name: 'House B', monthly_payment_day: null },
  { id: 'c', name: 'House C', monthly_payment_day: 22 },
]
const inv = (supply_house_id: string, amount: number, is_paid: boolean, updated_at: string | null = null, paid_at: string | null = null) => ({ supply_house_id, amount, is_paid, updated_at, paid_at })

describe('summarizeSupplyHouseBalances', () => {
  const rows = summarizeSupplyHouseBalances(houses, [inv('a', 1000, false, '2026-09-20T10:00:00Z'), inv('a', -200, false, '2026-09-25T10:00:00Z'), inv('a', 500, true, '2026-09-01T10:00:00Z', '2026-09-02T10:00:00Z'), inv('b', 3000, false), inv('zz', 99, false)])
  it('nets every unpaid paper per house, credits included, the most owed first', () => {
    expect(rows.map((r) => `${r.name}:${r.outstanding}`)).toEqual(['House B:3000', 'House A:800', 'House C:0'])
  })
  it('carries the pay day and the newest update and payment', () => {
    const a = rows.find((r) => r.supply_house_id === 'a')!
    expect(a).toMatchObject({ monthlyPaymentDay: 10, lastInvoiceUpdatedAt: '2026-09-25T10:00:00Z', lastInvoicePaidAt: '2026-09-02T10:00:00Z' })
    expect(rows.find((r) => r.supply_house_id === 'c')).toMatchObject({ lastInvoiceUpdatedAt: null, lastInvoicePaidAt: null })
  })
})

describe('supplyHouseCardMoney', () => {
  it('gives each house its balance, the aging shares and the pay day', () => {
    const balances = summarizeSupplyHouseBalances(houses, [inv('a', 750, false), inv('a', 250, false)])
    const aging = buildSupplyHouseAgingMatrix(
      houses.map((h) => ({ id: h.id, name: h.name })),
      [
        { supply_house_id: 'a', amount: 750, due_date: '2026-10-15', on_job_account: false },
        { supply_house_id: 'a', amount: 250, due_date: '2026-08-01', on_job_account: false },
      ],
      '2026-09-27',
    )
    const money = supplyHouseCardMoney(balances, aging.rows)
    expect(money['a']).toMatchObject({ outstanding: 1000, payDayWords: 'pays on the 10th' })
    expect(money['a']!.segments.map((s) => `${s.key}:${s.share}`)).toEqual(['current:0.75', 'past30_60:0.25'])
    expect(money['b']).toEqual({ outstanding: 0, segments: [], payDayWords: '' })
    expect(money['c']!.payDayWords).toBe('pays on the 22nd')
  })
  it('ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinalDay)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '31st'])
  })
})

describe('a house’s invoices as rows', () => {
  const list: SupplyHousePhoneInvoice[] = [
    { id: '1', invoice_number: '88121', purchase_order_number: 'PO-1041', due_date: '2026-10-02', amount: 1204, is_paid: false, job_allocations: [{ job_id: 'j1', pct: 100 }] },
    { id: '2', invoice_number: '87990', purchase_order_number: null, due_date: '2026-09-05', amount: 2870, is_paid: false, job_allocations: [{ job_id: 'j2', pct: 60 }, { job_id: 'j3', pct: 40 }] },
    { id: '3', invoice_number: '88140', purchase_order_number: ' ', due_date: null, amount: 388, is_paid: false, on_job_account: true },
    { id: '4', invoice_number: 'CM-4471', purchase_order_number: null, due_date: null, amount: -150, is_paid: false },
    { id: '5', invoice_number: '87001', purchase_order_number: null, due_date: '2026-08-01', amount: 900, is_paid: true },
  ]
  const opts = { todayYmd: '2026-09-27', jobLabel: (id: string) => id.toUpperCase(), formatMoney: (n: number) => `$${n.toLocaleString('en-US')}` }
  it('counts the tabs: unpaid, paid, open credits', () => {
    expect(supplyHouseInvoiceTabCounts(list)).toEqual({ unpaid: 3, paid: 1, credits: 1 })
  })
  it('says the number, the due day, the jobs and one amount; past due in days', () => {
    expect(supplyHousePhoneInvoiceRows(list, 'unpaid', opts)).toEqual([
      { id: '1', title: '88121 · PO-1041', sub: 'due Oct 2 · J1', amountWords: '$1,204', credit: false, pastDueDays: 0 },
      { id: '2', title: '87990', sub: 'due Sep 5 · J2 60% · J3 40%', amountWords: '$2,870', credit: false, pastDueDays: 22 },
      { id: '3', title: '88140', sub: 'no due date · job account', amountWords: '$388', credit: false, pastDueDays: 0 },
    ])
  })
  it('a credit reads as a credit, and a paid invoice is never past due', () => {
    expect(supplyHousePhoneInvoiceRows(list, 'credits', opts)).toEqual([{ id: '4', title: 'CM-4471', sub: '', amountWords: '− $150', credit: true, pastDueDays: 0 }])
    expect(supplyHousePhoneInvoiceRows(list, 'paid', opts)[0]).toMatchObject({ id: '5', sub: 'due Aug 1', pastDueDays: 0 })
  })
})

describe('v2.5035 · a credit and the invoice it credits name each other on the phone rows', () => {
  it('in the row’s second line', () => {
    const list: SupplyHousePhoneInvoice[] = [
      { id: 'i1', invoice_number: '88121', purchase_order_number: null, due_date: '2026-10-02', amount: 1204, is_paid: false, document_kind: 'invoice' },
      { id: 'c1', invoice_number: 'CM-4471', purchase_order_number: null, due_date: null, amount: -150, is_paid: false, document_kind: 'credit', credits_invoice_id: 'i1' },
    ]
    const opts = { todayYmd: '2026-09-27', jobLabel: (id: string) => id, formatMoney: (n: number) => `$${n}` }
    expect(supplyHousePhoneInvoiceRows(list, 'unpaid', opts)[0]?.sub).toBe('due Oct 2 · credited by CM-4471 (−$150.00)')
    expect(supplyHousePhoneInvoiceRows(list, 'credits', opts)[0]?.sub).toBe('credits 88121')
  })
})
