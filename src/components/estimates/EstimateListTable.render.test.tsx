// @vitest-environment jsdom
/**
 * Step 2 of the Estimates map (v2.3869): the list table and the phone cards moved out of the page
 * whole. This smoke pins the seam — the two renderings mount on the same rows, the title and
 * status read, the Customer column appears on request, an accepted row's Create job button calls the
 * parent setter, and the Declined chip reads what the parent hands it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { EstimateListCards, EstimateListTable } from './EstimateListTable'
import type { EstimateListRow } from '../../lib/estimates/estimateListRows'
import { renderSettled } from '../../test/renderSmokeMocks'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

afterEach(() => {
  cleanup()
})

function row(over: Partial<EstimateListRow>): EstimateListRow {
  return {
    id: 'est-1',
    estimate_number: 52,
    title: 'Second-floor rough-in',
    status: 'draft',
    doc_kind: 'estimate',
    total_cents: 245_000,
    customer_id: 'cust-1',
    customer_email: null,
    for_address: '1 Main St',
    line_items_snapshot: [{ line_item: 'Rough-in', description: '', quantity: 1, unit_price_cents: 245_000, amount_cents: 245_000 }],
    options_snapshot: null,
    created_at: '2026-09-20T12:00:00Z',
    updated_at: '2026-09-25T12:00:00Z',
    sent_at: null,
    sent_to_dispatch_at: null,
    job_ledger_id: null,
    project_id: null,
    customers: { name: 'Ana Ruiz', address: '12 Oak St', contact_info: null },
    ...over,
  } as unknown as EstimateListRow
}

const rows = [
  // Accepted and not yet on a job: the row that offers Create job.
  row({ status: 'customer_accepted' }),
  row({ id: 'est-2', estimate_number: 53, title: 'Water heater swap', status: 'sent', sent_at: '2026-09-22T12:00:00Z', customers: null, customer_email: 'pat@example.com' }),
  row({ id: 'est-3', estimate_number: 54, title: 'Slab leak', status: 'declined', customers: null }),
]

describe('EstimateListTable', () => {
  it('renders every row with its title and status, the Customer column on request, and hands an accepted row’s Create job to the parent', async () => {
    const setCreateJobFromListRow = vi.fn()
    await renderSettled(
      <EstimateListTable
        rows={rows}
        setAcceptanceModalEstimateId={() => {}}
        setCreateJobFromListRow={setCreateJobFromListRow}
        showCustomerColumn
        declinedLabelById={{ 'est-3': 'Declined by customer · 2d ago' }}
      />,
      { loaded: () => screen.findByText('Second-floor rough-in') },
    )
    expect(screen.getByText('Water heater swap')).toBeTruthy()
    expect(screen.getByText('Slab leak')).toBeTruthy()
    expect(screen.getByText('Ana Ruiz')).toBeTruthy()
    expect(screen.getByText('pat@example.com')).toBeTruthy()
    expect(screen.getByText('Declined by customer · 2d ago')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Create job from estimate' }))
    expect(setCreateJobFromListRow).toHaveBeenCalledTimes(1)
    expect(setCreateJobFromListRow.mock.calls[0]?.[0]?.id).toBe('est-1')
  })
})

describe('EstimateListCards', () => {
  it('renders the same rows as cards with their titles and the customer line', async () => {
    await renderSettled(
      <EstimateListCards rows={rows} setAcceptanceModalEstimateId={() => {}} setCreateJobFromListRow={() => {}} declinedLabelById={{ 'est-3': 'Declined by customer · 2d ago' }} />,
      { loaded: () => screen.findByText('Second-floor rough-in') },
    )
    expect(screen.getByText('Water heater swap')).toBeTruthy()
    expect(screen.getByText('Slab leak')).toBeTruthy()
    expect(screen.getByText('Declined by customer · 2d ago')).toBeTruthy()
    expect(screen.getAllByText(/Ana Ruiz/).length).toBeGreaterThan(0)
  })
})
