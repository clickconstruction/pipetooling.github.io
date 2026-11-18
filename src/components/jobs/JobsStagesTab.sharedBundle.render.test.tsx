// @vitest-environment jsdom
/**
 * The Stages tab hands every section list one bundle, `shared` (the Stages map's step 10). The board's own sections
 * are pinned by the tab's main render test. This file pins the five sites that had no test: the follow-up deck's
 * rows, which the tab draws through the same lists with the same bundle. The deck itself is a probe here, so each
 * case reads the row the tab hands it and nothing else. Made-up jobs and numbers throughout.
 */
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'

const ALL_SCOPES = ['waiting', 'working', 'ready_to_bill', 'billed_all', 'paid']
vi.mock('../../contexts/JobsListCacheContext', async () => {
  const actual = await vi.importActual<typeof import('../../contexts/JobsListCacheContext')>('../../contexts/JobsListCacheContext')
  return {
    ...actual,
    useJobsListCache: () => ({ mergedScopes: new Set(ALL_SCOPES), scopeLoading: new Set(), fetchScopeIfNeeded: async () => {}, headerStats: null }),
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
// The deck as a probe: it asks the tab for each job's row, as a deck card does, and draws what comes back.
const deck = vi.hoisted(() => ({ ids: [] as string[] }))
vi.mock('./JobsFollowupModal', async (original) => {
  const actual = await original<typeof import('./JobsFollowupModal')>()
  return {
    ...actual,
    JobsFollowupModal: ({ renderStageRow }: { renderStageRow?: (jobId: string) => { node: React.ReactNode; stage: string; lineItems: unknown[]; jobTotalDollars: number; bidDollars: number } | null }) => (
      <div data-testid="deck-probe">
        {deck.ids.map((id) => {
          const row = renderStageRow?.(id) ?? null
          return (
            <div key={id} data-testid={`deck-row-${id}`} data-stage={row?.stage ?? 'none'} data-lines={row ? JSON.stringify(row.lineItems) : ''} data-total={row?.jobTotalDollars ?? ''} data-bid={row?.bidDollars ?? ''}>
              {row?.node ?? null}
            </div>
          )
        })}
      </div>
    ),
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

/** A job billed five days ago, one bill for the whole job. */
function billedJob(id: string, name: string, extra: Record<string, unknown> = {}) {
  const j = makeJob({ id, job_name: name, status: 'billed', revenue: 900, payments_made: 0, ...extra })
  const billedAt = `${ymdAddDays(todayYmdInAppTz(), -5)}T18:00:00.000Z`
  return { ...j, invoices: [{ id: `inv-${id}`, job_id: j.id, amount: 900, status: 'billed', sequence_order: 0, billed_at: billedAt, estimated_bill_date: null }] } as typeof j
}
function deckJobs() {
  return [
    makeJob({ id: 'deck-waiting', job_name: 'Deck Waiting Casa', status: 'waiting' }),
    makeJob({ id: 'deck-working', job_name: 'Deck Working Duplex', status: 'working', hcp_number: '878' }),
    makeJob({ id: 'deck-rtb', job_name: 'Deck Ready Villa', status: 'ready_to_bill', revenue: 700, payments_made: 0 }),
    billedJob('deck-billed', 'Deck Billed Diner'),
    billedJob('deck-collections', 'Deck Parked Shop', { collections_at: `${ymdAddDays(todayYmdInAppTz(), -12)}T18:00:00.000Z` }),
  ]
}
const deckRow = (id: string): HTMLElement => screen.getByTestId(`deck-row-${id}`)
const openDeck = () => fireEvent.click(screen.getByRole('button', { name: /^Open job follow-ups/ }))

describe('JobsStagesTab — the follow-up deck’s rows take the one shared bundle (map step 10)', () => {
  beforeEach(() => {
    // Every board section shut, so the only rows on the page are the deck's.
    localStorage.setItem('pipetooling_stages_sections_v2', JSON.stringify({ waiting: false, working: false, readyToBill: false, billed: false, collections: false, paid: false }))
    localStorage.removeItem('jobs-stages-ham-mode')
    localStorage.removeItem('jobs-stages-edit-mode')
    localStorage.setItem('jobs-stages-mobile-cards', 'false')
    deck.ids = ['deck-waiting', 'deck-working', 'deck-rtb', 'deck-billed', 'deck-collections']
  })
  afterEach(() => {
    cleanup()
    localStorage.removeItem('jobs-stages-edit-mode')
    localStorage.removeItem('jobs-stages-mobile-cards')
  })

  it('each stage draws its own row with its own move, and no header row', async () => {
    const updateJobStatus = vi.fn(async () => true)
    renderWithProviders(<JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs: deckJobs(), updateJobStatus })} />)
    await settle()
    expect(document.querySelectorAll('[data-stages-job-id]')).toHaveLength(0)
    openDeck()
    await settle()

    expect(deckRow('deck-waiting').getAttribute('data-stage')).toBe('waiting')
    expect(deckRow('deck-working').getAttribute('data-stage')).toBe('working')
    expect(deckRow('deck-rtb').getAttribute('data-stage')).toBe('ready_to_bill')
    expect(deckRow('deck-billed').getAttribute('data-stage')).toBe('billed')
    expect(deckRow('deck-collections').getAttribute('data-stage')).toBe('collections')

    // One row each, the job's own, with the deck's bare table (`hideHeader`).
    for (const id of deck.ids) {
      expect(deckRow(id).querySelectorAll(`[data-stages-job-id="${id}"]`).length).toBeGreaterThan(0)
      expect(deckRow(id).querySelector('thead')).toBeNull()
    }
    // The bundle's name renderer reached every row.
    expect(within(deckRow('deck-billed')).getByText('Deck Billed Diner')).toBeTruthy()
    expect(within(deckRow('deck-collections')).getByText('Deck Parked Shop')).toBeTruthy()

    // Each stage's own move (the section action props), on the bundle's mutations.
    fireEvent.click(within(deckRow('deck-waiting')).getByRole('button', { name: 'Move to Working' }))
    expect(updateJobStatus).toHaveBeenCalledWith('deck-waiting', 'working')
    expect(within(deckRow('deck-working')).getByRole('button', { name: 'Ready to Bill' })).toBeTruthy()
    expect(within(deckRow('deck-working')).getByRole('button', { name: 'Mark Waiting' })).toBeTruthy()
    expect(within(deckRow('deck-rtb')).getAllByRole('button', { name: 'Bill Customer' }).length).toBeGreaterThan(0)
    expect(within(deckRow('deck-billed')).getAllByRole('button', { name: 'Mark Paid' }).length).toBeGreaterThan(0)
    expect(within(deckRow('deck-collections')).getAllByRole('button', { name: 'Mark Paid' }).length).toBeGreaterThan(0)
    // Collections' own way back, and none of it on the Billed row.
    expect(within(deckRow('deck-collections')).getAllByRole('button', { name: 'Send back to Billed' }).length).toBeGreaterThan(0)
    expect(within(deckRow('deck-billed')).queryAllByRole('button', { name: 'Send back to Billed' })).toHaveLength(0)
  })

  it('a job with no row in its stage’s list gets no deck row: one the office gave up on is out of Collections’ chased rows', async () => {
    const givenUp = billedJob('deck-given-up', 'Deck Given Up Shop', { collections_at: `${ymdAddDays(todayYmdInAppTz(), -40)}T18:00:00.000Z`, uncollectible_at: `${ymdAddDays(todayYmdInAppTz(), -3)}T18:00:00.000Z` })
    deck.ids = ['deck-given-up', 'deck-collections']
    renderWithProviders(<JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs: [...deckJobs(), givenUp] })} />)
    await settle()
    openDeck()
    await settle()
    expect(deckRow('deck-given-up').getAttribute('data-stage')).toBe('none')
    expect(deckRow('deck-given-up').children).toHaveLength(0)
    expect(deckRow('deck-collections').getAttribute('data-stage')).toBe('collections')
  })

  it('a job the tab does not hold gets no row', async () => {
    deck.ids = ['deck-gone']
    renderWithProviders(<JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs: deckJobs() })} />)
    await settle()
    openDeck()
    await settle()
    expect(deckRow('deck-gone').getAttribute('data-stage')).toBe('none')
    expect(deckRow('deck-gone').children).toHaveLength(0)
  })

  it('the card’s bill detail rides with the row: the named lines in order, their total and the bid (map step 17)', async () => {
    const line = (name: string, sequence_order: number, count: number, line_unit_price: number | null) => ({ id: `fx-${sequence_order}`, name, sequence_order, count, line_unit_price })
    const priced = makeJob({
      id: 'deck-priced',
      job_name: 'Deck Priced Annex',
      status: 'working',
      revenue: 4000,
      fixtures: [line('Rough in', 2, 1, 1500), line('', 9, 1, 999), line('Underground', 1, 2, 600)] as never,
    })
    deck.ids = ['deck-priced', 'deck-waiting']
    renderWithProviders(<JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs: [...deckJobs(), priced] })} />)
    await settle()
    openDeck()
    await settle()
    const row = deckRow('deck-priced')
    expect(JSON.parse(row.getAttribute('data-lines')!)).toEqual([
      { name: 'Underground', count: 2, unitPrice: 600 },
      { name: 'Rough in', count: 1, unitPrice: 1500 },
    ])
    expect(row.getAttribute('data-total')).toBe('2700')
    expect(row.getAttribute('data-bid')).toBe('4000')
    // A job with no lines carries an empty list and a zero total.
    expect(deckRow('deck-waiting').getAttribute('data-lines')).toBe('[]')
    expect(deckRow('deck-waiting').getAttribute('data-total')).toBe('0')
  })

  it('Edit mode reaches a deck row through the bundle: the EDIT rail opens that job', async () => {
    localStorage.setItem('jobs-stages-edit-mode', 'true')
    const openEdit = vi.fn()
    const jobs = deckJobs()
    renderWithProviders(<JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs, openEdit })} />)
    await settle()
    openDeck()
    await settle()
    for (const id of ['deck-working', 'deck-billed']) {
      openEdit.mockClear()
      fireEvent.click(within(deckRow(id)).getAllByLabelText(/^Edit job /)[0]!)
      expect(openEdit).toHaveBeenCalledTimes(1)
      expect((openEdit.mock.calls[0]![0] as { id: string }).id).toBe(id)
    }
  })

  it('with Edit mode off no deck row wears a rail', async () => {
    renderWithProviders(<JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs: deckJobs() })} />)
    await settle()
    openDeck()
    await settle()
    expect(screen.queryAllByLabelText(/^Edit job /)).toHaveLength(0)
  })

  it('on Mobile cards the deck draws the card lists, with the same bundle', async () => {
    localStorage.setItem('jobs-stages-mobile-cards', 'true')
    localStorage.setItem('jobs-stages-edit-mode', 'true')
    const openEdit = vi.fn()
    renderWithProviders(<JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs: deckJobs(), openEdit })} />)
    await settle()
    openDeck()
    await settle()
    // Cards, not table rows.
    expect(deckRow('deck-working').querySelector('table')).toBeNull()
    expect(deckRow('deck-billed').querySelector('table')).toBeNull()
    expect(within(deckRow('deck-working')).getByText('Deck Working Duplex')).toBeTruthy()
    expect(within(deckRow('deck-billed')).getByText('Deck Billed Diner')).toBeTruthy()
    fireEvent.click(within(deckRow('deck-billed')).getAllByLabelText(/^Edit job /)[0]!)
    expect((openEdit.mock.calls[0]![0] as { id: string }).id).toBe('deck-billed')
  })
})
