import { describe, expect, it } from 'vitest'
import { isRosterSub, isRosterSubSheet, sheetsNeedingWorkOrder, type NeedsWorkOrderSheet } from './sheetsNeedingWorkOrder'
import type { WorkOrderRowLike } from './workOrderCoverage'

const TODAY = '2026-09-05'
const ROSTER = [
  { id: 'p-tx', name: 'Texas R & A Electrical LLC', kind: 'sub', accountRole: null },
  { id: 'p-mig', name: 'Miguel Rodriguez', kind: 'sub', accountRole: null },
  { id: 'p-edgar', name: 'Edgar', kind: 'sub', accountRole: null },
  { id: 'p-behar', name: 'Behar Kraja', kind: 'sub', accountRole: 'subcontractor' },
  // Teammates: kind 'sub' is the roster row behind a login — the account role is what makes them crew.
  { id: 'p-abe', name: 'Abraham', kind: 'sub', accountRole: 'superintendent' },
  { id: 'p-mal', name: 'Malachi', kind: 'master_technician', accountRole: 'master_technician' },
  { id: 'p-taunya', name: 'Misses Taunya TESTING', kind: 'sub', accountRole: null },
]
const JOBS = [
  { id: 'j-892', hcp_number: '892', customer_name: 'Megan Connell', job_address: '582 Curvatura' },
  { id: 'j-273', hcp_number: '273', customer_name: 'Dudley', job_address: '9703 Lenox' },
]
const sheet = (over: Partial<NeedsWorkOrderSheet> & { id: string }): NeedsWorkOrderSheet => ({
  job_number: '892',
  address: '582 Curvatura',
  assigned_to_name: 'Miguel Rodriguez',
  labor_rate: 50,
  items: [{ count: 1, hrs_per_unit: 0, is_fixed: true, direct_labor_amount: 1750 }],
  payments: [],
  ...over,
})
const order = (over: Partial<WorkOrderRowLike> & { id: string; status: string }): WorkOrderRowLike => ({
  amount: 1750,
  display_name: 'Miguel Rodriguez',
  job_id: null,
  labor_job_id: null,
  step_id: null,
  record_id: null,
  offered_at: null,
  offer_expires_at: null,
  signed_at: null,
  accepted_at: null,
  declined_at: null,
  decline_reason: null,
  created_at: '2026-09-01T00:00:00Z',
  ...over,
})
const run = (sheets: NeedsWorkOrderSheet[], commitments: WorkOrderRowLike[] = [], assignees: Array<[string, string[]]> = []) =>
  sheetsNeedingWorkOrder({ sheets, assigneesBySheetId: new Map(assignees), roster: ROSTER, commitments, jobs: JOBS, todayYmd: TODAY })

describe('sheetsNeedingWorkOrder — money is items minus payments, never the paid stamp', () => {
  it('a fully paid sheet does not need an order (job 892, the reported false positive)', () => {
    expect(run([sheet({ id: 's1', payments: [{ amount: 1750 }] })])).toEqual([])
  })
  it('an open balance counts, with agreed / paid / open on the row', () => {
    const rows = run([sheet({ id: 's1', job_number: '273', assigned_to_name: 'Edgar', items: [{ count: 1, hrs_per_unit: 0, is_fixed: true, direct_labor_amount: 8500 }], payments: [{ amount: 500 }] })])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ sheetId: 's1', jobId: 'j-273', primary: '#273 · Dudley', secondary: '9703 Lenox', agreed: 8500, paid: 500, open: 8000, unpriced: false, subNames: ['Edgar'] })
  })
  it('an unpriced sheet with nothing paid still counts — it is work with no agreement', () => {
    const rows = run([sheet({ id: 's1', items: [], payments: [] })])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ unpriced: true, open: 0, agreed: 0 })
  })
  it('a back-charged sheet that nets to zero is excluded', () => {
    expect(run([sheet({ id: 's1', payments: [{ amount: 1000 }, { amount: -750 }] })])).toEqual([])
  })
})

describe('sheetsNeedingWorkOrder — only roster-sub sheets', () => {
  it('a crew pay sheet (junction to teammates) never needs one — job 1004 as it sits in prod', () => {
    expect(run([sheet({ id: 's1', assigned_to_name: 'Abraham | Misses Taunya TESTING' })], [], [['s1', ['p-abe', 'p-taunya']]])).toEqual([])
  })
  it('a mixed sheet (a teammate and a sub) is crew pay too', () => {
    expect(run([sheet({ id: 's1', assigned_to_name: 'Malachi | Abraham | Behar Kraja' })], [], [['s1', ['p-mal', 'p-abe', 'p-behar']]])).toEqual([])
  })
  it('a sub with a subcontractor login is still a sub', () => {
    expect(run([sheet({ id: 's1', assigned_to_name: 'Behar Kraja', items: [] })], [], [['s1', ['p-behar']]])).toHaveLength(1)
  })
  it('the junction wins over the name column', () => {
    expect(run([sheet({ id: 's1', assigned_to_name: 'Abraham' })], [], [['s1', ['p-mig']]])).toHaveLength(1)
  })
  it('a legacy sheet with no junction resolves its names against the roster', () => {
    expect(run([sheet({ id: 's1', assigned_to_name: 'texas r & a electrical llc', job_number: '977' })])).toHaveLength(1)
    expect(run([sheet({ id: 's2', assigned_to_name: 'Ryan (Garner HVAC)' })])).toEqual([])
    expect(run([sheet({ id: 's3', assigned_to_name: '' })])).toEqual([])
  })
  it('isRosterSubSheet is the one place the rule lives', () => {
    const byId = new Map(ROSTER.map((p) => [p.id, p]))
    const byName = new Map(ROSTER.map((p) => [p.name.toLowerCase(), p]))
    expect(isRosterSubSheet({ id: 'x', assigned_to_name: 'Edgar | Miguel Rodriguez' }, new Map(), byId, byName)).toBe(true)
    expect(isRosterSubSheet({ id: 'x', assigned_to_name: 'Edgar | Abraham' }, new Map(), byId, byName)).toBe(false)
    expect(isRosterSub({ kind: 'sub', accountRole: 'helpers' })).toBe(false)
    expect(isRosterSub({ kind: 'assistant', accountRole: null })).toBe(false)
  })
})

describe('sheetsNeedingWorkOrder — coverage', () => {
  it('a signed order anchored to the sheet covers it', () => {
    expect(run([sheet({ id: 's1' })], [order({ id: 'o1', status: 'accepted', labor_job_id: 's1' })])).toEqual([])
  })
  it('a draft or offer anchored to the sheet\'s job covers every sheet on that job', () => {
    expect(run([sheet({ id: 's1' }), sheet({ id: 's2', assigned_to_name: 'Edgar' })], [order({ id: 'o1', status: 'draft', job_id: 'j-892' })])).toEqual([])
  })
  it('a declined or cancelled order does not cover', () => {
    expect(run([sheet({ id: 's1' })], [order({ id: 'o1', status: 'declined', labor_job_id: 's1' }), order({ id: 'o2', status: 'cancelled', job_id: 'j-892' })])).toHaveLength(1)
  })
  it('an order on another job does not cover', () => {
    expect(run([sheet({ id: 's1' })], [order({ id: 'o1', status: 'accepted', job_id: 'j-273' })])).toHaveLength(1)
  })
})

describe('sheetsNeedingWorkOrder — sheets outside the Pipeline', () => {
  it('labels by the sheet\'s own job number + address and carries no job id', () => {
    const rows = run([sheet({ id: 's1', job_number: '977', address: 'Hospital-415 Springtown Way', assigned_to_name: 'Texas R & A Electrical LLC', items: [{ count: 1, hrs_per_unit: 0, is_fixed: true, direct_labor_amount: 40000 }] })])
    expect(rows[0]).toMatchObject({ jobId: null, jobNumber: '977', primary: '#977', secondary: 'Hospital-415 Springtown Way', open: 40000 })
  })
  it('sorts by open money, then job number', () => {
    const rows = run([
      sheet({ id: 'a', job_number: '892' }),
      sheet({ id: 'b', job_number: '977', assigned_to_name: 'Texas R & A Electrical LLC', items: [{ count: 1, hrs_per_unit: 0, is_fixed: true, direct_labor_amount: 40000 }] }),
      sheet({ id: 'c', job_number: '273', assigned_to_name: 'Edgar' }),
    ])
    expect(rows.map((r) => r.sheetId)).toEqual(['b', 'c', 'a'])
  })
})
