// @vitest-environment jsdom
/**
 * Render-smoke tests for TallySortPurchaseModal — Sort mode's one-purchase-at-
 * a-time screen (v2.1542): day jobs as buttons, tap-to-select, second tap
 * splits with editable auto-balancing amounts.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const fetchDayJobs = vi.fn()
vi.mock('../../lib/tally/fetchSortModeDayJobs', () => ({
  fetchSortModeDayJobs: (...args: unknown[]) => fetchDayJobs(...args),
}))

import { TallySortPurchaseModal } from './TallySortPurchaseModal'
import type { TallyLinkedMercuryRow } from '../../lib/mercuryTxRowFromTally'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const DAY_JOBS = [
  { id: 'j1', main: 'JP942 · Spigots replaced', address: '720 Bailey St, Seguin' },
  { id: 'j2', main: 'JP926 · Dylan Beck PRV', address: '210 Cliffside' },
]

function row(over: Partial<TallyLinkedMercuryRow> = {}): TallyLinkedMercuryRow {
  return {
    amount: -90.42,
    counterparty_name: 'Reece Plumbing',
    currency: 'USD',
    invoices_summary: '',
    job_splits: [],
    jobs_summary: '',
    mercury_account_id: 'acc-1',
    mercury_account_nickname: '',
    mercury_debit_card_id: 'card-1',
    mercury_id: 'm-1',
    mercury_transaction_id: 'tx-1',
    note: '',
    person_label: 'Paige',
    posted_at: '2026-08-08T17:00:00Z',
    raw: null,
    tally_user_note: '',
    ...over,
  } as TallyLinkedMercuryRow
}

function makeProps(over: Record<string, unknown> = {}) {
  return {
    open: true,
    rows: [row()],
    startTxId: null,
    userId: 'u-1',
    onClose: vi.fn(),
    onSaved: vi.fn(),
    onOpenFullAssign: vi.fn(),
    ...over,
  }
}

describe('TallySortPurchaseModal', () => {
  it('shows the purchase and the day-job buttons; one tap arms a full assign', async () => {
    fetchDayJobs.mockResolvedValue({ data: DAY_JOBS, error: null })
    renderWithProviders(<TallySortPurchaseModal {...makeProps()} />)
    expect(screen.getByText('1 of 1')).toBeTruthy()
    expect(screen.getByText('$90.42')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('JP942 · Spigots replaced')).toBeTruthy())
    screen.getByText('JP942 · Spigots replaced').click()
    await waitFor(() => expect(screen.getByText('Assign $90.42 ✓')).toBeTruthy())
  })

  it('a second tap turns the screen into an even, editable split', async () => {
    fetchDayJobs.mockResolvedValue({ data: DAY_JOBS, error: null })
    renderWithProviders(<TallySortPurchaseModal {...makeProps()} />)
    await waitFor(() => expect(screen.getByText('JP942 · Spigots replaced')).toBeTruthy())
    screen.getByText('JP942 · Spigots replaced').click()
    await waitFor(() => expect(screen.getByText('Assign $90.42 ✓')).toBeTruthy())
    screen.getByText('JP926 · Dylan Beck PRV').click()
    await waitFor(() => expect(screen.getByText('Save split · $90.42 ✓')).toBeTruthy())
    const inputs = screen.getAllByLabelText(/Amount for/) as HTMLInputElement[]
    expect(inputs).toHaveLength(2)
    expect(inputs[0]!.value).toBe('45.21')
    expect(inputs[1]!.value).toBe('45.21')
  })

  it('with no unsorted purchases it lands on the done state', () => {
    fetchDayJobs.mockResolvedValue({ data: [], error: null })
    const sorted = row({ jobs_summary: 'JP942' })
    renderWithProviders(<TallySortPurchaseModal {...makeProps({ rows: [sorted] })} />)
    expect(screen.getByText('Nothing left to sort.')).toBeTruthy()
  })

  it('"Another job…" hands the row to the full Assign modal', async () => {
    fetchDayJobs.mockResolvedValue({ data: [], error: null })
    const onOpenFullAssign = vi.fn()
    renderWithProviders(<TallySortPurchaseModal {...makeProps({ onOpenFullAssign })} />)
    await waitFor(() => expect(screen.getByText('Another job…')).toBeTruthy())
    screen.getByText('Another job…').click()
    expect(onOpenFullAssign).toHaveBeenCalledWith(expect.objectContaining({ mercury_transaction_id: 'tx-1' }))
  })
})
