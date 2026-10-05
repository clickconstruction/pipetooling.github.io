// @vitest-environment jsdom
/**
 * Render smoke for v2.4576, three small fixes in Accounts Receivable: Esc closes one layer
 * at a time, a Returned tick keeps a selected case selected, and a search of All that a
 * list refresh outdated mid-flight asks again.
 */
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderSettled } from '../../test/renderSmokeMocks'
import BankPaymentsModal from './BankPaymentsModal'
import { buildBilledStageRows } from '../../lib/jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'

const calls = vi.hoisted(() => ({ rpc: [] as Array<{ fn: string; args: unknown }>, hidden: 0, holdHidden: null as null | Promise<unknown> }))

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
    if (fn === 'list_mercury_transactions_for_bank_payments') {
      const hidden = (rest[0] as { p_filter?: { includeHiddenArDeposits?: boolean } } | undefined)?.p_filter?.includeHiddenArDeposits === true
      if (hidden) {
        calls.hidden += 1
        const hold = calls.holdHidden
        calls.holdHidden = null
        if (hold) return hold.then(() => ({ data: DEPOSITS, error: null }))
      }
      return Promise.resolve({ data: DEPOSITS, error: null })
    }
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

function job878(): JobWithDetails {
  return {
    id: 'job-878',
    status: 'billed',
    hcp_number: '878',
    click_number: null,
    job_name: 'Take 5- Seguin',
    job_address: '1 Main St, Seguin, TX',
    customer_name: 'Southern Post',
    revenue: 38625,
    payments_made: 0,
    materials: [],
    fixtures: [],
    payments: [],
    invoices: [
      { id: 'inv-878', job_id: 'job-878', amount: 15200, status: 'billed', sequence_order: 0, stripe_invoice_id: null, sent_to_customer_at: null, billed_at: null, estimated_bill_date: null },
    ],
    team_members: [],
  } as unknown as JobWithDetails
}

async function open(onClose = () => {}) {
  await renderSettled(
    <BankPaymentsModal open onClose={onClose} authUserId="smoke-auth-user-1" authRole="assistant" billedRows={buildBilledStageRows([job878()], [])} onApplied={() => {}} />,
    { loaded: async () => (await screen.findAllByTestId('ar-return-case-row'))[0]! },
  )
}

function caseRowFor(payer: RegExp): HTMLElement {
  return screen.getAllByTestId('ar-return-case-row').find((b) => payer.test(b.getAttribute('aria-label') ?? '')) as HTMLElement
}

describe('BankPaymentsModal · Esc, the Returned tick and the All search (render smoke)', () => {
  it('Esc closes the mark question first, then the window', async () => {
    const onClose = vi.fn()
    await open(onClose)
    fireEvent.click(screen.getByRole('button', { name: 'More Accounts Receivable options' }))
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: /Mark returned deposits/ }))
    fireEvent.click(await screen.findByLabelText('Returned: DRF'))
    await screen.findByTestId('ar-mark-ask')
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('ar-mark-ask')).toBeNull())
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Esc closes They said… first, then the window', async () => {
    const onClose = vi.fn()
    await open(onClose)
    fireEvent.click(caseRowFor(/Southern Post/))
    const pane = await screen.findByTestId('ar-return-case-pane')
    fireEvent.click(within(pane).getByTestId('ar-return-case-they-said'))
    const dialogs = () => screen.getAllByRole('dialog').length
    await waitFor(() => expect(dialogs()).toBe(2))
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(dialogs()).toBe(1))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('a Returned tick on a deposit keeps the selected case selected', async () => {
    calls.rpc.length = 0
    await open()
    fireEvent.click(caseRowFor(/KCG/))
    await screen.findByTestId('ar-return-case-pane')
    fireEvent.click(screen.getByRole('button', { name: 'More Accounts Receivable options' }))
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: /Mark returned deposits/ }))
    fireEvent.click(await screen.findByLabelText('Returned: DRF'))
    fireEvent.click(within(await screen.findByTestId('ar-mark-ask')).getByRole('button', { name: 'Yes, it bounced' }))
    await waitFor(() => expect(calls.rpc.map((c) => c.fn)).toEqual(['set_mercury_transaction_ar_returned']))
    await waitFor(() => expect(screen.queryByLabelText('Returned: DRF')).toBeNull())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(within(screen.getByTestId('ar-return-case-pane')).getByTestId('ar-return-case-stake').textContent).toContain('2 jobs still count it as paid.')
  })

  it('a search of All outdated by a list refresh asks again', async () => {
    calls.rpc.length = 0
    calls.hidden = 0
    let release: () => void = () => {}
    calls.holdHidden = new Promise<void>((r) => (release = r))
    await open()
    fireEvent.click(caseRowFor(/Southern Post/))
    const pane = await screen.findByTestId('ar-return-case-pane')
    fireEvent.change(screen.getByLabelText(/Search bank transactions/), { target: { value: 'weiss' } })
    await waitFor(() => expect(calls.hidden).toBe(1))
    // A case write refreshes the list while that read is still out.
    fireEvent.click(within(pane).getByRole('button', { name: /More/ }))
    fireEvent.click(within(pane).getByRole('menuitem', { name: 'Not coming…' }))
    fireEvent.change(within(pane).getByLabelText('A note for the record'), { target: { value: 'Written off' } })
    fireEvent.click(within(pane).getByTestId('ar-return-case-close-confirm'))
    await waitFor(() => expect(calls.rpc.map((c) => c.fn)).toEqual(['close_ar_return_case']))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(calls.hidden).toBe(1)
    await act(async () => {
      release()
    })
    await waitFor(() => expect(calls.hidden).toBe(2))
  })
})
