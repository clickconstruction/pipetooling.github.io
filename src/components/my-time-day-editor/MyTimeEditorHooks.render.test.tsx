// @vitest-environment jsdom
/**
 * Two hooks of the My Time day editor, each behind a probe: `useMyTimeJobBidLabels` (the labels
 * the parent did not supply, loaded once and merged over the parent's) and
 * `useMyTimeSalaryPrefetch` (an empty day asks the salary schedule once, then explains itself or
 * has its sessions made). The supabase stub records every read.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { renderSettled, settle } from '../../test/renderSmokeMocks'
import type { DayEditorSession } from '../../lib/myTimeDayTimeline'
import { emptyDayLine } from '../../lib/myTimeSalaryPrefetch'
import type { CalendarWorkdayResolution } from '../../lib/resolveCalendarWorkday'
import { useMyTimeJobBidLabels, type UseMyTimeJobBidLabelsInput } from './useMyTimeJobBidLabels'
import { useMyTimeSalaryPrefetch, type UseMyTimeSalaryPrefetchInput } from './useMyTimeSalaryPrefetch'

type Result = { data: unknown; error: unknown }

const h = vi.hoisted(() => ({
  rpcCalls: [] as Array<{ fn: string; args: unknown }>,
  rpcResults: {} as Record<string, { data: unknown; error: unknown }>,
  reads: [] as string[],
  tables: {} as Record<string, unknown>,
  /** When set, the template read waits on it — a prefetch held in flight. */
  templateGate: null as null | Promise<void>,
  resolution: { kind: 'none' } as unknown,
  syncCalls: [] as Array<[string, string | undefined]>,
  syncError: null as string | null,
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const b: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'lte', 'gte', 'maybeSingle']) b[m] = () => b
      b.then = (res: (v: Result) => unknown, rej: (e: unknown) => unknown) => {
        h.reads.push(table)
        const answer = { data: h.tables[table] ?? null, error: null }
        const gate = table === 'salary_work_schedule_templates' ? h.templateGate : null
        return (gate ? gate.then(() => answer) : Promise.resolve(answer)).then(res, rej)
      }
      return b
    },
    rpc: (fn: string, args: unknown) => {
      h.rpcCalls.push({ fn, args })
      return Promise.resolve(h.rpcResults[fn] ?? { data: [], error: null })
    },
  },
}))

vi.mock('../../utils/errorHandling', async (orig) => ({
  ...(await orig<typeof import('../../utils/errorHandling')>()),
  withSupabaseRetry: async (op: () => PromiseLike<Result>) => {
    const r = await op()
    if (r.error) throw r.error
    return r.data
  },
}))

vi.mock('../../lib/resolveCalendarWorkday', async (orig) => ({
  ...(await orig<typeof import('../../lib/resolveCalendarWorkday')>()),
  resolveCalendarWorkday: () => h.resolution as CalendarWorkdayResolution,
}))

vi.mock('../../lib/salaryScheduleSync', () => ({
  syncSalaryClockSessionsForUserDay: async (userId: string, workDate?: string) => {
    h.syncCalls.push([userId, workDate])
    return { error: h.syncError }
  },
}))

const JOB_A = 'aaaaaaaa-1111-4111-8111-111111111111'
const JOB_B = 'bbbbbbbb-2222-4222-8222-222222222222'
const BID_C = 'cccccccc-3333-4333-8333-333333333333'

function mk(id: string, over: Partial<DayEditorSession> = {}): DayEditorSession {
  return {
    id,
    clocked_in_at: '2026-01-05T14:00:00.000Z',
    clocked_out_at: '2026-01-05T22:00:00.000Z',
    work_date: '2026-01-05',
    notes: 'n',
    job_ledger_id: null,
    bid_id: null,
    approved_at: null,
    origin: 'user_punch',
    salary_segment_index: null,
    ...over,
  }
}

beforeEach(() => {
  h.rpcCalls.length = 0
  h.rpcResults = {}
  h.reads.length = 0
  h.tables = {}
  h.templateGate = null
  h.resolution = { kind: 'none' }
  h.syncCalls.length = 0
  h.syncError = null
})

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// useMyTimeJobBidLabels
// ---------------------------------------------------------------------------

function LabelsProbe({ input }: { input: UseMyTimeJobBidLabelsInput }) {
  const { mergedJobLabels, mergedBidLabels } = useMyTimeJobBidLabels(input)
  return (
    <div>
      <div data-testid="jobs">{JSON.stringify(mergedJobLabels)}</div>
      <div data-testid="bids">{JSON.stringify(mergedBidLabels)}</div>
    </div>
  )
}

const jobs = () => JSON.parse(screen.getByTestId('jobs').textContent ?? '{}') as Record<string, string>
const bids = () => JSON.parse(screen.getByTestId('bids').textContent ?? '{}') as Record<string, string>

function labelsInput(over: Partial<UseMyTimeJobBidLabelsInput> = {}): UseMyTimeJobBidLabelsInput {
  return {
    sortedSessions: [mk('s1', { job_ledger_id: JOB_A }), mk('s2', { job_ledger_id: JOB_B }), mk('s3', { bid_id: BID_C })],
    jobLabels: { [JOB_A]: 'J1 · From the parent - 1 Main' },
    bidLabels: {},
    effectiveSubjectUserId: 'user-1',
    dateStr: '2026-01-05',
    ...over,
  }
}

const mountLabels = (input: UseMyTimeJobBidLabelsInput) =>
  renderSettled(<LabelsProbe input={input} />, { loaded: () => screen.findByTestId('jobs') })

describe('useMyTimeJobBidLabels', () => {
  it('loads only what the parent did not label, and keeps the parent’s label', async () => {
    h.rpcResults.get_jobs_ledger_by_ids = {
      data: [{ id: JOB_B, hcp_number: '523', click_number: '', job_name: 'Mission Hills', job_address: '123 Main', service_type_id: null }],
      error: null,
    }
    h.rpcResults.get_bids_by_ids = {
      data: [{ id: BID_C, bid_number: '12', project_name: 'Oak Ridge', address: '9 Oak', service_type_id: null }],
      error: null,
    }
    await mountLabels(labelsInput())
    await waitFor(() => expect(jobs()[JOB_B]).toContain('Mission Hills - 123 Main'))
    expect(jobs()[JOB_A]).toBe('J1 · From the parent - 1 Main')
    expect(bids()[BID_C]).toContain('Oak Ridge - 9 Oak')
    // Every read asks for the unlabelled ids only. (The read runs twice on mount — see below.)
    const asked = [
      { fn: 'get_jobs_ledger_by_ids', args: { p_job_ids: [JOB_B] } },
      { fn: 'get_bids_by_ids', args: { p_bid_ids: [BID_C] } },
    ]
    expect(h.rpcCalls).toEqual([...asked, ...asked])
  })

  it('reads twice on mount: the reset for a new day hands the loader a new empty map, which restarts it', async () => {
    await mountLabels(labelsInput({ sortedSessions: [mk('s2', { job_ledger_id: JOB_B })] }))
    await waitFor(() => expect(jobs()[JOB_B]).toBe('Job bbbbbbbb…'))
    await settle()
    expect(h.rpcCalls).toEqual([
      { fn: 'get_jobs_ledger_by_ids', args: { p_job_ids: [JOB_B] } },
      { fn: 'get_jobs_ledger_by_ids', args: { p_job_ids: [JOB_B] } },
    ])
  })

  it('reads nothing when every job and bid already has a label', async () => {
    await mountLabels(
      labelsInput({
        jobLabels: { [JOB_A]: 'a', [JOB_B]: 'b' },
        bidLabels: { [BID_C]: 'c' },
      })
    )
    await settle()
    expect(h.rpcCalls).toEqual([])
    expect(jobs()).toEqual({ [JOB_A]: 'a', [JOB_B]: 'b' })
  })

  it('labels a job whose row did not come back by its id, and does not ask again', async () => {
    await mountLabels(labelsInput({ sortedSessions: [mk('s2', { job_ledger_id: JOB_B })] }))
    await waitFor(() => expect(jobs()[JOB_B]).toBe('Job bbbbbbbb…'))
    await settle()
    const afterMount = h.rpcCalls.length
    await settle()
    expect(h.rpcCalls).toHaveLength(afterMount)
  })

  it('a failed read labels everything it asked for by id', async () => {
    h.rpcResults.get_jobs_ledger_by_ids = { data: null, error: new Error('boom') }
    await mountLabels(labelsInput())
    await waitFor(() => expect(jobs()[JOB_B]).toBe('Job bbbbbbbb…'))
    expect(bids()[BID_C]).toBe('Bid cccccccc…')
    expect(jobs()[JOB_A]).toBe('J1 · From the parent - 1 Main')
  })

  it('a parent that rebuilds the same labels every render does not restart the read', async () => {
    const input = labelsInput({ sortedSessions: [mk('s2', { job_ledger_id: JOB_B })] })
    const { rerender } = await mountLabels(input)
    await waitFor(() => expect(jobs()[JOB_B]).toBe('Job bbbbbbbb…'))
    await settle()
    const afterMount = h.rpcCalls.length
    rerender(<LabelsProbe input={{ ...input, jobLabels: { ...input.jobLabels } }} />)
    rerender(<LabelsProbe input={{ ...input, jobLabels: { ...input.jobLabels } }} />)
    await settle()
    expect(h.rpcCalls).toHaveLength(afterMount)
  })

  it('a new day drops the labels it loaded', async () => {
    const input = labelsInput({ sortedSessions: [mk('s2', { job_ledger_id: JOB_B })], jobLabels: {} })
    const { rerender } = await mountLabels(input)
    await waitFor(() => expect(jobs()[JOB_B]).toBe('Job bbbbbbbb…'))
    rerender(<LabelsProbe input={{ ...input, sortedSessions: [], dateStr: '2026-01-06' }} />)
    await waitFor(() => expect(jobs()).toEqual({}))
  })
})

// ---------------------------------------------------------------------------
// useMyTimeSalaryPrefetch
// ---------------------------------------------------------------------------

function SalaryProbe({ input }: { input: UseMyTimeSalaryPrefetchInput }) {
  const { busy, emptyDayHint, timeOffLabel } = useMyTimeSalaryPrefetch(input)
  return <div data-testid="salary">{`${busy ? 'busy' : 'idle'} · ${emptyDayLine(emptyDayHint, timeOffLabel)}`}</div>
}

const EMPTY: DayEditorSession[] = []

function salaryInput(over: Partial<UseMyTimeSalaryPrefetchInput> = {}) {
  return {
    enabled: true,
    sessionsControlledByParent: false,
    sessionsLoading: false,
    fetchedSessions: EMPTY as DayEditorSession[] | null,
    resolvedSessionCount: 0,
    inSaveableRange: true,
    effectiveSubjectUserId: 'user-1',
    dateStr: '2026-01-05',
    onSessionsInvalidated: vi.fn(),
    ...over,
  }
}

const salaryText = () => screen.getByTestId('salary').textContent
const mountSalary = (input: UseMyTimeSalaryPrefetchInput) =>
  renderSettled(<SalaryProbe input={input} />, { loaded: () => screen.findByTestId('salary') })

const TEMPLATE = { id: 't1', user_id: 'user-1' }

describe('useMyTimeSalaryPrefetch', () => {
  it.each([
    ['the mount did not ask for it', { enabled: false }],
    ['the fetch has not answered', { fetchedSessions: null }],
    ['the day has sessions', { fetchedSessions: [mk('s1')], resolvedSessionCount: 1 }],
    ['the parent owns the sessions', { sessionsControlledByParent: true }],
  ] as const)('reads nothing when %s', async (_label, over) => {
    await mountSalary(salaryInput(over as Partial<UseMyTimeSalaryPrefetchInput>))
    await settle()
    expect(h.reads).toEqual([])
    expect(salaryText()).toBe('idle · No sessions this day.')
  })

  it('a person with no salary schedule stops at the first read', async () => {
    const input = salaryInput()
    await mountSalary(input)
    await waitFor(() => expect(h.reads).toEqual(['salary_work_schedule_templates']))
    await waitFor(() => expect(salaryText()).toBe('idle · No sessions this day.'))
    expect(h.syncCalls).toEqual([])
    expect(input.onSessionsInvalidated).not.toHaveBeenCalled()
  })

  it('time off explains the empty day in the time off’s own words', async () => {
    h.tables.salary_work_schedule_templates = TEMPLATE
    h.resolution = { kind: 'time_off', kindLabel: 'Paid time off', note: null }
    await mountSalary(salaryInput())
    await waitFor(() => expect(salaryText()).toBe('idle · No sessions this day — Paid time off.'))
    expect([...h.reads].sort()).toEqual(
      ['salary_work_schedule_day_overrides', 'salary_work_schedule_templates', 'user_time_off']
    )
    expect(h.syncCalls).toEqual([])
  })

  it('a day with no shift says so', async () => {
    h.tables.salary_work_schedule_templates = TEMPLATE
    h.resolution = { kind: 'none' }
    await mountSalary(salaryInput())
    await waitFor(() =>
      expect(salaryText()).toBe('idle · No scheduled work this day (e.g. weekend or no shift blocks).')
    )
    expect(h.syncCalls).toEqual([])
  })

  it('a scheduled day has its sessions made, then tells the editor to re-read the day', async () => {
    h.tables.salary_work_schedule_templates = TEMPLATE
    h.resolution = { kind: 'scheduled', source: 'template', blocks: [] }
    const input = salaryInput()
    await mountSalary(input)
    await waitFor(() => expect(input.onSessionsInvalidated).toHaveBeenCalledTimes(1))
    expect(h.syncCalls).toEqual([['user-1', '2026-01-05']])
    await waitFor(() => expect(salaryText()).toBe('idle · No sessions this day.'))
  })

  it('a failed sync raises its message and does not re-read the day', async () => {
    h.tables.salary_work_schedule_templates = TEMPLATE
    h.resolution = { kind: 'scheduled', source: 'template', blocks: [] }
    h.syncError = 'Sync failed: not allowed'
    const input = salaryInput()
    await mountSalary(input)
    await screen.findByText('Sync failed: not allowed')
    expect(input.onSessionsInvalidated).not.toHaveBeenCalled()
    await waitFor(() => expect(salaryText()).toBe('idle · No sessions this day.'))
  })

  it('asks once per person and day, and again on a new day', async () => {
    h.tables.salary_work_schedule_templates = TEMPLATE
    h.resolution = { kind: 'none' }
    const input = salaryInput()
    const { rerender } = await mountSalary(input)
    await waitFor(() => expect(h.reads).toHaveLength(3))
    await waitFor(() => expect(salaryText()).toContain('No scheduled work this day'))

    rerender(<SalaryProbe input={{ ...input, fetchedSessions: [] }} />)
    await settle()
    expect(h.reads).toHaveLength(3)

    rerender(<SalaryProbe input={{ ...input, fetchedSessions: [], dateStr: '2026-01-06' }} />)
    await waitFor(() => expect(h.reads).toHaveLength(6))
  })

  it('a session arriving clears the hint', async () => {
    h.tables.salary_work_schedule_templates = TEMPLATE
    h.resolution = { kind: 'none' }
    const input = salaryInput()
    const { rerender } = await mountSalary(input)
    await waitFor(() => expect(salaryText()).toContain('No scheduled work this day'))
    rerender(<SalaryProbe input={{ ...input, fetchedSessions: [mk('s1')], resolvedSessionCount: 1 }} />)
    await waitFor(() => expect(salaryText()).toBe('idle · No sessions this day.'))
  })

  it('a parent callback that is new every render does not restart the prefetch', async () => {
    h.tables.salary_work_schedule_templates = TEMPLATE
    h.resolution = { kind: 'scheduled', source: 'template', blocks: [] }
    let open: () => void = () => {}
    h.templateGate = new Promise<void>((resolve) => { open = resolve })
    const input = salaryInput()
    const { rerender } = await mountSalary(input)
    expect(salaryText()).toBe('busy · No sessions this day.')
    const latest = vi.fn()
    rerender(<SalaryProbe input={{ ...input, onSessionsInvalidated: latest }} />)
    open()
    await waitFor(() => expect(latest).toHaveBeenCalledTimes(1))
    expect(input.onSessionsInvalidated).not.toHaveBeenCalled()
    expect(h.syncCalls).toHaveLength(1)
    await waitFor(() => expect(salaryText()).toBe('idle · No sessions this day.'))
  })

  it('a re-read of the day while the prefetch is in flight leaves it reading busy', async () => {
    h.tables.salary_work_schedule_templates = TEMPLATE
    h.resolution = { kind: 'none' }
    let open: () => void = () => {}
    h.templateGate = new Promise<void>((resolve) => { open = resolve })
    const input = salaryInput()
    const { rerender } = await mountSalary(input)
    expect(salaryText()).toBe('busy · No sessions this day.')
    // The editor's fetch answers again with a new (still empty) list: the run in flight is
    // cancelled, and the day's key is already spent, so nothing finishes it.
    rerender(<SalaryProbe input={{ ...input, fetchedSessions: [] }} />)
    open()
    await settle()
    await settle()
    expect(salaryText()).toBe('busy · No sessions this day.')
    expect(h.reads).toEqual(['salary_work_schedule_templates'])
  })
})
