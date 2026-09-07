import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The reads behind the Person Desk lifecycle flows (end / start employment):
 * which tables are asked for which kind of person, how each answer becomes a
 * fact, and that an unreadable table degrades to "unknown" rather than a false
 * all-clear. The queue, balance and compliance kernels have their own suites.
 */
type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: (table: string, steps: Step[]) => { data?: unknown; count?: number | null; error: { message: string } | null } = () => ({ data: [], error: null })
vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      queries.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(route(table, steps))
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
const pending = vi.fn(async (_o: { userId: string }): Promise<unknown[]> => [])
vi.mock('./fetchAllPendingClockSessions', () => ({ fetchAllPendingClockSessions: (o: { userId: string }) => pending(o) }))
vi.mock('./approvalsQueue', () => ({ buildApprovalsQueue: (rows: unknown[]) => ({ count: rows.length, hours: rows.length * 2.5 }) }))
vi.mock('./subCompliance', () => ({
  buildSubComplianceBadges: (docs: Array<{ doc_type: string }>) => [
    { state: docs.some((d) => d.doc_type === 'coi') ? 'ok' : 'missing', label: 'COI missing' },
    { state: docs.some((d) => d.doc_type === 'w9') ? 'ok' : 'missing', label: 'W-9 missing' },
  ],
}))
vi.mock('../subLaborOutstanding', () => ({ subLaborJobBalance: (job: { labor_rate: number | null }) => ({ balance: (job.labor_rate ?? 0) * 1.005, backcharges: 0.125 }) }))

import { loadEndEmploymentFacts, loadPayConfigFacts, loadStartEmploymentFacts } from './personDeskFacts'
import type { PersonKey } from './personKey'

const argsOf = (steps: Step[], m: string) => steps.filter((s) => s.method === m).map((s) => s.args)
const isHead = (steps: Step[]) => steps.some((s) => s.method === 'select' && (s.args[1] as { head?: boolean } | undefined)?.head === true)
const q = (table: string) => queries.find((x) => x.table === table)
const key = (over: Partial<PersonKey> = {}): PersonKey => ({ userId: 'u1', personId: 'p1', payName: 'Ana', displayName: 'Ana', email: null, role: 'technician', personKind: 'employee', isSub: false, ...over }) as PersonKey
const payRow = { hourly_wage: 30, office_hourly_wage: null, is_salary: null, record_hours_but_salary: true }
const employeeData: Record<string, unknown> = {
  people_pay_config: payRow,
  clock_sessions: [{ id: 'open-1' }],
  pay_stubs: [{ period_end: '2026-08-29' }],
  vehicle_possessions: [
    { id: 'vp1', vehicle_id: 'v1', start_date: '2026-01-01', vehicles: { year: 2022, make: 'Ford', model: 'F-150' } },
    { id: 'vp2', vehicle_id: 'v2', start_date: '2026-02-01', vehicles: null },
  ],
  housing_possessions: [{ id: 'hp1', start_date: '2026-03-01', housing_units: { address: '9 Elm' } }, { id: 'hp2', start_date: '2026-04-01', housing_units: null }],
  team_leader_assignments: [{ id: 'tl1', leader_user_id: 'L1', users: { name: ' Lee ' } }, { id: 'tl2', leader_user_id: 'L2', users: [{ name: '' }] }],
  step_commitments: [{ status: 'offered' }, { status: 'accepted' }, { status: 'accepted' }],
}

beforeEach(() => {
  queries.length = 0
  route = (table) => ({ data: employeeData[table] ?? [], error: null })
  pending.mockReset()
  pending.mockResolvedValue([{ id: 's1' }, { id: 's2' }])
})

describe('loadPayConfigFacts', () => {
  it('reads the pay row by name; no name → null, no row → exists:false, a row → mapped with booleans coerced, a read error → null (unknown)', async () => {
    expect(await loadPayConfigFacts(null)).toBeNull()
    expect(queries).toHaveLength(0)
    expect(await loadPayConfigFacts('Ana')).toEqual({ exists: true, hourlyWage: 30, officeWage: null, isSalary: false, recordHoursButSalary: true })
    expect(argsOf(q('people_pay_config')!.steps, 'eq')).toEqual([['person_name', 'Ana']])
    expect(q('people_pay_config')!.steps.some((s) => s.method === 'maybeSingle')).toBe(true)
    route = () => ({ data: null, error: null })
    expect(await loadPayConfigFacts('Ana')).toEqual({ exists: false, hourlyWage: null, officeWage: null, isSalary: false, recordHoursButSalary: false })
    route = () => ({ data: null, error: { message: 'rls' } })
    expect(await loadPayConfigFacts('Ana')).toBeNull()
  })
})

describe('loadEndEmploymentFacts', () => {
  it('for an employee with a login: reads sessions, pay stubs, vehicles, housing, leaders and commitments (no sub tables) and maps each into a fact', async () => {
    const facts = await loadEndEmploymentFacts(key(), '2026-09-30', '2026-09-07')
    expect(pending).toHaveBeenCalledWith({ userId: 'u1' })
    const open = q('clock_sessions')!
    expect(argsOf(open.steps, 'eq')).toEqual([['user_id', 'u1']])
    expect(argsOf(open.steps, 'is')).toEqual([
      ['clocked_out_at', null],
      ['revoked_at', null],
    ])
    expect(argsOf(q('pay_stubs')!.steps, 'eq')).toEqual([['person_name', 'Ana']])
    expect(argsOf(q('pay_stubs')!.steps, 'order')).toEqual([['period_end', { ascending: false }]])
    expect(argsOf(q('vehicle_possessions')!.steps, 'is')).toEqual([['end_date', null]])
    expect(argsOf(q('housing_possessions')!.steps, 'or')).toEqual([['end_date.is.null,end_date.gte.2026-09-07']])
    expect(argsOf(q('team_leader_assignments')!.steps, 'eq')).toEqual([['member_user_id', 'u1']])
    expect(argsOf(q('step_commitments')!.steps, 'in')).toEqual([['status', ['offered', 'accepted']]])
    for (const t of ['people_labor_job_assignees', 'sub_portal_links', 'person_contract_documents']) expect(q(t)).toBeUndefined()
    expect(facts).toEqual({
      endDateYmd: '2026-09-30',
      isSub: false,
      hasPayConfig: true,
      openSession: true,
      pendingSessions: { count: 2, hours: 5 },
      lastPayReportEnd: '2026-08-29',
      subBalance: null,
      portalOn: null,
      vehiclesHeld: [
        { possessionId: 'vp1', vehicleId: 'v1', label: '2022 Ford F-150', since: '2026-01-01' },
        { possessionId: 'vp2', vehicleId: 'v2', label: 'Vehicle', since: '2026-02-01' },
      ],
      housing: [
        { possessionId: 'hp1', label: '9 Elm', since: '2026-03-01' },
        { possessionId: 'hp2', label: 'Housing', since: '2026-04-01' },
      ],
      leaders: [
        { assignmentId: 'tl1', name: 'Lee' },
        { assignmentId: 'tl2', name: 'Leader' },
      ],
      workOrders: { offered: 1, accepted: 2 },
      missingDocs: [],
    })
  })

  it('for a sub without a login: sums the sheet balances, checks the portal link and compliance docs, and skips every login-keyed read', async () => {
    route = (table) => {
      if (table === 'people_labor_job_assignees') return { data: [{ labor_job_id: 'lj1', people_labor_jobs: { id: 'lj1', labor_rate: 100, people_labor_job_items: [], people_labor_job_payments: [] } }, { labor_job_id: 'lj2', people_labor_jobs: null }, { labor_job_id: 'lj3', people_labor_jobs: { id: 'lj3', labor_rate: null, people_labor_job_items: [], people_labor_job_payments: [] } }], error: null }
      if (table === 'sub_portal_links') return { data: [{ id: 'link' }], error: null }
      if (table === 'person_contract_documents') return { data: [{ doc_type: 'coi', status: 'ok', expires_at: null }], error: null }
      return { data: employeeData[table] ?? [], error: null }
    }
    const facts = await loadEndEmploymentFacts(key({ userId: null, personId: 'p2', payName: 'Sub Co', isSub: true }), '2026-09-30', '2026-09-07')
    expect(pending).not.toHaveBeenCalled()
    for (const t of ['clock_sessions', 'vehicle_possessions', 'housing_possessions', 'team_leader_assignments']) expect(q(t)).toBeUndefined()
    expect(argsOf(q('people_labor_job_assignees')!.steps, 'eq')).toEqual([['person_id', 'p2']])
    expect(argsOf(q('sub_portal_links')!.steps, 'is')).toEqual([['revoked_at', null]])
    expect(facts).toMatchObject({
      isSub: true,
      openSession: false,
      pendingSessions: { count: 0, hours: 0 },
      subBalance: { balance: 100.5, backcharges: 0.25, sheets: 2 }, // two readable sheets, rounded to cents
      portalOn: true,
      vehiclesHeld: [],
      housing: [],
      leaders: [],
      missingDocs: ['W-9 missing'],
    })
  })

  it('unreadable side tables degrade: a failed pending-sessions fetch counts none, a null portal read means portal off, a sub with no sheets has a zero balance', async () => {
    pending.mockRejectedValueOnce(new Error('rls'))
    route = (table) => (table === 'people_labor_job_assignees' || table === 'sub_portal_links' ? { data: null, error: { message: 'rls' } } : { data: employeeData[table] ?? [], error: null })
    const facts = await loadEndEmploymentFacts(key({ isSub: true }), '2026-09-30', '2026-09-07')
    expect(facts.pendingSessions).toEqual({ count: 0, hours: 0 })
    expect(facts.subBalance).toEqual({ balance: 0, backcharges: 0, sheets: 0 })
    expect(facts.portalOn).toBe(false)
  })
})

describe('loadStartEmploymentFacts', () => {
  it('counts leaders, paperwork, vehicles and housing with head requests and decides the pay / login / roster facts', async () => {
    route = (table, steps) => {
      if (table === 'people') return { data: { start_date: '2026-09-01' }, error: null }
      if (isHead(steps)) return { count: { team_leader_assignments: 1, person_contract_assignments: 0, person_contract_documents: 2, vehicle_possessions: 1, housing_possessions: 0 }[table] ?? 0, error: null }
      return { data: employeeData[table] ?? [], error: null }
    }
    const facts = await loadStartEmploymentFacts(key(), '2026-09-07')
    expect(argsOf(q('people')!.steps, 'eq')).toEqual([['id', 'p1']])
    expect(argsOf(q('person_contract_assignments')!.steps, 'eq')).toEqual([['person_name', 'Ana']])
    expect(argsOf(q('housing_possessions')!.steps, 'or')).toEqual([['end_date.is.null,end_date.gte.2026-09-07']])
    expect(facts).toEqual({ hasRosterRow: true, startDate: '2026-09-01', hasPayConfig: true, payConfigured: true, leaders: 1, paperworkAssigned: true, vehiclesHeld: 1, housing: 0, hasLogin: true })
  })
  it('pay counts as configured only with a salary flag or a positive wage; no roster row or login skips those reads and null counts read as zero', async () => {
    route = (table, steps) => (isHead(steps) ? { count: null, error: null } : { data: table === 'people_pay_config' ? { hourly_wage: 0, office_hourly_wage: null, is_salary: false, record_hours_but_salary: false } : null, error: null })
    const facts = await loadStartEmploymentFacts(key({ userId: null, personId: null }), '2026-09-07')
    expect(q('people')).toBeUndefined()
    expect(q('team_leader_assignments')).toBeUndefined()
    expect(facts).toEqual({ hasRosterRow: false, startDate: null, hasPayConfig: true, payConfigured: false, leaders: 0, paperworkAssigned: false, vehiclesHeld: 0, housing: 0, hasLogin: false })
    route = (table, steps) => (isHead(steps) ? { count: 0, error: null } : { data: table === 'people_pay_config' ? { hourly_wage: null, office_hourly_wage: null, is_salary: true, record_hours_but_salary: false } : null, error: null })
    expect((await loadStartEmploymentFacts(key({ userId: null, personId: null }), '2026-09-07')).payConfigured).toBe(true)
  })
})
