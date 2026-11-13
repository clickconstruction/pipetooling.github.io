// @vitest-environment jsdom
/**
 * A billed row's "Pays in 3–67d" opens Pay speeds on that row's payer (v2.7013). The whole wire, on the real
 * board: the tab hands the line its press, the press names the payer, and the forecast's own window opens on
 * them with the whole list one press away. Made-up customers and numbers throughout.
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
// The Pay calendar line draws nothing here (no opener in a test); a marker says which job the window handed it (punch list #341).
vi.mock('../customers/PayCalendarLine', () => ({
  default: ({ payerId, job }: { payerId: string; job?: { id: string; label: string } | null }) => <span data-testid="pay-calendar-line-stub">{`${payerId} | ${job ? `${job.id} | ${job.label}` : 'no job'}`}</span>,
}))
// The board's pay speeds come from one RPC through useBilledMoneyData; hand it the answer a case sets.
const money = vi.hoisted(() => ({ speeds: null as unknown, calendars: null as unknown, opener: null as null | { openPayCalendar: (...args: unknown[]) => void; closePayCalendar: () => void } }))
// No Pay calendar opener unless a case sets one: the rows then read as they do with no provider above them.
vi.mock('../../contexts/PayCalendarModalContext', () => ({ usePayCalendarModal: () => money.opener }))
vi.mock('../../hooks/useBilledMoneyData', async (original) => {
  const actual = await original<typeof import('../../hooks/useBilledMoneyData')>()
  return {
    ...actual,
    useBilledMoneyData: (args: Parameters<typeof actual.useBilledMoneyData>[0]) => ({ ...actual.useBilledMoneyData(args), billedPaySpeeds: money.speeds, ...(money.calendars ? { payCalendars: money.calendars } : {}) }),
  }
})

import JobsStagesTab, { type JobsStagesTabHandle, type JobsStagesTabProps } from './JobsStagesTab'
import { makeJob, makeUseAuthValue, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { PaySpeedData } from '../../lib/jobs/billedExpectedPay'
import { indexPayCalendars, PAY_CALENDAR_DEFAULT, type PayCalendarRow } from '../../lib/jobs/payCalendar'
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

const gaps = (days: number[]) => days.map((gapDays, i) => ({ billedYmd: `2026-0${i + 1}-01`, paidYmd: `2026-0${i + 1}-20`, gapDays, jobId: null, jobName: null, address: null }))
const SPEEDS: PaySpeedData = {
  company: { medianDays: 11, samples: 40 },
  customers: { 'cust-diner': { medianDays: 21, samples: 9 }, 'cust-fast': { medianDays: 4, samples: 2 } },
  segments: { residential: null, commercial: { medianDays: 18, samples: 30 } },
  customerTypes: { 'cust-diner': 'commercial' },
  receipts: { 'cust-diner': gaps([2, 3, 3, 9, 21, 40, 67, 67, 90]), 'cust-fast': gaps([3, 5]) },
  quality: null,
}

/** A job billed five days ago to its own customer, one bill for the whole job. */
function billedJob(id: string, name: string, customerId: string, customerName: string, amount: number) {
  const j = makeJob({ id, job_name: name, status: 'billed', revenue: amount, payments_made: 0, customer_id: customerId, customer_name: customerName })
  const billedAt = `${ymdAddDays(todayYmdInAppTz(), -5)}T18:00:00.000Z`
  return { ...j, invoices: [{ id: `inv-${id}`, job_id: j.id, amount, status: 'billed', sequence_order: 0, billed_at: billedAt, estimated_bill_date: null }] } as typeof j
}
const rowOf = (id: string): HTMLElement => {
  const el = document.querySelector<HTMLElement>(`[data-stages-job-id="${id}"]`)
  if (!el) throw new Error(`no row for ${id}`)
  return el
}

describe('JobsStagesTab — a billed row’s Pays in line opens Pay speeds on its payer (v2.7013)', () => {
  beforeEach(() => {
    localStorage.setItem('pipetooling_stages_sections_v2', JSON.stringify({ waiting: false, working: false, readyToBill: false, billed: true, collections: true, paid: false }))
    money.speeds = SPEEDS
    money.calendars = null
    money.opener = null
  })
  afterEach(() => cleanup())

  const jobs = () => [
    billedJob('job-diner', 'Sink Drain', 'cust-diner', 'Made Up Diner', 1070),
    billedJob('job-fast', 'Pretest', 'cust-fast', 'Made Up Foundation', 250),
  ]

  it('the line is a button on each billed row, named for the payer whose pay speeds it opens', async () => {
    renderWithProviders(<JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs: jobs() })} />)
    await settle()
    expect(within(rowOf('job-diner')).getByRole('button', { name: 'Pays in 3–67d. Open pay speeds for Made Up Diner' })).toBeTruthy()
    expect(within(rowOf('job-fast')).getByRole('button', { name: 'Pays in 3–5d. Open pay speeds for Made Up Foundation' })).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: /^Pay speeds/ })).toBeNull()
  })

  it('pressing it opens the Pay speeds window on that payer, with the whole list one press away, and ✕ closes it', async () => {
    renderWithProviders(<JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs: jobs() })} />)
    await settle()
    fireEvent.click(within(rowOf('job-diner')).getByRole('button', { name: /^Pays in 3–67d\. Open pay speeds/ }))
    const win = within(screen.getByRole('dialog', { name: 'Pay speeds for Made Up Diner' }))
    const card = within(win.getByTestId('pay-speeds-payer'))
    expect(card.getByRole('heading', { name: 'Made Up Diner' })).toBeTruthy()
    // The window's headline is the row's own words, and every payment behind them is listed.
    expect(card.getByTestId('pay-speeds-payer-range').textContent).toBe('Pays in 3–67d')
    for (const gap of ['+2', '+9', '+21', '+40', '+90']) expect(card.getAllByText(gap).length).toBeGreaterThanOrEqual(1)
    // Their open bill on the board, and not the other payer's.
    expect(card.getByText('Sink Drain')).toBeTruthy()
    expect(card.queryByText('Pretest')).toBeNull()
    // The whole window is one press down.
    expect(win.queryByText('By customer — slowest first')).toBeNull()
    fireEvent.click(win.getByRole('button', { name: /^All customers/ }))
    expect(win.getByText('By customer — slowest first')).toBeTruthy()
    expect(win.getAllByText('Made Up Foundation').length).toBeGreaterThanOrEqual(1)
    fireEvent.click(win.getByRole('button', { name: 'Close pay speeds breakdown' }))
    expect(screen.queryByRole('dialog', { name: /^Pay speeds/ })).toBeNull()
  })

  it('hands the window the row’s job, so its Pay calendar line opens on that job (punch list #341)', async () => {
    renderWithProviders(<JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs: jobs() })} />)
    await settle()
    fireEvent.click(within(rowOf('job-diner')).getByRole('button', { name: /^Pays in 3–67d\. Open pay speeds/ }))
    const win = within(screen.getByRole('dialog', { name: 'Pay speeds for Made Up Diner' }))
    expect(win.getByTestId('pay-calendar-line-stub').textContent).toMatch(/^cust-diner \| job-diner \| .+ · Sink Drain$/)
  })

  describe('a job on its own Pay calendar, and one switched off (punch list #341, PR 2)', () => {
    const cal = (over: Partial<PayCalendarRow>): PayCalendarRow => ({ payerCustomerId: 'cust-diner', jobId: null, off: false, calendar: PAY_CALENDAR_DEFAULT, setByName: null, setAt: null, ...over })
    const twoDinerJobs = () => [billedJob('job-diner', 'Sink Drain', 'cust-diner', 'Made Up Diner', 1070), billedJob('job-diner-2', 'Grease Trap', 'cust-diner', 'Made Up Diner', 900)]

    it('marks the row whose calendar is the job’s own, and leaves the payer’s other row as it was', async () => {
      money.calendars = indexPayCalendars([cal({}), cal({ jobId: 'job-diner', calendar: { ...PAY_CALENDAR_DEFAULT, cutoffDay: 25, payDay: 30 } })])
      money.opener = { openPayCalendar: vi.fn(), closePayCalendar: vi.fn() }
      renderWithProviders(<JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs: twoDinerJobs() })} />)
      await settle()
      const own = within(rowOf('job-diner')).getByRole('button', { name: 'This job’s own · In by the 25th, paid the 30th. Open the pay calendar for Made Up Diner' })
      expect(within(rowOf('job-diner-2')).getByRole('button', { name: 'In by month end, paid the 10th. Open the pay calendar for Made Up Diner' })).toBeTruthy()
      fireEvent.click(own)
      expect(money.opener.openPayCalendar).toHaveBeenCalledWith({ id: 'cust-diner', name: 'Made Up Diner' }, expect.objectContaining({ job: expect.objectContaining({ id: 'job-diner' }) }))
    })

    it('says a job switched off has no pay calendar, and the words open the window on that job', async () => {
      money.calendars = indexPayCalendars([cal({}), cal({ jobId: 'job-diner', off: true, calendar: null })])
      money.opener = { openPayCalendar: vi.fn(), closePayCalendar: vi.fn() }
      renderWithProviders(<JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs: twoDinerJobs() })} />)
      await settle()
      // The row reads the usual guess, as any payer with no calendar does, and one more line says why.
      expect(within(rowOf('job-diner')).getByRole('button', { name: /^Pays in 3–67d\. Open pay speeds/ })).toBeTruthy()
      fireEvent.click(within(rowOf('job-diner')).getByRole('button', { name: 'No pay calendar on this job' }))
      expect(money.opener.openPayCalendar).toHaveBeenCalledWith({ id: 'cust-diner', name: 'Made Up Diner' }, expect.objectContaining({ job: expect.objectContaining({ id: 'job-diner' }) }))
      expect(within(rowOf('job-diner-2')).queryByRole('button', { name: 'No pay calendar on this job' })).toBeNull()
    })
  })

  it('the other row opens on the other payer', async () => {
    renderWithProviders(<JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs: jobs() })} />)
    await settle()
    fireEvent.click(within(rowOf('job-fast')).getByRole('button', { name: /^Pays in 3–5d\. Open pay speeds/ }))
    const card = within(within(screen.getByRole('dialog', { name: 'Pay speeds for Made Up Foundation' })).getByTestId('pay-speeds-payer'))
    expect(card.getByTestId('pay-speeds-payer-range').textContent).toBe('Pays in 3–5d')
    expect(card.getByText(/^Their 2 measured payments came 3 to 5 days after the bill\./)).toBeTruthy()
  })

  it('a billed row whose payer has no measured payment keeps a plain line: nothing to press', async () => {
    money.speeds = { ...SPEEDS, customers: {}, receipts: {} }
    renderWithProviders(<JobsStagesTab ref={createRef<JobsStagesTabHandle>()} {...makeProps({ jobs: jobs() })} />)
    await settle()
    expect(within(rowOf('job-diner')).queryByRole('button', { name: /Open pay speeds/ })).toBeNull()
  })
})
