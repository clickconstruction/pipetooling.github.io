import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Jobs → Team's week loader: four reads plus the office-job setting and the
 * soft acknowledgement read, mapped into the pure board kernel's shapes with
 * labels resolved here. Pins each read's filters and caps, the row mapping,
 * label resolution (first embed wins), the sub-sheet → job link by HCP, the
 * pay flags, the ack keys, and the two soft failures.
 */
type Step = { method: string; args: unknown[] }
const calls: Array<{ kind: 'from' | 'rpc'; name: string; steps: Step[] }> = []
let route: (kind: 'from' | 'rpc', name: string) => { data: unknown; error: { message: string } | null } = () => ({ data: [], error: null })
function recorder(kind: 'from' | 'rpc', name: string) {
  const steps: Step[] = []
  calls.push({ kind, name, steps })
  const p: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') {
          return (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
            try {
              resolve(route(kind, name))
            } catch (e) {
              reject(e)
            }
          }
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
    from: (table: string) => recorder('from', table),
    rpc: (fn: string) => recorder('rpc', fn),
  },
}))
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: { message: string } | null }>) => {
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
}))
const officeJob = vi.fn(async (): Promise<string | null> => 'office')
vi.mock('./overheadOfficeJobSettings', () => ({ fetchOverheadOfficeJobLedgerIdFromAppSettings: () => officeJob() }))

import { buildLedgerPrefixMap } from './ledgerDisplayPrefixes'
import { fetchTeamBoardWeek } from './fetchTeamBoardWeek'

const argsOf = (steps: Step[], m: string) => steps.filter((s) => s.method === m).map((s) => s.args)
const q = (name: string) => calls.find((c) => c.name === name)!
const prefixMap = buildLedgerPrefixMap([{ id: 'plumb', ledger_job_prefix: 'JP', ledger_bid_prefix: 'BP' }])
const jobEmbed = { hcp_number: '1842', job_name: 'Riverside', job_address: '1 Main', service_type_id: 'plumb', click_number: null }
const bidEmbed = { bid_number: '77', project_name: 'Oak Ridge', address: '9 Elm', service_type_id: null }
const data: Record<string, unknown> = {
  clock_sessions: [
    { id: 's1', user_id: 'u1', work_date: '2026-09-07', clocked_in_at: '2026-09-07T13:00:00Z', clocked_out_at: '2026-09-07T17:00:00Z', approved_at: '2026-09-07T18:00:00Z', job_ledger_id: 'j1', bid_id: null, users: { name: ' Ana ' }, jobs_ledger: jobEmbed, bids: null },
    { id: 's2', user_id: 'u2', work_date: '2026-09-08', clocked_in_at: '2026-09-08T13:00:00Z', clocked_out_at: '2026-09-08T15:00:00Z', approved_at: null, job_ledger_id: null, bid_id: 'b1', users: null, jobs_ledger: null, bids: bidEmbed },
  ],
  job_schedule_blocks: [
    { id: 'k1', assignee_user_id: 'u1', work_date: '2026-09-07', time_start: '08:00:00', time_end: '12:00:00', job_id: 'j1', bid_id: null, note: 'early', users: { name: 'Ana' }, jobs_ledger: { ...jobEmbed, job_name: 'Riverside (block copy)' }, bids: null },
    { id: 'k2', assignee_user_id: 'u3', work_date: '2026-09-09', time_start: '08:00:00', time_end: '10:00:00', job_id: 'j2', bid_id: null, note: null, users: { name: 'Cy' }, jobs_ledger: { hcp_number: null, job_name: 'Elm', job_address: null, service_type_id: null, click_number: 'C9' }, bids: null },
  ],
  people_labor_jobs: [
    { id: 'sh1', job_number: ' 1842 ', job_ledger_id: null, job_date: '2026-09-08', assigned_to_name: 'Bob Sub', address: '1 Main', stage: 'rough', jobs_ledger: null },
    { id: 'sh2', job_number: '9999', job_ledger_id: null, job_date: '2026-09-09', assigned_to_name: 'Cy Sub', address: 'x', stage: 'trim', jobs_ledger: null },
    { id: 'sh3', job_number: null, job_ledger_id: null, job_date: null, assigned_to_name: 'Undated', address: 'x', stage: 'trim', jobs_ledger: null },
    // v2.3055: linked by id to a job with no sessions or blocks this week — the link wins and the embed labels the row.
    { id: 'sh4', job_number: 'OLD-7', job_ledger_id: 'j7', job_date: '2026-09-10', assigned_to_name: 'Di Sub', address: '7 Oak', stage: 'rough', jobs_ledger: { hcp_number: '7007', job_name: 'Oak House', job_address: '7 Oak', service_type_id: null, click_number: null } },
  ],
  list_people_pay_flags: [{ person_name: ' Ana ', is_salary: true }, { person_name: 'Bob', is_salary: null }],
  team_board_acks: [{ id: 'a1', kind: 'over', work_date: '2026-09-07', person_user_id: 'u1', target_key: 'job:j1' }],
}

beforeEach(() => {
  calls.length = 0
  route = (_k, name) => ({ data: data[name] ?? [], error: null })
  officeJob.mockClear()
  officeJob.mockResolvedValue('office')
})

describe('fetchTeamBoardWeek', () => {
  it('sends the four week-bounded reads (closed, unrejected sessions; blocks; dated sub sheets; pay flags) plus the soft ack read', async () => {
    await fetchTeamBoardWeek('2026-09-07', '2026-09-13', prefixMap)
    const cs = q('clock_sessions')
    expect(String(argsOf(cs.steps, 'select')[0]![0])).toContain('users!clock_sessions_user_id_fkey(name), jobs_ledger(hcp_number,job_name,job_address,service_type_id,click_number), bids(bid_number,project_name,address,service_type_id)')
    expect(argsOf(cs.steps, 'gte')).toEqual([['work_date', '2026-09-07']])
    expect(argsOf(cs.steps, 'lte')).toEqual([['work_date', '2026-09-13']])
    expect(argsOf(cs.steps, 'is')).toEqual([
      ['rejected_at', null],
      ['revoked_at', null],
    ])
    expect(argsOf(cs.steps, 'not')).toEqual([['clocked_out_at', 'is', null]])
    expect(argsOf(cs.steps, 'order')).toEqual([['clocked_in_at', { ascending: true }]])
    expect(argsOf(cs.steps, 'limit')).toEqual([[3000]])
    const bl = q('job_schedule_blocks')
    expect(String(argsOf(bl.steps, 'select')[0]![0])).toContain('users!job_schedule_blocks_assignee_user_id_fkey(name)')
    expect(argsOf(bl.steps, 'gte')).toEqual([['work_date', '2026-09-07']])
    expect(argsOf(bl.steps, 'limit')).toEqual([[3000]])
    const sh = q('people_labor_jobs')
    expect(argsOf(sh.steps, 'gte')).toEqual([['job_date', '2026-09-07']])
    expect(argsOf(sh.steps, 'lte')).toEqual([['job_date', '2026-09-13']])
    expect(argsOf(sh.steps, 'limit')).toEqual([[500]])
    expect(calls.some((c) => c.kind === 'rpc' && c.name === 'list_people_pay_flags')).toBe(true)
    const ack = q('team_board_acks')
    expect(argsOf(ack.steps, 'gte')).toEqual([['work_date', '2026-09-07']])
    expect(argsOf(ack.steps, 'limit')).toEqual([[2000]])
  })

  it('maps sessions, blocks and sub sheets into the board shapes, resolving labels once per target (first embed wins) and linking sheets to jobs by HCP', async () => {
    const out = await fetchTeamBoardWeek('2026-09-07', '2026-09-13', prefixMap)
    expect(out.sessions).toEqual([
      { id: 's1', userId: 'u1', personName: 'Ana', workDate: '2026-09-07', clockedInAt: '2026-09-07T13:00:00Z', clockedOutAt: '2026-09-07T17:00:00Z', approvedAt: '2026-09-07T18:00:00Z', jobId: 'j1', bidId: null },
      { id: 's2', userId: 'u2', personName: '', workDate: '2026-09-08', clockedInAt: '2026-09-08T13:00:00Z', clockedOutAt: '2026-09-08T15:00:00Z', approvedAt: null, jobId: null, bidId: 'b1' },
    ])
    expect(out.blocks).toEqual([
      { id: 'k1', userId: 'u1', personName: 'Ana', workDate: '2026-09-07', timeStart: '08:00:00', timeEnd: '12:00:00', jobId: 'j1', bidId: null, note: 'early' },
      { id: 'k2', userId: 'u3', personName: 'Cy', workDate: '2026-09-09', timeStart: '08:00:00', timeEnd: '10:00:00', jobId: 'j2', bidId: null, note: null },
    ])
    expect(out.labels).toEqual({
      'job:j1': { label: 'JP1842 · Riverside', sub: '1 Main', jobNumber: '1842' }, // the session's embed came first; the block's copy did not overwrite it
      'bid:b1': { label: 'B77 · Oak Ridge', sub: '9 Elm' },
      'job:j2': { label: 'JC9 · Elm', sub: '', jobNumber: null },
      'job:j7': { label: 'J7007 · Oak House', sub: '7 Oak', jobNumber: '7007' }, // v2.3055: from the sheet's own embed
    })
    expect(out.subSheets).toEqual([
      { id: 'sh1', workDate: '2026-09-08', jobId: 'j1', jobNumber: ' 1842 ', contractor: 'Bob Sub', stage: 'rough', address: '1 Main' }, // linked by trimmed HCP
      { id: 'sh2', workDate: '2026-09-09', jobId: null, jobNumber: '9999', contractor: 'Cy Sub', stage: 'trim', address: 'x' }, // no job seen with that number
      { id: 'sh4', workDate: '2026-09-10', jobId: 'j7', jobNumber: 'OLD-7', contractor: 'Di Sub', stage: 'rough', address: '7 Oak' }, // v2.3055: linked by id, number ignored
      // the undated sheet is dropped
    ])
    expect(out.payFlags).toEqual({ Ana: { is_salary: true }, Bob: { is_salary: false } })
    expect(out.ackIdByKey).toEqual({ 'over|2026-09-07|u1|job:j1': 'a1' })
    expect(out.officeJobId).toBe('office')
  })

  it('a missing ack table or a failed office-job read is soft: no acks, no office job, everything else intact', async () => {
    route = (_k, name) => (name === 'team_board_acks' ? { data: null, error: { message: 'relation does not exist' } } : { data: data[name] ?? [], error: null })
    officeJob.mockRejectedValueOnce(new Error('rls'))
    const out = await fetchTeamBoardWeek('2026-09-07', '2026-09-13', prefixMap)
    expect(out.ackIdByKey).toEqual({})
    expect(out.officeJobId).toBeNull()
    expect(out.sessions).toHaveLength(2)
    route = (_k, name) => {
      if (name === 'team_board_acks') throw new Error('network')
      return { data: data[name] ?? [], error: null }
    }
    expect((await fetchTeamBoardWeek('2026-09-07', '2026-09-13', prefixMap)).ackIdByKey).toEqual({})
  })

  it('a failed core read throws; null results read as empty', async () => {
    route = (_k, name) => (name === 'clock_sessions' ? { data: null, error: { message: 'timeout' } } : { data: data[name] ?? [], error: null })
    await expect(fetchTeamBoardWeek('2026-09-07', '2026-09-13', prefixMap)).rejects.toThrow('timeout')
    route = () => ({ data: null, error: null })
    expect(await fetchTeamBoardWeek('2026-09-07', '2026-09-13', prefixMap)).toEqual({ sessions: [], blocks: [], subSheets: [], labels: {}, officeJobId: 'office', payFlags: {}, ackIdByKey: {} })
  })
})
