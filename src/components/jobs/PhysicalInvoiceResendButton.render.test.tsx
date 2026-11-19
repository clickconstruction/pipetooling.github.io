// @vitest-environment jsdom
/**
 * Render smokes for the physical-invoice "Email again" control (v2.2605):
 * confirm-first (nothing sends on the first click), the confirm names the
 * recipient, and a confirmed send targets the exact invoice + fires onSent.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import PhysicalInvoiceResendButton from './PhysicalInvoiceResendButton'
import { settle } from '../../test/renderSmokeMocks'

const resend = vi.fn(async (_invoice: unknown) => ({ ok: true as const, sentTo: 'owner@site.com' }))
const readRecipient = vi.fn(
  async (_invoice: unknown): Promise<{ ok: true; recipient: { party: 'gc'; email: string } } | { ok: false; message: string }> => ({
    ok: true,
    recipient: { party: 'gc', email: 'ap@acme.example' },
  }),
)
vi.mock('../../lib/resendPhysicalInvoiceEmail', () => ({
  resendPhysicalInvoiceEmailForBilledInvoice: (invoice: unknown) => resend(invoice),
  readPaperBillResendRecipient: (invoice: unknown) => readRecipient(invoice),
}))
vi.mock('../../contexts/ToastContext', () => ({
  useToastContext: () => ({ showToast: vi.fn() }),
}))

describe('PhysicalInvoiceResendButton', () => {
  beforeEach(() => {
    resend.mockClear()
    readRecipient.mockClear()
  })

  it('confirms first, names the recipient, then sends the exact invoice and fires onSent', async () => {
    const onSent = vi.fn()
    render(
      <PhysicalInvoiceResendButton invoice={{ id: 'inv-1', job_id: 'job-1' }} recipientEmail="owner@site.com" onSent={onSent} />,
    )
    await settle()
    fireEvent.click(screen.getByText('Email again — PDF attached'))
    expect(resend).not.toHaveBeenCalled()
    expect(screen.getByText('owner@site.com')).toBeTruthy()
    fireEvent.click(screen.getByText('Send email'))
    await waitFor(() => expect(resend).toHaveBeenCalledWith({ id: 'inv-1', job_id: 'job-1' }))
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1))
  })

  it('Cancel closes the confirm without sending', async () => {
    render(<PhysicalInvoiceResendButton invoice={{ id: 'inv-2', job_id: 'job-2' }} recipientEmail={null} />)
    await settle()
    fireEvent.click(screen.getByText('Email again — PDF attached'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('Send email')).toBeNull()
    expect(resend).not.toHaveBeenCalled()
  })
  it("a bill that went to the GC reads the GC's billing email when the window opens, names it, and sends (v2.7959)", async () => {
    render(<PhysicalInvoiceResendButton invoice={{ id: 'inv-3', job_id: 'job-3' }} recipientEmail={null} readRecipient />)
    await settle()
    // Nothing is read until the window opens.
    expect(readRecipient).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Email again — PDF attached'))
    await waitFor(() => expect(screen.getByText('ap@acme.example')).toBeTruthy())
    expect(readRecipient).toHaveBeenCalledWith({ id: 'inv-3', job_id: 'job-3' })
    expect(screen.queryByText('the customer')).toBeNull()
    fireEvent.click(screen.getByText('Send email'))
    await waitFor(() => expect(resend).toHaveBeenCalledWith({ id: 'inv-3', job_id: 'job-3' }))
  })

  it('a GC with no billing email on record gets the reason and where to add it, and no send', async () => {
    readRecipient.mockResolvedValueOnce({ ok: false, message: 'The GC on this job has no billing email. Add it on Edit Job → GC/Builder → Billing email.' })
    render(<PhysicalInvoiceResendButton invoice={{ id: 'inv-4', job_id: 'job-4' }} recipientEmail={null} readRecipient />)
    await settle()
    fireEvent.click(screen.getByText('Email again — PDF attached'))
    await waitFor(() => expect(screen.getByText(/The GC on this job has no billing email/)).toBeTruthy())
    expect(screen.queryByText('Send email')).toBeNull()
    fireEvent.click(screen.getByText('Close'))
    expect(resend).not.toHaveBeenCalled()
  })

  it('a bill to the customer reads nothing: the window names the address it was given, as before', async () => {
    render(<PhysicalInvoiceResendButton invoice={{ id: 'inv-5', job_id: 'job-5' }} recipientEmail="pat@example.com" />)
    await settle()
    fireEvent.click(screen.getByText('Email again — PDF attached'))
    expect(screen.getByText('pat@example.com')).toBeTruthy()
    expect(readRecipient).not.toHaveBeenCalled()
  })
})
