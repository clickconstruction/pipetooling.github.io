// @vitest-environment jsdom
/**
 * Render smoke for the payer bill-combo chip (Variant B): one check covering
 * two bills fills both allocation lines on tap. Combo math lives in
 * arPayerBillCombos.test.ts.
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
            mercury_transaction_id: 'mtx-combo',
            amount: 4091.5,
            counterparty_name: 'RELIANT HEALTH PROVIDERS',
            note: null,
            external_memo: null,
            posted_at: '2026-08-29T15:00:00Z',
            kind: 'checkDeposit',
            returned: false,
            consumed: 0,
            remaining_available: 4091.5,
          },
        ],
        error: null,
      })
    }
    return baseRpc(fn, ...rest)
  }
  return { supabase: stub }
})

function reliantJob(id: string, hcp: string, jobName: string, amount: number): JobWithDetails {
  return {
    id,
    status: 'billed',
    hcp_number: hcp,
    click_number: null,
    job_name: jobName,
    job_address: '150 E Sonterra Blvd, San Antonio, TX',
    customer_name: 'Reliant Health',
    revenue: amount,
    payments_made: 0,
    materials: [],
    fixtures: [],
    payments: [],
    team_members: [],
    invoices: [
      {
        id: `inv-${id}`,
        job_id: id,
        amount,
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

describe('BankPaymentsModal combo chip (render smoke)', () => {
  it('offers the unique 2-bill combo and fills both allocation lines on tap', async () => {
    const billedRows = buildBilledStageRows(
      [reliantJob('job-915', '915', 'Reliant Health', 2711.5), reliantJob('job-880', '880', 'Reliant Health- HVAC', 1380)],
      [],
    )
    renderWithProviders(
      <BankPaymentsModal
        open
        onClose={() => {}}
        authUserId="smoke-auth-user-1"
        authRole="dev"
        billedRows={billedRows}
        onApplied={() => {}}
      />,
    )

    const combo = await screen.findByRole('button', { name: /Fill 2 allocations: \$2,711\.50 915 \+ \$1,380\.00 880/ })
    expect(combo.textContent).toContain('2 bills = $4,091.50')
    expect(combo.textContent).toContain('fills 2 allocation lines')

    fireEvent.click(combo)
    await waitFor(() => {
      expect(screen.getAllByLabelText('Allocation amount')).toHaveLength(2)
    })
    const amounts = (screen.getAllByLabelText('Allocation amount') as HTMLInputElement[]).map((i) => i.value)
    expect(amounts).toEqual(['2,711.50', '1,380.00'])
    // Both lines picked their bill; the combo chip is gone (lines are no longer a single untouched row).
    expect(screen.queryByRole('button', { name: /Fill 2 allocations/ })).toBeNull()
  })
})
