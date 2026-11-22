import { describe, expect, it } from 'vitest'
import {
  buildCustomerInvoiceRows,
  customerInvoiceChipTail,
  invoiceChannelLabel,
  type CustomerInvoiceInput,
} from './customerInvoiceRows'

const TODAY = '2026-08-17'

function inv(p: Partial<CustomerInvoiceInput>): CustomerInvoiceInput {
  return {
    id: 'i1',
    job_id: 'j1',
    amount: 100,
    status: 'billed',
    sequence_order: 1,
    billed_at: '2026-08-01T00:00:00Z',
    estimated_bill_date: '2026-08-01',
    created_at: '2026-07-30T00:00:00Z',
    sent_to_customer_at: null,
    external_send_channel: null,
    stripe_invoice_id: null,
    hosted_invoice_url: null,
    ...p,
  }
}

const JOBS = [
  { id: 'j1', label: '941' },
  { id: 'j2', label: '972' },
]

describe('invoiceChannelLabel', () => {
  it('maps send channels; stripe id implies Stripe; nothing means —', () => {
    expect(invoiceChannelLabel({ external_send_channel: 'stripe', stripe_invoice_id: null })).toBe('Stripe')
    expect(invoiceChannelLabel({ external_send_channel: 'stripe_manual', stripe_invoice_id: null })).toBe('Stripe')
    expect(invoiceChannelLabel({ external_send_channel: 'housecallpro', stripe_invoice_id: null })).toBe('HCP')
    expect(invoiceChannelLabel({ external_send_channel: 'physical', stripe_invoice_id: null })).toBe('Physical')
    expect(invoiceChannelLabel({ external_send_channel: null, stripe_invoice_id: 'in_x' })).toBe('Stripe')
    expect(invoiceChannelLabel({ external_send_channel: null, stripe_invoice_id: null })).toBe('—')
  })
})

describe('buildCustomerInvoiceRows', () => {
  it('statuses: draft, billed, partial (billed with payments), paid; aging from estimated_bill_date', () => {
    const { rows } = buildCustomerInvoiceRows(
      [
        inv({ id: 'a', status: 'ready_to_bill', billed_at: null }),
        inv({ id: 'b', status: 'billed', estimated_bill_date: '2026-07-14' }),
        inv({ id: 'c', status: 'billed', amount: 200 }),
        inv({ id: 'd', status: 'paid', amount: 300, billed_at: '2026-08-05T00:00:00Z' }),
      ],
      [{ invoice_id: 'c', amount: 50, paid_on: '2026-08-10' }],
      JOBS,
      TODAY,
    )
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]))
    expect(byKey['a']!.status).toBe('draft')
    expect(byKey['b']!.status).toBe('billed')
    expect(byKey['b']!.agingDays).toBe(34)
    expect(byKey['c']!.status).toBe('partial')
    expect(byKey['c']!.applied).toBe(50)
    expect(byKey['c']!.lastPaidOnIso).toBe('2026-08-10')
    expect(byKey['d']!.status).toBe('paid')
    expect(byKey['d']!.agingDays).toBeNull()
  })

  it('totals ARE the money strip\'s numbers: billed/paid invoices per job, every payment collected', () => {
    const { totals } = buildCustomerInvoiceRows(
      [
        inv({ id: 'a', status: 'ready_to_bill', amount: 999 }), // draft — excluded
        inv({ id: 'b', status: 'billed', amount: 1000 }),
        inv({ id: 'c', status: 'paid', amount: 500 }),
      ],
      [
        { invoice_id: 'b', amount: 400, paid_on: '2026-08-01' },
        { invoice_id: 'c', amount: 500, paid_on: '2026-07-01' },
        { invoice_id: 'a', amount: 1, paid_on: '2026-07-01' }, // every payment row counts — same as the strip's "collected"
      ],
      JOBS,
      TODAY,
    )
    expect(totals).toEqual({ count: 3, billedTotal: 1500, collectedTotal: 901 })
  })

  it('J34-F1: a billed/paid job with no invoice rows adds its shell revenue, and record-only payments are collected — the footer equals the Profile strip', () => {
    const jobs = [
      { id: 'j1', label: '941', status: 'billed', revenue: 1200 }, // has an invoice → invoice arm
      { id: 'hcp', label: 'HCP-12', status: 'paid', revenue: 8_400 }, // HCP-era: no invoice rows → shell arm
      { id: 'w', label: '972', status: 'working', revenue: 5_000 }, // unbilled → nothing
    ]
    const { totals } = buildCustomerInvoiceRows(
      [inv({ id: 'b', job_id: 'j1', status: 'billed', amount: 1000 })],
      [
        { invoice_id: 'b', amount: 400, paid_on: '2026-08-01' },
        { invoice_id: null, amount: 8_400, paid_on: '2026-03-01' }, // job-level backfilled payment
      ],
      jobs,
      TODAY,
    )
    expect(totals).toEqual({ count: 1, billedTotal: 1000 + 8_400, collectedTotal: 400 + 8_400 })
  })

  it('part labels only for multi-invoice jobs; sorted newest billed first', () => {
    const { rows } = buildCustomerInvoiceRows(
      [
        inv({ id: 'a', job_id: 'j1', sequence_order: 1, billed_at: '2026-08-01T00:00:00Z' }),
        inv({ id: 'b', job_id: 'j1', sequence_order: 2, billed_at: '2026-08-10T00:00:00Z' }),
        inv({ id: 'c', job_id: 'j2', sequence_order: 1, billed_at: '2026-08-05T00:00:00Z' }),
      ],
      [],
      JOBS,
      TODAY,
    )
    expect(rows.map((r) => r.key)).toEqual(['b', 'c', 'a'])
    expect(rows.find((r) => r.key === 'b')!.partLabel).toBe('#2')
    expect(rows.find((r) => r.key === 'c')!.partLabel).toBeNull()
    expect(rows.find((r) => r.key === 'c')!.jobLabel).toBe('972')
  })
})

describe('a bill an in-kind deal pays (punch list #301)', () => {
  const jobs = [
    { id: 'j1', label: '941', in_kind_arrangement_id: 'deal-1' },
    { id: 'j2', label: '972' },
  ]

  it('a covered bill is scheduled: it has no age, however old it is', () => {
    const { rows } = buildCustomerInvoiceRows([inv({ id: 'a', estimated_bill_date: '2026-01-10' })], [], jobs, TODAY)
    expect(rows[0]).toMatchObject({ status: 'billed', scheduledInKind: true, agingDays: null })
    expect(customerInvoiceChipTail(rows[0]!)).toBe(' · in kind')
  })

  it('a payer part covered: the bill off the deal still ages', () => {
    const { rows } = buildCustomerInvoiceRows(
      [inv({ id: 'a', job_id: 'j1', estimated_bill_date: '2026-01-10' }), inv({ id: 'b', job_id: 'j2', estimated_bill_date: '2026-06-18' })],
      [],
      jobs,
      TODAY,
    )
    const off = rows.find((r) => r.key === 'b')!
    expect(off).toMatchObject({ scheduledInKind: false, agingDays: 60 })
    expect(customerInvoiceChipTail(off)).toBe(' · 60d')
    expect(rows.find((r) => r.key === 'a')!.scheduledInKind).toBe(true)
  })

  it('an ordinary late bill reads as before, and a young one says nothing after its status', () => {
    const { rows } = buildCustomerInvoiceRows([inv({ id: 'a', job_id: 'j2', estimated_bill_date: '2026-05-01' }), inv({ id: 'b', job_id: 'j2' })], [], jobs, TODAY)
    expect(customerInvoiceChipTail(rows.find((r) => r.key === 'a')!)).toBe(' · 108d')
    expect(customerInvoiceChipTail(rows.find((r) => r.key === 'b')!)).toBe('')
  })

  it('a paid or a draft bill on a deal is not marked: only open bills are scheduled', () => {
    const { rows } = buildCustomerInvoiceRows([inv({ id: 'a', status: 'paid' }), inv({ id: 'b', status: 'ready_to_bill', sequence_order: 2 })], [], jobs, TODAY)
    expect(rows.every((r) => !r.scheduledInKind)).toBe(true)
  })
})
