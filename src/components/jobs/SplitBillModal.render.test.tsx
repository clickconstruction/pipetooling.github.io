// @vitest-environment jsdom
/**
 * Render tests for SplitBillModal (v2.1520): the parts editor math is wired to the
 * splitBillParts kernel — remainder auto-fills, submit stays disabled until the
 * typed parts are valid, and the add/remove-part controls respect the 2–4 cap.
 */
import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach } from 'vitest'

import { SplitBillModal } from './SplitBillModal'
import { installDomShims } from '../../test/renderSmokeMocks'
import { ToastProvider } from '../../contexts/ToastContext'
import type { InvoiceWithJobForBillView } from './HostedStripeBillPanel'
import type { StripeInvoiceDetailsSuccess } from '../../lib/stripeInvoiceDetailsResponse'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' }, role: 'dev' }),
}))

const invoice = {
  id: 'inv-1',
  amount: 5000,
  status: 'billed',
  stripe_invoice_id: 'in_123',
  hosted_invoice_url: 'https://stripe.test/pay',
  stripe_invoice_memo: 'Septic install',
  stripe_invoice_footer: null,
  stripe_mode: 'test',
  job: {
    id: 'job-1',
    customer_id: 'cust-1',
    customer_email: 'c@example.com',
    customer_name: 'Customer',
    invoices: [],
    payments: [],
  },
} as unknown as InvoiceWithJobForBillView

const stripeDetail = {
  success: true,
  currency: 'usd',
  total: 500000,
  amount_due: 500000,
  amount_remaining: 500000,
  amount_paid: 0,
  paid_at: null,
  oob_paid_on: null,
  due_date: null,
  invoice_number: '560-2608101530',
  customer_name: 'Customer',
  customer_email: 'c@example.com',
  seller_name: null,
  memo: 'Septic install',
  footer: null,
  lines: [],
} as StripeInvoiceDetailsSuccess

function renderModal() {
  installDomShims()
  return render(
    <ToastProvider>
      <SplitBillModal open invoice={invoice} stripeDetail={stripeDetail} onClose={() => {}} onDone={() => {}} />
    </ToastProvider>,
  )
}

afterEach(cleanup)

describe('SplitBillModal parts editor', () => {
  it('starts at 2 parts with a disabled submit and auto-fills the remainder as you type', () => {
    renderModal()
    const submit = screen.getByRole('button', { name: 'Split into 2 bills' }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Part 1 amount'), { target: { value: '2,000' } })
    expect(screen.getByLabelText('Part 2 (remainder) amount (remainder)').textContent).toContain('3,000.00')
    expect((screen.getByRole('button', { name: 'Split into 2 bills' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('rejects an overshooting part and caps parts at 4', () => {
    renderModal()
    fireEvent.change(screen.getByLabelText('Part 1 amount'), { target: { value: '6000' } })
    expect((screen.getByRole('button', { name: 'Split into 2 bills' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '+ Add another part' }))
    fireEvent.click(screen.getByRole('button', { name: '+ Add another part' }))
    expect(screen.getByRole('button', { name: 'Split into 4 bills' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '+ Add another part' })).toBeNull()
  })
})
