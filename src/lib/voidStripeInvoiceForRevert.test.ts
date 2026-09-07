import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Sending a billed invoice back (job revert to Ready to Bill, sub Collect
 * Payment send-back): which lines need a Stripe void, the edge call and how
 * its answers map to ok / message, the ledger clean-up RPC with its
 * older-edge fallback, and the per-job sweep over billed lines.
 */
type Step = { method: string; args: unknown[] }
const calls: Array<{ kind: 'from' | 'rpc'; name: string; args: unknown[]; steps: Step[] }> = []
let route: (kind: 'from' | 'rpc', name: string, args: unknown[]) => { data: unknown; error: { message: string } | null } = () => ({ data: null, error: null })
function recorder(kind: 'from' | 'rpc', name: string, args: unknown[]) {
  const steps: Step[] = []
  calls.push({ kind, name, args, steps })
  const p: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') {
          return (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
            try {
              resolve(route(kind, name, args))
            } catch (e) {
              reject(e)
            }
          }
        }
        return (...a: unknown[]) => {
          steps.push({ method: String(prop), args: a })
          return p
        }
      },
    },
  )
  return p
}
const invoke = vi.fn(async (_name: string, _opts: unknown): Promise<{ data: unknown; error: unknown }> => ({ data: { success: true }, error: null }))
vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => recorder('from', table, []),
    rpc: (fn: string, args: unknown) => recorder('rpc', fn, [args]),
    functions: { invoke: (name: string, opts: unknown) => invoke(name, opts) },
  },
}))
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: { message: string } | null }>) => {
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
  formatErrorMessage: (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback),
}))
vi.mock('./readEdgeFunctionErrorBody', () => ({ readEdgeFunctionErrorBody: async (e: { detail?: string }) => e.detail ?? null }))
vi.mock('./billingStripeModePref', () => ({ getBillingStripeModePref: () => 'test', stripeModeInvokeBody: (mode: string) => ({ stripe_mode: mode }) }))

import {
  ensureLedgerInvoiceRemovedAfterStripeSendBack,
  invoiceNeedsStripeVoidForRevert,
  invokeVoidStripeInvoiceForCollectPaymentSendBack,
  invokeVoidStripeInvoiceForRevert,
  prepareBilledInvoicesBeforeJobRevertToReadyToBill,
  stripeModeForBillingFromRole,
} from './voidStripeInvoiceForRevert'

const rpcs = () => calls.filter((c) => c.kind === 'rpc').map((c) => [c.name, c.args[0]])

beforeEach(() => {
  calls.length = 0
  invoke.mockClear()
  invoke.mockResolvedValue({ data: { success: true }, error: null })
  route = () => ({ data: null, error: null })
})

describe('pure helpers', () => {
  it('a billed line needs a Stripe void when it carries a Stripe invoice id or was sent through Stripe', () => {
    expect(invoiceNeedsStripeVoidForRevert({ status: 'billed', stripe_invoice_id: 'in_1' })).toBe(true)
    expect(invoiceNeedsStripeVoidForRevert({ status: 'billed', stripe_invoice_id: '  ', external_send_channel: 'stripe' })).toBe(true)
    expect(invoiceNeedsStripeVoidForRevert({ status: 'billed', stripe_invoice_id: null, external_send_channel: 'email' })).toBe(false)
    expect(invoiceNeedsStripeVoidForRevert({ status: 'ready_to_bill', stripe_invoice_id: 'in_1' })).toBe(false)
  })
  it('only a dev follows the Stripe test/live preference; everyone else bills live', () => {
    expect(stripeModeForBillingFromRole('dev')).toBe('test')
    expect(stripeModeForBillingFromRole('controller')).toBe('live')
    expect(stripeModeForBillingFromRole(null)).toBe('live')
  })
})

describe('the void edge call', () => {
  it('sends the invoice id, the Stripe mode and the bearer token, and reads success / error / unexpected answers', async () => {
    expect(await invokeVoidStripeInvoiceForRevert({ invoiceId: 'inv1', stripeModeForBilling: 'live', accessToken: 'tok' })).toEqual({ ok: true })
    expect(invoke).toHaveBeenCalledWith('void-stripe-invoice-for-revert', {
      body: { jobs_ledger_invoice_id: 'inv1', stripe_mode: 'live' },
      headers: { Authorization: 'Bearer tok' },
    })
    invoke.mockResolvedValueOnce({ data: { error: 'Stripe says no' }, error: null })
    expect(await invokeVoidStripeInvoiceForRevert({ invoiceId: 'inv1', stripeModeForBilling: 'live', accessToken: 'tok' })).toEqual({ ok: false, message: 'Stripe says no' })
    invoke.mockResolvedValueOnce({ data: { something: 'else' }, error: null })
    expect(await invokeVoidStripeInvoiceForRevert({ invoiceId: 'inv1', stripeModeForBilling: 'live', accessToken: 'tok' })).toEqual({ ok: false, message: 'Unexpected response from server' })
    invoke.mockResolvedValueOnce({ data: null, error: { detail: 'Invoice already paid' } })
    expect(await invokeVoidStripeInvoiceForRevert({ invoiceId: 'inv1', stripeModeForBilling: 'live', accessToken: 'tok' })).toEqual({ ok: false, message: 'Invoice already paid' })
    invoke.mockResolvedValueOnce({ data: null, error: new Error('network') })
    expect(await invokeVoidStripeInvoiceForRevert({ invoiceId: 'inv1', stripeModeForBilling: 'live', accessToken: 'tok' })).toEqual({ ok: false, message: 'network' })
    invoke.mockResolvedValueOnce({ data: null, error: {} })
    expect(await invokeVoidStripeInvoiceForRevert({ invoiceId: 'inv1', stripeModeForBilling: 'live', accessToken: 'tok' })).toEqual({ ok: false, message: 'Failed to void Stripe invoice' })
  })
  it('the sub Collect Payment send-back variant adds the job id so the edge can run its team and flow checks', async () => {
    expect(await invokeVoidStripeInvoiceForCollectPaymentSendBack({ jobId: 'j1', invoiceId: 'inv1', stripeModeForBilling: 'test', accessToken: 'tok' })).toEqual({ ok: true })
    expect(invoke).toHaveBeenCalledWith('void-stripe-invoice-for-revert', {
      body: { jobs_ledger_invoice_id: 'inv1', collect_payment_send_back_job_id: 'j1', stripe_mode: 'test' },
      headers: { Authorization: 'Bearer tok' },
    })
    invoke.mockResolvedValueOnce({ data: { error: 'not on the team' }, error: null })
    expect(await invokeVoidStripeInvoiceForCollectPaymentSendBack({ jobId: 'j1', invoiceId: 'inv1', stripeModeForBilling: 'test', accessToken: 'tok' })).toEqual({ ok: false, message: 'not on the team' })
  })
})

describe('ensureLedgerInvoiceRemovedAfterStripeSendBack', () => {
  it('deletes the billed line via RPC; when an older edge already reverted it to ready-to-bill, deletes that instead', async () => {
    route = () => ({ data: { ok: true }, error: null })
    expect(await ensureLedgerInvoiceRemovedAfterStripeSendBack('inv1')).toEqual({ ok: true })
    expect(rpcs()).toEqual([['delete_billed_invoice_on_send_back', { p_invoice_id: 'inv1' }]])

    calls.length = 0
    route = (_k, name) => (name === 'delete_billed_invoice_on_send_back' ? { data: { ok: false, error: 'Invoice is not Billed Awaiting Payment' }, error: null } : { data: { ok: true }, error: null })
    expect(await ensureLedgerInvoiceRemovedAfterStripeSendBack('inv1')).toEqual({ ok: true })
    expect(rpcs()).toEqual([
      ['delete_billed_invoice_on_send_back', { p_invoice_id: 'inv1' }],
      ['delete_ready_to_bill_invoice', { p_invoice_id: 'inv1' }],
    ])
  })
  it('surfaces the RPC’s own error, the fallback-RPC error, a missing answer, and a thrown request', async () => {
    route = () => ({ data: { ok: false, error: 'locked' }, error: null })
    expect(await ensureLedgerInvoiceRemovedAfterStripeSendBack('inv1')).toEqual({ ok: false, message: 'locked' })
    route = (_k, name) => (name === 'delete_billed_invoice_on_send_back' ? { data: { ok: false, error: 'Invoice is not Billed Awaiting Payment' }, error: null } : { data: { ok: false, error: 'rtb gone' }, error: null })
    expect(await ensureLedgerInvoiceRemovedAfterStripeSendBack('inv1')).toEqual({ ok: false, message: 'rtb gone' })
    route = () => ({ data: null, error: null })
    expect(await ensureLedgerInvoiceRemovedAfterStripeSendBack('inv1')).toEqual({ ok: false, message: 'Failed to remove billing line' })
    route = () => ({ data: null, error: { message: 'rls' } })
    expect(await ensureLedgerInvoiceRemovedAfterStripeSendBack('inv1')).toEqual({ ok: false, message: 'rls' })
  })
})

describe('prepareBilledInvoicesBeforeJobRevertToReadyToBill', () => {
  const rows = [
    { id: 'stripe-line', status: 'billed', stripe_invoice_id: 'in_1', external_send_channel: null },
    { id: 'plain-line', status: 'billed', stripe_invoice_id: null, external_send_channel: 'email' },
  ]
  it('reads the job’s billed lines, voids the Stripe-backed ones through the edge (then cleans the ledger) and deletes the rest by RPC, in the dev’s Stripe mode', async () => {
    route = (kind, name) => (kind === 'from' && name === 'jobs_ledger_invoices' ? { data: rows, error: null } : { data: { ok: true }, error: null })
    expect(await prepareBilledInvoicesBeforeJobRevertToReadyToBill({ jobId: 'j1', authRole: 'dev', accessToken: 'tok' })).toEqual({ ok: true })
    const read = calls.find((c) => c.kind === 'from')!
    expect(read.steps.filter((s) => s.method === 'eq').map((s) => s.args)).toEqual([
      ['job_id', 'j1'],
      ['status', 'billed'],
    ])
    expect(invoke).toHaveBeenCalledTimes(1)
    expect(invoke.mock.calls[0]![1]).toEqual({ body: { jobs_ledger_invoice_id: 'stripe-line', stripe_mode: 'test' }, headers: { Authorization: 'Bearer tok' } })
    expect(rpcs()).toEqual([
      ['delete_billed_invoice_on_send_back', { p_invoice_id: 'stripe-line' }],
      ['delete_billed_invoice_on_send_back', { p_invoice_id: 'plain-line' }],
    ])
  })
  it('stops at the first failure: a read error, a refused void, or a refused delete', async () => {
    route = (kind, name) => (kind === 'from' && name === 'jobs_ledger_invoices' ? { data: null, error: { message: 'rls' } } : { data: { ok: true }, error: null })
    expect(await prepareBilledInvoicesBeforeJobRevertToReadyToBill({ jobId: 'j1', authRole: null, accessToken: 'tok' })).toEqual({ ok: false, message: 'rls' })
    expect(invoke).not.toHaveBeenCalled()

    route = (kind, name) => (kind === 'from' && name === 'jobs_ledger_invoices' ? { data: rows, error: null } : { data: { ok: true }, error: null })
    invoke.mockResolvedValueOnce({ data: { error: 'Stripe says no' }, error: null })
    expect(await prepareBilledInvoicesBeforeJobRevertToReadyToBill({ jobId: 'j1', authRole: null, accessToken: 'tok' })).toEqual({ ok: false, message: 'Stripe says no' })
    expect(rpcs()).toEqual([]) // the plain line was never reached
    expect(invoke.mock.calls[0]![1]).toMatchObject({ body: { stripe_mode: 'live' } }) // non-dev: live

    calls.length = 0
    route = (kind, name, args) => {
      if (kind === 'from') return { data: [rows[1]], error: null }
      return name === 'delete_billed_invoice_on_send_back' && (args[0] as { p_invoice_id: string }).p_invoice_id === 'plain-line' ? { data: { ok: false, error: 'locked' }, error: null } : { data: { ok: true }, error: null }
    }
    expect(await prepareBilledInvoicesBeforeJobRevertToReadyToBill({ jobId: 'j1', authRole: null, accessToken: 'tok' })).toEqual({ ok: false, message: 'locked' })
    route = (kind) => (kind === 'from' ? { data: [rows[1]], error: null } : { data: null, error: { message: 'timeout' } })
    expect(await prepareBilledInvoicesBeforeJobRevertToReadyToBill({ jobId: 'j1', authRole: null, accessToken: 'tok' })).toEqual({ ok: false, message: 'timeout' })
  })
  it('a job with no billed lines is a no-op success', async () => {
    route = () => ({ data: [], error: null })
    expect(await prepareBilledInvoicesBeforeJobRevertToReadyToBill({ jobId: 'j1', authRole: null, accessToken: 'tok' })).toEqual({ ok: true })
    expect(invoke).not.toHaveBeenCalled()
    expect(rpcs()).toEqual([])
  })
})
