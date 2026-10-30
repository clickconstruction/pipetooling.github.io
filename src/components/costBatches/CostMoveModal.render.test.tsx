// @vitest-environment jsdom
/**
 * Render smoke for the Move cost window: the ticked rows of one job, the target through the search,
 * the reason, the plan's words, a dry run that lays the RPC's by_job beside the plan and matches,
 * Apply dead until the summary is read, the apply (a second dry run, then the write), the result
 * and Done.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { CostMoveModal } from './CostMoveModal'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import type { CostMoveBankRow, CostMoveClockRow, CostMoveSupplyRow } from '../../lib/costBatches/costMoveRows'
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

const sourceJob = { id: SOURCE, hcp_number: '583', click_number: '', job_name: 'Diamondback', job_address: '1 Catch-all Rd', service_type_id: null }

const bank: CostMoveBankRow = { source: 'bank', allocationId: 'a1', txId: TX, postedYmd: '2026-09-10', counterparty: 'Shell', cardId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', cardNickname: 'Truck 2', category: 'Fuel', txAmount: -84.1, allocationAmount: -84.1, note: null }
const supply: CostMoveSupplyRow = { source: 'supply', invoiceId: INV, supplyHouse: 'Reece', invoiceNumber: '4471', invoiceYmd: '2026-10-08', amount: 507.8, pct: 100, isPaid: false, purchaseOrder: 'Gun Dog' }
const clock: CostMoveClockRow = { source: 'clock', sessionId: SESSION, userId: 'u1', personName: 'Malachi', workYmd: '2026-10-26', minutes: 570, approved: true, rejected: false, bidId: null }

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
      from: () => makeBuilder([]),
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

// The RPC's reply is one JSON value, not a list: the builder above returns it as `rows`, so unwrap.
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

installDomShims()
afterEach(cleanup)

describe('CostMoveModal', () => {
  it('plans the ticked rows onto the picked job, dry-runs to a match, applies after the summary is read, and says what it wrote', async () => {
    const onRequestClose = vi.fn()
    const onApplied = vi.fn()
    renderWithProviders(<CostMoveModal sourceJob={sourceJob} rows={[bank, supply, clock]} onRequestClose={onRequestClose} onApplied={onApplied} />)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Move 3 rows to another job' })).toBeTruthy()
    expect(screen.getByText(/1 bank row \(-\$84\.10\) · 1 invoice \(\$507\.80\) · 1 session \(9\.5 h\)/)).toBeTruthy()

    // The target and the reason make the plan.
    fireEvent.change(screen.getByLabelText('The job the rows move to'), { target: { value: '629' } })
    fireEvent.click(await screen.findByText(/J629 · ROUGH IN - 2 Draw St/))
    fireEvent.change(screen.getByPlaceholderText(/Owner decision/), { target: { value: 'Owner call tonight' } })
    expect(await screen.findByText(/5 ops · 1 allocate · 1 supply_repoint · 1 clock_repoint · 2 thread_note/)).toBeTruthy()

    // Apply is dead before the dry run; the dry run matches; Apply wakes only once the summary is read.
    expect((screen.getByRole('button', { name: 'Apply 5 ops' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Dry-run 5 ops' }))
    expect(await screen.findByText(/Dry run matches the plan to the cent — 5 ops/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Apply 5 ops' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('I read the dry run’s summary'))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Apply 5 ops' }) as HTMLButtonElement).disabled).toBe(false))

    // Apply: the dry run once more, then the write; the window says what it wrote and offers Done.
    fireEvent.click(screen.getByRole('button', { name: 'Apply 5 ops' }))
    await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1))
    expect(onApplied.mock.calls[0]![0]).toEqual({ batchId: BATCH, label: expect.stringMatching(/^Move cost: J583 · Diamondback → J629 · ROUGH IN \(\d{4}-\d{2}-\d{2}\)$/) })
    expect(rpcCalls.filter((c) => c.name === 'cost_batch_apply').map((c) => (c.args as { p_dry_run: boolean }).p_dry_run)).toEqual([true, true, false])
    expect(await screen.findByRole('heading', { name: 'Cost moved' })).toBeTruthy()
    expect(screen.getByText(BATCH)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onRequestClose).toHaveBeenCalledTimes(1)
  })
})
