// @vitest-environment jsdom
/**
 * My Schedule's kept day through the data seam (punch list #183 PR 3). The schedule read is a
 * controllable promise, the kept-read store a mock, so each case says what the device kept and
 * when the live read lands or fails. Made-up rows.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { KEPT_READ_SCHEMA, type KeptRead } from '../lib/keptRead'
import type { JobScheduleBlockRow } from '../lib/jobScheduleBlocks'
import { scheduleDateKeyAddDays, scheduleTodayDateKey } from '../lib/jobScheduleChicago'
import { myScheduleKeptKey, type MyScheduleKeptRow } from '../lib/dashboard/myScheduleKeptDay'

// A chainable, thenable client that answers every read empty: the labels fall back to *Job*, the meta to none.
vi.mock('../lib/supabase', () => {
  function makeBuilder(): Record<string, unknown> {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'like', 'order', 'gte', 'lte', 'limit', 'is', 'not']) builder[m] = () => builder
    const result = () => Promise.resolve({ data: [], error: null, count: 0 })
    builder.then = (f?: (v: unknown) => unknown, r?: (e: unknown) => unknown) => result().then(f, r)
    builder.catch = (r?: (e: unknown) => unknown) => result().catch(r)
    builder.finally = (f?: () => void) => result().finally(f)
    return builder
  }
  return { supabase: { from: () => makeBuilder() } }
})
vi.mock('./useIsDigitalTwin', () => ({ useIsDigitalTwin: () => false }))
vi.mock('../lib/impersonationSession', () => ({ isImpersonationSessionActive: () => false }))

const readKept = vi.fn<(key: string) => Promise<KeptRead | null>>()
const writeKept = vi.fn<(kept: KeptRead) => Promise<void>>(async () => {})
vi.mock('../lib/keptReadStore', () => ({
  readKeptRead: (key: string) => readKept(key),
  writeKeptRead: (kept: KeptRead) => writeKept(kept),
  clearKeptReads: vi.fn(async () => {}),
}))

type Deferred = { resolve: (rows: JobScheduleBlockRow[]) => void; reject: (e: unknown) => void }
let pending: Deferred | null = null
const readBlocks = vi.fn(
  () =>
    new Promise<JobScheduleBlockRow[]>((resolve, reject) => {
      pending = { resolve, reject }
    }),
)
// The seam imports the one reader (and a type) from this module; nothing else of it is needed here.
vi.mock('../lib/jobScheduleBlocks', () => ({ readScheduleBlocksForAssigneeDateRange: () => readBlocks() }))

const { useDashboardSubSchedule } = await import('./useDashboardSubSchedule')

const USER = 'u1'
const TODAY = scheduleTodayDateKey()
const TOMORROW = scheduleDateKeyAddDays(TODAY, 1) ?? TODAY
const KEY = myScheduleKeptKey(USER, TODAY)
const KEPT_AT = Date.now() - 11 * 60_000

const block = (over: Partial<JobScheduleBlockRow> & { id: string }): JobScheduleBlockRow => ({
  assignee_user_id: USER,
  bid_id: null,
  created_at: '2026-10-29T12:00:00Z',
  created_by: null,
  field_moved_at: null,
  field_moved_from: null,
  job_id: 'job-1',
  note: null,
  shared_block_group_id: null,
  time_end: '12:00',
  time_start: '08:00',
  updated_at: '2026-10-29T12:00:00Z',
  work_date: TODAY,
  ...over,
})

const keptRows: MyScheduleKeptRow[] = [
  { block: block({ id: 'kept-a' }), label: '512 · Ridgeway Builders', phone: '555-0100', meta: { job_pictures_link: null, hcp_number: '512', click_number: null, job_address: '1407 Cedar Bend Dr' } },
  { block: block({ id: 'kept-b', job_id: 'job-2', work_date: TOMORROW }), label: '498 · Pruett & Vance', phone: null, meta: null },
]
const stored = (over: Partial<KeptRead<MyScheduleKeptRow>> = {}): KeptRead<MyScheduleKeptRow> => ({ key: KEY, schema: KEPT_READ_SCHEMA, scopes: ['today', 'tomorrow'], readAt: KEPT_AT, rows: keptRows, ...over })

const liveRows = [block({ id: 'live-a', job_id: 'job-3' })]

// The assigned lists are state in the Dashboard, so their identity holds across renders; a fresh
// array per render would re-run the labels effect forever.
const NO_JOBS: never[] = []
const render = (role: 'helpers' | null = 'helpers') =>
  renderHook(() => useDashboardSubSchedule({ authUserId: USER, role, assignedJobs: NO_JOBS, assignedReadyToBillJobs: NO_JOBS }))

beforeEach(() => {
  pending = null
  readBlocks.mockClear()
  readKept.mockReset()
  readKept.mockResolvedValue(stored())
  writeKept.mockClear()
})
afterEach(() => {
  cleanup()
})

describe('useDashboardSubSchedule, the kept day (#183 PR 3)', () => {
  it('hands out the kept day while the read hangs, with its stamp and loading off, then the live day once it lands and writes it whole', async () => {
    const { result } = render()
    await waitFor(() => expect(result.current.subScheduleKeptAt).toBe(KEPT_AT))
    expect(readKept).toHaveBeenCalledWith(KEY)
    expect(result.current.subScheduleLoading).toBe(false)
    expect(result.current.subScheduleKeptFailed).toBe(false)
    expect(result.current.subScheduleDayPartition.todayBlocks.map((b) => b.id)).toEqual(['kept-a'])
    expect(result.current.subScheduleDayPartition.tomorrowBlocks.map((b) => b.id)).toEqual(['kept-b'])
    expect(result.current.subScheduleLabels.get('job-1')).toBe('512 · Ridgeway Builders')
    expect(result.current.subSchedulePhones.get('job-1')).toBe('555-0100')
    expect(result.current.subScheduleJobMeta.get('job-1')?.job_address).toBe('1407 Cedar Bend Dr')
    expect(result.current.subScheduleError).toBeNull()

    await act(async () => pending?.resolve(liveRows))
    await waitFor(() => expect(result.current.subScheduleKeptAt).toBeNull())
    expect(result.current.subScheduleLoading).toBe(false)
    expect(result.current.subScheduleDayPartition.todayBlocks.map((b) => b.id)).toEqual(['live-a'])
    // Written once the labels and the meta landed too: the whole day the card drew.
    await waitFor(() => expect(writeKept).toHaveBeenCalledTimes(1))
    const written = writeKept.mock.calls[0]![0] as KeptRead<MyScheduleKeptRow>
    expect(written.key).toBe(KEY)
    expect(written.scopes).toEqual(['today', 'tomorrow'])
    expect(written.rows.map((r) => r.block.id)).toEqual(['live-a'])
    expect(written.rows[0]!.label).toBe('Job') // the stub answers no label, so the card's fallback is what is kept
  })

  it('a failed read with nothing kept carries the failure and no rows, never an empty day', async () => {
    readKept.mockResolvedValue(null)
    const { result } = render()
    await waitFor(() => expect(readBlocks).toHaveBeenCalled())
    await act(async () => pending?.reject({ message: 'canceling statement due to statement timeout', code: '57014', details: null, hint: null }))
    await waitFor(() => expect(result.current.subScheduleLoading).toBe(false))
    expect(result.current.subScheduleError).not.toBeNull()
    expect(result.current.subScheduleError?.kind).not.toBe('network') // a freeze code is the server's answer: no Retry of its own
    expect(result.current.subScheduleError?.message.length).toBeGreaterThan(0)
    expect(result.current.subScheduleKeptAt).toBeNull()
    expect(result.current.subScheduleDayPartition.todayBlocks).toEqual([])
    expect(writeKept).not.toHaveBeenCalled()
  })

  it('a lost signal is classed as the network, so the panel can offer Retry', async () => {
    readKept.mockResolvedValue(null)
    const { result } = render()
    await waitFor(() => expect(readBlocks).toHaveBeenCalled())
    await act(async () => pending?.reject(new TypeError('Load failed')))
    await waitFor(() => expect(result.current.subScheduleError?.kind).toBe('network'))
  })

  it('a failed read over a kept day leaves the day up and says so; the read again replaces it', async () => {
    const { result } = render()
    await waitFor(() => expect(result.current.subScheduleKeptAt).toBe(KEPT_AT))
    await act(async () => pending?.reject({ message: 'canceling statement due to statement timeout', code: '57014', details: null, hint: null }))
    await waitFor(() => expect(result.current.subScheduleKeptFailed).toBe(true))
    expect(result.current.subScheduleKeptAt).toBe(KEPT_AT)
    expect(result.current.subScheduleDayPartition.todayBlocks.map((b) => b.id)).toEqual(['kept-a'])
    expect(result.current.subScheduleLoading).toBe(false)
    expect(writeKept).not.toHaveBeenCalled()

    act(() => result.current.reloadSubSchedule())
    await waitFor(() => expect(readBlocks).toHaveBeenCalledTimes(2))
    expect(result.current.subScheduleKeptFailed).toBe(false)
    await act(async () => pending?.resolve(liveRows))
    await waitFor(() => expect(result.current.subScheduleKeptAt).toBeNull())
    expect(result.current.subScheduleDayPartition.todayBlocks.map((b) => b.id)).toEqual(['live-a'])
  })

  it('with no role settled yet nothing is read and nothing kept is looked for', async () => {
    const { result } = render(null)
    await act(async () => {})
    expect(readBlocks).not.toHaveBeenCalled()
    expect(readKept).not.toHaveBeenCalled()
    expect(result.current.subScheduleKeptAt).toBeNull()
  })
})
