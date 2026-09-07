import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * jobScheduleBlocks is the repository layer for `job_schedule_blocks`: thin fetch /
 * write wrappers plus a few pure helpers. The contract worth pinning is WHICH
 * filters and payloads reach PostgREST and how results and failures come back —
 * so every builder call is recorded and each awaited query pops the next scripted
 * result. (`buildDispatchScheduledJobsForAssign` has its own suite in
 * jobScheduleBlocksAssignPicks.test.ts.)
 */
type Step = { method: string; args: unknown[] }
type Result = { data: unknown; error: { message: string } | null }
const calls: Array<{ kind: 'from' | 'rpc'; name: string; args: unknown[]; steps: Step[] }> = []
const results: Result[] = []
const nextResult = (): Result => results.shift() ?? { data: [], error: null }

function recorder(kind: 'from' | 'rpc', name: string, args: unknown[]) {
  const steps: Step[] = []
  calls.push({ kind, name, args, steps })
  const p: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') {
          return (resolve: (v: Result) => void) => resolve(nextResult())
        }
        return (...a: unknown[]) => {
          steps.push({ method: String(prop), args: a })
          return p
        }
      },
    },
  )
  return p
}
vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => recorder('from', table, []),
    rpc: (fn: string, args: unknown) => recorder('rpc', fn, [args]),
  },
}))
// The retry wrapper's own behaviour (backoff, classification) is covered elsewhere;
// here it only needs to unwrap `data` and throw on `error`, and the formatter only
// needs to surface the message.
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<Result>) => {
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
  formatErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}))

import {
  deleteJobScheduleBlock,
  ensureSharedBlockGroupForRow,
  fetchDispatchScheduledJobsForAssigneeDay,
  fetchDispatchScheduledJobsForAssigneesOnDay,
  fetchJobScheduleBlockGroupLegs,
  fetchJobScheduleBlocksForHubDateRange,
  fetchJobScheduleBlocksForJob,
  fetchJobScheduleBlocksForJobDateRange,
  fetchJobScheduleBlocksForJobDay,
  fetchJobScheduleBlocksForSharedGroupId,
  fetchScheduleBlocksForAssigneeDateRange,
  fetchScheduleBlocksForAssigneesOnDay,
  fetchScheduleJobContext,
  insertJobScheduleBlock,
  insertJobScheduleBlocks,
  isScheduleBidAnchorId,
  moveJobScheduleBlockGroupViaRpc,
  newJobScheduleSharedBlockGroupId,
  scheduleBlockAnchorFromId,
  scheduleBlockAnchorId,
  updateJobScheduleBlock,
  updateJobScheduleBlockGroup,
} from './jobScheduleBlocks'

beforeEach(() => {
  calls.length = 0
  results.length = 0
})

const last = () => calls[calls.length - 1]!
const step = (m: string) => last().steps.find((s) => s.method === m)
const stepsOf = (m: string) => last().steps.filter((s) => s.method === m).map((s) => s.args)
const selectText = () => String(step('select')?.args[0] ?? '')

describe('block anchors (job uuid or bid:<uuid>)', () => {
  it('encodes a job block by its job id and a bid block with the bid: prefix, and decodes both', () => {
    expect(scheduleBlockAnchorId({ job_id: 'j1', bid_id: null })).toBe('j1')
    expect(scheduleBlockAnchorId({ job_id: null, bid_id: 'b1' })).toBe('bid:b1')
    expect(scheduleBlockAnchorId({ job_id: null, bid_id: null })).toBe('bid:')
    expect(isScheduleBidAnchorId('bid:b1')).toBe(true)
    expect(isScheduleBidAnchorId('j1')).toBe(false)
    expect(scheduleBlockAnchorFromId('j1')).toEqual({ job_id: 'j1', bid_id: null })
    expect(scheduleBlockAnchorFromId('bid:b1')).toEqual({ job_id: null, bid_id: 'b1' })
  })
  it('mints a UUID for a new shared block group', () => {
    expect(newJobScheduleSharedBlockGroupId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(newJobScheduleSharedBlockGroupId()).not.toBe(newJobScheduleSharedBlockGroupId())
  })
})

describe('fetchScheduleJobContext', () => {
  it('reads the job with its team embed and maps the title, team and a trimmed project id', async () => {
    results.push({
      data: {
        id: 'j1',
        hcp_number: ' 1842 ',
        job_name: ' Riverside Dr ',
        project_id: ' p9 ',
        jobs_ledger_team_members: [
          { user_id: 'u1', users: { name: 'Ana' } },
          { user_id: 'u2', users: null },
        ],
      },
      error: null,
    })
    const r = await fetchScheduleJobContext('j1')
    expect(last().name).toBe('jobs_ledger')
    expect(selectText()).toContain('jobs_ledger_team_members(user_id, users(name))')
    expect(step('eq')?.args).toEqual(['id', 'j1'])
    expect(step('maybeSingle')).toBeTruthy()
    expect(r).toEqual({
      data: {
        jobId: 'j1',
        jobTitle: '1842 · Riverside Dr',
        project_id: 'p9',
        teamMembers: [
          { user_id: 'u1', name: 'Ana' },
          { user_id: 'u2', name: null },
        ],
      },
      error: null,
    })
  })
  it('falls back to "— · Job" for a nameless job, null project id for blank, and no team', async () => {
    results.push({ data: { id: 'j2', hcp_number: null, job_name: '', project_id: '  ', jobs_ledger_team_members: null }, error: null })
    const r = await fetchScheduleJobContext('j2')
    expect(r.data).toEqual({ jobId: 'j2', jobTitle: '— · Job', project_id: null, teamMembers: [] })
  })
  it('reports a missing or invisible job, and surfaces a read error', async () => {
    results.push({ data: null, error: null })
    expect(await fetchScheduleJobContext('gone')).toEqual({ data: null, error: 'Job not found or access denied.' })
    results.push({ data: null, error: { message: 'permission denied' } })
    expect(await fetchScheduleJobContext('j1')).toEqual({ data: null, error: 'permission denied' })
  })
})

describe('reads — the filters that reach PostgREST', () => {
  const row = { id: 'b1', job_id: 'j1' }

  it('fetchJobScheduleBlocksForJob: by job, day then start, capped at 101, with assignee and creator names', async () => {
    results.push({ data: [row], error: null })
    const r = await fetchJobScheduleBlocksForJob('j1')
    expect(last().name).toBe('job_schedule_blocks')
    expect(selectText()).toContain('users!job_schedule_blocks_assignee_user_id_fkey(name)')
    expect(selectText()).toContain('creator:users!job_schedule_blocks_created_by_fkey(name)')
    expect(step('eq')?.args).toEqual(['job_id', 'j1'])
    expect(stepsOf('order')).toEqual([
      ['work_date', { ascending: true }],
      ['time_start', { ascending: true }],
    ])
    expect(step('limit')?.args).toEqual([101])
    expect(r).toEqual({ data: [row], error: null })
  })

  it('fetchJobScheduleBlocksForJobDay: by job and day, start order; null data → empty list', async () => {
    results.push({ data: null, error: null })
    const r = await fetchJobScheduleBlocksForJobDay('j1', '2026-09-07')
    expect(stepsOf('eq')).toEqual([
      ['job_id', 'j1'],
      ['work_date', '2026-09-07'],
    ])
    expect(r).toEqual({ data: [], error: null })
  })

  it('group legs and shared-group reads key on shared_block_group_id alone (bid-anchored legs included)', async () => {
    await fetchJobScheduleBlockGroupLegs('g1')
    expect(stepsOf('eq')).toEqual([['shared_block_group_id', 'g1']])
    expect(last().steps.some((s) => s.method === 'eq' && s.args[0] === 'job_id')).toBe(false)

    await fetchJobScheduleBlocksForSharedGroupId('g1')
    expect(stepsOf('eq')).toEqual([['shared_block_group_id', 'g1']])
    expect(stepsOf('order').map((a) => a[0])).toEqual(['work_date', 'time_start', 'assignee_user_id'])
  })

  it('assignee-day reads use IN over the assignees and short-circuit on no assignees', async () => {
    expect(await fetchScheduleBlocksForAssigneesOnDay([], '2026-09-07')).toEqual({ data: [], error: null })
    expect(calls).toHaveLength(0)
    await fetchScheduleBlocksForAssigneesOnDay(['u1', 'u2'], '2026-09-07')
    expect(step('in')?.args).toEqual(['assignee_user_id', ['u1', 'u2']])
    expect(step('eq')?.args).toEqual(['work_date', '2026-09-07'])
  })

  it('date-range reads bound work_date inclusively and order by day then start (the hub also by assignee first)', async () => {
    await fetchScheduleBlocksForAssigneeDateRange('u1', '2026-09-06', '2026-09-12')
    expect(step('eq')?.args).toEqual(['assignee_user_id', 'u1'])
    expect(step('gte')?.args).toEqual(['work_date', '2026-09-06'])
    expect(step('lte')?.args).toEqual(['work_date', '2026-09-12'])
    expect(stepsOf('order').map((a) => a[0])).toEqual(['work_date', 'time_start'])

    await fetchJobScheduleBlocksForJobDateRange('j1', '2026-09-06', '2026-09-12')
    expect(step('eq')?.args).toEqual(['job_id', 'j1'])
    expect(stepsOf('order').map((a) => a[0])).toEqual(['work_date', 'time_start'])

    await fetchJobScheduleBlocksForHubDateRange('2026-09-06', '2026-09-12')
    expect(last().steps.some((s) => s.method === 'eq')).toBe(false)
    expect(step('gte')?.args).toEqual(['work_date', '2026-09-06'])
    expect(stepsOf('order').map((a) => a[0])).toEqual(['assignee_user_id', 'work_date', 'time_start'])
  })

  it('a failed read comes back as an empty list plus the message, never a throw', async () => {
    results.push({ data: null, error: { message: 'timeout' } })
    expect(await fetchJobScheduleBlocksForJob('j1')).toEqual({ data: [], error: 'timeout' })
    results.push({ data: null, error: { message: 'timeout' } })
    expect(await fetchJobScheduleBlocksForHubDateRange('a', 'b')).toEqual({ data: [], error: 'timeout' })
  })
})

describe('dispatch assign quick-picks', () => {
  const embed = (over: Record<string, unknown>) => ({
    id: 'x',
    job_id: 'j1',
    assignee_user_id: 'u1',
    work_date: '2026-09-07',
    time_start: '08:00:00',
    time_end: '12:00:00',
    jobs_ledger: { hcp_number: '1842', job_name: 'Riverside', job_address: '1 Main', service_type_id: null, click_number: null },
    ...over,
  })

  it('per-assignee: trims the ids, short-circuits on blanks, filters by assignee + day with the job embed', async () => {
    expect(await fetchDispatchScheduledJobsForAssigneeDay('  ', '2026-09-07')).toEqual({ data: [], error: null })
    expect(await fetchDispatchScheduledJobsForAssigneeDay('u1', '')).toEqual({ data: [], error: null })
    expect(calls).toHaveLength(0)
    results.push({ data: [embed({})], error: null })
    const r = await fetchDispatchScheduledJobsForAssigneeDay(' u1 ', ' 2026-09-07 ')
    expect(selectText()).toContain('jobs_ledger(hcp_number, job_name, job_address, service_type_id, click_number)')
    expect(stepsOf('eq')).toEqual([
      ['assignee_user_id', 'u1'],
      ['work_date', '2026-09-07'],
    ])
    expect(r.error).toBeNull()
    expect(r.data.map((j) => [j.jobId, j.hcp_number, j.scheduledMinutes])).toEqual([['j1', '1842', 240]])
  })

  it('batched: dedupes and trims assignees, one IN query, and keys the picks by assignee (absent when no blocks)', async () => {
    expect((await fetchDispatchScheduledJobsForAssigneesOnDay(['', '  '], '2026-09-07')).data.size).toBe(0)
    expect(calls).toHaveLength(0)
    results.push({
      data: [
        embed({ id: 'a', assignee_user_id: 'u1' }),
        embed({ id: 'b', assignee_user_id: 'u2', job_id: 'j2', jobs_ledger: { hcp_number: '77', job_name: 'Elm', job_address: '', service_type_id: null, click_number: null } }),
        embed({ id: 'c', assignee_user_id: 'u1', time_start: '13:00:00', time_end: '15:00:00' }),
      ],
      error: null,
    })
    const r = await fetchDispatchScheduledJobsForAssigneesOnDay([' u1', 'u2 ', 'u1', 'u3'], '2026-09-07')
    expect(calls).toHaveLength(1)
    expect(step('in')?.args).toEqual(['assignee_user_id', ['u1', 'u2', 'u3']])
    expect([...r.data.keys()]).toEqual(['u1', 'u2'])
    expect(r.data.get('u1')!.map((j) => [j.jobId, j.windowSpans.length, j.scheduledMinutes])).toEqual([['j1', 2, 360]])
    expect(r.data.get('u2')!.map((j) => j.jobId)).toEqual(['j2'])
    expect(r.data.has('u3')).toBe(false)
  })

  it('a failed batched read comes back as an empty map plus the message', async () => {
    results.push({ data: null, error: { message: 'rls' } })
    const r = await fetchDispatchScheduledJobsForAssigneesOnDay(['u1'], '2026-09-07')
    expect(r.data.size).toBe(0)
    expect(r.error).toBe('rls')
  })
})

describe('writes — the payloads that reach PostgREST', () => {
  it('insertJobScheduleBlock inserts one row and returns it; insertJobScheduleBlocks sends every row in one statement', async () => {
    const row = { job_id: 'j1', assignee_user_id: 'u1', work_date: '2026-09-07', time_start: '08:00', time_end: '12:00' }
    results.push({ data: { id: 'b1', ...row }, error: null })
    const r = await insertJobScheduleBlock(row as never)
    expect(step('insert')?.args).toEqual([row])
    expect(step('single')).toBeTruthy()
    expect(r).toEqual({ data: { id: 'b1', ...row }, error: null })

    expect(await insertJobScheduleBlocks([])).toEqual({ error: null })
    expect(calls).toHaveLength(1) // nothing sent for an empty batch
    const rows = [row, { ...row, assignee_user_id: 'u2' }]
    await insertJobScheduleBlocks(rows as never)
    expect(calls).toHaveLength(2)
    expect(step('insert')?.args).toEqual([rows])
    expect(step('select')?.args).toEqual(['id'])
  })

  it('updates patch by id or by group, and delete removes by id', async () => {
    await updateJobScheduleBlock('b1', { note: 'late start' })
    expect(step('update')?.args).toEqual([{ note: 'late start' }])
    expect(step('eq')?.args).toEqual(['id', 'b1'])

    await updateJobScheduleBlockGroup('g1', { time_start: '09:00', time_end: '13:00', note: null })
    expect(step('update')?.args).toEqual([{ time_start: '09:00', time_end: '13:00', note: null }])
    expect(step('eq')?.args).toEqual(['shared_block_group_id', 'g1'])

    await deleteJobScheduleBlock('b1')
    expect(step('delete')).toBeTruthy()
    expect(step('eq')?.args).toEqual(['id', 'b1'])
  })

  it('moving a linked group goes through the RPC with the job id passed as-is (null for bid-anchored groups)', async () => {
    expect(await moveJobScheduleBlockGroupViaRpc('j1', 'g1', '2026-09-08')).toEqual({ error: null })
    expect(last()).toMatchObject({ kind: 'rpc', name: 'move_job_schedule_block_group', args: [{ p_job_id: 'j1', p_shared_block_group_id: 'g1', p_new_work_date: '2026-09-08' }] })
    await moveJobScheduleBlockGroupViaRpc(null, 'g2', '2026-09-08')
    expect(last().args).toEqual([{ p_job_id: null, p_shared_block_group_id: 'g2', p_new_work_date: '2026-09-08' }])
    results.push({ data: null, error: { message: 'overlap' } })
    expect(await moveJobScheduleBlockGroupViaRpc('j1', 'g1', '2026-09-08')).toEqual({ error: 'overlap' })
  })

  it('a failed write surfaces the message', async () => {
    results.push({ data: null, error: { message: 'read only' } })
    expect(await updateJobScheduleBlock('b1', { note: 'x' })).toEqual({ error: 'read only' })
    results.push({ data: null, error: { message: 'read only' } })
    expect(await insertJobScheduleBlock({} as never)).toEqual({ data: null, error: 'read only' })
  })
})

describe('ensureSharedBlockGroupForRow', () => {
  it('returns the existing group id without writing', async () => {
    results.push({ data: { shared_block_group_id: 'g1' }, error: null })
    expect(await ensureSharedBlockGroupForRow('b1')).toEqual({ data: 'g1', error: null })
    expect(calls).toHaveLength(1)
    expect(step('select')?.args).toEqual(['shared_block_group_id'])
  })
  it('mints and patches a group id onto a legacy solo row', async () => {
    results.push({ data: { shared_block_group_id: null }, error: null })
    const r = await ensureSharedBlockGroupForRow('b1')
    expect(r.error).toBeNull()
    expect(r.data).toMatch(/^[0-9a-f-]{36}$/)
    expect(calls).toHaveLength(2)
    expect(step('update')?.args).toEqual([{ shared_block_group_id: r.data }])
    expect(step('eq')?.args).toEqual(['id', 'b1'])
  })
  it('reports a missing row, and a failed patch', async () => {
    results.push({ data: null, error: null })
    expect(await ensureSharedBlockGroupForRow('gone')).toEqual({ data: null, error: 'Block not found.' })
    results.push({ data: { shared_block_group_id: null }, error: null }, { data: null, error: { message: 'read only' } })
    expect(await ensureSharedBlockGroupForRow('b1')).toEqual({ data: null, error: 'read only' })
  })
})
