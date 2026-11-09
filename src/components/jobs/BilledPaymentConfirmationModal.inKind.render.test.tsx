// @vitest-environment jsdom
/**
 * Render tests for an in-kind payment in the Record a cash or check payment
 * window (v2.6816): In kind is offered with the other kinds, the memo is asked
 * for and refused when blank, the words under the kind say what it counts as,
 * and on a Stripe bill the credit line reads a credit applied, never money
 * received.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders, useAuthModuleMock } from '../../test/renderSmokeMocks'
import BilledPaymentConfirmationModal, { type InvoiceWithJobLike, type JobLikeForPayment } from './BilledPaymentConfirmationModal'
import { IN_KIND_MEMO_REQUIRED, PAYMENT_KIND_CHOICES } from '../../lib/jobs/inKindPayment'

vi.mock('../../hooks/useAuth', async () => useAuthModuleMock())

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn(async (..._args: unknown[]) => ({ data: null, error: null })) }))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc,
    auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) },
    functions: { invoke: vi.fn(async () => ({ data: { success: true, partial: true }, error: null })) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { status: 'paid' } }) }) }) }),
  },
}))

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

const plainJob: JobLikeForPayment = { id: 'job7', hcp_number: null, click_number: '7', job_name: 'Shop plumbing', revenue: 2000, payments_made: 0 }

function renderStripeWindow() {
  return renderWithProviders(
    <BilledPaymentConfirmationModal mode="invoice" invoice={stripeInvoice()} payments={[]} job={null} stripeModeForBilling="live" onClose={() => {}} onSuccess={() => {}} />,
  )
}

function renderJobWindow() {
  return renderWithProviders(
    <BilledPaymentConfirmationModal mode="job" invoice={null} payments={[]} job={plainJob} stripeModeForBilling="live" onClose={() => {}} onSuccess={() => {}} />,
  )
}

function pickInKind() {
  const type = screen.getByRole('combobox') as HTMLSelectElement
  fireEvent.change(type, { target: { value: 'In kind' } })
  return type
}

describe('BilledPaymentConfirmationModal — In kind (v2.6816)', () => {
  it('offers In kind with the other kinds, and asks for the memo once it is picked', () => {
    renderJobWindow()
    const type = screen.getByRole('combobox') as HTMLSelectElement
    expect([...type.options].map((o) => o.value)).toEqual([...PAYMENT_KIND_CHOICES])
    expect(screen.queryByTestId('in-kind-note')).toBeNull()
    expect(screen.getByLabelText('Internal notes (optional)')).toBeTruthy()
    pickInKind()
    expect(screen.getByLabelText('What was given instead of money')).toBeTruthy()
    const note = screen.getByTestId('in-kind-note')
    expect(note.textContent).toContain('never counted as money in the bank')
    expect(note.textContent).not.toMatch(/Stripe/)
  })

  it('refuses to record an in-kind payment with no memo, and records it with one', async () => {
    rpc.mockClear()
    renderJobWindow()
    pickInKind()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(await screen.findByText(IN_KIND_MEMO_REQUIRED)).toBeTruthy()
    expect(rpc).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('What was given instead of money'), { target: { value: 'Rent credit, March 2026' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await vi.waitFor(() => expect(rpc).toHaveBeenCalled())
    const call = rpc.mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(call[0]).toBe('mark_job_paid')
    expect(call[1]).toMatchObject({ p_job_id: 'job7', p_amount: 2000, p_payment_type: 'In kind', p_note: 'Rent credit, March 2026' })
  })

  it('on a Stripe bill a part credit reads "Credit applied", never received, and a whole one closes outside Stripe', () => {
    renderStripeWindow()
    pickInKind()
    expect(screen.getByTestId('in-kind-note').textContent).toContain('pay link stops working')
    expect(screen.queryByText(/payment\s+received outside Stripe/)).toBeNull()
    const box = screen.getAllByRole('textbox')[0] as HTMLInputElement
    fireEvent.change(box, { target: { value: '1000' } })
    const part = screen.getByTestId('stripe-part-payment-note')
    expect(part.textContent).toMatch(/Credit applied \w{3} \d{1,2} · \$1,000\.00/)
    expect(part.textContent).not.toMatch(/received/)
    expect(screen.getByTestId('in-kind-note').textContent).toContain('credit line')
    expect(screen.getByText('Record $1,000.00 · $500.00 stays due')).toBeTruthy()
  })
})
