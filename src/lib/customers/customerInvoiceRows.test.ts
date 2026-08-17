import { describe, expect, it } from 'vitest'
import {
  buildCustomerInvoiceRows,
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

  it('totals use the billed/paid basis and reconcile like the money strip', () => {
    const { totals } = buildCustomerInvoiceRows(
      [
        inv({ id: 'a', status: 'ready_to_bill', amount: 999 }), // draft — excluded
        inv({ id: 'b', status: 'billed', amount: 1000 }),
        inv({ id: 'c', status: 'paid', amount: 500 }),
      ],
      [
        { invoice_id: 'b', amount: 400, paid_on: '2026-08-01' },
        { invoice_id: 'c', amount: 500, paid_on: '2026-07-01' },
        { invoice_id: 'a', amount: 1, paid_on: '2026-07-01' }, // draft payment — excluded from collected
      ],
      JOBS,
      TODAY,
    )
    expect(totals).toEqual({ count: 3, billedTotal: 1500, collectedTotal: 900 })
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
