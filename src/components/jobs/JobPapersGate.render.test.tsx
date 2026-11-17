// @vitest-environment jsdom
/**
 * The prompt drawn in place of a job, over a fake io: it names the job's number and its papers and nothing else;
 * Read and sign makes the caller's link, remembers the way back and leaves for the signing page; with nothing left it
 * offers the job; a login with no file says why; a failed read draws the retry panel; the office gets the door to the
 * job's papers and a helper does not; a locked row shows the number and the count. Made-up names only.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetJobsClosedToMeForTest, useJobsClosedToMe, useJobsLockedInLists } from '../../hooks/useJobsClosedToMe'
import { JOB_PAPERS_RETURN_KEY, type MyJobPapers } from '../../lib/jobs/jobPapers'
import type { JobPapersIo } from '../../lib/jobs/jobPapersIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobPapersGate, LockedJobLine } from './JobPapersGate'
import { JobPapersGateModal } from './JobPapersGateModal'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'helpers' })
})

const owed: MyJobPapers = {
  jobNumber: 'J2391',
  linked: true,
  papers: [
    { id: 'nda', paperName: 'Ridgeway Builders NDA', isForm: true, documentId: null, status: 'none', signedAt: null },
    { id: 'site', paperName: 'Site rules and photo policy', isForm: false, documentId: null, status: 'none', signedAt: null },
  ],
}
const signed: MyJobPapers = { ...owed, papers: owed.papers.map((p) => ({ ...p, status: 'signed' as const, signedAt: '2026-11-15' })) }

function fakeIo(over: Partial<JobPapersIo> = {}): JobPapersIo {
  return {
    readRoster: vi.fn(async () => ({ jobNumber: 'J2391', papers: [], people: [] })),
    readBook: vi.fn(async () => []),
    requirePapers: vi.fn(async () => 0),
    removePaper: vi.fn(async () => undefined),
    signingLink: vi.fn(async () => 'https://example.test/sign/x'),
    countRequired: vi.fn(async () => 0),
    readClosed: vi.fn(async () => ['job-1']),
    readMine: vi.fn(async () => owed),
    ownSigningLink: vi.fn(async (paperId: string) => `https://example.test/contract/accept?t=${paperId}`),
    readNeedingMe: vi.fn(async () => []),
    ...over,
  }
}

const assign = vi.fn()
beforeEach(() => {
  assign.mockClear()
  window.sessionStorage.clear()
  Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, assign, pathname: '/dashboard', search: '?tab=today' } })
})
afterEach(() => {
  cleanup()
  resetJobsClosedToMeForTest()
})

describe('JobPapersGate', () => {
  it('names the job and its papers, and Read and sign leaves for the signing page remembering the way back', async () => {
    const io = fakeIo()
    resetJobsClosedToMeForTest(io)
    renderWithProviders(<JobPapersGate jobId="job-1" io={io} />)
    await screen.findByText('Before you open J2391')
    expect(screen.getByText('This job has 2 papers to sign first. It opens when both are signed.')).toBeTruthy()
    expect(screen.getByText('Ridgeway Builders NDA')).toBeTruthy()
    expect(screen.getAllByText('Not signed yet')).toHaveLength(2)
    expect(screen.getByText('Until then the job’s name, address, customer, notes, photos and materials stay shut.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Open the job' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Read and sign: Ridgeway Builders NDA' }))
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://example.test/contract/accept?t=nda'))
    expect(io.ownSigningLink).toHaveBeenCalledWith('nda')
    expect(JSON.parse(window.sessionStorage.getItem(JOB_PAPERS_RETURN_KEY) ?? '{}')).toEqual({ jobId: 'job-1', path: '/dashboard?tab=today' })
  })

  it('with nothing left it offers the job', async () => {
    const io = fakeIo({ readMine: vi.fn(async () => signed) })
    resetJobsClosedToMeForTest(io)
    const onOpenJob = vi.fn()
    renderWithProviders(<JobPapersGate jobId="job-1" io={io} onOpenJob={onOpenJob} />)
    await screen.findByText('Nothing is left to sign.')
    expect(screen.getAllByText('Signed Nov 15')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /Read and sign/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Open the job' }))
    expect(onOpenJob).toHaveBeenCalled()
  })

  it('a refused press shows its reason and stays on the prompt', async () => {
    const io = fakeIo({ ownSigningLink: vi.fn(async () => Promise.reject(new Error('Read-only (training) mode: changes are blocked.'))) })
    resetJobsClosedToMeForTest(io)
    renderWithProviders(<JobPapersGate jobId="job-1" io={io} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Read and sign: Ridgeway Builders NDA' }))
    expect(await screen.findByText(/Read-only \(training\) mode/)).toBeTruthy()
    expect(assign).not.toHaveBeenCalled()
  })

  it('a login with no file tied to it has no press, and says why', async () => {
    const io = fakeIo({ readMine: vi.fn(async () => ({ ...owed, linked: false })) })
    resetJobsClosedToMeForTest(io)
    renderWithProviders(<JobPapersGate jobId="job-1" io={io} />)
    expect(await screen.findByText('Your login is not tied to your file yet. Ask the office to link it on People. Then you can sign.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Read and sign/ })).toBeNull()
  })

  it('a read that fails draws the retry panel, never the job', async () => {
    const io = fakeIo({ readMine: vi.fn(async () => Promise.reject(new Error('permission denied for function job_papers_mine'))) })
    resetJobsClosedToMeForTest(io)
    renderWithProviders(<JobPapersGate jobId="job-1" io={io} />)
    expect(await screen.findByText(/permission denied for function job_papers_mine/)).toBeTruthy()
    expect(screen.queryByText('Before you open J2391')).toBeNull()
  })
})

describe('JobPapersGateModal', () => {
  it('a helper gets the prompt alone', async () => {
    const io = fakeIo()
    resetJobsClosedToMeForTest(io)
    renderWithProviders(<JobPapersGateModal jobId="job-1" role="helpers" onClose={() => undefined} />)
    await screen.findByText('Before you open J2391')
    expect(screen.queryByRole('button', { name: 'This job’s papers and who has signed' })).toBeNull()
  })
  it('the office gets a door to the job’s papers, so a paper can come off without signing it', async () => {
    const io = fakeIo()
    resetJobsClosedToMeForTest(io)
    renderWithProviders(<JobPapersGateModal jobId="job-1" role="assistant" onClose={() => undefined} />)
    await screen.findByText('Before you open J2391')
    expect(screen.getByRole('button', { name: 'This job’s papers and who has signed' })).toBeTruthy()
  })
})

describe('a locked job in a list', () => {
  it('shows the number and the count', async () => {
    const io = fakeIo()
    resetJobsClosedToMeForTest(io)
    renderWithProviders(<LockedJobLine jobId="job-1" />)
    expect(await screen.findByText('J2391')).toBeTruthy()
    expect(screen.getByText('2 papers to sign before this job opens')).toBeTruthy()
    expect(screen.queryByText(/Cedar/)).toBeNull()
  })
  it('the closed set is one read for every follower, and the office’s lists keep their names', async () => {
    const io = fakeIo()
    resetJobsClosedToMeForTest(io)
    function Probe({ role }: { role: string }) {
      const { ready, closed } = useJobsClosedToMe()
      const masked = useJobsLockedInLists(role)
      return <p data-testid={`probe-${role}`}>{`${ready}|${[...closed].join(',')}|${[...masked].join(',')}`}</p>
    }
    renderWithProviders(
      <>
        <Probe role="helpers" />
        <Probe role="assistant" />
      </>,
    )
    await waitFor(() => expect(screen.getByTestId('probe-helpers').textContent).toBe('true|job-1|job-1'))
    expect(screen.getByTestId('probe-assistant').textContent).toBe('true|job-1|')
    expect(io.readClosed).toHaveBeenCalledTimes(1)
  })
  it('a read that fails closes no job', async () => {
    const io = fakeIo({ readClosed: vi.fn(async () => Promise.reject(new Error('Could not find the function public.jobs_closed_to_me'))) })
    resetJobsClosedToMeForTest(io)
    function Probe() {
      const { ready, closed } = useJobsClosedToMe()
      return <p data-testid="probe">{`${ready}|${closed.size}`}</p>
    }
    renderWithProviders(<Probe />)
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('true|0'))
  })
})
