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
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

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
