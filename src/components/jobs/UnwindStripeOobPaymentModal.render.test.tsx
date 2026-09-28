// @vitest-environment jsdom
/**
 * Undo out-of-band payment (v2.4062): the send-back is on by default, the
 * reason can be prefilled by the door that opened it, and after the undo the
 * bill line is sent back through the one send-back path — or not, when the
 * box is unticked. Wiring-level only; the words live in
 * src/lib/jobs/stripeOobSendBack.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const invokes = vi.hoisted(() => ({ calls: [] as Array<{ fn: string; body: unknown }> }))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'tok' } } }) },
    functions: {
      invoke: (fn: string, opts: { body: unknown }) => {
        invokes.calls.push({ fn, body: opts.body })
        return Promise.resolve({ data: { success: true, stripe_credit_note_id: 'cn_1' }, error: null })
      },
    },
  },
}))
const sendBackMock = vi.fn()
vi.mock('../../lib/voidStripeInvoiceForRevert', async () => {
  const actual = await vi.importActual<typeof import('../../lib/voidStripeInvoiceForRevert')>('../../lib/voidStripeInvoiceForRevert')
  return { ...actual, sendBackStripeBilledLine: (args: unknown) => sendBackMock(args) }
})

import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import UnwindStripeOobPaymentModal from './UnwindStripeOobPaymentModal'

afterEach(cleanup)
beforeEach(() => {
  invokes.calls.length = 0
  sendBackMock.mockReset()
  sendBackMock.mockResolvedValue({ ok: true, stripeAction: 'reverse_oob_mark', stripeCreditNoteId: 'cn_1' })
})

const invoice = { id: 'inv-1040', amount: 600, job_id: 'job-1040' }

describe('UnwindStripeOobPaymentModal', () => {
  it('undoes, then sends the line back through the one path, and reports sentBack', async () => {
    const results: unknown[] = []
    renderWithProviders(
      <UnwindStripeOobPaymentModal
        invoice={invoice}
        stripeModeForBilling="live"
        open
        initialReason="Check did not clear"
        onClose={() => {}}
        onSuccess={(r) => {
          results.push(r)
        }}
      />,
    )
    const box = screen.getByTestId('unwind-oob-send-back') as HTMLInputElement
    expect(box.checked).toBe(true)
    expect((screen.getByLabelText('Reason (required)') as HTMLTextAreaElement).value).toBe('Check did not clear')
    fireEvent.click(screen.getByText('Undo and send back'))
    await waitFor(() => expect(results).toHaveLength(1))
    expect(invokes.calls.map((c) => c.fn)).toEqual(['reverse-stripe-invoice-out-of-band-payment'])
    expect((invokes.calls[0].body as { reason: string }).reason).toBe('Check did not clear')
    expect(sendBackMock).toHaveBeenCalledTimes(1)
    expect(sendBackMock.mock.calls[0][0]).toMatchObject({ invoiceId: 'inv-1040', jobId: 'job-1040', stripeModeForBilling: 'live', accessToken: 'tok' })
    expect(results[0]).toEqual({ sentBack: true })
  })

  it('with the box unticked it only undoes and says so', async () => {
    const results: unknown[] = []
    renderWithProviders(
      <UnwindStripeOobPaymentModal
        invoice={invoice}
        stripeModeForBilling="live"
        open
        onClose={() => {}}
        onSuccess={(r) => {
          results.push(r)
        }}
      />,
    )
    fireEvent.click(screen.getByTestId('unwind-oob-send-back'))
    fireEvent.change(screen.getByLabelText('Reason (required)'), { target: { value: 'Marked by mistake' } })
    fireEvent.click(screen.getByText('Undo out-of-band payment'))
    await waitFor(() => expect(results).toHaveLength(1))
    expect(sendBackMock).not.toHaveBeenCalled()
    expect(results[0]).toEqual({ sentBack: false })
  })

  it('a failed send-back after a good undo hands the host the message', async () => {
    sendBackMock.mockResolvedValue({ ok: false, message: 'Stripe is down' })
    const results: unknown[] = []
    renderWithProviders(
      <UnwindStripeOobPaymentModal
        invoice={invoice}
        stripeModeForBilling="live"
        open
        initialReason="Check did not clear"
        onClose={() => {}}
        onSuccess={(r) => {
          results.push(r)
        }}
      />,
    )
    fireEvent.click(screen.getByText('Undo and send back'))
    await waitFor(() => expect(results).toHaveLength(1))
    expect(results[0]).toEqual({ sentBack: false, sendBackError: 'Stripe is down' })
  })
})
