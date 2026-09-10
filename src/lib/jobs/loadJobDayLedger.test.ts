import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The job day ledger loader (Job Summary → Days / Timeline). The kernel
 * (`buildJobDayLedger`) and the labor builders have their own suites; this
 * pins the loader: the queries it sends for a window, the parts hand-off,
 * pending hours, invoiced revenue, the touched-job labels, status spans and
 * prior hours, cancellation at each checkpoint, and fail-soft vs throw.
 */
type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: (table: string, steps: Step[]) => unknown = () => []
vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      queries.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') {
              return (resolve: (v: { data: unknown; error: null }) => void, reject: (e: unknown) => void) => {
                try {
                  resolve({ data: route(table, steps), error: null })
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
    },
  },
}))
vi.mock('../../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: null }>) => (await op()).data,
}))
const partsLoader = vi.fn(async (_a: { officeJobLedgerId: string; startYmd: string; endYmd: string }) => ({
  partsUsdByDay: new Map([['2026-09-03', 50]]),
  partsDetailByDay: new Map(),
  bucketByTxId: new Map(),
}))
vi.mock('../overheadPartsBucketLoader', () => ({ loadOfficePartsUsdByDayExcludingInternalTransfer: (a: never) => partsLoader(a) }))
const loadInputs = vi.fn()
vi.mock('../overheadPoolSnapshot', async (orig) => ({ ...(await orig<typeof import('../overheadPoolSnapshot')>()), loadOverheadPoolSnapshotInputs: () => loadInputs() }))

import { buildOverheadWageLookups } from '../overheadPoolSnapshot'
import { loadJobDayLedger } from './loadJobDayLedger'

const argsOf = (steps: Step[], m: string) => steps.filter((s) => s.method === m).map((s) => s.args)
const has = (steps: Step[], m: string, first?: unknown) => steps.some((s) => s.method === m && (first === undefined || s.args[0] === first))
const session = (over: Record<string, unknown>) => ({
  id: 's',
  user_id: 'u-ana',
  work_date: '2026-09-02',
  clocked_in_at: '2026-09-02T12:00:00Z',
  clocked_out_at: '2026-09-02T20:00:00Z',
  job_ledger_id: 'j1',
  bid_id: null,
  approved_at: '2026-09-02T21:00:00Z',
  rejected_at: null,
  revoked_at: null,
  notes: null,
  users: { name: 'Ana' },
  ...over,
})
const overheadSessions = [session({ id: 'o1', job_ledger_id: 'office', work_date: '2026-09-01', clocked_in_at: '2026-09-01T13:00:00Z', clocked_out_at: '2026-09-01T17:00:00Z' })] // 4 h × $40 = $160 on 9/1
const fieldSessions = [
  session({ id: 'f1' }), // Ana, j1, 8 h × $30 = $240 on 9/2
  session({ id: 'f2', user_id: 'u-bob', users: { name: 'Bob' }, job_ledger_id: 'j2', work_date: '2026-09-03', clocked_in_at: '2026-09-03T13:00:00Z', clocked_out_at: '2026-09-03T15:00:00Z' }), // 2 h, no wage
  session({ id: 'f3', user_id: 'u-cy', users: { name: 'Cy' }, job_ledger_id: 'j3', work_date: '2026-09-03', clocked_in_at: '2026-09-03T13:00:00Z', clocked_out_at: '2026-09-03T14:00:00Z' }), // 1 h, no wage
  session({ id: 'f4', work_date: '2026-09-03', approved_at: null, clocked_in_at: '2026-09-03T16:00:00Z', clocked_out_at: '2026-09-03T19:00:00Z' }), // pending, 3 h
  session({ id: 'f5', user_id: 'u-bob', job_ledger_id: 'j2', work_date: '2026-09-03', approved_at: null, clocked_out_at: null }), // still open
]
const kind = (steps: Step[]) => (has(steps, 'lt', 'work_date') ? 'prior' : has(steps, 'or') || has(steps, 'not', 'bid_id') ? 'overhead' : 'field')
const routeScenario = (table: string, steps: Step[]): unknown => {
  switch (table) {
    case 'clock_sessions': {
      const k = kind(steps)
      if (k === 'overhead') return overheadSessions
      if (k === 'field') return fieldSessions
      return [
        { job_ledger_id: 'j1', clocked_in_at: '2026-08-20T12:00:00Z', clocked_out_at: '2026-08-20T14:00:00Z' },
        { job_ledger_id: 'j1', clocked_in_at: '2026-08-21T12:00:00Z', clocked_out_at: '2026-08-21T13:30:00Z' },
        { job_ledger_id: 'j1', clocked_in_at: '2026-08-22T12:00:00Z', clocked_out_at: null },
        { job_ledger_id: null, clocked_in_at: '2026-08-22T12:00:00Z', clocked_out_at: '2026-08-22T13:00:00Z' },
      ]
    }
    case 'jobs_ledger_invoices':
      return [
        { amount: 1000, sent_to_customer_at: '2026-09-02T15:00:00Z' },
        { amount: 500, sent_to_customer_at: '2026-09-04T04:30:00Z' }, // 11:30 PM Chicago on 9/3: in the window
        { amount: 700, sent_to_customer_at: '2026-09-04T15:00:00Z' }, // 9/4: fetched (day-wide), bucketed out
      ]
    case 'jobs_ledger':
      return [
        { id: 'j1', hcp_number: '1842', click_number: null, job_name: ' Riverside ', status: 'working' },
        { id: 'j2', hcp_number: '', click_number: ' ', job_name: null, status: null },
      ]
    case 'job_status_events':
      return [
        { job_id: 'j1', to_status: 'paid', changed_at: '2026-09-10T12:00:00Z' },
        { job_id: 'j1', to_status: 'working', changed_at: '2026-08-01T12:00:00Z' },
        { job_id: 'j1', to_status: 'billed', changed_at: '2026-09-05T03:00:00Z' }, // 10 PM Chicago on 9/4
        { job_id: 'j1', to_status: 'ready_to_bill', changed_at: '2026-09-02T12:00:00Z' },
        { job_id: 'j2', to_status: 'waiting', changed_at: '2026-08-15T12:00:00Z' }, // not a span status: ignored
        { job_id: 'j2', to_status: 'paid', changed_at: '2026-09-06T12:00:00Z' },
      ]
    default:
      return []
  }
}
const inputs = () => ({
  officeJobLedgerId: 'office' as string | null,
  wageLookup: buildOverheadWageLookups([{ person_name: 'Ana', person_id: 'p1', hourly_wage: 30, office_hourly_wage: 40, is_salary: false }]),
  personIdByUserId: new Map([['u-ana', 'p1']]),
})
const window = { startYmd: '2026-09-01', endYmd: '2026-09-03' }

beforeEach(() => {
  queries.length = 0
  route = routeScenario
  partsLoader.mockClear()
  loadInputs.mockReset()
  loadInputs.mockResolvedValue(inputs())
})

describe('loadJobDayLedger', () => {
  it('sends the overhead, field, invoice, label, status-event and prior-hours queries for the window', async () => {
    const ledger = (await loadJobDayLedger({ ...window, leadDays: 0, inputs: inputs() }))!
    expect(loadInputs).not.toHaveBeenCalled()
    const sessions = queries.filter((q) => q.table === 'clock_sessions')
    expect(sessions.map((q) => kind(q.steps))).toEqual(['overhead', 'field', 'prior'])
    const [overhead, field, prior] = sessions
    for (const q of [overhead!, field!]) {
      expect(argsOf(q.steps, 'gte')).toEqual([['work_date', '2026-09-01']])
      expect(argsOf(q.steps, 'lte')).toEqual([['work_date', '2026-09-03']])
      expect(argsOf(q.steps, 'range')).toEqual([[0, 999]])
      expect(String(argsOf(q.steps, 'select')[0]![0])).toContain('notes, users!clock_sessions_user_id_fkey(name)')
    }
    expect(argsOf(overhead!.steps, 'or')).toEqual([['job_ledger_id.eq.office,bid_id.not.is.null']])
    expect(argsOf(field!.steps, 'not')).toEqual([['job_ledger_id', 'is', null]])
    expect(argsOf(field!.steps, 'neq')).toEqual([['job_ledger_id', 'office']])
    expect(partsLoader).toHaveBeenCalledWith({ officeJobLedgerId: 'office', startYmd: '2026-09-01', endYmd: '2026-09-03' })

    const inv = queries.find((q) => q.table === 'jobs_ledger_invoices')!
    expect(argsOf(inv.steps, 'gte')).toEqual([['sent_to_customer_at', '2026-08-31T00:00:00-00:00']])
    expect(argsOf(inv.steps, 'lt')).toEqual([['sent_to_customer_at', '2026-09-05T00:00:00-00:00']])
    expect(argsOf(inv.steps, 'or')).toEqual([['stripe_mode.is.null,stripe_mode.neq.test']])

    expect(argsOf(queries.find((q) => q.table === 'jobs_ledger')!.steps, 'in')).toEqual([['id', ['j1', 'j2', 'j3']]])
    expect(argsOf(queries.find((q) => q.table === 'job_status_events')!.steps, 'in')).toEqual([['job_id', ['j1', 'j2', 'j3']]])
    expect(argsOf(prior!.steps, 'in')).toEqual([['job_ledger_id', ['j1', 'j2', 'j3']]])
    expect(argsOf(prior!.steps, 'lt')).toEqual([['work_date', '2026-09-01']])
    expect(argsOf(prior!.steps, 'not')).toEqual([
      ['approved_at', 'is', null],
      ['clocked_out_at', 'is', null],
    ])
    expect(argsOf(prior!.steps, 'is')).toEqual([
      ['rejected_at', null],
      ['revoked_at', null],
    ])
    expect(ledger.startYmd).toBe('2026-09-01')
    expect(ledger.leadDays).toEqual([])
  })

  it('fetches the lead-in before the window for sessions and parts only (v2.3258), and keeps invoices, pending and prior hours window-scoped', async () => {
    const ledger = (await loadJobDayLedger({ ...window, leadDays: 14, inputs: inputs() }))!
    const sessions = queries.filter((q) => q.table === 'clock_sessions')
    const [overhead, field, prior] = sessions
    for (const q of [overhead!, field!]) {
      expect(argsOf(q.steps, 'gte')).toEqual([['work_date', '2026-08-18']])
      expect(argsOf(q.steps, 'lte')).toEqual([['work_date', '2026-09-03']])
    }
    expect(partsLoader).toHaveBeenCalledWith({ officeJobLedgerId: 'office', startYmd: '2026-08-18', endYmd: '2026-09-03' })
    const inv = queries.find((q) => q.table === 'jobs_ledger_invoices')!
    expect(argsOf(inv.steps, 'gte')).toEqual([['sent_to_customer_at', '2026-08-31T00:00:00-00:00']])
    expect(argsOf(prior!.steps, 'lt')).toEqual([['work_date', '2026-09-01']])
    // The window's day rows are unchanged; the lead sits beside them.
    expect(ledger.days.map((d) => d.ymd)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03'])
    expect(ledger.leadDays!.map((d) => d.ymd)).toEqual(Array.from({ length: 14 }, (_, i) => `2026-08-${String(18 + i).padStart(2, '0')}`))
    expect(ledger.leadDays!.every((d) => d.poolUsd === 0 && d.fieldHours === 0)).toBe(true)
  })

  it('assembles the ledger: zero-filled days, pool and field per day, pending hours, revenue, labels, spans, prior hours and rates', async () => {
    const ledger = (await loadJobDayLedger({ ...window, leadDays: 0, inputs: inputs() }))!
    expect(ledger.days.map((d) => [d.ymd, d.poolUsd, d.fieldHours, d.fieldLaborUsd])).toEqual([
      ['2026-09-01', 160, 0, 0],
      ['2026-09-02', 0, 8, 240],
      ['2026-09-03', 50, 3, 0], // parts only; Bob and Cy have no wage
    ])
    expect([...ledger.jobs.keys()].sort()).toEqual(['j1', 'j2', 'j3'])
    expect(ledger.totals).toEqual({ poolUsd: 210, fieldHours: 11, fieldLaborUsd: 240, invoicedRevenueUsd: 1500 })
    expect(ledger.rates).toEqual({ methodA: 210 / 11, methodB: 210 / 1500, methodC: 210 / 240 })
    expect(ledger.pendingFieldSessions).toBe(1)
    expect(ledger.pendingFieldHours).toBe(3)
    expect([...ledger.jobLabels]).toEqual([
      ['j1', { number: '1842', name: 'Riverside', status: 'working' }],
      ['j2', { number: '—', name: '', status: null }], // no HCP and no Click number
    ])
    expect([...ledger.statusSpansByJob]).toEqual([
      ['j1', { startYmd: '2026-08-01', endYmd: '2026-09-04', billedYmd: '2026-09-04', paidYmd: '2026-09-10' }], // events sorted first; billed at 10 PM Chicago lands on 9/4
      ['j2', { startYmd: '2026-09-06', endYmd: '2026-09-06', billedYmd: null, paidYmd: '2026-09-06' }], // "waiting" is not a span status; a first "paid" opens and closes the span
    ])
    expect([...ledger.priorHoursByJob]).toEqual([['j1', 3.5]]) // the open prior session counts nothing; job-less rows are skipped
    expect(ledger.officeJobLedgerId).toBe('office')
  })

  it('loads the snapshot inputs itself when none are passed', async () => {
    await loadJobDayLedger(window)
    expect(loadInputs).toHaveBeenCalledTimes(1)
  })

  it('without an office job: bid sessions are the pool, no field exclusion, no parts loader', async () => {
    const ledger = (await loadJobDayLedger({ ...window, inputs: { ...inputs(), officeJobLedgerId: null } }))!
    const [overhead, field] = queries.filter((q) => q.table === 'clock_sessions')
    expect(has(overhead!.steps, 'or')).toBe(false)
    expect(argsOf(overhead!.steps, 'not')).toEqual([['bid_id', 'is', null]])
    expect(has(field!.steps, 'neq')).toBe(false)
    expect(partsLoader).not.toHaveBeenCalled()
    expect(ledger.days.map((d) => d.poolUsd)).toEqual([0, 0, 0]) // the office session no longer qualifies and there are no bid sessions
    expect(ledger.officeJobLedgerId).toBeNull()
  })

  it('no touched jobs means no label, event or prior-hours reads', async () => {
    route = (table, steps) => (table === 'clock_sessions' && kind(steps) === 'field' ? [] : routeScenario(table, steps))
    const ledger = (await loadJobDayLedger({ ...window, leadDays: 0, inputs: inputs() }))!
    expect(queries.map((q) => q.table)).toEqual(['clock_sessions', 'clock_sessions', 'jobs_ledger_invoices'])
    expect(ledger.jobs.size).toBe(0)
    expect(ledger.priorHoursByJob.size).toBe(0)
  })

  it('label and status-event reads fail soft; a failed prior-hours read throws', async () => {
    route = (table, steps) => {
      if (table === 'jobs_ledger' || table === 'job_status_events') throw new Error('rls')
      return routeScenario(table, steps)
    }
    const ledger = (await loadJobDayLedger({ ...window, leadDays: 0, inputs: inputs() }))!
    expect(ledger.jobLabels.size).toBe(0)
    expect(ledger.statusSpansByJob.size).toBe(0)
    expect([...ledger.priorHoursByJob]).toEqual([['j1', 3.5]])

    route = (table, steps) => {
      if (table === 'clock_sessions' && kind(steps) === 'prior') throw new Error('prior rls')
      return routeScenario(table, steps)
    }
    await expect(loadJobDayLedger({ ...window, leadDays: 0, inputs: inputs() })).rejects.toThrow('prior rls')
  })

  it('cancellation returns null at the first checkpoint reached', async () => {
    expect(await loadJobDayLedger({ ...window, inputs: inputs(), isCancelled: () => true })).toBeNull()
    expect(queries.map((q) => q.table)).toEqual(['clock_sessions', 'clock_sessions'])
    expect(partsLoader).not.toHaveBeenCalled()

    queries.length = 0
    let checks = 0
    expect(await loadJobDayLedger({ ...window, inputs: inputs(), isCancelled: () => ++checks >= 3 })).toBeNull()
    expect(queries.map((q) => q.table)).toEqual(['clock_sessions', 'clock_sessions', 'jobs_ledger_invoices']) // cancelled after the invoice read, before the job lookups
  })
})
