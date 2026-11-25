// @vitest-environment jsdom
/**
 * Render smoke for punch list #437: Accounts Receivable opens with nothing picked. Before, the window picked
 * the first deposit in the list by itself, so its pane filled and Apply went live on a row nobody chose. Now the
 * pane reads *Select a bank transaction.* until a row is pressed, and no read, filter or toggle picks one.
 * Every name is made up.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderSettled } from '../../test/renderSmokeMocks'
import { pickArDeposit } from '../../test/pickArDeposit'
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
  { ...base, mercury_transaction_id: 'mtx-dlf', amount: 250, counterparty_name: 'DLF', posted_at: '2026-09-28T15:00:00Z', raw: {}, mercury_id: 'm-1', remaining_available: 250, returned: false },
  // Marked returned by hand (the RPC hides it from To match in the app; the stub lists it so the pane can be read).
  { ...base, mercury_transaction_id: 'mtx-hand', amount: 119.56, counterparty_name: 'Texas Mutual', posted_at: '2026-08-13T15:00:00Z', raw: {}, mercury_id: 'm-2', remaining_available: 119.56, returned: true },
  // The bank sent it back: Mercury synced it failed after it posted.
  { ...base, mercury_transaction_id: 'mtx-lowbeck', amount: 5622.49, counterparty_name: 'Lowbeck', posted_at: '2026-09-28T15:00:00Z', raw: { status: 'failed', reasonForFailure: 'Stop payment' }, mercury_id: 'm-3', remaining_available: 5622.49, returned: false },
]

function job650(): JobWithDetails {
  const inv = { id: 'inv-650', job_id: 'job-650', amount: 9022.49, status: 'billed', sequence_order: 0, stripe_invoice_id: null, sent_to_customer_at: null, billed_at: null, estimated_bill_date: null }
  return {
    id: 'job-650', status: 'billed', hcp_number: '650', click_number: null, job_name: 'AXO Schertz', job_address: '5498 Cinder Valley Dr, Schertz, TX',
    customer_name: 'Lowbeck Contracting', revenue: 9022.49, payments_made: 0, materials: [], fixtures: [], payments: [], invoices: [inv], team_members: [],
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
    { loaded: () => screen.findByRole('button', { name: /250\.00 from DLF/ }) },
  )
}

describe('BankPaymentsModal · opens with nothing picked (render smoke)', () => {
  it('reads Select a bank transaction. on open, with no bills offered and no live Apply', async () => {
    await open()
    expect(screen.getByText('Select a bank transaction.')).toBeTruthy()
    expect(screen.queryByTestId('ar-allocation-row')).toBeNull()
    // The footer says what Apply will do. With nothing picked it says nothing.
    expect(screen.getByTestId('ar-apply-sentence').textContent).toBe('')
    const apply = applyButton() as HTMLButtonElement | undefined
    expect(apply == null || apply.disabled).toBe(true)
    // The list's read has landed and still picked nothing.
    expect(screen.getByRole('button', { name: /250\.00 from DLF/ }).getAttribute('aria-pressed')).not.toBe('true')
  })

  it('fills the pane once a row is pressed', async () => {
    await open()
    await pickArDeposit(/250\.00 from DLF/)
    await waitFor(() => expect(screen.getAllByTestId('ar-allocation-row').length).toBeGreaterThan(0))
    expect(screen.queryByText('Select a bank transaction.')).toBeNull()
  })

  it('still holds nothing after the filter changes to All and back', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: /^All/ }))
    await screen.findByRole('button', { name: /5,622\.49 from Lowbeck/ })
    expect(screen.getByText('Select a bank transaction.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^To match/ }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /5,622\.49 from Lowbeck/ })).toBeNull())
    expect(screen.getByText('Select a bank transaction.')).toBeTruthy()
    expect(screen.queryByTestId('ar-allocation-row')).toBeNull()
  })

  it('still holds nothing after a Returned tick is taken off a row in the list', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'More Accounts Receivable options' }))
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: /Mark returned deposits/ }))
    const tick = (await screen.findByRole('checkbox', { name: 'Returned: Texas Mutual' })) as HTMLInputElement
    expect(tick.checked).toBe(true)
    fireEvent.click(tick)
    await waitFor(() => expect((screen.getByRole('checkbox', { name: 'Returned: Texas Mutual' }) as HTMLInputElement).checked).toBe(false))
    // The toggle's own fall back runs a tick later.
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.getByText('Select a bank transaction.')).toBeTruthy()
    expect(screen.queryByTestId('ar-allocation-row')).toBeNull()
  })
})
