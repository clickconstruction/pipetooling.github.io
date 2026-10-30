// @vitest-environment jsdom
/**
 * Render smoke for the job window's Costs-tab panel (devs): every stream on the job with its rows,
 * a click on a row ticks it, a stream's press ticks the stream, Move N rows… opens the Move cost
 * window and holds the job window's Escape while it is up, the batches that touched the job list
 * with their Revert behind the typed word, and the office sees none of it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { JobWindowCostMovePanel } from './JobWindowCostMovePanel'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'

const SOURCE = '11111111-1111-4111-8111-111111111111'
const TARGET = '22222222-2222-4222-8222-222222222222'
const TX = '33333333-3333-4333-8333-333333333333'
const INV = '44444444-4444-4444-8444-444444444444'
const SESSION = '55555555-5555-4555-8555-555555555555'
const BATCH = '77777777-7777-4777-8777-777777777777'

const sourceJob = { id: SOURCE, hcp_number: '583', click_number: '', job_name: 'Diamondback', job_address: '1 Catch-all Rd', service_type_id: null }

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

const auth = vi.hoisted(() => ({ role: 'dev' as string }))

vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  const value = () => makeUseAuthValue({ role: auth.role, user: { id: '66666666-6666-4666-8666-666666666666', email: 'dev@example.com' } })
  return { useAuth: value, useOptionalAuth: value }
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

installDomShims()
afterEach(cleanup)

describe('JobWindowCostMovePanel', () => {
  it('lists every stream, ticks by row click and by stream, opens the Move cost window on the ticked rows, and lists the job’s batches with Revert', async () => {
    auth.role = 'dev'
    const onOverlayOpenChange = vi.fn()
    renderWithProviders(<JobWindowCostMovePanel job={sourceJob} onOverlayOpenChange={onOverlayOpenChange} />)
    expect(screen.getByText('Every cost row on this job')).toBeTruthy()

    // Four streams with their rows: the card's nickname, the invoice, the person, the Other charge held.
    expect(await screen.findByText('Shell')).toBeTruthy()
    expect(screen.getByText('Truck 2')).toBeTruthy()
    expect(screen.getByText('Reece')).toBeTruthy()
    expect(screen.getByText('rejected · stays')).toBeTruthy()
    expect(screen.getByText('Permit')).toBeTruthy()
    expect(screen.getByText(/Other job charges cannot be moved by a cost batch/)).toBeTruthy()
    expect(screen.getByText(/On the job: 1 bank row \(-\$84\.10\) · 1 invoice \(\$507\.80\) · 2 sessions \(9\.5 h\)/)).toBeTruthy()

    // Move is dead with nothing ticked. A click on the bank row's counterparty ticks it; the invoice by its box;
    // the stream's press ticks the one movable session (the rejected one is held by the kernel).
    expect((screen.getByRole('button', { name: 'Move ticked rows…' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByText('Shell'))
    expect((screen.getByLabelText(/Tick Shell/) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByLabelText(/Tick invoice 4471/))
    // The stream's press, the heading's and Malachi's group press read the same; any ticks his one movable session.
    fireEvent.click(screen.getAllByRole('button', { name: 'Tick 1 session' })[0]!)
    expect(screen.getByText(/Ticked: 1 bank row \(-\$84\.10\) · 1 invoice \(\$507\.80\) · 1 session \(9\.5 h\)/)).toBeTruthy()

    // Move N rows… opens the window on those rows and holds the job window's Escape; its × lets go.
    fireEvent.click(screen.getByRole('button', { name: 'Move 3 ticked rows…' }))
    expect(onOverlayOpenChange).toHaveBeenLastCalledWith(true)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Move 3 rows to another job' })).toBeTruthy()
    expect(screen.getByLabelText('The job the rows move to')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onOverlayOpenChange).toHaveBeenLastCalledWith(false)
    expect(screen.queryByRole('dialog')).toBeNull()
    // The ticks survive the window.
    expect((screen.getByLabelText(/Tick Shell/) as HTMLInputElement).checked).toBe(true)

    // The job's batches, and only the job's: the earlier batch with its Revert behind the typed word and a reason.
    expect(await screen.findByText('Earlier move')).toBeTruthy()
    expect(screen.getByText('Batches that touched this job (1)')).toBeTruthy()
    expect(screen.queryByText(/Every batch/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Revert…' }))
    const revert = screen.getByRole('button', { name: 'Revert 2 ops' }) as HTMLButtonElement
    expect(revert.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Type revert to confirm'), { target: { value: 'revert' } })
    fireEvent.change(screen.getByLabelText('Why this batch is reverted'), { target: { value: 'wrong draw' } })
    await waitFor(() => expect(revert.disabled).toBe(false))
  })

  it('is not drawn for the office', () => {
    auth.role = 'controller'
    renderWithProviders(<JobWindowCostMovePanel job={sourceJob} />)
    expect(screen.queryByText('Every cost row on this job')).toBeNull()
  })
})
