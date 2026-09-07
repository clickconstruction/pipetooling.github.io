import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The ONE 90-day overhead scan (Overhead tab, Dashboard card, Bridge, job day
 * ledger). The kernels it composes have their own suites; this pins the
 * composition: the window, the three session queries and the invoice query it
 * sends, the parts loader hand-off, the error semantics (core throws, salary
 * fails soft), cancellation, and that the per-day maps and averages line up
 * with hand-computed numbers from a tiny scenario.
 */
type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: (table: string, steps: Step[]) => unknown = () => []
vi.mock('./supabase', () => ({
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
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: null }>) => (await op()).data,
}))
const partsLoader = vi.fn(async (_args: { officeJobLedgerId: string; startYmd: string; endYmd: string }) => ({
  partsUsdByDay: new Map<string, number>([['2026-09-07', 50]]),
  partsDetailByDay: new Map([['2026-09-07', [{ memo: 'Ferguson', usd: 50 }]]]),
  bucketByTxId: new Map([['tx1', 'materials']]),
}))
vi.mock('./overheadPartsBucketLoader', () => ({ loadOfficePartsUsdByDayExcludingInternalTransfer: (a: never) => partsLoader(a) }))
vi.mock('./overheadOfficeJobSettings', () => ({ fetchOverheadOfficeJobLedgerIdFromAppSettings: async () => 'office' }))

import { buildOverheadWageLookups, loadOverheadPoolSnapshot, loadOverheadPoolSnapshotInputs } from './overheadPoolSnapshot'

const has = (steps: Step[], m: string, first?: unknown) => steps.some((s) => s.method === m && (first === undefined || s.args[0] === first))
const argsOf = (steps: Step[], m: string) => steps.filter((s) => s.method === m).map((s) => s.args)
const kind = (steps: Step[]) => (has(steps, 'eq', 'origin') ? 'salary' : has(steps, 'or') || has(steps, 'not', 'bid_id') ? 'office' : 'field')

const session = (over: Record<string, unknown>) => ({
  id: 's',
  user_id: 'u1',
  work_date: '2026-09-06',
  clocked_in_at: '2026-09-06T13:00:00Z',
  clocked_out_at: '2026-09-06T17:00:00Z',
  job_ledger_id: null,
  bid_id: null,
  approved_at: '2026-09-06T20:00:00Z',
  rejected_at: null,
  revoked_at: null,
  users: { name: 'Ana' },
  ...over,
})
const officeSessions = [
  session({ id: 'o1', job_ledger_id: 'office' }), // 4 h × $40 office rate = $160 on 9/6
  session({ id: 'o2', bid_id: 'b1', work_date: '2026-09-07', clocked_in_at: '2026-09-07T13:00:00Z', clocked_out_at: '2026-09-07T15:00:00Z' }), // 2 h × $40 = $80 on 9/7
  session({ id: 'o3', job_ledger_id: 'office', rejected_at: '2026-09-06T21:00:00Z' }), // rejected: ignored
]
const fieldSessions = [
  session({ id: 'f1', job_ledger_id: 'j1', clocked_in_at: '2026-09-06T12:00:00Z', clocked_out_at: '2026-09-06T20:00:00Z' }), // 8 h × $30 field rate = $240 on 9/6
  session({ id: 'f2', job_ledger_id: 'j1', user_id: 'u2', users: { name: 'Bob' }, work_date: '2026-09-07', clocked_in_at: '2026-09-07T13:00:00Z', clocked_out_at: '2026-09-07T15:00:00Z' }), // 2 h, no wage → $0
  session({ id: 'f3', job_ledger_id: 'j1', work_date: '2026-09-07', approved_at: null, clocked_in_at: '2026-09-07T16:00:00Z', clocked_out_at: '2026-09-07T19:00:00Z' }), // pending, 3 h
  session({ id: 'f4', job_ledger_id: 'j1', work_date: '2026-09-07', approved_at: null, clocked_out_at: null }), // still open: not pending hours
]
const invoices = [
  { amount: 1000, sent_to_customer_at: '2026-09-06T15:00:00Z' },
  { amount: 500, sent_to_customer_at: '2026-09-07T04:30:00Z' }, // 11:30 PM Chicago on 9/6
]
let salaryRows: unknown[] | (() => never) = []
const routeScenario = (table: string, steps: Step[]): unknown => {
  if (table === 'clock_sessions') {
    const k = kind(steps)
    if (k === 'salary') return typeof salaryRows === 'function' ? salaryRows() : salaryRows
    return k === 'office' ? officeSessions : fieldSessions
  }
  if (table === 'jobs_ledger_invoices') return invoices
  return []
}
const inputs = () => ({
  officeJobLedgerId: 'office' as string | null,
  wageLookup: buildOverheadWageLookups([{ person_name: 'Ana', person_id: 'p1', hourly_wage: 30, office_hourly_wage: 40, is_salary: false }]),
  personIdByUserId: new Map([['u1', 'p1']]),
})

beforeEach(() => {
  queries.length = 0
  partsLoader.mockClear()
  salaryRows = []
  route = routeScenario
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-07T18:00:00Z')) // 1 PM Chicago
})
afterEach(() => vi.useRealTimers())

describe('loadOverheadPoolSnapshot', () => {
  it('anchors a 90-day window on the company calendar and sends the three session queries and the invoice query', async () => {
    const snap = (await loadOverheadPoolSnapshot(inputs()))!
    expect(snap.windowStart).toBe('2026-06-10')
    expect(snap.windowEnd).toBe('2026-09-07')

    const sessionQs = queries.filter((q) => q.table === 'clock_sessions')
    expect(sessionQs.map((q) => kind(q.steps)).sort()).toEqual(['field', 'office', 'salary'])
    for (const q of sessionQs) {
      expect(argsOf(q.steps, 'gte')).toEqual([['work_date', '2026-06-10']])
      expect(argsOf(q.steps, 'lte')).toEqual([['work_date', '2026-09-07']])
      expect(argsOf(q.steps, 'order')).toEqual([['id']])
      expect(argsOf(q.steps, 'range')).toEqual([[0, 999]]) // paged
      expect(String(argsOf(q.steps, 'select')[0]![0])).toContain('users!clock_sessions_user_id_fkey(name)')
    }
    const office = sessionQs.find((q) => kind(q.steps) === 'office')!
    expect(argsOf(office.steps, 'or')).toEqual([['job_ledger_id.eq.office,bid_id.not.is.null']])
    const field = sessionQs.find((q) => kind(q.steps) === 'field')!
    expect(argsOf(field.steps, 'not')).toEqual([['job_ledger_id', 'is', null]])
    expect(argsOf(field.steps, 'neq')).toEqual([['job_ledger_id', 'office']])
    const salary = sessionQs.find((q) => kind(q.steps) === 'salary')!
    expect(argsOf(salary.steps, 'eq')).toEqual([['origin', 'salary_schedule']])
    expect(argsOf(salary.steps, 'is')).toEqual([
      ['job_ledger_id', null],
      ['bid_id', null],
    ])

    const inv = queries.find((q) => q.table === 'jobs_ledger_invoices')!
    expect(argsOf(inv.steps, 'gte')).toEqual([['sent_to_customer_at', '2026-06-09T00:00:00-00:00']]) // a day wide on both sides
    expect(argsOf(inv.steps, 'lt')).toEqual([['sent_to_customer_at', '2026-09-09T00:00:00-00:00']])
    expect(argsOf(inv.steps, 'or')).toEqual([['stripe_mode.is.null,stripe_mode.neq.test']])

    expect(partsLoader).toHaveBeenCalledWith({ officeJobLedgerId: 'office', startYmd: '2026-06-10', endYmd: '2026-09-07' })
  })

  it('prices the pool and the field denominators per day and rolls them into the averages and rate methods', async () => {
    const snap = (await loadOverheadPoolSnapshot(inputs()))!
    expect([...snap.poolUsdByDay]).toEqual([
      ['2026-09-06', 160],
      ['2026-09-07', 130], // $80 bid labor + $50 office parts
    ])
    expect([...snap.fieldLaborUsdByDay]).toEqual([
      ['2026-09-06', 240],
      ['2026-09-07', 0], // Bob has no wage: hours count, dollars do not
    ])
    expect([...snap.fieldHoursByDay]).toEqual([
      ['2026-09-06', 8],
      ['2026-09-07', 2],
    ])
    expect(snap.avg.avg90).toBeCloseTo(290 / 90, 6)
    expect(snap.avg.avg30).toBeCloseTo(290 / 30, 6)
    expect(snap.avg.avg7).toBeCloseTo(290 / 7, 6)
    expect(snap.avg.per100_90).toBeCloseTo((290 / 1500) * 100, 6) // both invoices land on 9/6 Chicago time
    expect(snap.rates).toEqual({ methodA: 29, methodB: 290 / 1500, methodC: 290 / 240 })
    expect(snap.lensDetail.denominators).toEqual({ fieldHours: 10, invoicedRevenueUsd: 1500, fieldLaborUsd: 240 })
    expect(snap.lensDetail.pendingFieldHours).toBe(3)
    expect(snap.lensDetail.overlapSessions).toBe(0)
    expect(snap.unassignedSalaryError).toBeNull()
    expect(snap.hygiene.unassignedSalary).not.toBeNull()
    expect(snap.peopleLines.labor.map((l) => [l.workDate, l.userName, l.bucket, l.hours, l.laborUsd])).toEqual([
      ['2026-09-06', 'Ana', 'office', 4, 160],
      ['2026-09-07', 'Ana', 'bid', 2, 80],
    ])
    expect(snap.peopleLines.parts).toEqual([{ workDate: '2026-09-07', line: { memo: 'Ferguson', usd: 50 } }])
    expect([...snap.peopleLines.bucketByTxId]).toEqual([['tx1', 'materials']])
    expect(snap.peopleLines.endYmd).toBe('2026-09-07')
    expect(Object.keys(snap.lensDetail.series)).toEqual(['A', 'B', 'C'])
  })

  it('counts an approved session on both a bid and a real field job as an overlap', async () => {
    route = (table, steps) =>
      table === 'clock_sessions' && kind(steps) === 'office'
        ? [...officeSessions, session({ id: 'x', bid_id: 'b1', job_ledger_id: 'j1', work_date: '2026-09-05' })]
        : routeScenario(table, steps)
    const snap = (await loadOverheadPoolSnapshot(inputs()))!
    expect(snap.lensDetail.overlapSessions).toBe(1)
  })

  it('without an office job: bid sessions only, no field exclusion, and no parts loader', async () => {
    const snap = (await loadOverheadPoolSnapshot({ ...inputs(), officeJobLedgerId: null }))!
    const office = queries.filter((q) => q.table === 'clock_sessions').find((q) => kind(q.steps) === 'office')!
    expect(has(office.steps, 'or')).toBe(false)
    expect(argsOf(office.steps, 'not')).toEqual([['bid_id', 'is', null]])
    const field = queries.filter((q) => q.table === 'clock_sessions').find((q) => kind(q.steps) === 'field')!
    expect(has(field.steps, 'neq')).toBe(false)
    expect(partsLoader).not.toHaveBeenCalled()
    expect(snap.peopleLines.parts).toEqual([])
    expect(snap.poolUsdByDay.get('2026-09-07')).toBe(80) // no parts
  })

  it('a failed unassigned-salary read fails soft: the snapshot still comes back with the error attached and that indicator hidden', async () => {
    salaryRows = () => {
      throw new Error('salary rls')
    }
    const snap = (await loadOverheadPoolSnapshot(inputs()))!
    expect((snap.unassignedSalaryError as Error).message).toBe('salary rls')
    expect(snap.hygiene.unassignedSalary).toBeNull()
    expect(snap.avg.avg90).toBeCloseTo(290 / 90, 6)
  })

  it('a failed core read throws to the caller', async () => {
    route = (table, steps) => {
      if (table === 'clock_sessions' && kind(steps) === 'field') throw new Error('field down')
      return routeScenario(table, steps)
    }
    await expect(loadOverheadPoolSnapshot(inputs())).rejects.toThrow('field down')
    route = (table, steps) => {
      if (table === 'jobs_ledger_invoices') throw new Error('invoices down')
      return routeScenario(table, steps)
    }
    await expect(loadOverheadPoolSnapshot(inputs())).rejects.toThrow('invoices down')
  })

  it('a cancelled load returns null before the invoice read', async () => {
    expect(await loadOverheadPoolSnapshot(inputs(), { isCancelled: () => true })).toBeNull()
    expect(queries.some((q) => q.table === 'jobs_ledger_invoices')).toBe(false)
  })
})

describe('loadOverheadPoolSnapshotInputs', () => {
  it('loads the office job id, the wage lookups from pay config, and the users → people link map', async () => {
    route = (table) => {
      if (table === 'people_pay_config') return [{ person_name: 'Ana', person_id: 'p1', hourly_wage: 30, office_hourly_wage: 40, is_salary: false }]
      if (table === 'people') return [{ id: 'p1', account_user_id: 'u1' }, { id: 'p2', account_user_id: null }]
      return []
    }
    const r = await loadOverheadPoolSnapshotInputs()
    expect(r.officeJobLedgerId).toBe('office')
    expect(r.wageLookup.byPersonId.get('p1')).toEqual({ fieldWage: 30, officeWage: 40 })
    expect(r.wageLookup.byName.size).toBe(1)
    expect([...r.personIdByUserId]).toEqual([['u1', 'p1']])
    const pay = queries.find((q) => q.table === 'people_pay_config')!
    expect(argsOf(pay.steps, 'order')).toEqual([['person_name']])
    const people = queries.find((q) => q.table === 'people')!
    expect(argsOf(people.steps, 'not')).toEqual([['account_user_id', 'is', null]])
    expect(argsOf(people.steps, 'is')).toEqual([['archived_at', null]])
  })
  it('a failed people read degrades to an empty link map; a failed pay-config read throws', async () => {
    route = (table) => {
      if (table === 'people') throw new Error('people rls')
      return []
    }
    expect((await loadOverheadPoolSnapshotInputs()).personIdByUserId.size).toBe(0)
    route = (table) => {
      if (table === 'people_pay_config') throw new Error('pay rls')
      return []
    }
    await expect(loadOverheadPoolSnapshotInputs()).rejects.toThrow('pay rls')
  })
})
