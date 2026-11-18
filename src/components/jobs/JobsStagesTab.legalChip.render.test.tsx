// @vitest-environment jsdom
/**
 * The ⚖ chip of a job's legal matter on its Pipeline row (the Stages map's step 21). v2.3313 shipped the chip and the
 * Glossary says a Collections row carries it, but no list ever handed the matters to the rows, so it never drew.
 * These cases go through the real board with the matters faked. Made-up jobs.
 */
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

vi.mock('../../contexts/JobsListCacheContext', async () => {
  const actual = await vi.importActual<typeof import('../../contexts/JobsListCacheContext')>('../../contexts/JobsListCacheContext')
  return {
    ...actual,
    useJobsListCache: () => ({ mergedScopes: new Set(['waiting', 'working', 'ready_to_bill', 'billed_all', 'paid']), scopeLoading: new Set(), fetchScopeIfNeeded: async () => {}, headerStats: null }),
  }
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
// The real hook, with the matters by job answered from `legal`, and only to a caller the hook is switched on for.
const legal = vi.hoisted(() => ({ byJobId: new Map<string, unknown>(), enabledSeen: [] as boolean[] }))
vi.mock('../../hooks/useLegalMatters', async (original) => {
  const actual = await original<typeof import('../../hooks/useLegalMatters')>()
  return {
    ...actual,
    useLegalMatters: (enabled: boolean) => {
      legal.enabledSeen.push(enabled)
      return { ...actual.useLegalMatters(enabled), byJobId: enabled ? legal.byJobId : new Map() }
    },
  }
})

import JobsStagesTab, { type JobsStagesTabHandle, type JobsStagesTabProps } from './JobsStagesTab'
import { makeJob, makeUseAuthValue, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { todayYmdInAppTz, ymdAddDays } from '../../utils/dateUtils'

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
    jobsListDataKey: 'k1',
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

const LEGAL_TITLE = "Legal desk — the account's standing with counsel"
/** A job billed a while ago and flagged for Collections, one bill for the whole job. */
function collectionsJob(id: string, name: string) {
  const j = makeJob({ id, job_name: name, status: 'billed', revenue: 900, payments_made: 0, collections_at: `${ymdAddDays(todayYmdInAppTz(), -30)}T18:00:00.000Z` })
  const billedAt = `${ymdAddDays(todayYmdInAppTz(), -60)}T18:00:00.000Z`
  return { ...j, invoices: [{ id: `inv-${id}`, job_id: j.id, amount: 900, status: 'billed', sequence_order: 0, billed_at: billedAt, estimated_bill_date: null }] } as typeof j
}
const jobs = () => [collectionsJob('with-firm', 'With Firm Diner'), collectionsJob('asked', 'Review Asked Villa'), collectionsJob('plain', 'No Matter Shop'), makeJob({ id: 'working-matter', job_name: 'Working With Matter', status: 'working' })]
const matters = () =>
  new Map<string, unknown>([
    ['with-firm', { id: 'm-1', stage: 'demand', closed_at: null, review_requested_at: null }],
    ['asked', { id: 'm-2', stage: null, closed_at: null, review_requested_at: '2026-10-01T00:00:00Z' }],
    ['working-matter', { id: 'm-3', stage: 'suit', closed_at: null, review_requested_at: null }],
  ])
const rowOf = (id: string): HTMLElement => {
  const el = document.querySelector<HTMLElement>(`[data-stages-job-id="${id}"]`)
  if (!el) throw new Error(`no row for ${id}`)
  return el
}
const tab = (over: Partial<JobsStagesTabProps> = {}) => <JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs: jobs(), ...over })} />

describe('JobsStagesTab — the ⚖ chip of a job’s legal matter on its row (map step 21)', () => {
  beforeEach(() => {
    localStorage.setItem('pipetooling_stages_sections_v2', JSON.stringify({ waiting: false, working: true, readyToBill: false, billed: true, collections: true, paid: false }))
    localStorage.setItem('jobs-stages-mobile-cards', 'false')
    legal.byJobId = matters()
    legal.enabledSeen = []
  })
  afterEach(() => {
    cleanup()
    localStorage.removeItem('jobs-stages-mobile-cards')
  })

  it('a table row wears its matter’s chip: with the firm, or review requested; a job with no matter wears none', async () => {
    renderWithProviders(tab())
    await settle()
    expect(rowOf('with-firm').querySelector(`[title="${LEGAL_TITLE}"]`)?.textContent).toBe('⚖ demand sent')
    expect(rowOf('asked').querySelector(`[title="${LEGAL_TITLE}"]`)?.textContent).toBe('⚖ review requested')
    expect(rowOf('plain').querySelector(`[title="${LEGAL_TITLE}"]`)).toBeNull()
    expect(rowOf('plain').textContent).not.toContain('⚖')
    // A job-only table's row wears it too, whatever its stage.
    expect(rowOf('working-matter').querySelector(`[title="${LEGAL_TITLE}"]`)?.textContent).toBe('⚖ suit filed')
  })

  it('a phone card wears the same words', async () => {
    localStorage.setItem('jobs-stages-mobile-cards', 'true')
    renderWithProviders(tab())
    await settle()
    expect(rowOf('with-firm').textContent).toContain('⚖ demand sent')
    expect(rowOf('asked').textContent).toContain('⚖ review requested')
    expect(rowOf('working-matter').textContent).toContain('⚖ suit filed')
    expect(rowOf('plain').textContent).not.toContain('⚖')
  })

  it('with no matters there is no chip anywhere', async () => {
    legal.byJobId = new Map()
    renderWithProviders(tab())
    await settle()
    expect(document.querySelector(`[title="${LEGAL_TITLE}"]`)).toBeNull()
  })

  it('a role outside the office gets no matters, so no chip: the board asks for them only for the office', async () => {
    renderWithProviders(tab({ authRole: 'subcontractor', myRole: 'subcontractor' }))
    await settle()
    expect(legal.enabledSeen.length).toBeGreaterThan(0)
    expect(legal.enabledSeen.every((e) => e === false)).toBe(true)
    expect(document.body.textContent).not.toContain('⚖ demand sent')
    expect(document.body.textContent).not.toContain('⚖ review requested')
  })
})
