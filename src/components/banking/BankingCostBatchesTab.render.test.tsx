// @vitest-environment jsdom
/**
 * Render smoke for Banking → Cost batches: the newest batches company-wide with their Revert behind
 * the typed word, and a job picked through the search adds the batches that touched it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { BankingCostBatchesTab } from './BankingCostBatchesTab'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const SOURCE = '11111111-1111-4111-8111-111111111111'
const TARGET = '22222222-2222-4222-8222-222222222222'
const TX = '33333333-3333-4333-8333-333333333333'
const BATCH = '77777777-7777-4777-8777-777777777777'

const jobs: Record<string, unknown>[] = [
  { id: SOURCE, hcp_number: '583', click_number: '', job_name: 'Diamondback', job_address: '1 Catch-all Rd', service_type_id: null, service_type_name: 'Plumbing' },
  { id: TARGET, hcp_number: '629', click_number: '', job_name: 'ROUGH IN', job_address: '2 Draw St', service_type_id: null, service_type_name: 'Plumbing' },
]

const TABLE_ROWS: Record<string, unknown[]> = {
  jobs_ledger: jobs,
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
      rpc: (name: string) => makeBuilder(name === 'search_jobs_ledger' ? jobs : []),
    },
  }
})

afterEach(cleanup)

describe('BankingCostBatchesTab', () => {
  it('lists every batch with Revert behind the typed word, and a picked job adds the batches that touched it', async () => {
    renderWithProviders(<BankingCostBatchesTab />)
    expect(await screen.findByText('Cost batches')).toBeTruthy()
    expect(screen.getByText(/open the job’s window → Costs/)).toBeTruthy()

    // Every batch, newest first; no job section until a job is picked.
    expect(await screen.findByText('Earlier move')).toBeTruthy()
    expect(screen.getByText(/Every batch \(newest 1\)/)).toBeTruthy()
    expect(screen.queryByText(/Batches that touched this job/)).toBeNull()

    // Revert behind the typed word and a reason.
    fireEvent.click(screen.getByRole('button', { name: 'Revert…' }))
    const revert = screen.getByRole('button', { name: 'Revert 2 ops' }) as HTMLButtonElement
    expect(revert.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Type revert to confirm'), { target: { value: 'revert' } })
    fireEvent.change(screen.getByLabelText('Why this batch is reverted'), { target: { value: 'wrong draw' } })
    await waitFor(() => expect(revert.disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Keep the batch' }))

    // A job through the search: its batches first, the batch listed once.
    fireEvent.change(screen.getByLabelText('Pick a job to see the batches that touched it'), { target: { value: '583' } })
    fireEvent.click(await screen.findByText(/J583 · Diamondback - 1 Catch-all Rd/))
    expect(await screen.findByText('Batches that touched this job (1)')).toBeTruthy()
    expect(screen.getAllByText('Earlier move')).toHaveLength(1)
    expect(screen.getByText(/listed once, in the first section/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Change job' }))
    await waitFor(() => expect(screen.queryByText(/Batches that touched this job/)).toBeNull())
  })
})
