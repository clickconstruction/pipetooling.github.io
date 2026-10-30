// @vitest-environment jsdom
/**
 * Render smoke for Banking → Cost batches: a dev picks the source job through the search, the four
 * sources render with their totals, ticking a bank row and picking the target builds the plan, the
 * dry run lays the RPC's by_job beside the plan and matches, Apply is dead until the summary is
 * read, and the batch list shows a batch with its Revert behind the typed word.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { BankingCostBatchesTab } from './BankingCostBatchesTab'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { Json } from '../../types/database'

const SOURCE = '11111111-1111-4111-8111-111111111111'
const TARGET = '22222222-2222-4222-8222-222222222222'
const TX = '33333333-3333-4333-8333-333333333333'
const INV = '44444444-4444-4444-8444-444444444444'
const SESSION = '55555555-5555-4555-8555-555555555555'
const BATCH = '77777777-7777-4777-8777-777777777777'

const jobs: Record<string, unknown>[] = [
  { id: SOURCE, hcp_number: '583', click_number: '', job_name: 'Diamondback', job_address: '1 Catch-all Rd', service_type_id: null, service_type_name: 'Plumbing' },
  { id: TARGET, hcp_number: '629', click_number: '', job_name: 'ROUGH IN', job_address: '2 Draw St', service_type_id: null, service_type_name: 'Plumbing' },
]

const TABLE_ROWS: Record<string, unknown[]> = {
  jobs_ledger: jobs,
  mercury_transaction_job_allocations: [
    { id: 'a1', amount: -84.1, note: null, mercury_transaction_id: TX, mercury_transactions: { id: TX, posted_at: '2026-09-10T15:00:00Z', counterparty_name: 'Shell', amount: -84.1, raw: { details: { debitCardInfo: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } } }, mercury_category: 'Fuel' } },
  ],
  supply_house_invoice_job_allocations: [{ invoice_id: INV, pct: 100, supply_house_invoices: { id: INV, invoice_number: '4471', invoice_date: '2026-10-08', amount: 507.8, is_paid: false, purchase_order_number: 'Gun Dog', supply_houses: { name: 'Reece' } } }],
  clock_sessions: [
    { id: SESSION, user_id: 'u1', work_date: '2026-10-26', clocked_in_at: '2026-10-26T13:00:00Z', clocked_out_at: '2026-10-26T22:30:00Z', quick_add_minutes: null, approved_at: '2026-10-27T00:00:00Z', rejected_at: null, bid_id: null, users: { name: 'Malachi' } },
    { id: '55555555-5555-4555-8555-555555555556', user_id: 'u1', work_date: '2026-10-27', clocked_in_at: '2026-10-27T13:00:00Z', clocked_out_at: '2026-10-27T14:00:00Z', quick_add_minutes: null, approved_at: null, rejected_at: '2026-10-28T00:00:00Z', bid_id: null, users: { name: 'Malachi' } },
  ],
  jobs_ledger_materials: [{ id: 'o1', description: 'Permit', amount: 100, sequence_order: 0 }],
  mercury_debit_card_nicknames: [{ mercury_debit_card_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', nickname: 'Truck 2' }],
  mercury_account_nicknames: [],
  cost_batches: [
    {
      id: BATCH,
      label: 'Earlier move',
      reason: 'Owner call',
      source_ref: 'plan.md',
      author_label: 'Cost agent',
      author_user_id: null,
      applied_at: '2026-10-20T20:00:00Z',
      reverted_at: null,
      revert_reason: null,
      op_count: 2,
      summary: { by_job: { [TARGET]: { allocated: 10, notes: 1 } } },
    },
  ],
  cost_batch_ops: [{ batch_id: BATCH, seq: 1, op_type: 'allocate', target: { op: 'allocate', job_id: TARGET, from_job_id: SOURCE, tx_id: TX, amount: 10 }, before_image: null, after_image: { action: 'insert', allocation: { job_id: TARGET } }, reverted_at: null }],
}

const rpcCalls: { name: string; args: unknown }[] = []

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ user: { id: '66666666-6666-4666-8666-666666666666', email: 'dev@example.com' } })
})

vi.mock('../../lib/supabase', () => {
  function makeBuilder(rows: unknown[]): Record<string, unknown> {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'in', 'is', 'or', 'not', 'order', 'range', 'limit']) {
      builder[m] = () => builder
    }
    builder.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null })
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => Promise.resolve({ data: rows, error: null, count: rows.length, status: 200 }).then(onFulfilled, onRejected)
    return builder
  }
  return {
    supabase: {
      from: (table: string) => makeBuilder(TABLE_ROWS[table] ?? []),
      rpc: (name: string, args: unknown) => {
        rpcCalls.push({ name, args })
        if (name === 'search_jobs_ledger') return makeBuilder(jobs)
        if (name === 'cost_batch_apply') {
          const a = args as { p: { ops: { op: string; job_id?: string; to_job_id?: string; amount?: number }[] }; p_dry_run: boolean }
          const byJob: Record<string, Record<string, number>> = {}
          for (const op of a.p.ops) {
            const job = op.job_id ?? op.to_job_id ?? ''
            const row = (byJob[job] ??= {})
            if (op.op === 'allocate') row.allocated = (row.allocated ?? 0) + (op.amount ?? 0)
            if (op.op === 'supply_repoint') row.supply = (row.supply ?? 0) + 1
            if (op.op === 'clock_repoint') row.clock_sessions = (row.clock_sessions ?? 0) + 1
            if (op.op === 'thread_note') row.notes = (row.notes ?? 0) + 1
          }
          return makeBuilder([{ batch_id: a.p_dry_run ? null : BATCH, dry_run: a.p_dry_run, op_count: a.p.ops.length, by_job: byJob, ops: [] }])
        }
        return makeBuilder([])
      },
    },
  }
})

// The dry-run reply is one JSON value, not a list: the builder above returns it as `rows`, so unwrap.
vi.mock('../../lib/costBatches/costMoveReads', async () => {
  const real = await import('../../lib/costBatches/costMoveReads')
  const { supabase } = await import('../../lib/supabase')
  const { parseCostBatchApplyResult } = await import('../../lib/costBatches/costBatchDryRunCompare')
  const call = async (payload: unknown, dryRun: boolean) => {
    const res = (await (supabase.rpc('cost_batch_apply', { p: payload as Json, p_dry_run: dryRun }) as unknown as Promise<{ data: unknown[] }>)).data
    const parsed = parseCostBatchApplyResult(Array.isArray(res) ? res[0] : res)
    if (!parsed) throw new Error('not a summary')
    return parsed
  }
  return { ...real, dryRunCostBatch: (p: unknown) => call(p, true), applyCostBatch: (p: unknown) => call(p, false) }
})

afterEach(cleanup)

describe('BankingCostBatchesTab', () => {
  it('reads a job, ticks rows, plans, dry-runs to a match and lists the batches with Revert', async () => {
    renderWithProviders(<BankingCostBatchesTab />)
    expect(await screen.findByText('Cost batches')).toBeTruthy()

    // The source job through the search.
    fireEvent.change(screen.getByLabelText('Pick the job whose rows you are moving'), { target: { value: '583' } })
    fireEvent.click(await screen.findByText(/J583 · Diamondback - 1 Catch-all Rd/))

    // Four sources with their rows: the card's nickname, the invoice, the person, the Other charge held.
    expect(await screen.findByText('Shell')).toBeTruthy()
    expect(screen.getByText('Truck 2')).toBeTruthy()
    expect(screen.getByText('Reece')).toBeTruthy()
    expect(screen.getByText('rejected · stays')).toBeTruthy()
    expect(screen.getByText('Permit')).toBeTruthy()
    expect(screen.getByText(/Other job charges cannot be moved by a cost batch/)).toBeTruthy()

    // Tick the bank row, the invoice and every session (the rejected one is held by the kernel).
    fireEvent.click(screen.getByLabelText(/Tick Shell/))
    fireEvent.click(screen.getByLabelText(/Tick invoice 4471/))
    // The heading's press and Malachi's group press read the same; either ticks his one movable session.
    fireEvent.click(screen.getAllByRole('button', { name: 'Tick 1 session' })[0]!)
    expect(screen.getByText(/Move 3 ticked rows to…/)).toBeTruthy()

    // The target and the reason make the plan.
    fireEvent.change(screen.getByLabelText('The job the rows move to'), { target: { value: '629' } })
    fireEvent.click(await screen.findByText(/J629 · ROUGH IN - 2 Draw St/))
    fireEvent.change(screen.getByPlaceholderText(/Owner decision/), { target: { value: 'Owner call tonight' } })
    expect(await screen.findByText(/5 ops · 1 allocate · 1 supply_repoint · 1 clock_repoint · 2 thread_note/)).toBeTruthy()

    // Apply is dead before the dry run; the dry run matches; Apply wakes only once the summary is read.
    const apply = screen.getByRole('button', { name: 'Apply 5 ops' })
    expect((apply as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Dry-run 5 ops' }))
    expect(await screen.findByText(/Dry run matches the plan to the cent — 5 ops/)).toBeTruthy()
    expect(rpcCalls.filter((c) => c.name === 'cost_batch_apply').map((c) => (c.args as { p_dry_run: boolean }).p_dry_run)).toEqual([true])
    expect((screen.getByRole('button', { name: 'Apply 5 ops' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('I read the dry run’s summary'))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Apply 5 ops' }) as HTMLButtonElement).disabled).toBe(false))

    // The batch list: the earlier batch, its Revert behind the typed word and a reason.
    expect(await screen.findByText('Earlier move')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Revert…' }))
    const revert = screen.getByRole('button', { name: 'Revert 2 ops' }) as HTMLButtonElement
    expect(revert.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Type revert to confirm'), { target: { value: 'revert' } })
    fireEvent.change(screen.getByLabelText('Why this batch is reverted'), { target: { value: 'wrong draw' } })
    await waitFor(() => expect(revert.disabled).toBe(false))
  })
})
