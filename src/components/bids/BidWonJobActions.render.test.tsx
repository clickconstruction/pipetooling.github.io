// @vitest-environment jsdom
/** Render smoke for the shared Won-moment door (Tier-1 #8): which buttons mount, and where they route. */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

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
// v2.5659: the draft sheet's reads.
vi.mock('../../lib/bids/jobDraftIo', () => ({
  supabaseJobDraftIo: {
    load: async () => ({
      bid: { id: 'bid-6', bid_number: '166', project_name: 'Tune 5 Oil Change Seguin', address: '410 TX-123, Seguin, TX 78155', service_type_id: 'st-plumb', agreed_value: null },
      options: [{ key: '', customerId: null, name: 'Southern Pine', sentOn: '2026-04-20', value: 38625, outcome: null, sharedLetter: false }],
      serviceTypes: [{ id: 'st-plumb', name: 'Plumbing' }],
      draft: { v: 1, jobName: 'Tune 5 Oil Change Seguin', address: '410 TX-123, Seguin, TX 78155', gcKey: '', gcName: 'Southern Pine', carry: 38625, serviceTypeId: 'st-plumb', wantedBy: null, note: null },
    }),
  },
}))
vi.mock('../../hooks/useOpenJobFromBidRequest', () => ({ useOpenJobFromBidRequest: () => ({ request: handoffRequest, refetch: vi.fn() }) }))

// The block's own lookup (no `knownJob`): each test decides when it answers, and with what.
type Opened = { bidId: string; jobId: string; hcpNumber: string | null; jobName: string | null; createdAt: string | null }
const lookups: Array<{ bidIds: ReadonlyArray<string>; resolve: (rows: Opened[]) => void; reject: (e: unknown) => void }> = []
vi.mock('../../lib/bids/bidJobsOpenedIo', () => ({
  loadJobsOpenedFromBids: (bidIds: ReadonlyArray<string>) => new Promise<Opened[]>((resolve, reject) => lookups.push({ bidIds, resolve, reject })),
}))
const job = (bidId: string, jobId: string, hcpNumber: string): Opened => ({ bidId, jobId, hcpNumber, jobName: null, createdAt: '2026-11-01T00:00:00Z' })

import { BidWonJobActions } from './BidWonJobActions'
import { installDomShims, settle } from '../../test/renderSmokeMocks'

beforeAll(installDomShims)

describe('BidWonJobActions', () => {
  it('no job yet: one primary "Open the job" that prefills from the bid', async () => {
    role = 'assistant'
    render(<BidWonJobActions bidId="bid-1" won knownJob={null} />)
    await settle()
    fireEvent.click(screen.getByText('Open the job'))
    expect(openNewJob).toHaveBeenCalledWith({ prefillBidId: 'bid-1' })
    expect(screen.queryByText(/opened from this bid/)).toBeNull()
  })
  it('a job exists: the chip names it, "Open the job" opens it, "Create another job" prefills again', async () => {
    role = 'assistant'
    openNewJob.mockClear()
    render(<BidWonJobActions bidId="bid-1" knownJob={{ jobId: 'job-9', hcpNumber: '1007' }} />)
    await settle()
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
  it('v2.3143: beside "Open the job", a quiet "Ask Dispatch to open it" that files the to-do', async () => {
    role = 'controller'
    handoffRequest = null
    render(<BidWonJobActions bidId="bid-3" won knownJob={null} />)
    await settle()
    expect(screen.getByText('Open the job')).toBeTruthy()
    fireEvent.click(screen.getByText('Ask Dispatch to open it'))
    expect(askDispatchToOpenJob).toHaveBeenCalledTimes(1)
    expect(askDispatchToOpenJob.mock.calls[0]?.[2]).toBe('bid-3')
  })
  it('v2.3143: primary (can mark Won, no job door) gets the hand-off as its one button', async () => {
    role = 'primary'
    handoffRequest = null
    render(<BidWonJobActions bidId="bid-4" won knownJob={null} />)
    await settle()
    expect(screen.queryByText('Open the job')).toBeNull()
    expect(screen.getByText('Ask Dispatch to open the job')).toBeTruthy()
  })
  it('v2.3143: while the to-do is open the chip says who asked and the ask button is gone', async () => {
    role = 'assistant'
    handoffRequest = { id: 'r1', createdAt: new Date(Date.now() - 120000).toISOString(), senderName: 'Wendi' }
    render(<BidWonJobActions bidId="bid-5" won knownJob={null} />)
    await settle()
    expect(screen.getByText('Dispatch asked · by Wendi · 2 min ago')).toBeTruthy()
    expect(screen.queryByText('Ask Dispatch to open it')).toBeNull()
    expect(screen.getByText('Open the job')).toBeTruthy()
    handoffRequest = null
  })
  it('compact beside a won pill: the create link only, and it stops the row click', async () => {
    role = 'dev'
    openNewJob.mockClear()
    const rowClick = vi.fn()
    render(
      <div onClick={rowClick}>
        <BidWonJobActions bidId="bid-2" compact knownJob={null} />
      </div>,
    )
    await settle()
    fireEvent.click(screen.getByText('open the job →'))
    expect(openNewJob).toHaveBeenCalledWith({ prefillBidId: 'bid-2' })
    expect(rowClick).not.toHaveBeenCalled()
  })
  it('v2.5659: an estimator gets Send to Dispatch, never New Job; the sheet sends the draft on the hand-off', async () => {
    role = 'estimator'
    handoffRequest = null
    openNewJob.mockClear()
    askDispatchToOpenJob.mockClear()
    render(<BidWonJobActions bidId="bid-6" won knownJob={null} />)
    await settle()
    expect(screen.queryByText('Open the job')).toBeNull()
    expect(screen.queryByText('Ask Dispatch to open it')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Send to Dispatch' }))
    await settle()
    expect(openNewJob).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Wanted by'), { target: { value: '2026-10-30' } })
    fireEvent.change(screen.getByLabelText('A note for Dispatch'), { target: { value: 'Slab pour is the 3rd' } })
    const sends = screen.getAllByRole('button', { name: 'Send to Dispatch' })
    fireEvent.click(sends[sends.length - 1]!)
    await settle()
    expect(askDispatchToOpenJob).toHaveBeenCalledTimes(1)
    const [, , bidId, opts] = askDispatchToOpenJob.mock.calls[0]!
    expect(bidId).toBe('bid-6')
    expect((opts as { draft: unknown }).draft).toMatchObject({ jobName: 'Tune 5 Oil Change Seguin', gcName: 'Southern Pine', carry: 38625, serviceTypeId: 'st-plumb', wantedBy: '2026-10-30', note: 'Slab pour is the 3rd' })
  })
  it('v2.5659: while Dispatch has it the estimator reads "Sent to Dispatch … · waiting"; once a job exists, its chip', async () => {
    role = 'estimator'
    handoffRequest = { id: 'r2', createdAt: '2026-10-20T15:30:00Z', senderName: 'Wendi' }
    const sent = render(<BidWonJobActions bidId="bid-7" won knownJob={null} />)
    await settle()
    expect(screen.getByText('Sent to Dispatch Oct 20 · waiting')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Send to Dispatch' })).toBeNull()
    sent.unmount()
    handoffRequest = null
    render(<BidWonJobActions bidId="bid-7" won knownJob={{ jobId: 'job-878', hcpNumber: '878' }} />)
    await settle()
    expect(screen.getByText('J878 opened from this bid')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Send to Dispatch' })).toBeNull()
    expect(screen.queryByText('Open the job')).toBeNull()
  })

  describe('the block looks the job up itself (no knownJob)', () => {
    const CREATE_DOORS = ['Open the job', 'Create another job', 'Ask Dispatch to open it', 'Ask Dispatch to open the job', 'Send to Dispatch', 'open the job →', 'send to Dispatch →']
    const noCreateDoor = () => {
      for (const label of CREATE_DOORS) expect(screen.queryByText(label)).toBeNull()
    }
    const answer = async (rows: Opened[]) => {
      await act(async () => {
        lookups[lookups.length - 1]!.resolve(rows)
      })
    }
    beforeEach(() => {
      lookups.length = 0
      handoffRequest = null
      openNewJob.mockClear()
      openEditJob.mockClear()
    })

    it('an office role, a bid that has a job: no door before the answer, then the chip and its two doors', async () => {
      role = 'assistant'
      render(<BidWonJobActions bidId="bid-20" won />)
      await settle()
      expect(lookups.map((l) => l.bidIds)).toEqual([['bid-20']])
      noCreateDoor()
      expect(screen.queryByTestId('bid-won-job-actions')).toBeNull()
      await answer([job('bid-20', 'job-20', '1020')])
      expect(screen.getByText('J1020 opened from this bid')).toBeTruthy()
      fireEvent.click(screen.getByText('Open the job'))
      expect(openEditJob).toHaveBeenCalledWith('job-20')
      expect(openNewJob).not.toHaveBeenCalled()
      expect(screen.getByText('Create another job')).toBeTruthy()
      expect(screen.queryByText('Ask Dispatch to open it')).toBeNull()
    })
    it('an office role, a bid with no job: no door before the answer, then the doors as before', async () => {
      role = 'controller'
      render(<BidWonJobActions bidId="bid-21" won />)
      await settle()
      noCreateDoor()
      await answer([])
      fireEvent.click(screen.getByText('Open the job'))
      expect(openNewJob).toHaveBeenCalledWith({ prefillBidId: 'bid-21' })
      expect(screen.getByText('Ask Dispatch to open it')).toBeTruthy()
    })
    it('an estimator: Send to Dispatch waits for the answer, and a bid that has a job never shows it', async () => {
      role = 'estimator'
      const withJob = render(<BidWonJobActions bidId="bid-22" won />)
      await settle()
      noCreateDoor()
      await answer([job('bid-22', 'job-22', '1022')])
      expect(screen.getByText('J1022 opened from this bid')).toBeTruthy()
      noCreateDoor()
      withJob.unmount()
      render(<BidWonJobActions bidId="bid-23" won />)
      await settle()
      noCreateDoor()
      await answer([])
      expect(screen.getByRole('button', { name: 'Send to Dispatch' })).toBeTruthy()
    })
    it('primary: the hand-off to Dispatch waits for the answer too', async () => {
      role = 'primary'
      render(<BidWonJobActions bidId="bid-24" won />)
      await settle()
      noCreateDoor()
      await answer([])
      expect(screen.getByText('Ask Dispatch to open the job')).toBeTruthy()
    })
    it('compact: the create link waits for the answer, and stays away when the bid has a job', async () => {
      role = 'dev'
      const withJob = render(<BidWonJobActions bidId="bid-25" compact />)
      await settle()
      noCreateDoor()
      await answer([job('bid-25', 'job-25', '1025')])
      expect(withJob.container.textContent).toBe('')
      withJob.unmount()
      render(<BidWonJobActions bidId="bid-26" compact />)
      await settle()
      noCreateDoor()
      await answer([])
      fireEvent.click(screen.getByText('open the job →'))
      expect(openNewJob).toHaveBeenCalledWith({ prefillBidId: 'bid-26' })
    })
    it('a lookup that fails still ends with the doors drawn', async () => {
      role = 'assistant'
      render(<BidWonJobActions bidId="bid-27" won />)
      await settle()
      noCreateDoor()
      await act(async () => {
        lookups[lookups.length - 1]!.reject(new Error('Failed to fetch'))
      })
      expect(screen.getByText('Open the job')).toBeTruthy()
      expect(screen.getByText('Ask Dispatch to open it')).toBeTruthy()
    })
    it('moving the block to another bid holds the doors again until that bid answers', async () => {
      role = 'assistant'
      const view = render(<BidWonJobActions bidId="bid-28" won />)
      await settle()
      await answer([])
      expect(screen.getByText('Open the job')).toBeTruthy()
      view.rerender(<BidWonJobActions bidId="bid-29" won />)
      // Before any effect runs: the first bid's "no job" is not the second bid's answer.
      noCreateDoor()
      await settle()
      noCreateDoor()
      expect(lookups[lookups.length - 1]!.bidIds).toEqual(['bid-29'])
      await answer([job('bid-29', 'job-29', '1029')])
      expect(screen.getByText('J1029 opened from this bid')).toBeTruthy()
      expect(screen.queryByText('Ask Dispatch to open it')).toBeNull()
      fireEvent.click(screen.getByText('Open the job'))
      expect(openEditJob).toHaveBeenCalledWith('job-29')
    })
    it('the board passes its own answer: the doors are there at once, with no lookup', async () => {
      role = 'assistant'
      render(<BidWonJobActions bidId="bid-30" won knownJob={null} />)
      expect(screen.getByText('Open the job')).toBeTruthy()
      await settle()
      expect(lookups).toEqual([])
    })
  })
})
