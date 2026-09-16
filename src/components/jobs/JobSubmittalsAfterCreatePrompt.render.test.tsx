// @vitest-environment jsdom
/**
 * Render smokes for the won question (Submittals stage 4c): a job from a won bid with
 * picks asks; Build Rev 1 builds it linked to the job and opens the tab; Not needed
 * writes the bid; a bid with a revision is back-filled and asks nothing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import JobSubmittalsAfterCreatePrompt from './JobSubmittalsAfterCreatePrompt'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'wendi' }, role: 'estimator' }) }))

const navigateSpy = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateSpy }
})

const state = { revisionCount: 0, notNeededAt: null as string | null, bidId: 'b398' as string | null }
vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: () => Promise.resolve({ data: [{ id: 'j1', hcp_number: 'J964', click_number: null, job_name: 'Pondhill', job_address: '1 Pond Rd', bid_id: state.bidId }], error: null }),
    from: (table: string) => {
      const b: Record<string, unknown> = {}
      const chain = () => b
      b.select = chain
      b.eq = chain
      b.maybeSingle = () => Promise.resolve({ data: table === 'bids' ? { id: 'b398', bid_number: '398', project_name: 'ZZ Test', submittals_not_needed_at: state.notNeededAt } : null, error: null })
      b.then = (res: (v: unknown) => void) => Promise.resolve({ data: null, error: null, count: table === 'bid_submittals' ? state.revisionCount : 0 }).then(res)
      return b
    },
  },
}))

const createSpy = vi.fn(() => Promise.resolve({ revId: 'rev-1', rows: 4 }))
const notNeededSpy = vi.fn(() => Promise.resolve())
const backfillSpy = vi.fn(() => Promise.resolve())
vi.mock('../../lib/submittals/firstRevisionClient', () => ({
  loadPicksForBid: () => Promise.resolve({ specified: [{ tag: 'WC-1' }, { tag: 'FD-1' }, { tag: 'KS-1' }, { tag: 'ST-1' }], picks: [{ fixture: 'water closet' }], overridesByFixture: new Map() }),
  createFirstRevisionFromPicks: (...args: unknown[]) => createSpy(...(args as [])),
  setSubmittalsNotNeeded: (...args: unknown[]) => notNeededSpy(...(args as [])),
  backfillSubmittalJob: (...args: unknown[]) => backfillSpy(...(args as [])),
}))

afterEach(() => {
  state.revisionCount = 0
  state.notNeededAt = null
  state.bidId = 'b398'
  navigateSpy.mockClear()
  createSpy.mockClear()
  notNeededSpy.mockClear()
  backfillSpy.mockClear()
})

describe('JobSubmittalsAfterCreatePrompt', () => {
  it('asks on a job from a won bid with picks; Build Rev 1 builds it linked to the job and opens the tab', async () => {
    const close = vi.fn()
    renderWithProviders(<JobSubmittalsAfterCreatePrompt jobId="j1" onClose={close} />)
    expect(await screen.findByText('Submittals for J964 · Pondhill?')).toBeTruthy()
    expect(screen.getByText('4 tags on the schedule · 1 picked line')).toBeTruthy()
    fireEvent.click(screen.getByTestId('submittals-prompt-build'))
    await waitFor(() => expect(close).toHaveBeenCalled())
    expect(createSpy).toHaveBeenCalledTimes(1)
    expect((createSpy.mock.calls[0] as unknown[])[1]).toMatchObject({ bidId: 'b398', userId: 'wendi', jobLedgerId: 'j1' })
    expect(navigateSpy).toHaveBeenCalledWith('/bids?tab=submittals&bidId=b398')
  })

  it('Not needed on this job writes the bid and closes', async () => {
    const close = vi.fn()
    renderWithProviders(<JobSubmittalsAfterCreatePrompt jobId="j1" onClose={close} />)
    fireEvent.click(await screen.findByTestId('submittals-prompt-none'))
    await waitFor(() => expect(close).toHaveBeenCalled())
    expect((notNeededSpy.mock.calls[0] as unknown[]).slice(1)).toEqual(['b398', 'wendi', true])
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('a bid that already has a revision is back-filled with the job and asks nothing; a job with no bid asks nothing', async () => {
    state.revisionCount = 2
    const close = vi.fn()
    renderWithProviders(<JobSubmittalsAfterCreatePrompt jobId="j1" onClose={close} />)
    await waitFor(() => expect(close).toHaveBeenCalled())
    expect((backfillSpy.mock.calls[0] as unknown[]).slice(1)).toEqual(['b398', 'j1'])
    expect(screen.queryByText(/Submittals for/)).toBeNull()

    state.revisionCount = 0
    state.bidId = null
    const close2 = vi.fn()
    renderWithProviders(<JobSubmittalsAfterCreatePrompt jobId="j2" onClose={close2} />)
    await waitFor(() => expect(close2).toHaveBeenCalled())
    expect(screen.queryByText(/Submittals for/)).toBeNull()
  })
})
