// @vitest-environment jsdom
/**
 * Render tests for the Record a cash or check payment window on a Stripe bill
 * (v2.3695): the amount box takes any amount up to the open balance — under
 * it the window explains the part payment and the button carries both
 * numbers; over it the window says how much is open; at it, today's close.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders, useAuthModuleMock } from '../../test/renderSmokeMocks'
import BilledPaymentConfirmationModal, { type InvoiceWithJobLike } from './BilledPaymentConfirmationModal'

vi.mock('../../hooks/useAuth', async () => useAuthModuleMock())

function stripeInvoice(over: Partial<InvoiceWithJobLike> = {}): InvoiceWithJobLike {
  return {
    id: 'inv-s',
    job_id: 'job1022',
    amount: 1500,
    status: 'billed',
    stripe_invoice_id: 'in_123',
    external_send_channel: 'stripe',
    hosted_invoice_url: 'https://invoice.stripe.com/i/x',
    sent_to_customer_at: '2026-09-21T12:00:00Z',
    job: { id: 'job1022', hcp_number: '', click_number: '1022', job_name: 'Aguirre Well', revenue: 1500, payments_made: 0 },
    ...over,
  } as unknown as InvoiceWithJobLike
}

function renderWindow(payments: Array<{ invoice_id: string | null; amount: number }> = [], initialAmount: number | null = null) {
  return renderWithProviders(
    <BilledPaymentConfirmationModal
      mode="invoice"
      invoice={stripeInvoice()}
      payments={payments}
      job={null}
      initialAmount={initialAmount}
      stripeModeForBilling="live"
      onClose={() => {}}
      onSuccess={() => {}}
    />,
  )
}

describe('BilledPaymentConfirmationModal — part cash on a Stripe bill (v2.3695)', () => {
  it('opens at the open balance with the amount editable and the full-close button', () => {
    renderWindow()
    expect(screen.getByText('Record a cash or check payment')).toBeTruthy()
    const box = screen.getAllByRole('textbox')[0] as HTMLInputElement
    expect(box.value).toBe('1500')
    expect(box.disabled).toBe(false)
    expect(screen.getByText('Record $1,500.00')).toBeTruthy()
    expect(screen.queryByTestId('stripe-part-payment-note')).toBeNull()
  })

  it('under the balance: the part-payment note names the credit line and the button carries both numbers', () => {
    renderWindow()
    const box = screen.getAllByRole('textbox')[0] as HTMLInputElement
    fireEvent.change(box, { target: { value: '1000' } })
    const note = screen.getByTestId('stripe-part-payment-note')
    expect(note.textContent).toContain('Stripe lowers the bill to $500.00 due')
    expect(note.textContent).toContain('“Cash received')
    expect(note.textContent).toContain('$1,000.00”')
    expect(screen.getByText('Record $1,000.00 · $500.00 stays due')).toBeTruthy()
  })

  it('over the balance: says how much is open and keeps Confirm inert', () => {
    renderWindow()
    const box = screen.getAllByRole('textbox')[0] as HTMLInputElement
    fireEvent.change(box, { target: { value: '2000' } })
    expect(screen.getByTestId('stripe-over-note').textContent).toMatch(/more than the \$1,500\.00 open/)
    expect(screen.getByText('Confirm')).toBeTruthy()
  })

  it('the open balance counts payments already on the bill, and a typed hand-off amount prefills up to it', () => {
    renderWindow([{ invoice_id: 'inv-s', amount: 1000 }], 700)
    const box = screen.getAllByRole('textbox')[0] as HTMLInputElement
    expect(box.value).toBe('500')
    expect(screen.getByText('Record $500.00')).toBeTruthy()
  })
})
