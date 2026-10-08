// @vitest-environment jsdom
/**
 * The Schedule Dispatch hub's week data engine (punch list #46 row 7, the SCHEDULE_DISPATCH
 * map's step 3): what one load reads and in what shape, who gets a row on the board, the
 * spinner rules (a quiet reload never touches it; an older load finishing late never clears a
 * newer one's), each read's fail-soft warning, the pay-rate gate, the time-off prime, the
 * standing office schedule and the swim lanes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { JobScheduleBlockRow } from '../lib/jobScheduleBlocks'
import type { ScheduleDispatchHubJobRow } from '../lib/scheduleDispatchHub'

const io = vi.hoisted(() => ({
  fetchJobsLedgerForScheduleDispatchHub: vi.fn(),
  fetchUsersTabRosterForScheduleDispatchHub: vi.fn(),
  fetchBidsForScheduleDispatchHub: vi.fn(),
  fetchTeamMemberUserIdsForJobIds: vi.fn(),
  fetchUserNamesForIds: vi.fn(),
  fetchArchivedUserIdSetForIds: vi.fn(),
  fetchBidTitlesForScheduleBlocks: vi.fn(),
  fetchJobScheduleBlocksForHubDateRange: vi.fn(),
  fetchSubOrdersForRange: vi.fn(),
  fetchTeamMembersByJobId: vi.fn(),
  fetchSubOffDaysForRange: vi.fn(),
  fetchScheduleHiddenBlockCounts: vi.fn(),
  fetchUserTimeOffForUsersInRange: vi.fn(),
  fetchClockInsForUsersInRange: vi.fn(),
  fetchSalariedUserIdSetFromUserIds: vi.fn(),
  ensureOfficeScheduleBlocks: vi.fn(),
  fetchDispatchSwimLanes: vi.fn(),
  recordNavClick: vi.fn(),
}))
const db = vi.hoisted(() => ({
  masters: [] as Array<{ master_id: string }>,
  payRows: [] as Array<{ person_name: string; hourly_wage: number }>,
  payNamesAsked: [] as string[][],
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => {
        if (table === 'pay_approved_masters') return Promise.resolve({ data: db.masters, error: null })
        return {
          in: (_col: string, names: string[]) => {
            db.payNamesAsked.push(names)
            return Promise.resolve({ data: db.payRows, error: null })
          },
        }
      },
    }),
  },
}))
vi.mock('../lib/scheduleDispatchHub', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../lib/scheduleDispatchHub')>()
  return {
    ...orig,
    fetchJobsLedgerForScheduleDispatchHub: io.fetchJobsLedgerForScheduleDispatchHub,
    fetchUsersTabRosterForScheduleDispatchHub: io.fetchUsersTabRosterForScheduleDispatchHub,
    fetchBidsForScheduleDispatchHub: io.fetchBidsForScheduleDispatchHub,
    fetchTeamMemberUserIdsForJobIds: io.fetchTeamMemberUserIdsForJobIds,
    fetchUserNamesForIds: io.fetchUserNamesForIds,
    fetchArchivedUserIdSetForIds: io.fetchArchivedUserIdSetForIds,
    fetchBidTitlesForScheduleBlocks: io.fetchBidTitlesForScheduleBlocks,
  }
})
vi.mock('../lib/jobScheduleBlocks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/jobScheduleBlocks')>()),
  fetchJobScheduleBlocksForHubDateRange: io.fetchJobScheduleBlocksForHubDateRange,
}))
vi.mock('../lib/subs/subDispatchFetch', () => ({
  fetchSubOrdersForRange: io.fetchSubOrdersForRange,
  fetchTeamMembersByJobId: io.fetchTeamMembersByJobId,
  fetchSubOffDaysForRange: io.fetchSubOffDaysForRange,
}))
vi.mock('../lib/scheduleHiddenBlocks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/scheduleHiddenBlocks')>()),
  fetchScheduleHiddenBlockCounts: io.fetchScheduleHiddenBlockCounts,
}))
vi.mock('../lib/userTimeOffByCell', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/userTimeOffByCell')>()),
  fetchUserTimeOffForUsersInRange: io.fetchUserTimeOffForUsersInRange,
}))
vi.mock('../lib/scheduleLateness', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/scheduleLateness')>()),
  fetchClockInsForUsersInRange: io.fetchClockInsForUsersInRange,
}))
vi.mock('../lib/salaryPayConfigGate', () => ({ fetchSalariedUserIdSetFromUserIds: io.fetchSalariedUserIdSetFromUserIds }))
vi.mock('../lib/dispatchOfficeRoster', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/dispatchOfficeRoster')>()),
  ensureOfficeScheduleBlocks: io.ensureOfficeScheduleBlocks,
}))
vi.mock('../lib/dispatchSwimLanes', () => ({ fetchDispatchSwimLanes: io.fetchDispatchSwimLanes }))
vi.mock('../lib/navClickTelemetry', () => ({ recordNavClick: io.recordNavClick }))

import { useScheduleDispatchHubData, type ScheduleDispatchHubDataInput } from './useScheduleDispatchHubData'
import { hubPersonDayKey } from '../lib/scheduleDispatchHub'
import { userTimeOffCellKey } from '../lib/userTimeOffByCell'

// A week far enough ahead that "today onward" is the whole week; and one already worked.
const WEEK = '2099-01-04'
const WEEK_END = '2099-01-10'
const MON = '2099-01-05'
const PAST_WEEK = '2020-01-05'
const PAST_WEEK_END = '2020-01-11'

const JOB: ScheduleDispatchHubJobRow = { id: 'job-1', hcp_number: '927', job_name: 'Berg AirBnb', project_id: null, job_address: '12 Elm St' }

function block(over: Partial<JobScheduleBlockRow> = {}): JobScheduleBlockRow {
  return {
    id: 'blk-1',
    job_id: 'job-1',
    bid_id: null,
    assignee_user_id: 'carl',
    work_date: MON,
    time_start: '08:00:00',
    time_end: '12:00:00',
    note: null,
    shared_block_group_id: null,
    created_by: null,
    created_at: '2099-01-01T15:00:00Z',
    updated_at: '2099-01-01T15:00:00Z',
    field_moved_at: null,
    field_moved_from: null,
    ...over,
  }
}

const NAMES = new Map([
  ['abraham', 'Abraham'],
  ['paige', 'Paige'],
  ['carl', 'Carl'],
  ['zed', 'Zed'],
  ['dana', 'Dana'],
])

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const showToast = vi.fn()

function input(over: Partial<ScheduleDispatchHubDataInput> = {}): ScheduleDispatchHubDataInput {
  return { jobId: '', weekStart: WEEK, weekEnd: WEEK_END, role: 'assistant', authUserId: 'me', canEdit: true, showToast, ...over }
}

async function mountSettled(over: Partial<ScheduleDispatchHubDataInput> = {}) {
  const hook = renderHook((p: ScheduleDispatchHubDataInput) => useScheduleDispatchHubData(p), { initialProps: input(over) })
  // What the load produces: the people on the board, and the spinner off again.
  await waitFor(() => expect(hook.result.current.hubAllPeopleRows.length).toBeGreaterThan(0))
  await waitFor(() => expect(hook.result.current.hubLoading).toBe(false))
  await act(async () => {})
  return hook
}

beforeEach(() => {
  vi.clearAllMocks()
  db.masters = []
  db.payRows = []
  db.payNamesAsked = []
  io.fetchJobsLedgerForScheduleDispatchHub.mockResolvedValue({ data: [JOB], error: null })
  io.fetchUsersTabRosterForScheduleDispatchHub.mockResolvedValue({
    data: [
      { id: 'abraham', role: 'journeyman', needs_supervision: false },
      { id: 'paige', role: 'helpers', needs_supervision: true },
    ],
    error: null,
  })
  io.fetchBidsForScheduleDispatchHub.mockResolvedValue({ data: [], error: null })
  io.fetchTeamMemberUserIdsForJobIds.mockResolvedValue({ data: ['abraham', 'zed'], error: null })
  io.fetchUserNamesForIds.mockResolvedValue({ data: NAMES, error: null })
  io.fetchArchivedUserIdSetForIds.mockResolvedValue(new Set(['zed']))
  io.fetchBidTitlesForScheduleBlocks.mockResolvedValue({ data: new Map(), error: null })
  io.fetchJobScheduleBlocksForHubDateRange.mockResolvedValue({ data: [block()], error: null })
  io.fetchSubOrdersForRange.mockResolvedValue({ data: [], error: null })
  io.fetchTeamMembersByJobId.mockResolvedValue({ data: new Map(), error: null })
  io.fetchSubOffDaysForRange.mockResolvedValue({ data: new Map(), error: null })
  io.fetchScheduleHiddenBlockCounts.mockResolvedValue({ data: [], error: null })
  io.fetchUserTimeOffForUsersInRange.mockResolvedValue({ data: [], error: null })
  io.fetchClockInsForUsersInRange.mockResolvedValue({ data: [], error: null })
  io.fetchSalariedUserIdSetFromUserIds.mockResolvedValue(new Set(['paige']))
  io.ensureOfficeScheduleBlocks.mockResolvedValue({ created: 0, error: null })
  io.fetchDispatchSwimLanes.mockResolvedValue({ data: { lanes: [], memberIdsByLaneId: new Map(), laneIdByUserId: new Map() }, error: null })
})
afterEach(cleanup)

describe('useScheduleDispatchHubData — one load', () => {
  it('reads the week, puts the team, the users tab and every assignee on the board, and leaves the archived off', async () => {
    const { result } = await mountSettled()
    expect(io.fetchJobScheduleBlocksForHubDateRange).toHaveBeenCalledWith(WEEK, WEEK_END)
    expect(io.fetchUsersTabRosterForScheduleDispatchHub).toHaveBeenCalledWith(false)
    expect(io.fetchScheduleHiddenBlockCounts).not.toHaveBeenCalled()
    expect(io.fetchTeamMemberUserIdsForJobIds).toHaveBeenCalledWith(['job-1'])
    expect(new Set(io.fetchUserNamesForIds.mock.calls[0]?.[0])).toEqual(new Set(['abraham', 'zed', 'paige', 'carl']))

    expect(result.current.hubAllPeopleRows.map((r) => r.displayName)).toEqual(['Abraham', 'Carl', 'Paige'])
    expect(result.current.hubJobTitleById.get('job-1')).toContain('Berg AirBnb')
    expect(result.current.getHubJobAddress('job-1')).toBe('12 Elm St')
    expect(result.current.hubPersonDayBlocks.get(hubPersonDayKey('carl', MON))?.map((b) => b.id)).toEqual(['blk-1'])
    expect(result.current.hubBlockById.get('blk-1')?.assignee_user_id).toBe('carl')
    expect(result.current.hubMergedRows.map((r) => r.id)).toEqual(['job-1'])
    expect(result.current.hubRoleByUserId.get('paige')).toBe('helpers')
    expect(result.current.hubPersonById.get('paige')).toEqual({ role: 'helpers', needsSupervision: true })
    expect([...result.current.hubSalariedUserIds]).toEqual(['paige'])
    expect(result.current.hubJobsError).toBeNull()
    expect(result.current.hubSummariesError).toBeNull()
    expect(showToast).not.toHaveBeenCalled()
  })

  it('checks each person on the board for lateness against the week', async () => {
    io.fetchClockInsForUsersInRange.mockResolvedValue({ data: [{ user_id: 'carl', work_date: MON, clocked_in_at: '2099-01-05T15:30:00Z' }], error: null })
    const { result } = await mountSettled()
    await waitFor(() => expect(result.current.hubLatenessByCell.size).toBe(1))
    const calls = io.fetchClockInsForUsersInRange.mock.calls
    const [ids, from, to] = calls[calls.length - 1]!
    expect(new Set(ids)).toEqual(new Set(['abraham', 'carl', 'paige']))
    expect([from, to]).toEqual([WEEK, WEEK_END])
  })

  it('a quiet reload never touches the spinner; a loud one does', async () => {
    const { result } = await mountSettled()
    const quiet = deferred<{ data: ScheduleDispatchHubJobRow[]; error: null }>()
    io.fetchJobsLedgerForScheduleDispatchHub.mockReturnValueOnce(quiet.promise)
    let pending!: Promise<void>
    act(() => {
      pending = result.current.loadHub({ quiet: true })
    })
    expect(result.current.hubLoading).toBe(false)
    await act(async () => {
      quiet.resolve({ data: [JOB], error: null })
      await pending
    })
    expect(result.current.hubLoading).toBe(false)

    const loud = deferred<{ data: ScheduleDispatchHubJobRow[]; error: null }>()
    io.fetchJobsLedgerForScheduleDispatchHub.mockReturnValueOnce(loud.promise)
    act(() => {
      pending = result.current.loadHub()
    })
    expect(result.current.hubLoading).toBe(true)
    await act(async () => {
      loud.resolve({ data: [JOB], error: null })
      await pending
    })
    expect(result.current.hubLoading).toBe(false)
  })

  it('an older loud load that finishes late leaves the newer load’s spinner on', async () => {
    const { result } = await mountSettled()
    const first = deferred<{ data: ScheduleDispatchHubJobRow[]; error: null }>()
    const second = deferred<{ data: ScheduleDispatchHubJobRow[]; error: null }>()
    io.fetchJobsLedgerForScheduleDispatchHub.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    let p1!: Promise<void>
    let p2!: Promise<void>
    act(() => {
      p1 = result.current.loadHub()
      p2 = result.current.loadHub()
    })
    await act(async () => {
      first.resolve({ data: [JOB], error: null })
      await p1
    })
    expect(result.current.hubLoading).toBe(true)
    await act(async () => {
      second.resolve({ data: [JOB], error: null })
      await p2
    })
    expect(result.current.hubLoading).toBe(false)
  })

  it('each read that fails is a warning and the board still loads; the panels get their error lines; only a throw is an error', async () => {
    io.fetchSubOrdersForRange.mockResolvedValue({ data: [], error: 'subs down' })
    io.fetchBidsForScheduleDispatchHub.mockResolvedValue({ data: [], error: 'bids down' })
    io.fetchJobScheduleBlocksForHubDateRange.mockResolvedValue({ data: [], error: 'blocks down' })
    io.fetchJobsLedgerForScheduleDispatchHub.mockResolvedValue({ data: [], error: 'jobs down' })
    const { result } = await mountSettled()
    expect(showToast).toHaveBeenCalledWith('Subs on the board: subs down', 'warning')
    expect(showToast).toHaveBeenCalledWith('Bids list: bids down', 'warning')
    expect(showToast).toHaveBeenCalledWith('Schedule blocks: blocks down', 'warning')
    expect(result.current.hubJobsError).toBe('jobs down')
    expect(result.current.hubSummariesError).toBe('blocks down')
    expect(showToast.mock.calls.some(([, tone]) => tone === 'error')).toBe(false)
    // The users tab and the team are still on the board.
    expect(result.current.hubAllPeopleRows.map((r) => r.displayName)).toEqual(['Abraham', 'Paige'])

    showToast.mockClear()
    io.fetchJobsLedgerForScheduleDispatchHub.mockRejectedValueOnce(new Error('network gone'))
    await act(async () => {
      await result.current.loadHub()
    })
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('network gone'), 'error')
    expect(result.current.hubLoading).toBe(false)
  })

  it('a superintendent asks what RLS hid, gets a row for each busy-elsewhere person, and logs the count on loud loads only', async () => {
    io.fetchScheduleHiddenBlockCounts.mockResolvedValue({ data: [{ user_id: 'dana', day: MON, hidden_count: 2, hidden_hours: 5 }], error: null })
    const { result } = await mountSettled({ role: 'superintendent' })
    expect(io.fetchScheduleHiddenBlockCounts).toHaveBeenCalledWith(WEEK, WEEK_END)
    expect(io.recordNavClick).toHaveBeenCalledTimes(1)
    expect(io.recordNavClick).toHaveBeenCalledWith('me', 'superintendent', 'schedule_hidden_blocks', '#2')
    expect(result.current.hubAllPeopleRows.map((r) => r.userId)).toContain('dana')
    expect(result.current.hubUserIdsWithBlocksThisWeek.has('dana')).toBe(true)
    expect(result.current.hubHiddenByCell.size).toBe(1)

    await act(async () => {
      await result.current.loadHub({ quiet: true })
    })
    expect(io.recordNavClick).toHaveBeenCalledTimes(1)
  })
})

describe('useScheduleDispatchHubData — pay rates', () => {
  it('a dev sees pay rates, read by name and keyed by person', async () => {
    db.payRows = [{ person_name: 'Abraham', hourly_wage: 31 }]
    const { result } = await mountSettled({ role: 'dev' })
    await waitFor(() => expect(result.current.hubHourlyWageByUserId.get('abraham')).toBe(31))
    expect(result.current.canShowHubExpectedManpowerPayroll).toBe(true)
    expect(io.fetchUsersTabRosterForScheduleDispatchHub).toHaveBeenCalledWith(true)
    expect(new Set(db.payNamesAsked[db.payNamesAsked.length - 1])).toEqual(new Set(['Abraham', 'Carl', 'Paige', 'Zed']))
  })

  it('a master not on the pay-approved list never reads pay rates', async () => {
    const { result } = await mountSettled({ role: 'master_technician' })
    expect(result.current.canShowHubExpectedManpowerPayroll).toBe(false)
    expect(db.payNamesAsked).toEqual([])
    expect(result.current.hubHourlyWageByUserId.size).toBe(0)
  })

  it('a pay-approved master gets them once the list loads, which reloads the week', async () => {
    db.masters = [{ master_id: 'me' }]
    db.payRows = [{ person_name: 'Carl', hourly_wage: 28 }]
    const { result } = await mountSettled({ role: 'master_technician' })
    await waitFor(() => expect(result.current.hubHourlyWageByUserId.get('carl')).toBe(28))
    expect(result.current.canShowHubExpectedManpowerPayroll).toBe(true)
  })
})

describe('useScheduleDispatchHubData — the satellites', () => {
  it('time off the load seeded is not fetched again for the same week and roster', async () => {
    io.fetchUserTimeOffForUsersInRange.mockResolvedValue({
      data: [{ id: 'to-1', user_id: 'abraham', start_date: MON, end_date: MON, kind: 'time_off', note: null }],
      error: null,
    })
    io.fetchArchivedUserIdSetForIds.mockResolvedValue(new Set())
    const { result } = await mountSettled()
    expect(io.fetchUserTimeOffForUsersInRange).toHaveBeenCalledTimes(1)
    expect(result.current.hubUserTimeOffByCell.has(userTimeOffCellKey('abraham', MON))).toBe(true)

    await act(async () => {
      await result.current.refreshHubUserTimeOff()
    })
    expect(io.fetchUserTimeOffForUsersInRange).toHaveBeenCalledTimes(2)
  })

  it('an archived person on the roster defeats that skip: one more read (SCHEDULE_DISPATCH map, quirk "An archived person on the roster defeats the time-off prime")', async () => {
    // The load primes with every roster id; the effect compares the board's rows, which leave the archived out.
    await mountSettled()
    expect(io.fetchUserTimeOffForUsersInRange).toHaveBeenCalledTimes(2)
  })

  it('the standing office schedule fills the week once per range, reloads quietly when it made blocks, and runs again when forced', async () => {
    io.ensureOfficeScheduleBlocks.mockResolvedValue({ created: 2, error: null })
    const { result } = await mountSettled()
    await waitFor(() => expect(io.fetchJobsLedgerForScheduleDispatchHub).toHaveBeenCalledTimes(2))
    expect(io.ensureOfficeScheduleBlocks).toHaveBeenCalledTimes(1)
    expect(io.ensureOfficeScheduleBlocks).toHaveBeenCalledWith(WEEK, WEEK_END)
    expect(result.current.hubLoading).toBe(false)

    await act(async () => {
      await result.current.runOfficeEnsure()
    })
    expect(io.ensureOfficeScheduleBlocks).toHaveBeenCalledTimes(1)
    await act(async () => {
      await result.current.runOfficeEnsure({ force: true })
    })
    expect(io.ensureOfficeScheduleBlocks).toHaveBeenCalledTimes(2)
  })

  it('never fills for a viewer who cannot edit, or a week already worked', async () => {
    const viewer = await mountSettled({ canEdit: false })
    viewer.unmount()
    await mountSettled({ weekStart: PAST_WEEK, weekEnd: PAST_WEEK_END })
    expect(io.ensureOfficeScheduleBlocks).not.toHaveBeenCalled()
  })

  it('reads the swim lanes for a signed-in viewer only, and again when asked', async () => {
    const signedOut = await mountSettled({ authUserId: undefined })
    expect(io.fetchDispatchSwimLanes).not.toHaveBeenCalled()
    expect(signedOut.result.current.swimLanes).toBeNull()
    signedOut.unmount()

    const { result } = await mountSettled()
    await waitFor(() => expect(result.current.swimLanes).not.toBeNull())
    expect(io.fetchDispatchSwimLanes).toHaveBeenCalledTimes(1)
    await act(async () => {
      await result.current.refetchSwimLanes()
    })
    expect(io.fetchDispatchSwimLanes).toHaveBeenCalledTimes(2)
  })
})
