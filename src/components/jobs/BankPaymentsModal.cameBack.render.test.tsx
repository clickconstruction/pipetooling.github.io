// @vitest-environment jsdom
/**
 * Render smoke for v2.4313 (punch list #76 PR 1): a check that came back can pay no bill.
 * Before, a returned deposit left To match but, found under All or by the search, its pane
 * still offered the payer's open bills, the allocation lines and Apply — Loberg's stopped
 * $5,622.49 offered #650's bills on 2026-10-01. Now the pane says so and Apply stays off.
 * The database refuses the link too (20261001220000_returned_check_cannot_pay.sql).
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderSettled } from '../../test/renderSmokeMocks'
import BankPaymentsModal from './BankPaymentsModal'
import { buildBilledStageRows } from '../../lib/jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'

const base = {
  note: null,
  external_memo: null,
  kind: 'checkDeposit',
  mercury_account_id: 'acct-1',
  consumed: 0,
}

const DEPOSITS = [
  { ...base, mercury_transaction_id: 'mtx-drf', amount: 250, counterparty_name: 'DRF', posted_at: '2026-09-28T15:00:00Z', raw: {}, mercury_id: 'm-1', remaining_available: 250, returned: false },
  // Marked returned by hand (the RPC hides it from To match in the app; the stub lists it so the pane can be read).
  { ...base, mercury_transaction_id: 'mtx-hand', amount: 119.56, counterparty_name: 'Texas Mutual', posted_at: '2026-08-13T15:00:00Z', raw: {}, mercury_id: 'm-2', remaining_available: 119.56, returned: true },
  // The bank sent it back: Mercury synced it failed after it posted.
  { ...base, mercury_transaction_id: 'mtx-loberg', amount: 5622.49, counterparty_name: 'Loberg', posted_at: '2026-09-28T15:00:00Z', raw: { status: 'failed', reasonForFailure: 'Stop payment' }, mercury_id: 'm-3', remaining_available: 5622.49, returned: false },
]

function job650(): JobWithDetails {
  const inv = { id: 'inv-650', job_id: 'job-650', amount: 9022.49, status: 'billed', sequence_order: 0, stripe_invoice_id: null, sent_to_customer_at: null, billed_at: null, estimated_bill_date: null }
  return {
    id: 'job-650', status: 'billed', hcp_number: '650', click_number: null, job_name: 'ATI Schertz', job_address: '5498 Cibolo Valley Dr, Schertz, TX',
    customer_name: 'Loberg Contracting', revenue: 9022.49, payments_made: 0, materials: [], fixtures: [], payments: [], invoices: [inv], team_members: [],
  } as unknown as JobWithDetails
}
const BILLED = buildBilledStageRows([job650()], [])

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown>
  const baseRpc = stub.rpc as (...args: unknown[]) => unknown
  const baseFrom = stub.from as (...args: unknown[]) => unknown
  const fixed = (result: { data: unknown; error: null }) => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'order', 'limit', 'neq', 'is']) b[m] = () => b
    b.maybeSingle = () => Promise.resolve(result)
    b.single = () => Promise.resolve(result)
    b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej)
    return b
  }
  stub.rpc = (fn: string, ...rest: unknown[]) => {
    if (fn === 'list_mercury_transactions_for_bank_payments') return Promise.resolve({ data: DEPOSITS, error: null })
    if (fn === 'list_ar_allocations_for_mercury_transaction') return Promise.resolve({ data: [], error: null })
    if (fn === 'list_ar_deposit_trails') return Promise.resolve({ data: [], error: null })
    return baseRpc(fn, ...rest)
  }
  stub.from = (table: string, ...rest: unknown[]) => {
    if (table === 'mercury_transaction_ar_closed') return fixed({ data: [], error: null })
    if (table === 'app_settings') return fixed({ data: null, error: null })
    if (table === 'mercury_transaction_drag_sort_assignments') return fixed({ data: null, error: null })
    if (table === 'mercury_transaction_ar_income_labels') return fixed({ data: null, error: null })
    return baseFrom(table, ...rest)
  }
  return { supabase: stub }
})

function applyButton(): HTMLButtonElement {
  return screen.getAllByRole('button').find((b) => /^Apply( \$|$)/.test((b.textContent ?? '').trim())) as HTMLButtonElement
}

async function open() {
  await renderSettled(
    <BankPaymentsModal open onClose={() => {}} authUserId="smoke-auth-user-1" authRole="assistant" billedRows={BILLED} onApplied={() => {}} />,
    { loaded: () => screen.findByRole('button', { name: /250\.00 from DRF/ }) },
  )
}

describe('BankPaymentsModal · a check that came back pays no bill (render smoke)', () => {
  it('a deposit marked returned by hand: the note, the way to untick it, no allocation lines, Apply off', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: /119\.56 from Texas Mutual/ }))
    await waitFor(() => expect(screen.getByTestId('ar-came-back-note')).toBeTruthy())
    expect(screen.getByTestId('ar-came-back-note').textContent).toContain('This check came back, so it cannot pay a bill.')
    expect(screen.getByTestId('ar-came-back-note').textContent).toContain('untick Returned')
    expect(screen.queryByTestId('ar-allocation-row')).toBeNull()
    expect(screen.getByTestId('ar-apply-sentence').textContent).toBe('This check came back, so it cannot pay a bill.')
    expect(applyButton().disabled).toBe(true)
    expect(screen.queryByRole('button', { name: /Apply & next/ })).toBeNull()
  })

  it('a check the bank sent back, found under All: the same, and no untick hint — the bank said it', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: /^All/ }))
    const row = await screen.findByRole('button', { name: /5,622\.49 from Loberg/ })
    fireEvent.click(row)
    await waitFor(() => expect(screen.getByTestId('ar-came-back-note')).toBeTruthy())
    expect(screen.getByTestId('ar-came-back-note').textContent).not.toContain('untick')
    expect(screen.queryByTestId('ar-allocation-row')).toBeNull()
    expect(screen.queryByText(/their open bills/i)).toBeNull()
    expect(applyButton().disabled).toBe(true)
  })

  it('a plain deposit still gets the allocation lines', async () => {
    await open()
    await waitFor(() => expect(screen.getAllByTestId('ar-allocation-row').length).toBeGreaterThan(0))
    expect(screen.queryByTestId('ar-came-back-note')).toBeNull()
  })
})
