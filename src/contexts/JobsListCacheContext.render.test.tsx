// @vitest-environment jsdom
/**
 * Render smoke for punch list #61 PR 1 (v2.5116): the jobs cache hands every role but dev its rows
 * without ZZ test jobs. That covers the full fetch and its result, the remembered board painted
 * before the fetch lands, and the header stats read. PR 2a (v2.5120): a dev's switch, hidden by
 * default, shows them; a flip moves the rows with no read and reads the stats again. Made-up jobs.
 */
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { JobWithDetails } from '../types/jobWithDetails'
import { act } from '@testing-library/react'
import { setDevShowsZzTestJobs, ZZ_TEST_JOBS_SHOWN_STORAGE_KEY } from '../lib/jobs/zzTestJobSwitch'

let role: string | null = 'assistant'
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u-1' }, role }) }))

const fetchFull = vi.fn()
vi.mock('../lib/fetchJobsLedgerWithDetailsForStages', () => ({
  fetchJobsLedgerWithDetailsForStages: (...a: unknown[]) => fetchFull(...a),
  fetchJobsLedgerStagesPrimary: vi.fn(async () => ({ ok: true, rows: [] })),
  fetchStagesEnrichment: vi.fn(async () => ({})),
  primaryRowToJobWithDetails: (r: unknown) => r,
}))
const statsAnswer = (tag: string) => ({ ok: true, stats: { tag }, leanBilledRows: [], billTruth: {} })
const fetchStats = vi.fn<(...a: unknown[]) => Promise<ReturnType<typeof statsAnswer>>>(async () => statsAnswer('plain'))
vi.mock('../lib/jobs/fetchStagesHeaderStats', () => ({ fetchStagesHeaderStats: (...a: unknown[]) => fetchStats(...(a as [])) }))
const readSnapshot = vi.fn()
vi.mock('../lib/jobs/boardSnapshotStore', () => ({
  readBoardSnapshot: (...a: unknown[]) => readSnapshot(...a),
  writeBoardSnapshot: vi.fn(async () => {}),
  clearBoardSnapshots: vi.fn(async () => {}),
}))
vi.mock('../lib/jobs/boardSnapshot', () => ({
  boardSnapshotIsUsable: () => true,
  buildBoardSnapshot: (x: unknown) => x,
}))

const { JobsListCacheProvider, useJobsListCache } = await import('./JobsListCacheContext')

const job = (id: string, jobName: string, customerName: string) => ({ id, job_name: jobName, customer_name: customerName, status: 'working' }) as unknown as JobWithDetails
const REAL = job('A', '101 Hill Street', 'Ann Lee')
const ZZ_BY_NAME = job('Z', 'ZZ TEST working', 'Ann Lee')
const ZZ_BY_CUSTOMER = job('Y', 'Hill Street remodel', 'ZZ Test Customer')

function Probe() {
  const { jobs, runFetchJobs, zzTestJobCount, headerStats } = useJobsListCache()
  const [returned, setReturned] = useState<string | null>(null)
  return (
    <div>
      <p data-testid="jobs">{jobs.map((j) => j.id).join(',')}</p>
      <p data-testid="returned">{returned ?? ''}</p>
      <p data-testid="zz-count">{zzTestJobCount}</p>
      <p data-testid="stats-tag">{(headerStats as { tag?: string } | null)?.tag ?? ''}</p>
      <button
        type="button"
        onClick={async () => {
          const rows = await runFetchJobs(null)
          setReturned((rows ?? []).map((j) => j.id).join(','))
        }}
      >
        Load
      </button>
    </div>
  )
}

const renderProbe = () =>
  render(
    <JobsListCacheProvider>
      <Probe />
    </JobsListCacheProvider>,
  )

beforeEach(() => {
  role = 'assistant'
  localStorage.removeItem(ZZ_TEST_JOBS_SHOWN_STORAGE_KEY)
  fetchFull.mockReset()
  fetchStats.mockReset()
  fetchStats.mockImplementation(async () => statsAnswer('plain'))
  readSnapshot.mockReset()
  readSnapshot.mockResolvedValue(null)
  fetchFull.mockResolvedValue({ ok: true, jobs: [ZZ_BY_NAME, REAL, ZZ_BY_CUSTOMER] })
})

describe('JobsListCacheProvider · ZZ test jobs (punch list #61)', () => {
  it('hands an assistant the board, and the fetch result, without ZZ jobs, and asks the stats to leave them out', async () => {
    renderProbe()
    fireEvent.click(screen.getByRole('button', { name: 'Load' }))
    await waitFor(() => expect(screen.getByTestId('returned').textContent).toBe('A'))
    expect(screen.getByTestId('jobs').textContent).toBe('A')
    await waitFor(() => expect(fetchStats).toHaveBeenCalled())
    expect(fetchStats).toHaveBeenCalledWith(null, undefined, { excludeZzTestJobs: true })
  })

  it('hands a dev who shows them every row, and asks the stats to keep them', async () => {
    role = 'dev'
    localStorage.setItem(ZZ_TEST_JOBS_SHOWN_STORAGE_KEY, '1')
    renderProbe()
    fireEvent.click(screen.getByRole('button', { name: 'Load' }))
    await waitFor(() => expect(screen.getByTestId('returned').textContent).toBe('Z,A,Y'))
    expect(screen.getByTestId('jobs').textContent).toBe('Z,A,Y')
    await waitFor(() => expect(fetchStats).toHaveBeenCalled())
    expect(fetchStats).toHaveBeenCalledWith(null, undefined, { excludeZzTestJobs: false })
  })

  it('a role that lands after the load: hidden while it is null, every row for a dev who shows them once it lands, with no second read', async () => {
    role = null
    localStorage.setItem(ZZ_TEST_JOBS_SHOWN_STORAGE_KEY, '1')
    const tree = (
      <JobsListCacheProvider>
        <Probe />
      </JobsListCacheProvider>
    )
    const { rerender } = render(tree)
    fireEvent.click(screen.getByRole('button', { name: 'Load' }))
    await waitFor(() => expect(screen.getByTestId('returned').textContent).toBe('A'))
    expect(screen.getByTestId('jobs').textContent).toBe('A')
    role = 'dev'
    rerender(
      <JobsListCacheProvider>
        <Probe />
      </JobsListCacheProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('jobs').textContent).toBe('Z,A,Y'))
    expect(fetchFull).toHaveBeenCalledTimes(1)
  })

  it('a dev’s default hides them and counts them; a flip shows them with no second read and reads the stats again', async () => {
    role = 'dev'
    renderProbe()
    fireEvent.click(screen.getByRole('button', { name: 'Load' }))
    await waitFor(() => expect(screen.getByTestId('returned').textContent).toBe('A'))
    expect(screen.getByTestId('zz-count').textContent).toBe('2')
    await waitFor(() => expect(fetchStats).toHaveBeenCalledWith(null, undefined, { excludeZzTestJobs: true }))
    act(() => setDevShowsZzTestJobs(true))
    await waitFor(() => expect(screen.getByTestId('jobs').textContent).toBe('Z,A,Y'))
    await waitFor(() => expect(fetchStats).toHaveBeenLastCalledWith(null, undefined, { excludeZzTestJobs: false }))
    expect(fetchFull).toHaveBeenCalledTimes(1)
    act(() => setDevShowsZzTestJobs(false))
    await waitFor(() => expect(screen.getByTestId('jobs').textContent).toBe('A'))
  })

  it('a flip while the stats read is out drops that answer and reads again under the new choice (review on #5241)', async () => {
    role = 'dev'
    let release: (v: ReturnType<typeof statsAnswer>) => void = () => {}
    fetchStats.mockImplementationOnce(() => new Promise((r) => (release = r)))
    fetchStats.mockImplementation(async (...a: unknown[]) => statsAnswer((a[2] as { excludeZzTestJobs: boolean }).excludeZzTestJobs ? 'hidden' : 'shown'))
    renderProbe()
    fireEvent.click(screen.getByRole('button', { name: 'Load' }))
    await waitFor(() => expect(fetchStats).toHaveBeenCalledTimes(1))
    act(() => setDevShowsZzTestJobs(true))
    await act(async () => release(statsAnswer('hidden, from before the flip')))
    await waitFor(() => expect(screen.getByTestId('stats-tag').textContent).toBe('shown'))
    expect(fetchStats).toHaveBeenLastCalledWith(null, undefined, { excludeZzTestJobs: false })
  })

  it('an assistant’s switch does nothing: a stray key on the device never shows them', async () => {
    localStorage.setItem(ZZ_TEST_JOBS_SHOWN_STORAGE_KEY, '1')
    renderProbe()
    fireEvent.click(screen.getByRole('button', { name: 'Load' }))
    await waitFor(() => expect(screen.getByTestId('returned').textContent).toBe('A'))
    expect(screen.getByTestId('jobs').textContent).toBe('A')
  })

  it('paints an assistant’s remembered board without ZZ jobs while the fetch is still out', async () => {
    fetchFull.mockReturnValue(new Promise(() => {}))
    readSnapshot.mockResolvedValue({ key: 'u-1:all', scopes: ['waiting', 'working'], jobs: [REAL, ZZ_BY_NAME], savedAt: 1 })
    renderProbe()
    fireEvent.click(screen.getByRole('button', { name: 'Load' }))
    await waitFor(() => expect(readSnapshot).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByTestId('jobs').textContent).toBe('A'))
  })
})
