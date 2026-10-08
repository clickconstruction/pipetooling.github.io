// @vitest-environment jsdom
/**
 * The People Review tab's Team Summary rows (v2.4976, the PEOPLE_REVIEW_TAB map's step 9), on the
 * hook over a recording union loader: the auto-refresh waits 200 ms, loads once for the latest
 * inputs, stamps the popup's cache with the key from before the load, keeps only the newest answer,
 * clears on an empty roster, waits out an open drilldown until the page's drain tick, and re-opens
 * the Hours drilldown after a save; Open in new window reuses the inline rows for the same inputs.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { MutableRefObject } from 'react'
import type { PayConfigRow } from '../types/peoplePayConfig'
import type { CategoryTagLookups } from '../lib/banking/categoryTags'
import { EMPTY_REVIEW_OVERHEAD_RATES, type ReviewOverheadRates } from '../lib/people/loadReviewOverheadRates'
import { buildTeamSummaryCacheKey } from '../lib/people/teamSummaryCacheKey'
import type { TeamSummaryInlineHandle } from '../components/people/teamSummary/TeamSummaryInline'
import type { TeamSummaryRow } from '../components/people/teamSummary/types'
import type { UserRow } from './usePeopleRoster'

const h = vi.hoisted(() => ({
  union: vi.fn<(...args: unknown[]) => Promise<{ tag: string }>>(),
}))

vi.mock('../lib/people/loadTeamReviewUnion', () => ({
  loadTeamReviewUnion: (...args: unknown[]) => h.union(...args),
}))
// One row per person that says which load it came from.
vi.mock('../lib/people/derivePersonTeamSummary', () => ({
  derivePersonTeamSummary: (union: { tag: string }, personName: string, _payConfig: unknown, onlyPaid: boolean, days: string[]) => ({
    personName,
    from: union.tag,
    onlyPaid,
    days,
  }),
}))
vi.mock('../components/people/teamSummary/formatters', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../components/people/teamSummary/formatters')>()),
  enrichTeamSummaryRowsForInline: (rows: Array<{ personName: string }>) => rows.map((r) => ({ name: r.personName })),
}))
vi.mock('../lib/peopleDocuments/buildTeamSummaryHtml', () => ({
  buildTeamSummaryHtml: (ctx: { breakdowns: Array<{ name: string }>; periodLabel: string; overheadRate: number | null }) =>
    `popup:${ctx.breakdowns.map((b) => b.name).join(',')}|${ctx.periodLabel}|rate=${String(ctx.overheadRate)}`,
}))

import { useTeamSummaryData, type UseTeamSummaryDataInput } from './useTeamSummaryData'

const ROSTER = ['Ann Lee', 'Bo Park']
const NO_ROSTER: string[] = []
const PAY = {
  'Ann Lee': { is_salary: false, hourly_wage: 30 },
  'Bo Park': { is_salary: true, hourly_wage: 40 },
} as unknown as Record<string, PayConfigRow>
const NO_PAY: Record<string, PayConfigRow> = {}
const USERS = [{ id: 'u-ann', name: 'Ann Lee' }, { id: 'u-bo', name: 'Bo Park' }] as unknown as UserRow[]
const TAGS = { lookups: {} as CategoryTagLookups }
const RANGE: [string, string] = ['2026-09-08', '2026-10-07']
const RATES: ReviewOverheadRates = { ...EMPTY_REVIEW_OVERHEAD_RATES, ratePerHour: 31.5, officeParts90d: 60, fieldHours90d: 4 }
const RATES_LOADING: ReviewOverheadRates = { ...EMPTY_REVIEW_OVERHEAD_RATES, loading: true }
const getReviewDateRange = (): [string, string] => RANGE
const getReviewPeriodLabel = () => 'Last 30 days'
const getDaysInRange = (start: string, end: string) => [start, end]
const keyFor = (onlyPaidInFull: boolean) =>
  buildTeamSummaryCacheKey({ start: RANGE[0], end: RANGE[1], onlyPaidInFull, roster: ROSTER, payConfig: PAY })

/** A load the test finishes by hand. */
function pending() {
  let resolve!: (v: { tag: string }) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<{ tag: string }>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

let showToast: Mock<UseTeamSummaryDataInput['showToast']>
let openDrilldown: Mock<TeamSummaryInlineHandle['openDrilldown']>
let refs: {
  teamSummaryInlineRef: MutableRefObject<TeamSummaryInlineHandle | null>
  teamSummaryDataCacheRef: MutableRefObject<{ rows: TeamSummaryRow[]; cacheKey: string } | null>
  teamSummaryModalOpenRef: MutableRefObject<boolean>
  teamSummaryRefreshPendingRef: MutableRefObject<boolean>
  reviewHoursReopenAfterLoadRef: MutableRefObject<string | null>
}

function inputs(over: Partial<UseTeamSummaryDataInput> = {}): UseTeamSummaryDataInput {
  return {
    isDev: true,
    payConfig: PAY,
    users: USERS,
    showPeopleForReview: ROSTER,
    reviewPeriod: 'last_30_days',
    reviewCustomRangeStart: '',
    reviewCustomRangeEnd: '',
    reviewOnlyPaidInFull: false,
    selectedReviewPersonIndex: -1,
    reviewOverheadRates: RATES,
    categoryTags: TAGS,
    getReviewDateRange,
    getReviewPeriodLabel,
    getDaysInRange,
    showToast,
    ...refs,
    teamSummaryDrainTick: 0,
    ...over,
  }
}

function mount(over: Partial<UseTeamSummaryDataInput> = {}) {
  return renderHook((props: UseTeamSummaryDataInput) => useTeamSummaryData(props), { initialProps: inputs(over) })
}

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

async function settle(p: ReturnType<typeof pending>, value: { tag: string }) {
  await act(async () => {
    p.resolve(value)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  h.union.mockReset()
  showToast = vi.fn<UseTeamSummaryDataInput['showToast']>()
  openDrilldown = vi.fn<TeamSummaryInlineHandle['openDrilldown']>()
  refs = {
    teamSummaryInlineRef: { current: { openDrilldown, openOverheadRateDrilldown: vi.fn() } },
    teamSummaryDataCacheRef: { current: null },
    teamSummaryModalOpenRef: { current: false },
    teamSummaryRefreshPendingRef: { current: false },
    reviewHoursReopenAfterLoadRef: { current: null },
  }
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useTeamSummaryData — the auto-refresh', () => {
  it('waits 200 ms, then loads the roster’s rows once and stamps the popup’s cache', async () => {
    const p = pending()
    h.union.mockReturnValueOnce(p.promise)
    const { result } = mount()
    expect(result.current.teamSummaryRows).toBeNull()

    await tick(199)
    expect(h.union).not.toHaveBeenCalled()
    await tick(1)
    expect(h.union.mock.calls).toEqual([[RANGE[0], RANGE[1], false, PAY, TAGS.lookups, USERS]])
    expect(result.current.teamSummaryLoading).toBe(true)
    expect(result.current.teamSummaryError).toBeNull()

    await settle(p, { tag: 'first' })
    expect(result.current.teamSummaryRows).toEqual([
      { personName: 'Ann Lee', from: 'first', onlyPaid: false, days: RANGE },
      { personName: 'Bo Park', from: 'first', onlyPaid: false, days: RANGE },
    ])
    expect(result.current.teamSummaryLoading).toBe(false)
    expect(refs.teamSummaryDataCacheRef.current).toEqual({ rows: result.current.teamSummaryRows, cacheKey: keyFor(false) })
  })

  it('a change inside the 200 ms starts the wait again: one load, with the latest inputs', async () => {
    h.union.mockReturnValue(pending().promise)
    const { rerender } = mount()
    await tick(150)
    rerender(inputs({ reviewOnlyPaidInFull: true }))
    await tick(150)
    expect(h.union).not.toHaveBeenCalled()
    await tick(50)
    expect(h.union).toHaveBeenCalledTimes(1)
    expect(h.union.mock.calls[0]![2]).toBe(true)
  })

  it('any change of its inputs drops the popup’s cache at once', async () => {
    const p = pending()
    h.union.mockReturnValueOnce(p.promise).mockReturnValue(pending().promise)
    const { rerender } = mount()
    await tick(200)
    await settle(p, { tag: 'first' })
    expect(refs.teamSummaryDataCacheRef.current?.cacheKey).toBe(keyFor(false))

    rerender(inputs({ reviewPeriod: 'last_week' }))
    expect(refs.teamSummaryDataCacheRef.current).toBeNull()
  })

  it('keeps only the newest answer: an older load that lands late is dropped', async () => {
    const first = pending()
    const second = pending()
    h.union.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result, rerender } = mount()
    await tick(200)
    rerender(inputs({ reviewOnlyPaidInFull: true }))
    await tick(200)
    expect(h.union).toHaveBeenCalledTimes(2)

    await settle(second, { tag: 'second' })
    await settle(first, { tag: 'first' })
    expect(result.current.teamSummaryRows?.map((r) => (r as unknown as { from: string }).from)).toEqual(['second', 'second'])
    expect(refs.teamSummaryDataCacheRef.current?.cacheKey).toBe(keyFor(true))
    expect(result.current.teamSummaryLoading).toBe(false)
  })

  it('a failed load shows its message and stops loading', async () => {
    const p = pending()
    h.union.mockReturnValueOnce(p.promise)
    const { result } = mount()
    await tick(200)
    await act(async () => {
      p.reject(new Error('permission denied for table people_hours'))
    })
    expect(result.current.teamSummaryError).toBe('permission denied for table people_hours')
    expect(result.current.teamSummaryLoading).toBe(false)
    expect(result.current.teamSummaryRows).toBeNull()
    expect(refs.teamSummaryDataCacheRef.current).toBeNull()
  })

  it('an empty roster clears the rows, the error and the pending flag, and loads nothing', async () => {
    const p = pending()
    h.union.mockReturnValueOnce(p.promise)
    const { result, rerender } = mount()
    await tick(200)
    await settle(p, { tag: 'first' })
    refs.teamSummaryRefreshPendingRef.current = true

    rerender(inputs({ showPeopleForReview: NO_ROSTER }))
    await tick(500)
    expect(result.current.teamSummaryRows).toBeNull()
    expect(result.current.teamSummaryError).toBeNull()
    expect(result.current.teamSummaryLoading).toBe(false)
    expect(refs.teamSummaryRefreshPendingRef.current).toBe(false)
    expect(refs.teamSummaryDataCacheRef.current).toBeNull()
    expect(h.union).toHaveBeenCalledTimes(1)
  })

  it('loads nothing for a non-dev, with no pay config, or with half a custom range', async () => {
    const stale = { rows: [], cacheKey: 'stale' }
    refs.teamSummaryDataCacheRef.current = stale
    mount({ isDev: false })
    await tick(500)
    // A non-dev's effect returns before it touches the cache.
    expect(refs.teamSummaryDataCacheRef.current).toBe(stale)

    mount({ payConfig: NO_PAY })
    mount({ reviewPeriod: 'custom', reviewCustomRangeStart: '2026-09-01', reviewCustomRangeEnd: '' })
    await tick(500)
    expect(h.union).not.toHaveBeenCalled()
    expect(refs.teamSummaryDataCacheRef.current).toBeNull()
  })

  it('an open drilldown holds the refresh until the page bumps the drain tick', async () => {
    h.union.mockReturnValue(pending().promise)
    refs.teamSummaryModalOpenRef.current = true
    const { rerender } = mount()
    await tick(1000)
    expect(h.union).not.toHaveBeenCalled()
    expect(refs.teamSummaryRefreshPendingRef.current).toBe(true)

    refs.teamSummaryModalOpenRef.current = false
    rerender(inputs({ teamSummaryDrainTick: 1 }))
    await tick(200)
    expect(h.union).toHaveBeenCalledTimes(1)
  })

  it('after a save from the Hours drilldown, the drilldown opens again 50 ms after the rows land', async () => {
    const p = pending()
    h.union.mockReturnValueOnce(p.promise)
    refs.reviewHoursReopenAfterLoadRef.current = 'Ann Lee'
    mount()
    await tick(200)
    await settle(p, { tag: 'first' })
    expect(refs.reviewHoursReopenAfterLoadRef.current).toBeNull()
    await tick(49)
    expect(openDrilldown).not.toHaveBeenCalled()
    await tick(1)
    expect(openDrilldown.mock.calls).toEqual([['Ann Lee', 'hours']])
  })
})

describe('openTeamSummaryWindow — Open in new window', () => {
  function fakeWindow() {
    return { document: { open: vi.fn(), write: vi.fn(), close: vi.fn() }, focus: vi.fn(), close: vi.fn() }
  }

  it('reuses the inline rows for the same inputs: no second load and no loading toast', async () => {
    const p = pending()
    h.union.mockReturnValueOnce(p.promise)
    const { result } = mount()
    await tick(200)
    await settle(p, { tag: 'first' })
    const win = fakeWindow()
    const open = vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window)

    await act(async () => {
      result.current.openTeamSummaryWindow('popup')
    })
    expect(open).toHaveBeenCalledWith('', '_blank')
    expect(h.union).toHaveBeenCalledTimes(1)
    expect(showToast).not.toHaveBeenCalled()
    expect(win.document.write.mock.calls.at(-1)).toEqual(['popup:Ann Lee,Bo Park|Last 30 days|rate=31.5'])
  })

  it('without a cache it loads afresh and reads the rates as they are when the rows land', async () => {
    const popupLoad = pending()
    h.union.mockReturnValueOnce(popupLoad.promise).mockReturnValue(pending().promise)
    const { result, rerender } = mount({ reviewOverheadRates: RATES_LOADING })
    const win = fakeWindow()
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window)

    act(() => {
      result.current.openTeamSummaryWindow('popup')
    })
    expect(h.union).toHaveBeenCalledTimes(1)
    expect(showToast).toHaveBeenCalledWith('Loading Team Summary…', 'info')
    // The rates finish while the popup's rows are still loading.
    rerender(inputs({ reviewOverheadRates: RATES }))
    await settle(popupLoad, { tag: 'popup' })
    expect(win.document.write.mock.calls.at(-1)).toEqual(['popup:Ann Lee,Bo Park|Last 30 days|rate=31.5'])
  })

  it('with no roster it warns and opens no window; a blocked popup says so and loads nothing', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const empty = mount({ showPeopleForReview: NO_ROSTER })
    act(() => {
      empty.result.current.openTeamSummaryWindow('popup')
    })
    expect(showToast).toHaveBeenLastCalledWith('No people in pay config. Add people in People pay config (Payroll tab) first.', 'warning')
    expect(open).not.toHaveBeenCalled()

    const full = mount()
    act(() => {
      full.result.current.openTeamSummaryWindow('popup')
    })
    expect(open).toHaveBeenCalledTimes(1)
    expect(showToast).toHaveBeenLastCalledWith('Popup blocked. Allow popups to open Team Summary.', 'warning')
    expect(h.union).not.toHaveBeenCalled()
  })
})
