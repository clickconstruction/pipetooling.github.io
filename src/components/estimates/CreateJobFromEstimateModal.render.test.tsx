// @vitest-environment jsdom
/**
 * CO money train PR 4: the modal speaks change-order. Covers the mode fork —
 * a change order gets the "Apply change order #N" title with the add-to-existing
 * lead path (Apply to job + Link only), while a standard estimate keeps the
 * classic "Create job from estimate" layout with Save link.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import CreateJobFromEstimateModal from './CreateJobFromEstimateModal'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { EstimateForCreateJob } from '../../lib/createJobFromEstimateSubmit'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

function estimateRow(overrides: Partial<EstimateForCreateJob>): EstimateForCreateJob {
  return {
    id: 'est-1',
    status: 'customer_accepted',
    project_id: null,
    customer_id: 'cust-1',
    job_ledger_id: null,
    title: 'Second-floor rough-in',
    for_address: '1 Main St',
    total_cents: 245000,
    line_items_snapshot: [
      { line_item: 'Second-floor bathroom rough-in', description: '', quantity: 1, unit_price_cents: 284000, amount_cents: 284000 },
      { line_item: 'Credit — delete hall lav', description: '', quantity: 1, unit_price_cents: -39000, amount_cents: -39000 },
    ],
    doc_kind: 'estimate',
    estimate_number: 52,
    bid_id: null,
    ...overrides,
  }
}

const baseProps = {
  open: true,
  customerIdForPayload: 'cust-1',
  linkedCustomerPrefill: null,
  onClose: () => {},
  onSuccess: () => {},
}

afterEach(() => {
  cleanup()
})

describe('CreateJobFromEstimateModal mode fork', () => {
  it('renders the classic create layout for a standard estimate', () => {
    renderWithProviders(<CreateJobFromEstimateModal {...baseProps} estimate={estimateRow({})} />)
    expect(screen.getByText('Create job from estimate')).toBeTruthy()
    expect(screen.getByText('Link existing job')).toBeTruthy()
    expect(screen.getByText('Save link')).toBeTruthy()
    expect(screen.queryByText(/Apply change order/)).toBeNull()
    expect(screen.queryByText('Apply to job')).toBeNull()
  })

  it('renders the apply-to-job lead path for a change order', () => {
    renderWithProviders(
      <CreateJobFromEstimateModal {...baseProps} estimate={estimateRow({ doc_kind: 'change_order' })} />,
    )
    expect(screen.getByText('Apply change order #52')).toBeTruthy()
    expect(screen.getByText('Add to an existing job')).toBeTruthy()
    expect(screen.getByText('Apply to job')).toBeTruthy()
    expect(screen.getByText('Link only (no cost change)')).toBeTruthy()
    // signed net from the credit line: 2840 − 390 = $2,450.00
    expect(screen.getByText(/Net change to contract/).textContent).toContain('$2,450.00')
    // create path demoted below the divider but still present
    expect(screen.getByText('or create a new job')).toBeTruthy()
    expect(screen.getByText('Create job')).toBeTruthy()
    expect(screen.queryByText('Save link')).toBeNull()
  })
})
