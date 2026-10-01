// @vitest-environment jsdom
/**
 * Render smoke for v2.4325 (punch list #76 PR 3): a check that came back is worked as a
 * case on top of To match. The Came back group lists the open cases; a case's pane tells
 * the story, the stake and one next step; Use it as the new check fills the bills the
 * returned check paid and closes the case when the apply lands; Take it off reads back
 * what changes before the one press; More closes a case with a reason; a hand mark on a
 * deposit the bank never failed is asked about first. The words live in arReturnCase.ts.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
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

describe('BankPaymentsModal · checks that came back are cases (render smoke)', () => {
  it('Came back sits on top of To match, and the header counts it', async () => {
    await open()
    expect(screen.getByTestId('ar-came-back-group').textContent).toContain('Came back · 2')
    expect(screen.getByTestId('ar-summary').textContent).toContain('2 came back')
    expect(caseRowFor(/Southern Post/).textContent).toContain('off #878 since 9/24')
  })

  it('a case off its job: the story, the stake, the new check offered, and no Apply', async () => {
    await open()
    fireEvent.click(caseRowFor(/Southern Post/))
    const pane = await screen.findByTestId('ar-return-case-pane')
    expect(within(pane).getByTestId('ar-return-case-story').textContent).toContain('The bank sent it back. Insufficient funds.')
    expect(within(pane).getByTestId('ar-return-case-story').textContent).toContain('Taunya applied it to #878 Take 5- Seguin.')
    expect(within(pane).getByTestId('ar-return-case-stake').textContent).toContain('#878 owes the $13,680 again.')
    expect(within(pane).getByTestId('ar-return-case-stake').textContent).toContain('It owes $38,625 in all.')
    expect(within(pane).getByTestId('ar-return-case-replacement').textContent).toContain('This looks like the new check.')
    expect(screen.getAllByRole('button').some((b) => /^Apply( \$|$)/.test((b.textContent ?? '').trim()))).toBe(false)
  })

  it('Use it as the new check: the bill it paid fills, Apply lands, and the case closes as replaced', async () => {
    calls.rpc.length = 0
    const onClose = vi.fn()
    await open(onClose)
    fireEvent.click(caseRowFor(/Southern Post/))
    const pane = await screen.findByTestId('ar-return-case-pane')
    fireEvent.click(within(pane).getByRole('button', { name: 'Use it as the new check' }))
    await waitFor(() => expect(screen.queryByTestId('ar-return-case-pane')).toBeNull())
    await waitFor(() => expect(screen.getByTestId('ar-apply-sentence').textContent).toContain('$13,680.00'))
    const apply = screen.getAllByRole('button').find((b) => /^Apply \$/.test((b.textContent ?? '').trim())) as HTMLButtonElement
    fireEvent.click(apply)
    await waitFor(() => expect(calls.rpc.map((c) => c.fn)).toEqual(['apply_mercury_bank_payment_allocations', 'close_ar_return_case']))
    expect((calls.rpc[0]!.args as { p_mercury_transaction_id: string }).p_mercury_transaction_id).toBe('mtx-sp-new')
    expect(calls.rpc[1]!.args).toEqual({ p_mercury_transaction_id: 'mtx-sp', p_reason: 'replaced', p_note: null, p_replaced_by: 'mtx-sp-new' })
  })

  it('the new check, selected on its own, offers to fill the bills the returned check paid', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: /13,680\.00 from SOUTHERN POST CONSTRUCTION/ }))
    const note = await screen.findByTestId('ar-replacement-note')
    expect(note.textContent).toContain('This looks like the new check for the $13,680 that came back on Sep 23.')
  })

  it('a case still on two jobs: the read-back first, then one press', async () => {
    calls.rpc.length = 0
    await open()
    fireEvent.click(caseRowFor(/KCG/))
    const pane = await screen.findByTestId('ar-return-case-pane')
    expect(within(pane).getByTestId('ar-return-case-stake').textContent).toContain('2 jobs still count it as paid.')
    fireEvent.click(within(pane).getByTestId('ar-return-case-takeoff'))
    const readback = within(pane).getByTestId('ar-return-case-readback')
    expect(readback.textContent).toContain('#963 Knight Springtown Vet')
    expect(readback.textContent).toContain('$1,482 comes off bill 2. Bill 2 goes back to Billed.')
    expect(calls.rpc).toEqual([])
    fireEvent.click(within(pane).getByTestId('ar-return-case-takeoff-confirm'))
    await waitFor(() => expect(calls.rpc).toEqual([{ fn: 'take_returned_check_off_jobs', args: { p_mercury_transaction_id: 'mtx-kcg' } }]))
  })

  it('More → Not coming… closes the case with the note', async () => {
    calls.rpc.length = 0
    await open()
    fireEvent.click(caseRowFor(/Southern Post/))
    const pane = await screen.findByTestId('ar-return-case-pane')
    fireEvent.click(within(pane).getByRole('button', { name: /More/ }))
    fireEvent.click(within(pane).getByRole('menuitem', { name: 'Not coming…' }))
    fireEvent.change(within(pane).getByLabelText('A note for the record'), { target: { value: 'Written off with the owner' } })
    fireEvent.click(within(pane).getByTestId('ar-return-case-close-confirm'))
    await waitFor(() =>
      expect(calls.rpc).toEqual([{ fn: 'close_ar_return_case', args: { p_mercury_transaction_id: 'mtx-sp', p_reason: 'not_coming', p_note: 'Written off with the owner', p_replaced_by: null } }]),
    )
  })

  it('a Returned tick on a deposit the bank never failed asks first; No leaves it alone, Yes marks it', async () => {
    calls.rpc.length = 0
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'More Accounts Receivable options' }))
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: /Mark returned deposits/ }))
    fireEvent.click(await screen.findByLabelText('Returned: DRF'))
    const ask = await screen.findByTestId('ar-mark-ask')
    expect(ask.textContent).toContain('Did the bank send DRF’s $250 check back?')
    fireEvent.click(within(ask).getByRole('button', { name: /not a customer/ }))
    await waitFor(() => expect(screen.queryByTestId('ar-mark-ask')).toBeNull())
    expect(calls.rpc).toEqual([])
    fireEvent.click(screen.getByLabelText('Returned: DRF'))
    fireEvent.click(within(await screen.findByTestId('ar-mark-ask')).getByRole('button', { name: 'Yes, it bounced' }))
    await waitFor(() => expect(calls.rpc).toEqual([{ fn: 'set_mercury_transaction_ar_returned', args: { p_mercury_transaction_id: 'mtx-drf', p_returned: true } }]))
  })
})
