import { describe, expect, it } from 'vitest'
import {
  canRemovePaymentRowFromForm,
  canUnlinkMercuryPayment,
  jobsLedgerInvoiceIsStripeLinked,
  mercuryLinkedPaymentRow,
  paymentRowLinkedToInvoice,
  stripeBillInvoiceForPaymentRow,
} from './jobFormPaymentPredicates'
import type { JobsLedgerInvoiceRow, PaymentRow } from './jobFormTypes'
import type { JobWithDetails } from '../../types/jobWithDetails'

const payment = (o: Partial<PaymentRow> = {}): PaymentRow => ({ id: 'p', amount: 0, paid_on: null, note: null, payment_type: null, reference_number: null, invoice_id: null, mercury_transaction_id: null, ...o })
const jobWithInvoice = (inv: Partial<JobsLedgerInvoiceRow>) => ({ invoices: [{ id: 'i1', ...inv }] }) as unknown as JobWithDetails

describe('linkage predicates', () => {
  it('mercuryLinkedPaymentRow / paymentRowLinkedToInvoice', () => {
    expect(mercuryLinkedPaymentRow(payment())).toBe(false)
    expect(mercuryLinkedPaymentRow(payment({ mercury_transaction_id: 'm' }))).toBe(true)
    expect(paymentRowLinkedToInvoice(payment())).toBe(false)
    expect(paymentRowLinkedToInvoice(payment({ invoice_id: 'i' }))).toBe(true)
  })
  it('jobsLedgerInvoiceIsStripeLinked via stripe id or channel', () => {
    expect(jobsLedgerInvoiceIsStripeLinked({ stripe_invoice_id: 'in_1', external_send_channel: null } as JobsLedgerInvoiceRow)).toBe(true)
    expect(jobsLedgerInvoiceIsStripeLinked({ stripe_invoice_id: null, external_send_channel: 'stripe' } as JobsLedgerInvoiceRow)).toBe(true)
    expect(jobsLedgerInvoiceIsStripeLinked({ stripe_invoice_id: null, external_send_channel: 'physical' } as JobsLedgerInvoiceRow)).toBe(false)
  })
})

describe('canUnlinkMercuryPayment', () => {
  it('office roles only', () => {
    expect(canUnlinkMercuryPayment('dev')).toBe(true)
    expect(canUnlinkMercuryPayment('primary')).toBe(true)
    expect(canUnlinkMercuryPayment('technician')).toBe(false)
    expect(canUnlinkMercuryPayment(null)).toBe(false)
  })
})

describe('stripeBillInvoiceForPaymentRow / canRemovePaymentRowFromForm', () => {
  it('returns the linked stripe invoice, else null', () => {
    const job = jobWithInvoice({ stripe_invoice_id: 'in_1' })
    expect(stripeBillInvoiceForPaymentRow(payment({ invoice_id: 'i1' }), job)?.id).toBe('i1')
    expect(stripeBillInvoiceForPaymentRow(payment({ invoice_id: 'i1' }), null)).toBeNull()
    expect(stripeBillInvoiceForPaymentRow(payment(), job)).toBeNull() // not invoice-linked
  })
  it('a plain manual row is removable; mercury/invoice/stripe-linked rows are not', () => {
    expect(canRemovePaymentRowFromForm(payment(), null)).toBe(true)
    expect(canRemovePaymentRowFromForm(payment({ mercury_transaction_id: 'm' }), null)).toBe(false)
    expect(canRemovePaymentRowFromForm(payment({ invoice_id: 'i1' }), jobWithInvoice({ stripe_invoice_id: 'in_1' }))).toBe(false)
  })
})
