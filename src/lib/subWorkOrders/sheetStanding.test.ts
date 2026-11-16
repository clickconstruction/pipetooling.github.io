import { describe, expect, it } from 'vitest'
import { subLaborJobBalance } from '../subLaborOutstanding'
import type { LaborJob } from '../../types/laborJob'
import type { NeedsWorkOrderRosterPerson } from './rosterSub'
import { buildSheetStandingContext, sheetStanding, teamSheetPayWhen, type StandingJob } from './sheetStanding'

// Made-up people, jobs and sheets.
const ROSTER: NeedsWorkOrderRosterPerson[] = [
  { id: 'marlow', name: 'Marlow Tile', kind: 'sub', accountRole: 'subcontractor' },
  { id: 'dana', name: 'Dana Whitlock', kind: 'sub', accountRole: 'superintendent' },
  { id: 'owen', name: 'Owen Farris', kind: 'helper', accountRole: 'helpers' },
]
const JOBS: StandingJob[] = [{ id: 'job-cedar', hcp_number: '2041', job_name: 'Cedar Hollow Clinic', job_address: '418 Larkspur Ln', invoices: [{ status: 'paid' }] }]
const TODAY = '2026-11-15'

function sheet(id: string, people: string[], amount: number, over: Partial<LaborJob> = {}): LaborJob {
  return {
    id,
    assigned_to_name: people.map((p) => ROSTER.find((r) => r.id === p)!.name).join(' | '),
    job_number: '2041',
    job_ledger_id: 'job-cedar',
    address: '418 Larkspur Ln',
    labor_rate: null,
    job_date: '2026-11-13',
    created_at: '2026-11-13T15:00:00Z',
    stage: 'working',
    items: [{ fixture: 'Flat amount', count: 1, hrs_per_unit: 0, direct_labor_amount: amount }],
    payments: [],
    ...over,
  } as unknown as LaborJob
}

function standing(s: LaborJob, people: string[], rule?: 'owed' | 'payroll') {
  const assignees = new Map([[s.id, people.map((p) => ({ personId: p, personName: ROSTER.find((r) => r.id === p)!.name }))]])
  const ctx = buildSheetStandingContext({ roster: ROSTER, jobs: JOBS, orders: [], assigneesByJobId: assignees, todayYmd: TODAY, rule })
  return sheetStanding(s, subLaborJobBalance(s), ctx)
}

describe('sheetStanding — whose a sheet is, its job, and when it pays', () => {
  it("a sub's sheet: theirs, on its Pipeline job, and it waits as the Pay view says", () => {
    const st = standing(sheet('s1', ['marlow'], 900), ['marlow'])
    expect(st.parties).toMatchObject({ crew: false, label: 'Marlow Tile', key: 'id:marlow' })
    expect(st.job?.job_name).toBe('Cedar Hollow Clinic')
    // Work under way with nothing signed: the Pay view's own "Not payable".
    expect(st.payWhen.kind).toBe('gap')
  })
  it("a teammate's own sheet is ready: no inspection and no customer bill to wait on", () => {
    const st = standing(sheet('s2', ['dana'], 450), ['dana'])
    expect(st.parties.crew).toBe(true)
    expect(st.payWhen).toMatchObject({ kind: 'ready', label: 'Ready', detail: 'sub labor to a teammate · $450.00 with nothing to wait on' })
  })
  it('the old rule read the same sheet as payroll, owed to nobody', () => {
    expect(standing(sheet('s2', ['dana'], 450), ['dana'], 'payroll').payWhen).toMatchObject({ kind: 'crew', label: 'Payroll' })
  })
  it("a teammate's sheet that is paid reads Paid, and one with no price reads Unpriced", () => {
    const paid = sheet('s3', ['dana'], 450, { payments: [{ id: 'p1', amount: 450, memo: null, created_at: '2026-11-14T15:00:00Z' }] } as Partial<LaborJob>)
    expect(standing(paid, ['dana']).payWhen.kind).toBe('paid')
    expect(standing(sheet('s4', ['dana'], 0), ['dana']).payWhen.kind).toBe('unpriced')
  })
  it('several teammates and no sub: shared, so it is not ready by the teammate rule', () => {
    expect(standing(sheet('s5', ['dana', 'owen'], 300), ['dana', 'owen']).payWhen.kind).not.toBe('ready')
  })
})

describe('teamSheetPayWhen — the office can still hold or date it', () => {
  it('a hold wins', () => {
    expect(teamSheetPayWhen({ pay_hold_reason: 'waiting on the count', payable_after: null }, 450, TODAY)).toMatchObject({ kind: 'hold', detail: 'waiting on the count' })
  })
  it('a later day queues it', () => {
    expect(teamSheetPayWhen({ pay_hold_reason: null, payable_after: '2026-11-20' }, 450, TODAY)).toMatchObject({ kind: 'queued', label: 'Queued · 11/20' })
  })
  it('a day that has come is ready', () => {
    expect(teamSheetPayWhen({ pay_hold_reason: null, payable_after: '2026-11-10' }, 450, TODAY).kind).toBe('ready')
  })
})
