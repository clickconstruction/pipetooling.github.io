// @vitest-environment jsdom
/** Render smoke for the shared Won-moment door (Tier-1 #8): which buttons mount, and where they route. */
import { beforeAll, describe, expect, it, vi } from 'vitest'
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
// v2.5659: the draft sheet's reads.
vi.mock('../../lib/bids/jobDraftIo', () => ({
  supabaseJobDraftIo: {
    load: async () => ({
      bid: { id: 'bid-6', bid_number: '166', project_name: 'Take 5 Oil Change Seguin', address: '380 TX-123, Seguin, TX 78155', service_type_id: 'st-plumb', agreed_value: null },
      options: [{ key: '', customerId: null, name: 'Southern Post', sentOn: '2026-04-20', value: 38625, outcome: null, sharedLetter: false }],
      serviceTypes: [{ id: 'st-plumb', name: 'Plumbing' }],
      draft: { v: 1, jobName: 'Take 5 Oil Change Seguin', address: '380 TX-123, Seguin, TX 78155', gcKey: '', gcName: 'Southern Post', carry: 38625, serviceTypeId: 'st-plumb', wantedBy: null, note: null },
    }),
  },
}))
vi.mock('../../hooks/useOpenJobFromBidRequest', () => ({ useOpenJobFromBidRequest: () => ({ request: handoffRequest, refetch: vi.fn() }) }))

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
    expect((opts as { draft: unknown }).draft).toMatchObject({ jobName: 'Take 5 Oil Change Seguin', gcName: 'Southern Post', carry: 38625, serviceTypeId: 'st-plumb', wantedBy: '2026-10-30', note: 'Slab pour is the 3rd' })
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
})
