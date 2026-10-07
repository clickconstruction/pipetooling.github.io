// @vitest-environment jsdom
/**
 * Render tests for the Move window (v2.4803): an ordinary row gets the one-RPC words; a check
 * Stripe holds as paid gets the four steps listed before the press.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders, useAuthModuleMock } from '../../test/renderSmokeMocks'
import { JobPaymentMoveModal } from './JobPaymentMoveModal'
import type { JobsLedgerInvoiceRow, PaymentRow } from '../../lib/jobs/jobFormTypes'
import type { JobWithDetails } from '../../types/jobWithDetails'

vi.mock('../../hooks/useAuth', async () => useAuthModuleMock())
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const row = (over: Partial<PaymentRow> = {}): PaymentRow =>
  ({ id: 'p1', amount: 6200, paid_on: '2025-10-28', sent_on: null, note: null, payment_type: 'Check', reference_number: '1042', invoice_id: 'inv-s', mercury_transaction_id: null, ...over })
const heldBill = { id: 'inv-s', status: 'paid', amount: 6200, stripe_invoice_id: 'in_1', external_send_channel: 'stripe', stripe_invoice_status: 'paid' } as unknown as JobsLedgerInvoiceRow
const plainBill = { id: 'inv-p', status: 'billed', amount: 6200, sent_to_customer_at: null, stripe_invoice_id: null } as unknown as JobsLedgerInvoiceRow
const job = (invoices: JobsLedgerInvoiceRow[]) => ({ id: 'j186', hcp_number: '186', click_number: null, job_name: 'Dudley Mason', revenue: 6200, payments: [], invoices }) as unknown as JobWithDetails

describe('JobPaymentMoveModal', () => {
  it('a check Stripe holds: the window names the four steps before the press', () => {
    renderWithProviders(<JobPaymentMoveModal open payment={row()} fromJob={job([heldBill])} onClose={() => {}} onMoved={() => {}} />)
    // first paint
    expect(screen.getByRole('dialog', { name: 'Move this payment' }).textContent).toContain('Move this check')
    expect(screen.getByTestId('held-move-intro').textContent).toContain('Stripe never reopens a paid invoice')
    const steps = screen.getByTestId('held-move-steps')
    expect(steps.textContent).toContain("A credit note in Stripe reverses the paid mark on J186's $6,200.00 bill")
    expect(steps.textContent).toContain('J186 is Ready to Bill')
    expect(steps.textContent).toContain('The $6,200.00 check lands on the job you pick')
    expect(steps.textContent).toContain('moved → the job you pick')
    expect(screen.getByText('Pick a job')).toBeTruthy()
  })

  it('v2.4822: a cash payment Stripe holds is called a payment, not a check', () => {
    renderWithProviders(<JobPaymentMoveModal open payment={row({ payment_type: 'Cash', reference_number: null })} fromJob={job([heldBill])} onClose={() => {}} onMoved={() => {}} />)
    // first paint
    expect(screen.getByRole('dialog', { name: 'Move this payment' }).textContent).toContain('Move this payment')
    expect(screen.getByTestId('held-move-intro').textContent).toContain('Stripe holds this payment as paid')
    expect(screen.getByTestId('held-move-steps').textContent).toContain('The $6,200.00 payment lands on the job you pick')
    expect(screen.getByTestId('held-move-steps').textContent).not.toContain('check')
  })

  it('an ordinary row keeps the one-RPC words and no step list', () => {
    renderWithProviders(<JobPaymentMoveModal open payment={row({ invoice_id: 'inv-p' })} fromJob={job([plainBill])} onClose={() => {}} onMoved={() => {}} />)
    // first paint
    expect(screen.getByText('Move this payment')).toBeTruthy()
    expect(screen.queryByTestId('held-move-steps')).toBeNull()
    expect(screen.queryByTestId('held-move-intro')).toBeNull()
  })
})
