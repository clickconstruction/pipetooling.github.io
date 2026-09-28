// @vitest-environment jsdom
/**
 * The job form's payment actions as a hook. Pins the seam over a remove RPC that answers as
 * told and is recorded: what Remove refuses, what the confirm shows, when confirming writes at
 * once and when it only drops the line, what each answer of the RPC turns into, how a hand-typed
 * line is dropped once its payment is recorded, and the three ways Unlink and remove stops.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useJobFormPaymentActions, type JobFormPaymentActionsArgs } from './useJobFormPaymentActions'
import type { PaymentRow } from '../lib/jobs/jobFormTypes'
import type { JobWithDetails } from '../types/jobWithDetails'

const db = vi.hoisted(() => ({
  rpcCalls: [] as Array<{ name: string; params: unknown }>,
  reply: { data: { ok: true } as unknown, error: null as unknown },
  found: null as unknown,
}))
const ui = vi.hoisted(() => ({ showToast: vi.fn() }))

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: async (name: string, params: unknown) => {
      db.rpcCalls.push({ name, params })
      return db.reply
    },
  },
}))
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => PromiseLike<{ data: unknown; error: unknown }>) => {
    const r = await op()
    if (r.error) throw r.error
    return r.data
  },
  formatPostgrestOrUnknownError: (e: unknown, fallback: string) => `${fallback}: ${(e as { message?: string })?.message ?? 'unknown'}`,
}))
vi.mock('../contexts/ToastContext', () => ({ useToastContext: () => ({ showToast: ui.showToast }) }))
vi.mock('../lib/fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: async () => db.found }))

const pay = (over: Partial<PaymentRow> & { id: string }): PaymentRow => ({
  amount: 500,
  paid_on: '2026-09-01',
  sent_on: null,
  note: null,
  payment_type: 'check',
  reference_number: null,
  invoice_id: null,
  mercury_transaction_id: null,
  ...over,
})
const saved = pay({ id: 'p-saved' })
const typed = pay({ id: 'p-typed', amount: 200 })
const bank = pay({ id: 'p-bank', mercury_transaction_id: 'mtx-1' })
const onStripe = pay({ id: 'p-stripe', invoice_id: 'inv-stripe' })
const bankOnPaidStripe = pay({ id: 'p-bank-stripe', mercury_transaction_id: 'mtx-2', invoice_id: 'inv-paid' })

const job = (over: Record<string, unknown> = {}) =>
  ({
    id: 'job-1',
    status: 'billed',
    payments: [{ id: 'p-saved', amount: 500 }, { id: 'p-bank', amount: 500 }, { id: 'p-stripe', amount: 500 }, { id: 'p-bank-stripe', amount: 500 }],
    invoices: [
      { id: 'inv-stripe', status: 'billed', amount: 500, stripe_invoice_id: 'in_1', stripe_invoice_status: 'open' },
      { id: 'inv-paid', status: 'billed', amount: 500, stripe_invoice_id: 'in_2', stripe_invoice_status: 'paid' },
    ],
    ...over,
  }) as unknown as JobWithDetails

function mount(over: Partial<JobFormPaymentActionsArgs> = {}) {
  const spies = {
    setEditing: vi.fn(),
    setPayments: vi.fn(),
    removePaymentRow: vi.fn(),
    cancelPending: vi.fn(),
    isRunning: vi.fn(() => false),
    onSaved: vi.fn(),
    paymentsRereadFromDb: vi.fn(),
  }
  const hydrated = { current: ['before'] }
  const args: JobFormPaymentActionsArgs = {
    editing: job(),
    authRole: 'dev',
    payments: [saved, typed, bank, onStripe, bankOnPaidStripe],
    jobTotalWithRidersDollars: 2_000,
    setEditing: spies.setEditing,
    setPayments: spies.setPayments,
    removePaymentRow: spies.removePaymentRow,
    billingAutosave: { cancelPending: spies.cancelPending, isRunning: spies.isRunning },
    hydratedPaymentIdsRef: hydrated,
    paymentsRereadFromDb: spies.paymentsRereadFromDb,
    onSavedRef: { current: spies.onSaved },
    ...over,
  }
  const hook = renderHook((a: JobFormPaymentActionsArgs) => useJobFormPaymentActions(a), { initialProps: args })
  return { ...hook, spies, hydrated, args }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  db.rpcCalls.length = 0
  db.reply = { data: { ok: true }, error: null }
  db.found = null
})

describe('useJobFormPaymentActions — Remove', () => {
  it('knows the saved lines from the job as it was last read', () => {
    const { result } = mount()
    expect([...result.current.persistedLedgerPaymentIds]).toEqual(['p-saved', 'p-bank', 'p-stripe', 'p-bank-stripe'])
    expect([...mount({ editing: null }).result.current.persistedLedgerPaymentIds]).toEqual([])
  })

  it('refuses a bank-matched line and a line on a Stripe bill, and opens no confirm', () => {
    const { result } = mount()
    act(() => result.current.requestRemovePaymentRow(bank))
    expect(ui.showToast).toHaveBeenLastCalledWith(expect.stringContaining('linked to a bank transaction'), 'error')
    act(() => result.current.requestRemovePaymentRow(onStripe))
    expect(ui.showToast).toHaveBeenLastCalledWith(expect.stringContaining('linked to a Stripe invoice'), 'error')
    expect(result.current.paymentRemoveConfirmRowId).toBeNull()
    expect(result.current.paymentRemovePreview).toBeNull()
  })

  it('opens the confirm with the line, the job total and the remainder now and after', () => {
    const { result } = mount({ payments: [saved, typed] })
    act(() => result.current.requestRemovePaymentRow(saved))
    expect(result.current.paymentRemoveConfirmRowId).toBe('p-saved')
    expect(result.current.paymentRemovePreview).toEqual({ rowAmt: 500, jobTotal: 2_000, currentRem: 1_300, newRem: 1_800 })
    expect(result.current.paymentRemoveConfirmsPersistedRpc).toBe(true)
    act(() => result.current.requestRemovePaymentRow(typed))
    expect(result.current.paymentRemoveConfirmsPersistedRpc).toBe(false)
  })

  it('confirming a line that was only typed drops it from the form and writes nothing', async () => {
    const { result, spies } = mount()
    act(() => result.current.requestRemovePaymentRow(typed))
    await act(() => result.current.confirmRemovePaymentRow())
    expect(db.rpcCalls).toEqual([])
    expect(spies.removePaymentRow).toHaveBeenCalledWith('p-typed')
    expect(result.current.paymentRemoveConfirmRowId).toBeNull()
  })

  it('confirming a saved line writes at once, re-reads the job and its payments, and closes', async () => {
    db.found = job({ payments: [{ id: 'p-bank', amount: 500, paid_on: '2026-09-02T00:00:00Z' }] })
    const { result, spies } = mount()
    act(() => result.current.requestRemovePaymentRow(saved))
    await act(() => result.current.confirmRemovePaymentRow())
    expect(db.rpcCalls).toEqual([{ name: 'remove_jobs_ledger_payment_and_reconcile', params: { p_payment_id: 'p-saved' } }])
    expect(ui.showToast).toHaveBeenCalledWith('Payment removed.', 'success')
    expect(spies.setEditing).toHaveBeenCalledWith(db.found)
    expect(spies.setPayments.mock.calls[0]?.[0]).toMatchObject([{ id: 'p-bank', amount: 500, paid_on: '2026-09-02' }])
    // The engine is told before the rows are set, so it judges the slice as it stood.
    expect(spies.paymentsRereadFromDb).toHaveBeenCalledWith(db.found)
    expect(spies.paymentsRereadFromDb.mock.invocationCallOrder[0]).toBeLessThan(spies.setPayments.mock.invocationCallOrder[0] ?? 0)
    expect(spies.removePaymentRow).not.toHaveBeenCalled()
    expect(spies.onSaved).toHaveBeenCalledTimes(1)
    expect(result.current.paymentRemoveConfirmRowId).toBeNull()
    expect(result.current.paymentRemoveRpcBusy).toBe(false)
  })

  it('a caveat from the database is shown as a warning, and the line still goes', async () => {
    db.reply = { data: { ok: true, warning: 'Job moved back to Billed.' }, error: null }
    const { result, spies } = mount()
    act(() => result.current.requestRemovePaymentRow(saved))
    await act(() => result.current.confirmRemovePaymentRow())
    expect(ui.showToast).toHaveBeenCalledWith('Job moved back to Billed.', 'warning')
    expect(spies.onSaved).toHaveBeenCalledTimes(1)
  })

  it('a refusal keeps the confirm open and re-reads nothing', async () => {
    db.reply = { data: { error: 'Payment is locked' }, error: null }
    const { result, spies } = mount()
    act(() => result.current.requestRemovePaymentRow(saved))
    await act(() => result.current.confirmRemovePaymentRow())
    expect(ui.showToast).toHaveBeenCalledWith('Payment is locked', 'error')
    expect(spies.setEditing).not.toHaveBeenCalled()
    expect(spies.onSaved).not.toHaveBeenCalled()
    expect(result.current.paymentRemoveConfirmRowId).toBe('p-saved')
    expect(result.current.paymentRemoveRpcBusy).toBe(false)
  })

  it('a call that fails outright says so and brings the busy flag down', async () => {
    db.reply = { data: null, error: { message: 'timeout' } }
    const { result } = mount()
    act(() => result.current.requestRemovePaymentRow(saved))
    await act(() => result.current.confirmRemovePaymentRow())
    expect(ui.showToast).toHaveBeenCalledWith('Failed to remove payment: timeout', 'error')
    expect(result.current.paymentRemoveRpcBusy).toBe(false)
  })

  it('with no confirm open nothing happens; a confirm whose line has gone just closes', async () => {
    const { result, rerender, spies, args } = mount()
    await act(() => result.current.confirmRemovePaymentRow())
    expect(db.rpcCalls).toEqual([])
    act(() => result.current.requestRemovePaymentRow(typed))
    expect(result.current.paymentRemoveConfirmRowId).toBe('p-typed')
    // The line leaves the form while the confirm is open.
    rerender({ ...args, payments: [saved] })
    await act(() => result.current.confirmRemovePaymentRow())
    expect(result.current.paymentRemoveConfirmRowId).toBeNull()
    expect(spies.removePaymentRow).not.toHaveBeenCalled()
    expect(db.rpcCalls).toEqual([])
  })
})

describe('useJobFormPaymentActions — a payment recorded on the bill', () => {
  it('quiets the autosave, drops the hand-typed line by id, re-reads and re-bases the payment ids', async () => {
    db.found = job({ payments: [{ id: 'p-recorded', amount: 200 }] })
    const { result, spies, hydrated } = mount()
    await act(() => result.current.finishRecordPaymentOnBill('p-typed'))
    expect(spies.cancelPending).toHaveBeenCalledTimes(1)
    expect(db.rpcCalls).toEqual([{ name: 'remove_jobs_ledger_payment_and_reconcile', params: { p_payment_id: 'p-typed' } }])
    expect(spies.setEditing).toHaveBeenCalledWith(db.found)
    expect(spies.setPayments.mock.calls[0]?.[0]).toMatchObject([{ id: 'p-recorded', amount: 200 }])
    expect(hydrated.current).toEqual(['p-recorded'])
    expect(spies.paymentsRereadFromDb).not.toHaveBeenCalled()
    expect(ui.showToast).toHaveBeenCalledWith('Payment recorded.', 'success')
    expect(spies.onSaved).toHaveBeenCalledTimes(1)
  })

  it('a line that was never saved answers "not found", which is fine; any other refusal is shown', async () => {
    db.reply = { data: { error: 'Payment not found' }, error: null }
    const quiet = mount()
    await act(() => quiet.result.current.finishRecordPaymentOnBill('p-typed'))
    expect(ui.showToast.mock.calls.map((c) => c[0])).toEqual(['Payment recorded.'])
    cleanup()
    vi.clearAllMocks()
    db.reply = { data: { error: 'Payment is locked' }, error: null }
    const loud = mount()
    await act(() => loud.result.current.finishRecordPaymentOnBill('p-typed'))
    expect(ui.showToast.mock.calls.map((c) => c[0])).toEqual(['Payment is locked', 'Payment recorded.'])
  })

  it('a drop that fails outright is said, and the recorded payment still shows', async () => {
    db.reply = { data: null, error: { message: 'timeout' } }
    db.found = job()
    const { result, spies } = mount()
    await act(() => result.current.finishRecordPaymentOnBill('p-typed'))
    expect(ui.showToast).toHaveBeenCalledWith('The payment was recorded, but the typed row could not be dropped: timeout', 'error')
    expect(spies.setEditing).toHaveBeenCalledWith(db.found)
    expect(spies.onSaved).toHaveBeenCalledTimes(1)
  })

  it('with no typed line there is nothing to drop; with no job open nothing happens', async () => {
    const { result, spies } = mount()
    await act(() => result.current.finishRecordPaymentOnBill(null))
    expect(db.rpcCalls).toEqual([])
    expect(spies.cancelPending).not.toHaveBeenCalled()
    expect(ui.showToast).toHaveBeenCalledWith('Payment recorded.', 'success')
    cleanup()
    vi.clearAllMocks()
    const closed = mount({ editing: null })
    await act(() => closed.result.current.finishRecordPaymentOnBill('p-typed'))
    expect(db.rpcCalls).toEqual([])
    expect(ui.showToast).not.toHaveBeenCalled()
  })
})

describe('useJobFormPaymentActions — Unlink and remove', () => {
  const openFor = (result: { current: ReturnType<typeof useJobFormPaymentActions> }, id: string) => act(() => result.current.setUnlinkMercuryConfirmRowId(id))

  it('removes the line, says the deposit is free again, re-reads and closes', async () => {
    db.found = job({ payments: [{ id: 'p-saved', amount: 500 }] })
    const { result, spies } = mount()
    openFor(result, 'p-bank')
    await act(async () => {
      result.current.confirmUnlinkMercuryFromBankRow()
      await Promise.resolve()
    })
    await vi.waitFor(() => expect(result.current.unlinkMercuryConfirmRowId).toBeNull())
    expect(db.rpcCalls).toEqual([{ name: 'remove_jobs_ledger_payment_and_reconcile', params: { p_payment_id: 'p-bank' } }])
    expect(ui.showToast).toHaveBeenCalledWith('Payment removed from job. The bank deposit is available in Accounts Receivable again.', 'success')
    expect(spies.setEditing).toHaveBeenCalledWith(db.found)
    expect(spies.paymentsRereadFromDb).toHaveBeenCalledWith(db.found)
    expect(spies.onSaved).toHaveBeenCalledTimes(1)
    expect(result.current.unlinkingMercuryPaymentId).toBeNull()
  })

  it('a deposit the bank returned is said to be marked returned', async () => {
    db.reply = { data: { ok: true, bank_failed: true, bank_reason: 'Insufficient funds', marked_returned: true }, error: null }
    const { result } = mount()
    openFor(result, 'p-bank')
    await act(async () => {
      result.current.confirmUnlinkMercuryFromBankRow()
      await Promise.resolve()
    })
    await vi.waitFor(() => expect(result.current.unlinkMercuryConfirmRowId).toBeNull())
    expect(ui.showToast).toHaveBeenCalledWith(expect.stringContaining('The bank returned this deposit (Insufficient funds)'), 'success')
  })

  it('stops while Stripe holds the payment, with Stripe’s own door named', async () => {
    const { result } = mount()
    openFor(result, 'p-bank-stripe')
    await act(async () => {
      result.current.confirmUnlinkMercuryFromBankRow()
      await Promise.resolve()
    })
    expect(db.rpcCalls).toEqual([])
    expect(ui.showToast).toHaveBeenCalledWith(expect.stringContaining('marked paid in Stripe'), 'error')
    expect(result.current.unlinkMercuryConfirmRowId).toBeNull()
  })

  it('stops for a role that may not unlink, a line that is not bank-matched, or a line that has gone', async () => {
    const field = mount({ authRole: 'subcontractor' })
    openFor(field.result, 'p-bank')
    act(() => field.result.current.confirmUnlinkMercuryFromBankRow())
    expect(field.result.current.unlinkMercuryConfirmRowId).toBeNull()
    cleanup()
    const manual = mount()
    openFor(manual.result, 'p-saved')
    act(() => manual.result.current.confirmUnlinkMercuryFromBankRow())
    expect(manual.result.current.unlinkMercuryConfirmRowId).toBeNull()
    cleanup()
    const gone = mount()
    openFor(gone.result, 'p-missing')
    act(() => gone.result.current.confirmUnlinkMercuryFromBankRow())
    expect(gone.result.current.unlinkMercuryConfirmRowId).toBeNull()
    expect(db.rpcCalls).toEqual([])
  })

  it('a refusal or a failed call is shown, and the confirm closes either way', async () => {
    db.reply = { data: { error: 'Deposit is reconciled' }, error: null }
    const refused = mount()
    openFor(refused.result, 'p-bank')
    await act(async () => {
      refused.result.current.confirmUnlinkMercuryFromBankRow()
      await Promise.resolve()
    })
    await vi.waitFor(() => expect(refused.result.current.unlinkMercuryConfirmRowId).toBeNull())
    expect(ui.showToast).toHaveBeenCalledWith('Deposit is reconciled', 'error')
    expect(refused.spies.onSaved).not.toHaveBeenCalled()
    cleanup()
    vi.clearAllMocks()
    db.reply = { data: null, error: { message: 'timeout' } }
    const failed = mount()
    openFor(failed.result, 'p-bank')
    await act(async () => {
      failed.result.current.confirmUnlinkMercuryFromBankRow()
      await Promise.resolve()
    })
    await vi.waitFor(() => expect(failed.result.current.unlinkMercuryConfirmRowId).toBeNull())
    expect(ui.showToast).toHaveBeenCalledWith('Failed to remove payment and unlink bank: timeout', 'error')
    expect(failed.result.current.unlinkingMercuryPaymentId).toBeNull()
  })
})
