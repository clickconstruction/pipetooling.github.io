// @vitest-environment jsdom
/** Render smoke for the T5-04 "Move them to J1007" row: mounts on bid-anchored blocks, confirms, calls the RPC, toasts. */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({
  role: 'assistant' as string | null,
  confirm: vi.fn(async () => true),
  showToast: vi.fn(),
  rpc: vi.fn(async () => ({ data: 2, error: null })),
  blockRows: [{ work_date: '2026-09-01' }, { work_date: '2099-01-01' }] as Array<{ work_date: string }>,
}))

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ role: h.role, user: { id: 'u1' } }) }))
vi.mock('../../contexts/ConfirmDialogContext', () => ({ useConfirmDialog: () => h.confirm }))
vi.mock('../../contexts/ToastContext', () => ({ useToastContext: () => ({ showToast: h.showToast, showActionToast: vi.fn() }) }))
vi.mock('../../lib/supabase', () => {
  const builder: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'is']) builder[m] = () => builder
  builder.then = (onFulfilled: (v: unknown) => unknown) => Promise.resolve({ data: h.blockRows, error: null }).then(onFulfilled)
  return { supabase: { from: () => builder, rpc: h.rpc } }
})

import { BidVisitsRehomeRow } from './BidVisitsRehomeRow'

describe('BidVisitsRehomeRow', () => {
  it('shows the count with the upcoming share and moves on confirm', async () => {
    render(<BidVisitsRehomeRow bidId="bid-1" jobId="job-9" jobLabel="J1007" />)
    await waitFor(() => expect(screen.getByText('2 scheduled visits still sit on the bid (1 upcoming).')).toBeTruthy())
    fireEvent.click(screen.getByText('Move them to J1007'))
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('move_bid_schedule_blocks_to_job', { p_bid_id: 'bid-1', p_job_id: 'job-9' }))
    expect(h.confirm).toHaveBeenCalled()
    await waitFor(() => expect(h.showToast).toHaveBeenCalledWith('Moved 2 scheduled visits to J1007.', 'success'))
  })
  it('renders nothing when no visits sit on the bid', async () => {
    h.blockRows = []
    const { container } = render(<BidVisitsRehomeRow bidId="bid-1" jobId="job-9" jobLabel="J1007" />)
    await new Promise((r) => setTimeout(r, 0))
    expect(container.textContent).toBe('')
  })
  it('renders nothing for a role outside the schedule-edit set (estimator)', async () => {
    h.role = 'estimator'
    h.blockRows = [{ work_date: '2099-01-01' }]
    const { container } = render(<BidVisitsRehomeRow bidId="bid-1" jobId="job-9" jobLabel="J1007" />)
    await new Promise((r) => setTimeout(r, 0))
    expect(container.textContent).toBe('')
  })
})
