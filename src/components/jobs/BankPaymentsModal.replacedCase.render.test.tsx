// @vitest-environment jsdom
/**
 * Render smoke for v2.4574: a deposit closes a case as replaced only while the apply still
 * pays a job the returned check paid. When none of those bills is open, nothing fills, the
 * deposit is not held as the new check, and an apply to another job leaves the case open.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderSettled } from '../../test/renderSmokeMocks'
import BankPaymentsModal from './BankPaymentsModal'
import { buildBilledStageRows } from '../../lib/jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'

const calls = vi.hoisted(() => ({ rpc: [] as Array<{ fn: string; args: unknown }> }))

const deposit = (id: string, name: string, amount: number, postedAt: string) => ({
  mercury_transaction_id: id,
  amount,
  counterparty_name: name,
  note: null,
  external_memo: null,
  posted_at: postedAt,
  kind: 'checkDeposit',
  mercury_account_id: 'acct-1',
  raw: {},
  mercury_id: `m-${id}`,
  returned: false,
  consumed: 0,
  remaining_available: amount,
})

const DEPOSITS = [
  deposit('mtx-drf', 'DRF', 250, '2026-09-29T15:00:00Z'),
  // The new check from Southern Post, after theirs came back.
  deposit('mtx-sp-new', 'SOUTHERN POST CONSTRUCTION', 13680, '2026-09-30T15:00:00Z'),
]

const caseRow = (over: Record<string, unknown>) => ({
  kind: 'checkDeposit',
  source: 'bank',
  closed_at: null,
  closed_reason: null,
  closed_note: null,
  closed_by: null,
  replaced_by_mercury_transaction_id: null,
  notified_at: '2026-09-23T15:05:00Z',
  live_payments: [],
  last_job: null,
  recorded_payment: null,
  promise: null,
  ...over,
})

const CASES = [
  caseRow({
    mercury_transaction_id: 'mtx-sp',
    counterparty_name: 'Southern Post',
    amount: 13680,
    posted_at: '2026-09-18T22:00:58Z',
    failed_at: '2026-09-23T15:00:00Z',
    opened_at: '2026-09-23T15:00:00Z',
    bank_reason: 'Insufficient funds',
    last_job: { job_id: 'job-878', job_number: '878', job_name: 'Take 5- Seguin', removed_at: '2026-09-24T13:43:00Z', removed_by: 'Taunya', job_revenue: 38625, job_payments_made: 0 },
  }),
  caseRow({
    mercury_transaction_id: 'mtx-kcg',
    counterparty_name: 'KCG LLC-CONSTR',
    amount: 3572,
    posted_at: '2026-09-17T15:00:00Z',
    failed_at: '2026-09-29T15:00:00Z',
    opened_at: '2026-09-29T15:00:00Z',
    bank_reason: 'Stop payment',
    live_payments: [
      { payment_id: 'p1', job_id: 'job-963', job_number: '963', job_name: 'Knight Springtown Vet', amount: 2090, invoice_id: 'i1', invoice_sequence_order: 0, invoice_status: 'billed' },
      { payment_id: 'p2', job_id: 'job-977', job_number: '977', job_name: 'Springtown', amount: 1482, invoice_id: 'i2', invoice_sequence_order: 1, invoice_status: 'paid' },
    ],
  }),
]

const TRAILS = [
  {
    mercury_transaction_id: 'mtx-sp',
    payment_id: 'old-1',
    live: false,
    job_id: 'job-878',
    job_number: '878',
    job_name: 'Take 5- Seguin',
    invoice_id: 'inv-878',
    amount: 13680,
    applied_at: '2026-09-21T16:00:00Z',
    applied_by: 'Taunya',
    removed_at: '2026-09-24T13:43:00Z',
    removed_by: 'Taunya',
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
    if (fn === 'list_ar_return_cases') return Promise.resolve({ data: CASES, error: null })
    if (fn === 'list_ar_deposit_trails') return Promise.resolve({ data: TRAILS, error: null })
    if (fn === 'list_ar_allocations_for_mercury_transaction') return Promise.resolve({ data: [], error: null })
    if (['apply_mercury_bank_payment_allocations', 'close_ar_return_case', 'take_returned_check_off_jobs', 'set_mercury_transaction_ar_returned'].includes(fn)) {
      calls.rpc.push({ fn, args: rest[0] })
      if (fn === 'take_returned_check_off_jobs') return Promise.resolve({ data: { ok: true, removed: 2, jobs: [{}, {}] }, error: null })
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

/** Another Southern Post job. The returned check never paid it. */
function job900(): JobWithDetails {
  return {
    id: 'job-900',
    status: 'billed',
    hcp_number: '900',
    click_number: null,
    job_name: 'Take 5- Luling',
    job_address: '2 Main St, Luling, TX',
    customer_name: 'Southern Post Construction',
    revenue: 13680,
    payments_made: 0,
    materials: [],
    fixtures: [],
    payments: [],
    invoices: [
      { id: 'inv-900', job_id: 'job-900', amount: 13680, status: 'billed', sequence_order: 0, stripe_invoice_id: null, sent_to_customer_at: null, billed_at: null, estimated_bill_date: null },
    ],
    team_members: [],
  } as unknown as JobWithDetails
}

describe('BankPaymentsModal · the new check and the case it replaces (render smoke)', () => {
  it('the bills it paid are not open: nothing fills, and an apply to another job leaves the case open', async () => {
    calls.rpc.length = 0
    await renderSettled(
      <BankPaymentsModal open onClose={() => {}} authUserId="smoke-auth-user-1" authRole="assistant" billedRows={buildBilledStageRows([job900()], [])} onApplied={() => {}} />,
      { loaded: async () => (await screen.findAllByTestId('ar-return-case-row'))[0]! },
    )
    fireEvent.click(screen.getByRole('button', { name: /13,680\.00 from SOUTHERN POST CONSTRUCTION/ }))
    fireEvent.click(await screen.findByTestId('ar-replacement-fill'))
    expect(screen.getByTestId('ar-apply-sentence').textContent).toMatch(/pick a bill/)
    fireEvent.click(await screen.findByRole('button', { name: /Apply allocation: \$13,680\.00 · 900/ }))
    const apply = await waitFor(() => screen.getAllByRole('button').find((b) => /^Apply \$/.test((b.textContent ?? '').trim())) as HTMLButtonElement)
    fireEvent.click(apply)
    await waitFor(() => expect(calls.rpc.map((c) => c.fn)).toContain('apply_mercury_bank_payment_allocations'))
    await new Promise((r) => setTimeout(r, 50))
    expect(calls.rpc.map((c) => c.fn)).toEqual(['apply_mercury_bank_payment_allocations'])
  })
})
