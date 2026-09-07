import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Dispatch Mode's Customer Summary: every interaction across a customer's
 * jobs, newest first. Pins the job read and cap, the job mapping, the five
 * per-job loads (each degrading to nothing on its own), the tagging of each
 * item with its job, the newest-first order, and the failure shape.
 */
type Step = { method: string; args: unknown[] }
const calls: Array<{ kind: 'from' | 'rpc'; name: string; args: unknown[]; steps: Step[] }> = []
let route: (kind: 'from' | 'rpc', name: string, args: unknown[]) => { data: unknown; error: { message: string } | null } = () => ({ data: [], error: null })
function recorder(kind: 'from' | 'rpc', name: string, args: unknown[]) {
  const steps: Step[] = []
  calls.push({ kind, name, args, steps })
  const p: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(route(kind, name, args))
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
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: { message: string } | null }>) => {
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
  formatErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}))
type Pack = { data: unknown[]; error: string | null }
const blocks = vi.fn(async (_jobId: string): Promise<Pack> => ({ data: [], error: null }))
const clock = vi.fn(async (_jobId: string): Promise<Pack> => ({ data: [], error: null }))
const events = vi.fn(async (_jobId: string): Promise<Pack> => ({ data: [], error: null }))
vi.mock('./jobScheduleBlocks', () => ({ fetchJobScheduleBlocksForJob: (id: string) => blocks(id) }))
vi.mock('./fetchClockSessionsForJobLedger', () => ({ fetchClockSessionsForJobLedger: (id: string) => clock(id) }))
vi.mock('./fetchJobActivityEventsForJobLedger', () => ({ fetchJobActivityEventsForJobLedger: (id: string) => events(id) }))
// The item mappers have their own suites; here each row becomes a tagged item carrying its sort time.
vi.mock('./jobThreadScheduleActivity', () => ({ scheduleBlocksToScheduleActivityItems: (rows: Array<{ t: number }>) => rows.map((r) => ({ kind: 'schedule', t: r.t })) }))
vi.mock('./jobThreadClockActivity', () => ({ clockSessionsToActivityItems: (rows: Array<{ t: number }>) => rows.map((r) => ({ kind: 'clock', t: r.t })) }))
vi.mock('./jobActivityEventsFromRpc', () => ({ jobActivityEventsFromRpc: (rows: Array<{ t: number }>) => rows.map((r) => ({ kind: 'event', t: r.t })) }))
vi.mock('./reportForViewFromJobLedgerRow', () => ({ reportForViewFromJobLedgerRow: (r: { t: number }) => ({ t: r.t }) }))
vi.mock('./jobThreadActivitySort', () => ({
  activitySortMs: (item: { kind: string; t?: number; note?: { t: number }; report?: { t: number } }) => item.t ?? item.note?.t ?? item.report?.t ?? 0,
}))

import { CUSTOMER_SUMMARY_MAX_JOBS, fetchCustomerSummaryActivity } from './customerSummaryActivity'

const argsOf = (steps: Step[], m: string) => steps.filter((s) => s.method === m).map((s) => s.args)
const job = (over: Record<string, unknown> = {}) => ({ id: 'j1', hcp_number: '1842', click_number: null, job_name: ' Riverside ', job_address: ' 1 Main ', created_at: '2026-09-01', revenue: '1000.5', payments_made: 200, ...over })

beforeEach(() => {
  calls.length = 0
  route = () => ({ data: [], error: null })
  for (const f of [blocks, clock, events]) {
    f.mockReset()
    f.mockResolvedValue({ data: [], error: null })
  }
})

describe('fetchCustomerSummaryActivity', () => {
  it('reads the customer’s jobs newest first, maps them (number, "Job" fallback, numeric money), loads each job’s five sources, tags every item with its job and sorts newest first', async () => {
    route = (kind, name, args) => {
      if (kind === 'from' && name === 'jobs_ledger') return { data: [job(), job({ id: 'j2', hcp_number: null, click_number: 'C9', job_name: null, job_address: null, revenue: null, payments_made: 'x' })], error: null }
      if (kind === 'from' && name === 'jobs_ledger_thread_notes') return { data: [{ id: 'n1', t: 10 }], error: null }
      if (kind === 'rpc' && name === 'list_reports_for_job_ledger') return { data: (args[0] as { p_job_id: string }).p_job_id === 'j1' ? [{ t: 50 }] : [], error: null }
      return { data: [], error: null }
    }
    blocks.mockImplementation(async (id) => ({ data: id === 'j1' ? [{ t: 30 }] : [], error: null }))
    clock.mockImplementation(async (id) => ({ data: id === 'j2' ? [{ t: 40 }] : [], error: null }))
    events.mockImplementation(async () => ({ data: [{ t: 20 }], error: null }))

    const r = await fetchCustomerSummaryActivity('c1')
    const jobs = calls.find((c) => c.name === 'jobs_ledger')!
    expect(argsOf(jobs.steps, 'eq')).toEqual([['customer_id', 'c1']])
    expect(argsOf(jobs.steps, 'order')).toEqual([['created_at', { ascending: false }]])
    const notes = calls.filter((c) => c.name === 'jobs_ledger_thread_notes')
    expect(notes.map((c) => argsOf(c.steps, 'eq'))).toEqual([[['job_id', 'j1']], [['job_id', 'j2']]])
    expect(String(argsOf(notes[0]!.steps, 'select')[0]![0])).toContain('author:users!jobs_ledger_thread_notes_author_user_id_fkey(name)')
    expect(argsOf(notes[0]!.steps, 'order')).toEqual([['created_at', { ascending: true }]])
    expect(calls.filter((c) => c.kind === 'rpc').map((c) => c.args[0])).toEqual([{ p_job_id: 'j1' }, { p_job_id: 'j2' }])
    expect(blocks).toHaveBeenCalledWith('j1')
    expect(clock).toHaveBeenCalledWith('j2')

    expect(r.error).toBeNull()
    expect(r.data.truncated).toBe(false)
    expect(r.data.jobs).toEqual([
      { id: 'j1', numberLabel: '1842', jobName: 'Riverside', jobAddress: '1 Main', revenueDollars: 1000.5, paymentsMadeDollars: 200 },
      { id: 'j2', numberLabel: 'C9', jobName: 'Job', jobAddress: '', revenueDollars: null, paymentsMadeDollars: 0 },
    ])
    expect(r.data.items.map((i) => [i.jobId, i.jobNumberLabel, i.jobAddress, (i.inner as { kind: string }).kind])).toEqual([
      ['j1', '1842', '1 Main', 'report'], // 50
      ['j2', 'C9', '', 'clock'], // 40
      ['j1', '1842', '1 Main', 'schedule'], // 30
      ['j1', '1842', '1 Main', 'event'], // 20
      ['j2', 'C9', '', 'event'], // 20
      ['j1', '1842', '1 Main', 'note'], // 10
      ['j2', 'C9', '', 'note'], // 10
    ])
  })

  it('caps at 60 jobs newest first and says so; a no-id row is dropped', async () => {
    route = (kind, name) => (kind === 'from' && name === 'jobs_ledger' ? { data: [{ id: null }, ...Array.from({ length: CUSTOMER_SUMMARY_MAX_JOBS + 1 }, (_, i) => job({ id: `j${i}` }))], error: null } : { data: [], error: null })
    const r = await fetchCustomerSummaryActivity('c1')
    expect(r.data.jobs).toHaveLength(CUSTOMER_SUMMARY_MAX_JOBS)
    expect(r.data.jobs[0]!.id).toBe('j0')
    expect(r.data.truncated).toBe(true)
    expect(blocks).toHaveBeenCalledTimes(CUSTOMER_SUMMARY_MAX_JOBS)
  })

  it('each per-job source degrades on its own: failed notes / reports read as none, and a source pack with an error contributes nothing', async () => {
    route = (kind, name) => {
      if (kind === 'from' && name === 'jobs_ledger') return { data: [job()], error: null }
      if (kind === 'from' && name === 'jobs_ledger_thread_notes') return { data: null, error: { message: 'notes rls' } }
      if (kind === 'rpc') return { data: null, error: { message: 'reports rls' } }
      return { data: [], error: null }
    }
    blocks.mockResolvedValue({ data: [{ t: 1 }], error: 'blocks rls' })
    clock.mockResolvedValue({ data: [{ t: 2 }], error: null })
    events.mockResolvedValue({ data: [{ t: 3 }], error: 'events rls' })
    const r = await fetchCustomerSummaryActivity('c1')
    expect(r.error).toBeNull()
    expect(r.data.items.map((i) => (i.inner as { kind: string }).kind)).toEqual(['clock'])
  })

  it('a failed jobs read comes back empty with the message; a customer with no jobs comes back empty', async () => {
    route = () => ({ data: null, error: { message: 'jobs rls' } })
    expect(await fetchCustomerSummaryActivity('c1')).toEqual({ data: { jobs: [], items: [], truncated: false }, error: 'jobs rls' })
    route = () => ({ data: null, error: null })
    expect(await fetchCustomerSummaryActivity('c1')).toEqual({ data: { jobs: [], items: [], truncated: false }, error: null })
    expect(blocks).not.toHaveBeenCalled()
  })
})
