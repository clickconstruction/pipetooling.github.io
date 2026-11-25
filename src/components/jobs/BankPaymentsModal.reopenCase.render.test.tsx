// @vitest-environment jsdom
/**
 * Render smoke for punch list #443, row 5: Accounts Receivable draws the office's list of closed cases in its
 * list, with Reopen, on any job. A case closed as replaced is counted and not listed. A reopen reads the cases
 * again, calls the function of the case's own table, and reads the page again. Every name is made up.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderSettled } from '../../test/renderSmokeMocks'
import BankPaymentsModal from './BankPaymentsModal'
import { buildBilledStageRows } from '../../lib/jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'

const calls = vi.hoisted(() => ({ rpc: [] as Array<{ fn: string; args: unknown }>, lists: 0 }))

const DEPOSITS = [
  { mercury_transaction_id: 'mtx-dlf', amount: 250, counterparty_name: 'DLF', note: null, external_memo: null, posted_at: '2026-11-20T15:00:00Z', kind: 'checkDeposit', mercury_account_id: 'acct-1', raw: {}, mercury_id: 'm-mtx-dlf', returned: false, consumed: 0, remaining_available: 250 },
]

const caseRow = (over: Record<string, unknown>) => ({
  kind: 'checkDeposit',
  source: 'bank',
  closed_at: null,
  closed_reason: null,
  closed_note: null,
  closed_by: null,
  replaced_by_mercury_transaction_id: null,
  notified_at: null,
  live_payments: [],
  last_job: null,
  recorded_payment: null,
  promise: null,
  posted_at: '2026-11-18T15:00:00Z',
  failed_at: '2026-11-20T15:00:00Z',
  opened_at: '2026-11-20T15:00:00Z',
  bank_reason: 'Insufficient funds',
  ...over,
})

const CASES = [
  // An open case, so Came back draws and the page reads as it does for the office.
  caseRow({ mercury_transaction_id: 'mtx-open', counterparty_name: 'Southern Pine', amount: 900, last_job: { job_id: 'job-878', job_number: '878', job_name: 'Tune 5- Seguin', removed_at: '2026-11-21T13:43:00Z', removed_by: 'Taunya', job_revenue: 900, job_payments_made: 0 } }),
  // A test case a walk closed.
  caseRow({ mercury_transaction_id: 'mtx-zz', counterparty_name: 'ZZ Test Payer', amount: 125, closed_at: '2026-11-24T18:00:00Z', closed_reason: 'not_coming', closed_note: 'ZZ TEST walk', closed_by: 'Priya', last_job: { job_id: 'job-zz', job_number: '900', job_name: 'ZZ TEST walk job', removed_at: null, removed_by: null } }),
  // A case on a real job the office closed by hand: listed, and the office may reopen it.
  caseRow({ mercury_transaction_id: 'mtx-real', counterparty_name: 'Larkfield Homes', amount: 400, closed_at: '2026-11-22T18:00:00Z', closed_reason: 'settled_other_way', last_job: { job_id: 'job-412', job_number: '412', job_name: 'Larkfield Lot 9', removed_at: null, removed_by: null } }),
  // A case a new check replaced: counted, never listed.
  caseRow({ mercury_transaction_id: 'mtx-replaced', counterparty_name: 'Juniper Builders', amount: 310, closed_at: '2026-11-21T18:00:00Z', closed_reason: 'replaced', last_job: { job_id: 'job-413', job_number: '413', job_name: 'Juniper Lot 2', removed_at: null, removed_by: null } }),
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
    if (fn === 'list_ar_return_cases') {
      calls.lists += 1
      return Promise.resolve({ data: CASES, error: null })
    }
    if (fn === 'list_ar_deposit_trails') return Promise.resolve({ data: [], error: null })
    if (fn === 'list_ar_allocations_for_mercury_transaction') return Promise.resolve({ data: [], error: null })
    if (fn === 'list_ar_return_case_fees') return Promise.resolve({ data: [], error: null })
    if (fn.startsWith('reopen_ar_')) {
      calls.rpc.push({ fn, args: rest[0] })
      return Promise.resolve({ data: { ok: true }, error: null })
    }
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

function job878(): JobWithDetails {
  return {
    id: 'job-878',
    status: 'billed',
    hcp_number: '878',
    click_number: null,
    job_name: 'Tune 5- Seguin',
    job_address: '1 Main St, Seguin, TX',
    customer_name: 'Southern Pine',
    revenue: 900,
    payments_made: 0,
    materials: [],
    fixtures: [],
    payments: [],
    invoices: [{ id: 'inv-878', job_id: 'job-878', amount: 900, status: 'billed', sequence_order: 0, stripe_invoice_id: null, sent_to_customer_at: null, billed_at: null, estimated_bill_date: null }],
    team_members: [],
  } as unknown as JobWithDetails
}

async function open(authRole: string) {
  await renderSettled(<BankPaymentsModal open onClose={() => {}} authUserId="smoke-auth-user-1" authRole={authRole} billedRows={buildBilledStageRows([job878()], [])} onApplied={() => {}} />, {
    loaded: async () => (await screen.findAllByTestId('ar-return-case-row'))[0]!,
  })
}

describe('BankPaymentsModal · the office reopens a closed case (render smoke)', () => {
  it('draws the list for a dev too', async () => {
    await open('dev')
    expect(screen.getByTestId('ar-closed-cases').textContent).toContain('Closed cases · 2')
  })

  it('draws the list for an assistant, and Reopen on a real job’s case calls its own function and reads the cases again', async () => {
    calls.rpc.length = 0
    await open('assistant')
    expect(screen.getByTestId('ar-came-back-group').textContent).toContain('Came back · 1')
    const box = screen.getByTestId('ar-closed-cases')
    expect(box.textContent).toContain('Closed cases · 2')
    fireEvent.click(within(box).getByRole('button', { name: 'Show' }))
    expect(box.textContent).toContain('ZZ Test Payer')
    expect(box.textContent).toContain('Larkfield Homes')
    expect(box.textContent).not.toContain('Juniper')
    expect(screen.getByTestId('ar-closed-others').textContent).toContain('1 closed case is not listed.')
    const before = calls.lists
    fireEvent.click(within(box).getByRole('button', { name: 'Reopen the case of Larkfield Homes' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Reopen the case' }))
    await waitFor(() => expect(calls.rpc).toEqual([{ fn: 'reopen_ar_return_case', args: { p_mercury_transaction_id: 'mtx-real' } }]))
    // Once for the fresh read before the call, once for the page after it.
    await waitFor(() => expect(calls.lists).toBeGreaterThanOrEqual(before + 2))
  })
})
