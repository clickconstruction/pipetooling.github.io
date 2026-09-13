// @vitest-environment jsdom
/**
 * Render smokes for BankPaymentsModal: the deposit→payer chip row (v2.2584)
 * and the exact-match sweep bar + review panel. Wiring-level only — the
 * matching/pairing rules live in arDepositCustomerMatch.test.ts and
 * arExactMatchSweep.test.ts.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import BankPaymentsModal from './BankPaymentsModal'
import { buildBilledStageRows } from '../../lib/jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'

const DEPOSITS = [
  {
    mercury_transaction_id: 'mtx-1',
    amount: -0, // unused by the modal's math paths under test
    counterparty_name: 'WEISS SERVICES LLC',
    note: null,
    external_memo: null,
    posted_at: '2026-08-28T15:00:00Z',
    kind: 'checkDeposit',
    returned: false,
    consumed: 0,
    remaining_available: 1625,
  },
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
    if (fn === 'list_mercury_transactions_for_bank_payments') {
      return Promise.resolve({ data: DEPOSITS.map((d) => ({ ...d, amount: 1625 })), error: null })
    }
    return baseRpc(fn, ...rest)
  }
  return { supabase: stub }
})

function billedJob(): JobWithDetails {
  const inv = {
    id: 'inv-876',
    job_id: 'job-876',
    amount: 1625,
    status: 'billed',
    sequence_order: 0,
    stripe_invoice_id: null,
    sent_to_customer_at: null,
    billed_at: null,
    estimated_bill_date: null,
  }
  return {
    id: 'job-876',
    status: 'billed',
    hcp_number: '876',
    click_number: null,
    job_name: 'American Eagle',
    job_address: '4015 S I-35, San Marcos, TX',
    customer_name: 'Weiss Services LLC',
    revenue: 1625,
    payments_made: 0,
    materials: [],
    fixtures: [],
    payments: [],
    invoices: [inv],
    team_members: [],
  } as unknown as JobWithDetails
}

describe('BankPaymentsModal (render smoke)', () => {
  it('leads a matched deposit with the payer chip row and offers the exact-match sweep', async () => {
    const billedRows = buildBilledStageRows([billedJob()], [])
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

    // Variant A: payer-matched chips lead the allocation line.
    await waitFor(() => {
      expect(screen.getByText(/their open bills/)).toBeTruthy()
    })
    expect(screen.getByText('Weiss Services LLC')).toBeTruthy()
    // AR refresh PR 1 (v2.3379): the header counts the pile; the row wears the sweep's verdict.
    expect(screen.getByTestId('ar-summary').textContent).toMatch(/1 deposit to match · \$1,625\.00 unapplied/)
    expect(screen.getByTestId('ar-deposit-state').getAttribute('data-state')).toBe('exact')
    expect(screen.getByText('1 exact match')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^To match · 1$/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByText(/Show fully applied and returned/)).toBeNull()
    const chip = screen.getByRole('button', { name: /Apply allocation: \$1,625\.00 · 876 · American Eagle/ })
    // AR refresh PR 4 (v2.3382): the footer says what Apply will do once a bill is picked.
    expect(screen.getByTestId('ar-apply-sentence').textContent).toMatch(/^Remaining \$1,625\.00 — pick a bill/)
    fireEvent.click(chip)
    expect(screen.getByTestId('ar-apply-sentence').textContent).toMatch(/^Applies \$1,625\.00 to 876 · .*The bill is settled\./)
    expect(screen.getByRole('button', { name: 'Apply $1,625.00' })).toBeTruthy()
    expect(chip.textContent).toContain('matches this deposit')

    // Variant C: the sweep bar sees the one unambiguous pair and opens the review panel.
    const bar = screen.getByText(/deposit matches exactly one open bill/)
    expect(bar.textContent).toContain('$1,625.00')
    fireEvent.click(screen.getByRole('button', { name: /Review & apply…/ }))
    const panel = await screen.findByRole('dialog', { name: 'Review exact deposit matches' })
    expect(panel.textContent).toContain('WEISS SERVICES LLC')
    expect(panel.textContent).toContain('876 · American Eagle')
    expect(screen.getByRole('button', { name: /Apply 1 deposit/ })).toBeTruthy()

    // Un-ticking the pair disables Apply.
    fireEvent.click(screen.getByRole('checkbox', { name: /Include 1,625\.00 from WEISS SERVICES LLC/ }))
    expect((screen.getByRole('button', { name: /Apply 0 deposits/ }) as HTMLButtonElement).disabled).toBe(true)
  })
})
