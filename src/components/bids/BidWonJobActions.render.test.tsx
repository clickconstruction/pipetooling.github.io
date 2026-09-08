// @vitest-environment jsdom
/** Render smoke for the shared Won-moment door (Tier-1 #8): which buttons mount, and where they route. */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const openNewJob = vi.fn()
const openEditJob = vi.fn()
let role: string | null = 'master_technician'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ role, user: { id: 'u1' } }) }))
vi.mock('../../contexts/JobFormModalContext', () => ({
  useJobFormModal: () => ({ isOpen: false, openNewJob, openEditJob, closeJobForm: vi.fn() }),
}))
vi.mock('../../contexts/ConfirmDialogContext', () => ({ useConfirmDialog: () => vi.fn(async () => true) }))
vi.mock('../../contexts/ToastContext', () => ({ useToastContext: () => ({ showToast: vi.fn(), showActionToast: vi.fn() }) }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
// v2.3143: the Dispatch hand-off — the write is mocked, the open to-do is a knob.
const askDispatchToOpenJob = vi.fn(async (..._args: unknown[]) => 'created' as const)
vi.mock('../../lib/bids/openJobFromBidDispatchRequest', () => ({ askDispatchToOpenJob: (...args: unknown[]) => askDispatchToOpenJob(...args) }))
let handoffRequest: { id: string; createdAt: string | null; senderName: string | null } | null = null
vi.mock('../../hooks/useOpenJobFromBidRequest', () => ({ useOpenJobFromBidRequest: () => ({ request: handoffRequest, refetch: vi.fn() }) }))

import { BidWonJobActions } from './BidWonJobActions'

describe('BidWonJobActions', () => {
  it('no job yet: one primary "Open the job" that prefills from the bid', () => {
    role = 'estimator'
    render(<BidWonJobActions bidId="bid-1" won knownJob={null} />)
    fireEvent.click(screen.getByText('Open the job'))
    expect(openNewJob).toHaveBeenCalledWith({ prefillBidId: 'bid-1' })
    expect(screen.queryByText(/opened from this bid/)).toBeNull()
  })
  it('a job exists: the chip names it, "Open the job" opens it, "Create another job" prefills again', () => {
    role = 'assistant'
    openNewJob.mockClear()
    render(<BidWonJobActions bidId="bid-1" knownJob={{ jobId: 'job-9', hcpNumber: '1007' }} />)
    expect(screen.getByText('J1007 opened from this bid')).toBeTruthy()
    fireEvent.click(screen.getByText('Open the job'))
    expect(openEditJob).toHaveBeenCalledWith('job-9')
    fireEvent.click(screen.getByText('Create another job'))
    expect(openNewJob).toHaveBeenCalledWith({ prefillBidId: 'bid-1' })
  })
  it('superintendent (read-only board) sees no door; the compact link hides too', () => {
    role = 'superintendent'
    const { container } = render(<BidWonJobActions bidId="bid-1" won knownJob={null} />)
    expect(container.textContent).toBe('')
    const compact = render(<BidWonJobActions bidId="bid-1" compact knownJob={null} />)
    expect(compact.container.textContent).toBe('')
  })
  it('v2.3143: beside "Open the job", a quiet "Ask Dispatch to open it" that files the to-do', () => {
    role = 'estimator'
    handoffRequest = null
    render(<BidWonJobActions bidId="bid-3" won knownJob={null} />)
    expect(screen.getByText('Open the job')).toBeTruthy()
    fireEvent.click(screen.getByText('Ask Dispatch to open it'))
    expect(askDispatchToOpenJob).toHaveBeenCalledTimes(1)
    expect(askDispatchToOpenJob.mock.calls[0]?.[2]).toBe('bid-3')
  })
  it('v2.3143: primary (can mark Won, no job door) gets the hand-off as its one button', () => {
    role = 'primary'
    handoffRequest = null
    render(<BidWonJobActions bidId="bid-4" won knownJob={null} />)
    expect(screen.queryByText('Open the job')).toBeNull()
    expect(screen.getByText('Ask Dispatch to open the job')).toBeTruthy()
  })
  it('v2.3143: while the to-do is open the chip says who asked and the ask button is gone', () => {
    role = 'estimator'
    handoffRequest = { id: 'r1', createdAt: new Date(Date.now() - 120000).toISOString(), senderName: 'Wendi' }
    render(<BidWonJobActions bidId="bid-5" won knownJob={null} />)
    expect(screen.getByText('Dispatch asked · by Wendi · 2 min ago')).toBeTruthy()
    expect(screen.queryByText('Ask Dispatch to open it')).toBeNull()
    expect(screen.getByText('Open the job')).toBeTruthy()
    handoffRequest = null
  })
  it('compact beside a won pill: the create link only, and it stops the row click', () => {
    role = 'dev'
    openNewJob.mockClear()
    const rowClick = vi.fn()
    render(
      <div onClick={rowClick}>
        <BidWonJobActions bidId="bid-2" compact knownJob={null} />
      </div>,
    )
    fireEvent.click(screen.getByText('open the job →'))
    expect(openNewJob).toHaveBeenCalledWith({ prefillBidId: 'bid-2' })
    expect(rowClick).not.toHaveBeenCalled()
  })
})
