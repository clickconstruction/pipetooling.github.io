// @vitest-environment jsdom
/**
 * The Stages tab's billed-money windows behind one host (punch list #46 row 2, map step 8). Each
 * window is a probe that records its props, so these cases pin the wiring the move carried over:
 * which board each window reads (the unfiltered one for the money, the filtered one for Fix bill
 * lines, the paid chart and the billed print — map quirk 4), the scope kicks while a window is open,
 * call mode's queue waiting on every non-paid scope, the forecast's work months, the office gates,
 * and every door back into the board.
 */
import { act, cleanup, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { JobsStagesBoardLists, StageRow } from '../../lib/jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'
import StagesBilledMoneyModals from './StagesBilledMoneyModals'

type Props = Record<string, unknown>

const h = vi.hoisted(() => ({
  /** The newest props each probe window drew with, by name. */
  seen: {} as Record<string, Record<string, unknown>>,
  merged: [] as string[],
  fetches: [] as Array<[string, string | null]>,
  workMonthArgs: [] as Array<[unknown, string]>,
  chaseArgs: [] as unknown[][],
  fixRows: [] as unknown[],
}))

function probe(name: string) {
  return (p: Record<string, unknown>) => {
    h.seen[name] = p
    return <div data-testid={name} />
  }
}

vi.mock('./BilledByCustomerBreakdownModal', () => ({ default: probe('breakdown') }))
vi.mock('./BilledAgingChartModal', () => ({ default: probe('aging') }))
vi.mock('./BilledPaymentForecastModal', () => ({ default: probe('forecast') }))
vi.mock('./PaymentForecastShareModal', () => ({ default: probe('forecastShare') }))
vi.mock('./PaymentChaseModal', () => ({ default: probe('chase') }))
vi.mock('./FixBillLinesModal', () => ({ default: probe('fixLines') }))
vi.mock('./SetPromisedPayDateModal', () => ({ default: probe('promisedPay') }))
vi.mock('./PaidProfitChartModal', () => ({ default: probe('paidProfit') }))
vi.mock('./BilledReportShareModal', () => ({ default: probe('billedShare') }))

vi.mock('../../contexts/JobsListCacheContext', () => ({
  useJobsListCache: () => ({
    mergedScopes: new Set(h.merged),
    scopeLoading: {},
    fetchScopeIfNeeded: (scope: string, filter: string | null) => {
      h.fetches.push([scope, filter])
      return Promise.resolve()
    },
  }),
}))
vi.mock('../../hooks/useForecastWorkMonths', () => ({
  useForecastWorkMonths: (jobs: unknown, todayYmd: string) => {
    h.workMonthArgs.push([jobs, todayYmd])
    return { byJob: jobs ? { 'j-1': { months: [] } } : null, loading: false }
  },
}))
vi.mock('../../lib/jobs/paymentChase', () => ({
  buildPaymentChaseQueue: (...args: unknown[]) => {
    h.chaseArgs.push(args)
    return { sentinel: 'chase-queue' }
  },
}))
vi.mock('../../lib/jobs/fixBillLines', () => ({
  buildFixBillLineItems: (rows: unknown) => {
    h.fixRows.push(rows)
    return [{ sentinel: 'fix-items' }]
  },
}))

const ALL_NON_PAID = ['waiting', 'working', 'ready_to_bill', 'billed_all']

const job = (id: string, extra: Partial<JobWithDetails> = {}) =>
  ({ id, gc_customer_id: `gc-${id}`, customer_address_id: `addr-${id}`, ...extra }) as unknown as JobWithDetails
const J1 = job('j-1')
const J2 = job('j-2')
const invoiceRow = (j: JobWithDetails, invId: string) => ({ kind: 'invoice', job: j, inv: { id: invId } }) as unknown as StageRow
const jobRow = (j: JobWithDetails) => ({ kind: 'job', job: j }) as unknown as StageRow

/** Every bill, as the money windows count them: two bills on J1 (one row each), J2 billed as a whole job. */
const UNFILTERED_ROWS = [invoiceRow(J1, 'inv-1'), invoiceRow(J1, 'inv-2'), jobRow(J2)]
/** What the search left on screen. */
const FILTERED_ROWS = [invoiceRow(J1, 'inv-1')]
const lists = (billedActiveRows: StageRow[], paid: JobWithDetails[]) =>
  ({ billedActiveRows, paid }) as unknown as JobsStagesBoardLists

function mount(over: Partial<Props> = {}) {
  const p = {
    authRole: 'assistant',
    jobs: [J1, J2],
    customerFilterForFetch: 'cust-7',
    unfilteredBoardLists: lists(UNFILTERED_ROWS, [J1, J2]),
    stagesBoardLists: lists(FILTERED_ROWS, [J2]),
    stagesSearchQuery: 'ridge',
    billedBreakdownOpen: false,
    setBilledBreakdownOpen: vi.fn(),
    billedAgingChartOpen: false,
    setBilledAgingChartOpen: vi.fn(),
    billedPaymentForecastOpen: false,
    setBilledPaymentForecastOpen: vi.fn(),
    chaseModalOpen: false,
    setChaseModalOpen: vi.fn(),
    fixBillLinesOpen: false,
    setFixBillLinesOpen: vi.fn(),
    promisedPayModalJob: null,
    setPromisedPayModalJob: vi.fn(),
    paidProfitChartOpen: false,
    setPaidProfitChartOpen: vi.fn(),
    billedShareModalOpen: false,
    setBilledShareModalOpen: vi.fn(),
    billedPaySpeeds: { speeds: 'pay-speeds' },
    refreshBilledPaySpeeds: vi.fn(),
    promisedPayDates: { 'inv-1': { ymd: '2026-10-20' } },
    loadPromisedPayDates: vi.fn(),
    loadPromiseRecords: vi.fn(),
    promiseSlipByCustomer: { 'cust-7': 2 },
    chaseTouches: [],
    loadChaseTouches: vi.fn(),
    gcTemperatureById: new Map([['gc-j-1', { temperature: 'cold' }]]),
    chaseTodayYmd: '2026-10-08',
    forecastTodayYmd: '2026-10-08',
    applyStagesInvoiceFocus: vi.fn(() => true),
    setStagesSectionOpen: vi.fn(),
    setPendingStagesJobFocusId: vi.fn(),
    setStagesJobFlashId: vi.fn(),
    setBilledAgingFilter: vi.fn(),
    focusStagesSection: vi.fn(),
    tryOpenEditJob: vi.fn(),
    setLienDesk: vi.fn(),
    setCollectionsConfirm: vi.fn(),
    showToast: vi.fn(),
    loadJobs: vi.fn(),
    openStagesDetailJobModal: vi.fn(),
    printBilledAwaitingPaymentReport: vi.fn(),
    ...over,
  }
  const utils = render(<StagesBilledMoneyModals {...(p as unknown as ComponentProps<typeof StagesBilledMoneyModals>)} />)
  return { ...utils, p }
}

/** The newest entry of a record list (no `.at()`: the app's lib is ES2020). */
const last = <T,>(xs: T[]): T | undefined => xs[xs.length - 1]

const call = (name: string, fn: string, ...args: unknown[]) =>
  act(() => {
    ;(h.seen[name]![fn] as (...a: unknown[]) => void)(...args)
  })

beforeEach(() => {
  h.seen = {}
  h.merged = []
  h.fetches = []
  h.workMonthArgs = []
  h.chaseArgs = []
  h.fixRows = []
})
afterEach(() => cleanup())

describe('StagesBilledMoneyModals — nothing open', () => {
  it('draws no window and kicks no scope', () => {
    mount()
    expect(Object.keys(h.seen)).toEqual([])
    expect(h.fetches).toEqual([])
    expect(last(h.workMonthArgs)?.[0]).toBeNull()
  })
})

describe('who owes what, the aging chart and the forecast: the unfiltered board, every non-paid scope', () => {
  it('who owes what counts every bill, loads every non-paid scope while open, and waits for all four', () => {
    const { rerender, p } = mount({ billedBreakdownOpen: true })
    expect(h.seen.breakdown!.rows).toBe(UNFILTERED_ROWS)
    expect(h.seen.breakdown!.loading).toBe(true)
    expect(h.fetches).toEqual(ALL_NON_PAID.map((s) => [s, 'cust-7']))
    expect(h.seen.breakdown!.canSeeCharts).toBe(false)

    h.merged = ALL_NON_PAID.slice(0, 3)
    rerender(<StagesBilledMoneyModals {...(p as unknown as ComponentProps<typeof StagesBilledMoneyModals>)} />)
    expect(h.seen.breakdown!.loading).toBe(true)
    h.merged = ALL_NON_PAID
    rerender(<StagesBilledMoneyModals {...(p as unknown as ComponentProps<typeof StagesBilledMoneyModals>)} />)
    expect(h.seen.breakdown!.loading).toBe(false)
  })

  it("who owes what's doors: a bill focuses its invoice, a whole-job bill opens Billed on the job, 90+ filters", () => {
    const { p } = mount({ billedBreakdownOpen: true, authRole: 'controller' })
    expect(h.seen.breakdown!.canSeeCharts).toBe(true)
    call('breakdown', 'onOpenBill', { invoiceId: 'inv-2', jobId: 'j-1' })
    expect(p.setBilledBreakdownOpen).toHaveBeenLastCalledWith(false)
    expect(p.applyStagesInvoiceFocus).toHaveBeenCalledWith('inv-2')

    call('breakdown', 'onOpenBill', { invoiceId: null, jobId: 'j-2' })
    const opener = (p.setStagesSectionOpen as ReturnType<typeof vi.fn>).mock.calls[0]![0] as (prev: object) => object
    expect(opener({ billed: false, paid: true })).toEqual({ billed: true, paid: true })
    expect(p.setPendingStagesJobFocusId).toHaveBeenCalledWith('j-2')
    expect(p.setStagesJobFlashId).toHaveBeenCalledWith('j-2')

    call('breakdown', 'onShow90')
    expect(p.setBilledAgingFilter).toHaveBeenCalledWith('90')
    expect(p.focusStagesSection).toHaveBeenLastCalledWith('billed')
    call('breakdown', 'onOpenAgingChart')
    expect(p.setBilledAgingChartOpen).toHaveBeenCalledWith(true)
  })

  it('the aging chart reads every bill and kicks the scopes too; its invoice door focuses the bill', () => {
    const { p } = mount({ billedAgingChartOpen: true })
    expect(h.seen.aging!.rows).toBe(UNFILTERED_ROWS)
    expect(h.fetches).toHaveLength(4)
    call('aging', 'onOpenInvoice', 'inv-1')
    expect(p.setBilledAgingChartOpen).toHaveBeenCalledWith(false)
    expect(p.applyStagesInvoiceFocus).toHaveBeenCalledWith('inv-1')
  })

  it("the forecast asks work months for its open-bill jobs once each, never a whole-job row, only while open", () => {
    mount({ billedPaymentForecastOpen: true })
    expect(h.fetches).toHaveLength(4)
    const [jobs, today] = last(h.workMonthArgs)!
    expect(jobs).toEqual([{ id: 'j-1', gc_customer_id: 'gc-j-1', customer_address_id: 'addr-j-1' }])
    expect(today).toBe('2026-10-08')
    expect(h.seen.forecast!.workMonths).toEqual({ 'j-1': { months: [] } })
    expect(h.seen.forecast!.rows).toBe(UNFILTERED_ROWS)
    expect(h.seen.forecast!.slipByCustomer).toEqual({ 'cust-7': 2 })
  })

  it("the forecast's doors: the Bill tab, stacked, the lien desk, pay speeds, and Email… for the office only", () => {
    const { p, unmount } = mount({ billedPaymentForecastOpen: true })
    call('forecast', 'onOpenJobDetail', 'j-1')
    expect(p.setBilledPaymentForecastOpen).toHaveBeenLastCalledWith(false)
    expect(p.tryOpenEditJob).toHaveBeenLastCalledWith('j-1', { initialTab: 'bill' })
    const onSaved = vi.fn()
    ;(p.setBilledPaymentForecastOpen as ReturnType<typeof vi.fn>).mockClear()
    call('forecast', 'onOpenJobStacked', 'j-2', onSaved)
    expect(p.tryOpenEditJob).toHaveBeenLastCalledWith('j-2', { initialTab: 'bill', onSaved })
    expect(p.setBilledPaymentForecastOpen).not.toHaveBeenCalled()
    call('forecast', 'onOpenLienNotice', 'j-1')
    expect(p.setLienDesk).toHaveBeenCalledWith({ jobId: 'j-1' })
    call('forecast', 'onPaySpeedsChanged')
    expect(p.refreshBilledPaySpeeds).toHaveBeenCalled()
    expect(h.seen.forecast!.canExcludePayments).toBe(false)

    expect(screen.queryByTestId('forecastShare')).toBeNull()
    call('forecast', 'onEmail')
    expect(screen.getByTestId('forecastShare')).toBeTruthy()
    call('forecastShare', 'onClose')
    expect(screen.queryByTestId('forecastShare')).toBeNull()
    unmount()

    mount({ billedPaymentForecastOpen: true, authRole: 'estimator' })
    expect(h.seen.forecast!.onEmail).toBeUndefined()
    expect(h.seen.forecast!.canEmailMoneyWaiting).toBe(false)
  })
})

describe('call mode', () => {
  it('kicks every non-paid scope and builds its queue from every bill only once all four have merged', () => {
    const { rerender, p } = mount({ chaseModalOpen: true })
    expect(h.fetches).toEqual(ALL_NON_PAID.map((s) => [s, 'cust-7']))
    expect(h.seen.chase!.queue).toBeNull()
    expect(h.chaseArgs).toEqual([])

    h.merged = ALL_NON_PAID
    rerender(<StagesBilledMoneyModals {...(p as unknown as ComponentProps<typeof StagesBilledMoneyModals>)} />)
    expect(h.seen.chase!.queue).toEqual({ sentinel: 'chase-queue' })
    const [rows, speeds, promises, touches, today, temps] = last(h.chaseArgs)!
    expect(rows).toBe(UNFILTERED_ROWS)
    expect(speeds).toBe(p.billedPaySpeeds)
    expect(promises).toBe(p.promisedPayDates)
    expect(touches).toBe(p.chaseTouches)
    expect(today).toBe('2026-10-08')
    expect(temps).toBe(p.gcTemperatureById)
  })

  it('a call recorded reloads the touches and the promises; Move to Collections asks first, office only', () => {
    const { p, unmount } = mount({ chaseModalOpen: true })
    call('chase', 'onRecorded')
    expect(p.loadChaseTouches).toHaveBeenCalled()
    expect(p.loadPromisedPayDates).toHaveBeenCalled()
    call('chase', 'onMoveToCollections', 'j-2')
    expect(p.setCollectionsConfirm).toHaveBeenCalledWith({ job: J2, direction: 'to' })
    call('chase', 'onMoveToCollections', 'gone')
    expect(p.showToast).toHaveBeenCalledWith('That job is not on the board any more — refresh and try again.', 'warning')
    call('chase', 'onOpenInvoice', 'inv-1')
    expect(p.setChaseModalOpen).toHaveBeenCalledWith(false)
    expect(p.applyStagesInvoiceFocus).toHaveBeenCalledWith('inv-1')
    unmount()

    mount({ chaseModalOpen: true, authRole: 'estimator' })
    expect(h.seen.chase!.onMoveToCollections).toBeUndefined()
  })
})

describe('the windows that read the board as filtered on screen', () => {
  it('Fix bill lines lists the filtered bills and reloads the board after a fix', () => {
    const { p } = mount({ fixBillLinesOpen: true })
    expect(last(h.fixRows)).toBe(FILTERED_ROWS)
    expect(h.seen.fixLines!.items).toEqual([{ sentinel: 'fix-items' }])
    call('fixLines', 'onAnyFixed')
    expect(p.loadJobs).toHaveBeenCalled()
    expect(h.fetches).toEqual([])
  })

  it('the paid profit chart reads the filtered paid jobs and opens one', () => {
    const { p } = mount({ paidProfitChartOpen: true })
    expect(h.seen.paidProfit!.paidJobs).toEqual([J2])
    call('paidProfit', 'onOpenJob', J2)
    expect(p.setPaidProfitChartOpen).toHaveBeenCalledWith(false)
    expect(p.openStagesDetailJobModal).toHaveBeenCalledWith(J2)
  })

  it('the billed share prints the filtered bills with the search, and is disabled with none', () => {
    const { p, unmount } = mount({ billedShareModalOpen: true })
    call('billedShare', 'onPrint')
    expect(p.printBilledAwaitingPaymentReport).toHaveBeenCalledWith(FILTERED_ROWS, { searchFilter: 'ridge' })
    expect(h.seen.billedShare!.printDisabled).toBe(false)
    unmount()
    mount({ billedShareModalOpen: true, stagesBoardLists: lists([], []) })
    expect(h.seen.billedShare!.printDisabled).toBe(true)
  })

  it('the promised pay date window: saved reloads the promises and the records; Close clears it', () => {
    const { p } = mount({ promisedPayModalJob: { jobId: 'j-1', jobLabel: 'J1 Ridgeway', initialYmd: null } })
    expect(h.seen.promisedPay).toMatchObject({ jobId: 'j-1', jobLabel: 'J1 Ridgeway', initialYmd: null })
    call('promisedPay', 'onSaved')
    expect(p.loadPromisedPayDates).toHaveBeenCalled()
    expect(p.loadPromiseRecords).toHaveBeenCalled()
    call('promisedPay', 'onClose')
    expect(p.setPromisedPayModalJob).toHaveBeenCalledWith(null)
  })
})
