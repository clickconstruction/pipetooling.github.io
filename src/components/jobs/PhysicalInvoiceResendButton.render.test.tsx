// @vitest-environment jsdom
/**
 * Render smokes for the physical-invoice "Email again" control (v2.2605):
 * confirm-first (nothing sends on the first click), the confirm names the
 * recipient, and a confirmed send targets the exact invoice + fires onSent.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import PhysicalInvoiceResendButton from './PhysicalInvoiceResendButton'

const resend = vi.fn(async (_invoice: unknown) => ({ ok: true as const, sentTo: 'owner@site.com' }))
vi.mock('../../lib/resendPhysicalInvoiceEmail', () => ({
  resendPhysicalInvoiceEmailForBilledInvoice: (invoice: unknown) => resend(invoice),
}))
vi.mock('../../contexts/ToastContext', () => ({
  useToastContext: () => ({ showToast: vi.fn() }),
}))

describe('PhysicalInvoiceResendButton', () => {
  beforeEach(() => {
    resend.mockClear()
  })

  it('confirms first, names the recipient, then sends the exact invoice and fires onSent', async () => {
    const onSent = vi.fn()
    render(
      <PhysicalInvoiceResendButton invoice={{ id: 'inv-1', job_id: 'job-1' }} recipientEmail="owner@site.com" onSent={onSent} />,
    )
    fireEvent.click(screen.getByText('Email again — PDF attached'))
    expect(resend).not.toHaveBeenCalled()
    expect(screen.getByText('owner@site.com')).toBeTruthy()
    fireEvent.click(screen.getByText('Send email'))
    await waitFor(() => expect(resend).toHaveBeenCalledWith({ id: 'inv-1', job_id: 'job-1' }))
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1))
  })

  it('Cancel closes the confirm without sending', () => {
    render(<PhysicalInvoiceResendButton invoice={{ id: 'inv-2', job_id: 'job-2' }} recipientEmail={null} />)
    fireEvent.click(screen.getByText('Email again — PDF attached'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('Send email')).toBeNull()
    expect(resend).not.toHaveBeenCalled()
  })
})
