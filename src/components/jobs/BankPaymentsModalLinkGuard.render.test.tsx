// @vitest-environment jsdom
/**
 * Render smoke for the link-vs-create guard (Variant D): picking a billed
 * line whose job already carries a same-amount unlinked recorded payment
 * raises the steer, and "Link that payment instead" flips the line to the
 * Payment-received kind with the row preselected. Collision detection lives
 * in arLinkCollision.test.ts.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import BankPaymentsModal from './BankPaymentsModal'
import { buildBilledStageRows } from '../../lib/jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown>
  const baseRpc = stub.rpc as (...args: unknown[]) => unknown
  stub.rpc = (fn: string, ...rest: unknown[]) => {
    if (fn === 'list_mercury_transactions_for_bank_payments') {
      return Promise.resolve({
        data: [
          {
            mercury_transaction_id: 'mtx-harper',
            amount: 2918.22,
            counterparty_name: 'TF HARPER ASSOC',
            note: null,
            external_memo: null,
            posted_at: '2026-08-26T15:00:00Z',
            kind: 'checkDeposit',
            returned: false,
            consumed: 0,
            remaining_available: 2918.22,
          },
        ],
        error: null,
      })
    }
    if (fn === 'list_unlinked_payments_for_bank_payments') {
      return Promise.resolve({
        data: [
          {
            payment_id: 'pay-1',
            job_id: 'job-883',
            amount: 2918.22,
            paid_on: '2026-08-26',
            payment_type: 'Check',
            hcp_number: '883',
            click_number: null,
            job_name: 'TF Harper- Mission Hills',
            stripe_hosted: false,
          },
        ],
        error: null,
      })
    }
    return baseRpc(fn, ...rest)
  }
  return { supabase: stub }
})

function harperJob(): JobWithDetails {
  return {
    id: 'job-883',
    status: 'billed',
    hcp_number: '883',
    click_number: null,
    job_name: 'TF Harper- Mission Hills',
    job_address: '2100 Independence Dr, New Braunfels, TX',
    customer_name: 'TF Harper Associates',
    revenue: 2918.22,
    payments_made: 0,
    materials: [],
    fixtures: [],
    payments: [],
    team_members: [],
    invoices: [
      {
        id: 'inv-883',
        job_id: 'job-883',
        amount: 2918.22,
        status: 'billed',
        sequence_order: 0,
        stripe_invoice_id: null,
        sent_to_customer_at: null,
        billed_at: null,
        estimated_bill_date: null,
      },
    ],
  } as unknown as JobWithDetails
}

describe('BankPaymentsModal link guard (render smoke)', () => {
  it('raises the steer on a colliding pick and links the recorded payment on request', async () => {
    renderWithProviders(
      <BankPaymentsModal
        open
        onClose={() => {}}
        authUserId="smoke-auth-user-1"
        authRole="dev"
        billedRows={buildBilledStageRows([harperJob()], [])}
        onApplied={() => {}}
      />,
    )

    // Payer chip fills the line…
    const chip = await screen.findByRole('button', { name: /Apply allocation: \$2,918\.22 · 883/ })
    fireEvent.click(chip)

    // …and the guard notices the same-amount unlinked recorded payment.
    const steer = await screen.findByRole('note', { name: 'This payment may already be recorded' })
    expect(steer.textContent).toContain('2,918.22')
    expect(steer.textContent).toContain('Linking it avoids counting the money twice')

    fireEvent.click(screen.getByRole('button', { name: 'Link that payment instead' }))
    await waitFor(() => {
      expect(screen.queryByRole('note', { name: 'This payment may already be recorded' })).toBeNull()
    })
    // Line is now the Payment-received kind with the row preselected and the amount locked.
    expect((screen.getByRole('button', { name: 'Payment received' }) as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true')
    const amount = screen.getByLabelText('Allocation amount') as HTMLInputElement
    expect(amount.value).toBe('2918.22')
    expect(amount.disabled).toBe(true)
    expect(screen.getByText(/no new payment created/)).toBeTruthy()
  })

  it('"It\'s a different payment" dismisses the steer for that line', async () => {
    renderWithProviders(
      <BankPaymentsModal
        open
        onClose={() => {}}
        authUserId="smoke-auth-user-1"
        authRole="dev"
        billedRows={buildBilledStageRows([harperJob()], [])}
        onApplied={() => {}}
      />,
    )
    const chip = await screen.findByRole('button', { name: /Apply allocation: \$2,918\.22 · 883/ })
    fireEvent.click(chip)
    await screen.findByRole('note', { name: 'This payment may already be recorded' })
    fireEvent.click(screen.getByRole('button', { name: "It's a different payment" }))
    await waitFor(() => {
      expect(screen.queryByRole('note', { name: 'This payment may already be recorded' })).toBeNull()
    })
    // The billed pick survives untouched.
    expect((screen.getByLabelText('Allocation amount') as HTMLInputElement).value).toBe('2,918.22')
  })
})
