// @vitest-environment jsdom
/**
 * Render smoke for the applied-means-income wiring in BankPaymentsModal: with
 * the org switch on, a deposit that already carries a non-Income label shows
 * the one-line deviation note and the footer names the label it leaves alone;
 * an unlabelled deposit shows no note and the footer says Apply books it.
 * The words come from arBankLabel.ts / arApplySentence.ts (kernel-tested).
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import BankPaymentsModal from './BankPaymentsModal'
import { buildBilledStageRows } from '../../lib/jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'

const scenario = vi.hoisted(() => ({ label: null as null | { name: string; default_key: string | null } }))

const DEPOSITS = [
  {
    mercury_transaction_id: 'mtx-seguin',
    amount: 1625,
    counterparty_name: 'City of Seguin',
    note: null,
    external_memo: null,
    posted_at: '2026-08-26T15:00:00Z',
    kind: 'other',
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
  const baseFrom = stub.from as (...args: unknown[]) => unknown
  // A chainable builder that resolves to one fixed result whatever the chain.
  const fixed = (result: { data: unknown; error: null }) => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'order', 'limit', 'neq', 'is']) b[m] = () => b
    b.maybeSingle = () => Promise.resolve(result)
    b.single = () => Promise.resolve(result)
    b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej)
    return b
  }
  stub.rpc = (fn: string, ...rest: unknown[]) => {
    if (fn === 'list_mercury_transactions_for_bank_payments') {
      return Promise.resolve({ data: DEPOSITS, error: null })
    }
    return baseRpc(fn, ...rest)
  }
  stub.from = (table: string, ...rest: unknown[]) => {
    if (table === 'app_settings') return fixed({ data: { value_text: 'true' }, error: null })
    if (table === 'mercury_transaction_drag_sort_assignments') {
      return fixed({
        data: scenario.label ? { label_id: 'lbl-1', mercury_drag_sort_labels: scenario.label } : null,
        error: null,
      })
    }
    if (table === 'mercury_transaction_ar_income_labels') return fixed({ data: null, error: null })
    return baseFrom(table, ...rest)
  }
  return { supabase: stub }
})

function billedJob(): JobWithDetails {
  const inv = {
    id: 'inv-908',
    job_id: 'job-908',
    amount: 1625,
    status: 'billed',
    sequence_order: 0,
    stripe_invoice_id: null,
    sent_to_customer_at: null,
    billed_at: null,
    estimated_bill_date: null,
  }
  return {
    id: 'job-908',
    hcp_number: '908',
    click_number: null,
    job_name: 'Seguin permit',
    customer_name: 'City of Seguin',
    status: 'billed',
    revenue: 1625,
    payments_made: 0,
    invoices: [inv],
  } as unknown as JobWithDetails
}

async function pickTheBill() {
  const billedRows = buildBilledStageRows([billedJob()], [])
  renderWithProviders(
    <BankPaymentsModal open onClose={() => {}} authUserId="smoke-auth-user-1" authRole="assistant" billedRows={billedRows} onApplied={() => {}} />,
  )
  await screen.findByTestId('ar-allocation-row')
  fireEvent.click(screen.getByRole('button', { name: /Apply allocation: \$1,625\.00 · 908/ }))
  await waitFor(() => {
    expect(screen.getByTestId('ar-apply-sentence').textContent).toMatch(/^Applies \$1,625\.00 to 908/)
  })
}

describe('BankPaymentsModal · applied means income (render smoke)', () => {
  it('a hand-labelled deposit: the note appears and the footer names the label Apply leaves alone', async () => {
    scenario.label = { name: 'Taxes and Licenses', default_key: 'taxes_licenses' }
    await pickTheBill()
    await waitFor(() => {
      expect(screen.getByTestId('ar-bank-label-note').textContent).toBe('Labelled Taxes and Licenses in Banking, not Income. Apply leaves that alone.')
    })
    expect(screen.getByTestId('ar-apply-sentence').textContent).toMatch(/Stays Taxes and Licenses in Banking\.$/)
  })

  it('an unlabelled deposit: no note, and the footer says Apply books it as Income', async () => {
    scenario.label = null
    await pickTheBill()
    await waitFor(() => {
      expect(screen.getByTestId('ar-apply-sentence').textContent).toMatch(/^Applies \$1,625\.00 to 908 · .* and books it as Income\. The bill is settled\.$/)
    })
    expect(screen.queryByTestId('ar-bank-label-note')).toBeNull()
  })
})
