// @vitest-environment jsdom
/**
 * Render smokes for Send Email invoice (v2.4020): the confirm says where the bill email goes
 * and who the customer pays, the send reads the function's outcome, and the green line is
 * the outcome's own sentence — ours, a test bill that came to the sender, or Stripe's when
 * ours could not go.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StripeInvoiceSendFromStripeButton } from './StripeInvoiceSendFromStripeButton'
import { settle } from '../../test/renderSmokeMocks'

const showToast = vi.fn()
const invoke = vi.fn()

vi.mock('../../contexts/ToastContext', () => ({ useToastContext: () => ({ showToast }) }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown>
  return {
    supabase: {
      ...stub,
      auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'jwt' } }, error: null }) },
      functions: { invoke: (...args: unknown[]) => invoke(...args) },
    },
  }
})

const props = {
  jobsLedgerInvoiceId: '8f3c2a1e-6b7d-4c9a-9e21-5d0f7a3b1c44',
  stripeInvoiceId: 'in_1',
  customerEmail: 'ap@hartwell.example',
  stripeModeForBilling: 'live' as const,
}

async function send() {
  await settle()
  fireEvent.click(screen.getByRole('button', { name: /Send Email invoice/ }))
  fireEvent.click(await screen.findByRole('button', { name: 'Yes, send it' }))
}

describe('StripeInvoiceSendFromStripeButton', () => {
  beforeEach(() => {
    showToast.mockReset()
    invoke.mockReset()
    sessionStorage.clear()
  })

  it('the confirm names the address, the sender and where the customer pays', async () => {
    render(<StripeInvoiceSendFromStripeButton {...props} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /Send Email invoice/ }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain('Email this invoice?')
    expect(dialog.textContent).toContain('The bill email goes to ap@hartwell.example from ClickTooling; they pay on Stripe.')
    expect(dialog.textContent).toContain('the QR code and short address of their statement')
    expect(dialog.textContent).not.toContain('Test mode')
  })

  it('in test mode the confirm says the email comes to you', async () => {
    render(<StripeInvoiceSendFromStripeButton {...props} stripeModeForBilling="test" />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /Send Email invoice/ }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain('Test mode: the bill email comes to you, not to ap@hartwell.example.')
  })

  it('our send: the line names the address, with the copies', async () => {
    invoke.mockResolvedValue({ data: { success: true, sent_by: 'clicktooling', delivered_to: 'ap@hartwell.example', copies_sent: ['pm@hartwell.example'], copies_failed: [] }, error: null })
    const onSent = vi.fn()
    render(<StripeInvoiceSendFromStripeButton {...props} onSent={onSent} />)
    await send()
    expect((await screen.findByRole('status')).textContent).toBe('Bill email sent to ap@hartwell.example.')
    expect(invoke).toHaveBeenCalledWith('send-stripe-invoice', expect.objectContaining({ body: expect.objectContaining({ jobs_ledger_invoice_id: props.jobsLedgerInvoiceId }) }))
    expect(showToast).toHaveBeenCalledWith('Bill email sent to ap@hartwell.example. Copies went to pm@hartwell.example.', 'success')
    expect(onSent).toHaveBeenCalledTimes(1)
  })

  it('a test bill: the line says it came to the sender', async () => {
    invoke.mockResolvedValue({ data: { success: true, sent_by: 'clicktooling', delivered_to: 'office@click.example', test_redirected: true }, error: null })
    render(<StripeInvoiceSendFromStripeButton {...props} stripeModeForBilling="test" />)
    await send()
    expect((await screen.findByRole('status')).textContent).toBe('Test bill: the email came to you (office@click.example), not the customer.')
  })

  it('Stripe sent it because ours could not go: the line says so', async () => {
    invoke.mockResolvedValue({ data: { success: true, sent_by: 'stripe', delivered_to: 'ap@hartwell.example', fallback_reason: 'send_failed' }, error: null })
    render(<StripeInvoiceSendFromStripeButton {...props} />)
    await send()
    expect((await screen.findByRole('status')).textContent).toBe('Stripe sent the invoice email — ours could not go out, so this one has no account code.')
  })

  it('the function before this release names no sender: Stripe’s wording', async () => {
    invoke.mockResolvedValue({ data: { success: true, customer_email: 'ap@hartwell.example' }, error: null })
    render(<StripeInvoiceSendFromStripeButton {...props} />)
    await send()
    expect((await screen.findByRole('status')).textContent).toBe('Stripe sent the invoice email.')
  })

  it('the line survives a remount', async () => {
    invoke.mockResolvedValue({ data: { success: true, sent_by: 'clicktooling', delivered_to: 'ap@hartwell.example' }, error: null })
    const first = render(<StripeInvoiceSendFromStripeButton {...props} />)
    await send()
    await screen.findByRole('status')
    first.unmount()
    render(<StripeInvoiceSendFromStripeButton {...props} />)
    expect((await screen.findByRole('status')).textContent).toBe('Bill email sent to ap@hartwell.example.')
  })

  it('an error from the function shows and leaves no green line', async () => {
    invoke.mockResolvedValue({ data: { error: 'This Stripe invoice is already paid' }, error: null })
    render(<StripeInvoiceSendFromStripeButton {...props} />)
    await send()
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('This Stripe invoice is already paid', 'error'))
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText('This Stripe invoice is already paid')).toBeTruthy()
  })
})
