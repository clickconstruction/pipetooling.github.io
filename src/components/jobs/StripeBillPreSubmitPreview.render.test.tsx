// @vitest-environment jsdom
/**
 * Bill Customer "What the customer will see" (v2.3288): the bill built from
 * the job's own lines shows whenever Stripe's preview is not here, with the
 * lines, the negative discount line and the total; Stripe's answer wins.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { StripeBillPreSubmitPreview } from './StripeBillPreSubmitPreview'
import type { StripeInvoicePreviewSuccess } from '../../lib/stripeInvoicePreview'

afterEach(cleanup)

const snapshot = (over: Partial<StripeInvoicePreviewSuccess> = {}): StripeInvoicePreviewSuccess => ({
  success: true,
  currency: 'usd',
  subtotal: 450000,
  total: 450000,
  amount_due: 450000,
  amount_paid: 0,
  amount_remaining: 450000,
  due_date: null,
  seller_name: null,
  lines: [
    { description: 'Water heater install', amount: 300000, quantity: 1, source: { kind: 'fixture', jobs_ledger_fixture_id: 'a' } },
    { description: 'Repipe kitchen', amount: 200000, quantity: 1, source: { kind: 'fixture', jobs_ledger_fixture_id: 'b' } },
    { description: 'Negotiated discount (10%)', amount: -50000, quantity: 1, source: { kind: 'discount', jobs_ledger_fixture_id: 'd' } },
  ],
  invoice_number: '1018-2609151205',
  customer_name: 'ZZ Scratch Customer',
  customer_email: null,
  ...over,
})

const baseProps = {
  customerName: 'ZZ Scratch Customer',
  customerEmail: null,
  jobName: 'ZZ Discount test',
  hcpNumber: '1018',
  amountLabel: '$4,500.00',
  dueDateYmd: '2026-09-15',
  memo: '',
  localLineDescription: 'Custom service.',
  stripePreviewLoading: false,
  stripePreviewError: null,
}

describe('StripeBillPreSubmitPreview', () => {
  it('shows the local bill — lines, the negative discount, the total — and names the blocker', () => {
    render(
      <StripeBillPreSubmitPreview
        {...baseProps}
        stripePreview={null}
        localPreview={snapshot()}
        previewIdleHint="Add the customer's email above and Stripe's exact preview appears here — the lines below are what the bill will list."
      />,
    )
    expect(screen.getByTestId('stripe-bill-local-lines')).toBeTruthy()
    expect(screen.getByTestId('stripe-bill-local-tag').textContent).toMatch(/from the job.s lines/)
    expect(screen.getByText('Negotiated discount (10%)')).toBeTruthy()
    expect(screen.getByText('−$500.00')).toBeTruthy()
    expect(screen.getAllByText('$4,500.00').length).toBeGreaterThan(0)
    expect(screen.getByText(/Add the customer.s email above/)).toBeTruthy()
    expect(screen.queryByText(/Draft line:/)).toBeNull()
  })

  it("Stripe's own preview wins over the local one", () => {
    render(
      <StripeBillPreSubmitPreview
        {...baseProps}
        stripePreview={snapshot({ seller_name: 'Click Plumbing', lines: [{ description: 'From Stripe', amount: 450000, quantity: 1 }] })}
        localPreview={snapshot()}
      />,
    )
    expect(screen.getByTestId('stripe-bill-lines')).toBeTruthy()
    expect(screen.queryByTestId('stripe-bill-local-tag')).toBeNull()
    expect(screen.getByText('From Stripe')).toBeTruthy()
    expect(screen.queryByText('Water heater install')).toBeNull()
  })

  it('with neither, the old draft line stays', () => {
    render(<StripeBillPreSubmitPreview {...baseProps} stripePreview={null} localPreview={null} previewIdleHint="Preparing billing line…" />)
    expect(screen.getByText(/Draft line: Custom service\./)).toBeTruthy()
    expect(screen.queryByTestId('stripe-bill-local-lines')).toBeNull()
  })
})
