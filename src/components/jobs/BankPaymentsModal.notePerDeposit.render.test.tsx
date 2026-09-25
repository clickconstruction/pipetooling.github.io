// @vitest-environment jsdom
/**
 * Render smoke (v2.3831): the internal note is per deposit. A note typed on one
 * deposit used to survive a switch to the next one and go out as that deposit's
 * p_note (apply_mercury_bank_payment_allocations) — the reset effect cleared the
 * allocation lines and the "Add a note" fold but never the note itself.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import BankPaymentsModal from './BankPaymentsModal'
import { buildBilledStageRows } from '../../lib/jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'

const deposit = (id: string, name: string, amount: number, postedAt: string) => ({
  mercury_transaction_id: id,
  amount,
  counterparty_name: name,
  note: null,
  external_memo: null,
  posted_at: postedAt,
  kind: 'checkDeposit',
  returned: false,
  consumed: 0,
  remaining_available: amount,
})

const DEPOSITS = [
  deposit('mtx-a', 'ALPHA PLUMBING LLC', 1200, '2026-08-28T15:00:00Z'),
  deposit('mtx-b', 'BRAVO BUILDERS INC', 800, '2026-08-27T15:00:00Z'),
]

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown>
  const baseRpc = stub.rpc as (...args: unknown[]) => unknown
  stub.rpc = (fn: string, ...rest: unknown[]) => {
    if (fn === 'list_mercury_transactions_for_bank_payments') return Promise.resolve({ data: DEPOSITS, error: null })
    return baseRpc(fn, ...rest)
  }
  return { supabase: stub }
})

/** One open bill, so the allocation lines (and the note under them) render. */
function billedJob(): JobWithDetails {
  return {
    id: 'job-501',
    status: 'billed',
    hcp_number: '501',
    click_number: null,
    job_name: 'Note Test',
    job_address: '1 Main St',
    customer_name: 'Alpha Plumbing LLC',
    revenue: 1200,
    payments_made: 0,
    materials: [],
    fixtures: [],
    payments: [],
    invoices: [
      { id: 'inv-501', job_id: 'job-501', amount: 1200, status: 'billed', sequence_order: 0, stripe_invoice_id: null, sent_to_customer_at: null, billed_at: null, estimated_bill_date: null },
    ],
    team_members: [],
  } as unknown as JobWithDetails
}

describe('BankPaymentsModal · the note is per deposit', () => {
  it('clears a typed note when another deposit is picked', async () => {
    renderWithProviders(
      <BankPaymentsModal open onClose={() => {}} authUserId="smoke-auth-user-1" authRole="dev" billedRows={buildBilledStageRows([billedJob()], [])} onApplied={() => {}} />,
    )
    const first = await screen.findByRole('button', { name: /from ALPHA PLUMBING LLC/ })
    fireEvent.click(first)
    await waitFor(() => expect(first.getAttribute('aria-current')).toBe('true'))
    // The reset effect flushes after the render that shows the deposit; the empty
    // allocation row exists only once it has run.
    await screen.findByTestId('ar-allocation-row')

    fireEvent.click(screen.getByRole('button', { name: /Add a note/ }))
    const note = (await screen.findByLabelText(/Note on this payment/)) as HTMLTextAreaElement
    fireEvent.change(note, { target: { value: 'Retainage for ALPHA only' } })
    expect(note.value).toBe('Retainage for ALPHA only')

    const second = screen.getByRole('button', { name: /from BRAVO BUILDERS INC/ })
    fireEvent.click(second)
    await waitFor(() => expect(second.getAttribute('aria-current')).toBe('true'))
    await waitFor(() => expect(screen.queryByLabelText(/Note on this payment/)).toBeNull())
    expect(screen.getByRole('button', { name: /Add a note/ })).toBeTruthy()
  })
})
