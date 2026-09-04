// @vitest-environment jsdom
/**
 * Render smoke for the cleared-releases queue (v2.2751): rows carry the job,
 * the release, the clearing payment and the two actions; the empty state and
 * the closed state render nothing surprising.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import { DashboardLienReleaseQueueModal } from './DashboardLienReleaseQueueModal'
import type { JobLienReleaseRow, LienUnconditionalQueueRow } from '../../lib/jobs/lienReleaseTracking'
import { renderWithProviders } from '../../test/renderSmokeMocks'

function row(p: Partial<LienUnconditionalQueueRow> = {}): LienUnconditionalQueueRow {
  const release = {
    id: 'r1',
    job_id: 'job-1',
    invoice_ids: ['inv-1'],
    form_type: 'conditional_progress',
    amount: 408,
    through_date: null,
    signed_date: null,
    fields: {},
    created_by: null,
    created_at: '2026-08-22T12:00:00Z',
    voided_at: null,
    status: 'issued',
    signer_printed_name: null,
    signed_at: null,
    signer_consented_at: null,
    sent_to_customer_at: null,
  } as unknown as JobLienReleaseRow
  return {
    releaseId: 'r1',
    jobId: 'job-1',
    jobNumber: '1042',
    jobName: 'Mission Hills — Bldg C',
    customerName: 'Harvey Builders',
    jobAddress: '4410 Mission Hills Dr',
    release,
    amount: 408,
    issuedOn: '2026-08-22',
    invoiceIds: ['inv-1'],
    appliedTotal: 408,
    clearedOn: '2026-09-01',
    clearedBy: 'Check #4471',
    ...p,
  }
}

const noop = () => {}

describe('DashboardLienReleaseQueueModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing while closed', () => {
    renderWithProviders(<DashboardLienReleaseQueueModal open={false} onClose={noop} rows={[row()]} onChanged={noop} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('lists each cleared release with its job, payment, and both actions', () => {
    renderWithProviders(<DashboardLienReleaseQueueModal open onClose={noop} rows={[row(), row({ releaseId: 'r2', jobId: 'job-2', jobNumber: '', jobName: 'Lakeline Medical', customerName: '', jobAddress: '', amount: 3200, appliedTotal: 3200, clearedOn: '2026-08-29', clearedBy: 'Ach' })]} onChanged={noop} />)
    expect(screen.getByRole('dialog', { name: /conditional releases/i })).toBeTruthy()
    expect(screen.getByText(/2 waiting/)).toBeTruthy()
    expect(screen.getByText('#1042 · Mission Hills — Bldg C')).toBeTruthy()
    expect(screen.getByText('Lakeline Medical')).toBeTruthy()
    expect(screen.getByText(/Harvey Builders · 4410 Mission Hills Dr/)).toBeTruthy()
    expect(screen.getByText('$408.00')).toBeTruthy()
    expect(screen.getByText(/Cleared Sep 1, 2026/)).toBeTruthy()
    expect(screen.getByText(/Check #4471 · \$408\.00 applied/)).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Issue unconditional' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'View release' })).toHaveLength(2)
    expect(screen.getByText(/across 2 jobs still owed/)).toBeTruthy()
  })

  it('shows the all-caught-up line when the queue is empty', () => {
    renderWithProviders(<DashboardLienReleaseQueueModal open onClose={noop} rows={[]} onChanged={noop} />)
    expect(screen.getByText(/Nothing waiting/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Issue unconditional' })).toBeNull()
  })
})
