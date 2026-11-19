// @vitest-environment jsdom
/**
 * The Pipeline's status line over the board this device remembered, through the real jobs cache and
 * the real board (v2.7953). The cache hands the board its flags as the Jobs page does. While the
 * remembered board shows, the line reads *Updating jobs…* with the board's age until the last read
 * landed, the enrichment too. It says the refresh did not land only when the live read failed.
 * Before v2.7953 it said so for as long as the enrichment took, with every read answered. Made-up jobs.
 */
import { createRef, useEffect, useRef } from 'react'
import { act, cleanup, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StagesEnrichment } from '../../lib/jobs/stagesEnrichment'
import type { JobWithDetails } from '../../types/jobWithDetails'

type PrimaryAnswer = { ok: true; rows: JobWithDetails[] } | { ok: false; error: string; errorKind: 'unknown' }
const fetchPrimary = vi.fn<() => Promise<PrimaryAnswer>>()
const fetchEnrichment = vi.fn<() => Promise<StagesEnrichment>>()
vi.mock('../../lib/fetchJobsLedgerWithDetailsForStages', async () => ({
  ...(await vi.importActual<typeof import('../../lib/fetchJobsLedgerWithDetailsForStages')>('../../lib/fetchJobsLedgerWithDetailsForStages')),
  fetchJobsLedgerStagesPrimary: () => fetchPrimary(),
  fetchStagesEnrichment: () => fetchEnrichment(),
  primaryRowToJobWithDetails: (row: unknown) => row,
}))
vi.mock('../../lib/jobs/fetchStagesHeaderStats', () => ({ fetchStagesHeaderStats: vi.fn(async () => ({ ok: false, error: 'not read in this test' })) }))
const readKept = vi.fn()
vi.mock('../../lib/keptReadStore', () => ({
  readKeptRead: (...a: unknown[]) => readKept(...a),
  writeKeptRead: vi.fn(async () => {}),
  clearKeptReads: vi.fn(async () => {}),
}))
vi.mock('../../hooks/useIsDigitalTwin', () => ({ useIsDigitalTwin: () => false }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import JobsStagesTab, { type JobsStagesTabHandle, type JobsStagesTabProps } from './JobsStagesTab'
import { JobsListCacheProvider, useJobsListCache } from '../../contexts/JobsListCacheContext'
import { buildKeptRead, buildKeptReadKey } from '../../lib/keptRead'
import { makeJob, makeUseAuthValue, renderWithProviders, settle, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'

const authValue = makeUseAuthValue()

function makeProps(overrides: Partial<JobsStagesTabProps> = {}): JobsStagesTabProps {
  return {
    active: true,
    error: null,
    setError: vi.fn(),
    jobs: [],
    jobsListLoading: false,
    jobsListRefreshing: false,
    jobsListError: null,
    paidJobsLoading: false,
    jobsListDataKey: null,
    paidJobsMergedForKey: null,
    loadJobs: vi.fn(async () => []),
    runFetchJobs: vi.fn(async () => []),
    fetchPaidJobsIfNeeded: vi.fn(async () => {}),
    customerFilterForFetch: null,
    scheduleLoadJobsAfterMutation: vi.fn(),
    authUser: authValue.user as JobsStagesTabProps['authUser'],
    authRole: 'dev',
    authProfileName: 'Smoke Dev',
    myRole: 'dev',
    users: [],
    customers: [],
    showToast: vi.fn(),
    shortNewJobButtonLabel: false,
    openNew: vi.fn(),
    openEdit: vi.fn(),
    openEditJobAndCreateCustomerFlow: vi.fn(),
    tryOpenEditJob: vi.fn(),
    openStagesDetailJobModal: vi.fn(),
    refreshCustomersAfterJobFormSave: vi.fn(),
    billCustomer: { openBillCustomer: vi.fn() } as unknown as JobsStagesTabProps['billCustomer'],
    stagesStatusUpdatingId: null,
    stagesInvoiceUpdatingId: null,
    updateJobStatus: vi.fn(async () => {}),
    moveJobToReadyToBillWithStripePrep: vi.fn(async () => {}),
    revertBilledInvoiceToReadyToBill: vi.fn(async () => {}),
    deleteInvoice: vi.fn(async () => {}),
    invoiceEstimatedBillDateSavingId: null,
    setInvoiceEstimatedBillDate: vi.fn(async () => {}),
    bumpInvoiceEstimatedBillDate: vi.fn(async () => {}),
    pctCompleteSavingId: null,
    updateJobPctComplete: vi.fn(async () => {}),
    commitStagesPctWithNote: vi.fn(async () => {}),
    expandedJobThreadId: null,
    setExpandedJobThreadId: vi.fn(),
    jobThreadActivityByJobId: {},
    jobThreadNotesLoadingId: null,
    jobThreadSubmittingId: null,
    jobThreadDraft: '',
    setJobThreadDraft: vi.fn(),
    submitJobThreadNote: vi.fn(async () => {}),
    jobThreadStatsByJobId: {},
    refreshJobThreadStatsForJobIds: vi.fn(async () => {}),
    ...overrides,
  } as JobsStagesTabProps
}

/** The Jobs page's part: start the board's scoped load once, and hand the cache's values to the board. */
function BoardOverTheCache() {
  const cache = useJobsListCache()
  const base = useRef<JobsStagesTabProps | null>(null)
  base.current ??= makeProps()
  const tabRef = useRef(createRef<JobsStagesTabHandle>()).current
  const { runFetchScopes } = cache
  useEffect(() => {
    void runFetchScopes(['working'], null)
  }, [runFetchScopes])
  return (
    <JobsStagesTab
      ref={tabRef}
      {...base.current}
      jobs={cache.jobs}
      jobsListLoading={cache.jobsListLoading}
      jobsListRefreshing={cache.jobsListRefreshing}
      jobsListSnapshotAt={cache.jobsListSnapshotAt}
      jobsListError={cache.jobsListError}
      jobsListDataKey={cache.jobsListDataKey}
    />
  )
}

const renderBoard = () =>
  renderWithProviders(
    <JobsListCacheProvider>
      <BoardOverTheCache />
    </JobsListCacheProvider>,
  )

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

const KEPT_JOB = makeJob({ id: 'kb-1', job_name: 'Kept Duplex', status: 'working' })
const LIVE_JOB = makeJob({ id: 'kb-1', job_name: 'Live Duplex', status: 'working' })
const NO_ENRICHMENT: StagesEnrichment = { materialsByJobId: new Map(), fixturesByJobId: new Map(), scheduleMaxByJobId: new Map(), estimateCandidatesByJobId: new Map() }
const UPDATING = /^Updating jobs…/
const DID_NOT_LAND = /^Showing the board this device remembered/

describe('JobsStagesTab over the jobs cache: the status line of the remembered board (v2.7953)', () => {
  beforeEach(() => {
    localStorage.setItem('pipetooling_stages_sections_v2', JSON.stringify({ waiting: false, working: true, readyToBill: false, billed: false, collections: false, paid: false }))
    fetchPrimary.mockReset()
    // The board's own later reads of its other sections answer with no rows.
    fetchPrimary.mockResolvedValue({ ok: true, rows: [] })
    fetchEnrichment.mockReset()
    readKept.mockReset()
    readKept.mockResolvedValue(
      buildKeptRead({ key: buildKeptReadKey(SMOKE_AUTH_USER_ID, 'pipeline', null), scopes: ['working'], rows: [KEPT_JOB], now: Date.now() - 5 * 60_000 }),
    )
  })
  afterEach(cleanup)

  it('reads Updating jobs… with the board’s age through the enrichment, and never says the refresh did not land', async () => {
    const primary = deferred<PrimaryAnswer>()
    const enrichment = deferred<StagesEnrichment>()
    fetchPrimary.mockReturnValueOnce(primary.promise)
    fetchEnrichment.mockReturnValue(enrichment.promise)
    renderBoard()

    // The main read is out: the remembered board is up with its age.
    await waitFor(() => expect(screen.getByText(UPDATING).textContent).toBe('Updating jobs…board from 5 min ago'))
    expect(screen.queryByText(DID_NOT_LAND)).toBeNull()

    // The main read landed, the enrichment is still out: the same line, not a failure.
    await act(async () => primary.resolve({ ok: true, rows: [LIVE_JOB] }))
    await settle()
    expect(fetchEnrichment).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(DID_NOT_LAND)).toBeNull()
    expect(screen.getByText(UPDATING).textContent).toBe('Updating jobs…board from 5 min ago')

    // The enrichment landed: the live board, with neither line.
    await act(async () => enrichment.resolve(NO_ENRICHMENT))
    await waitFor(() => expect(screen.queryByText(UPDATING)).toBeNull())
    expect(screen.queryByText(DID_NOT_LAND)).toBeNull()
    expect(screen.queryByText(/board from/)).toBeNull()
  })

  it('says the refresh did not land, with the board’s age, when the live read fails', async () => {
    const primary = deferred<PrimaryAnswer>()
    fetchPrimary.mockReturnValueOnce(primary.promise)
    renderBoard()
    await waitFor(() => expect(screen.getByText(UPDATING).textContent).toBe('Updating jobs…board from 5 min ago'))

    await act(async () => primary.resolve({ ok: false, error: 'The connection dropped.', errorKind: 'unknown' }))
    await waitFor(() => expect(screen.getByText(DID_NOT_LAND).textContent).toMatch(/the refresh did not land\.board from 5 min ago$/))
    expect(screen.queryByText(UPDATING)).toBeNull()
    expect(fetchEnrichment).not.toHaveBeenCalled()
  })
})
