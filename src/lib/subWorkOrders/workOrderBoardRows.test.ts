import { describe, expect, it } from 'vitest'
import { buildWorkOrderBoard, workOrderBoardFilterFromParam, workOrderBoardRowMatches, type WorkOrderBoardSheet } from './workOrderBoardRows'
import type { WorkOrderRowLike } from './workOrderCoverage'

const TODAY = '2026-09-05'
const ROSTER = [
  { id: 'p-tx', name: 'Texas R & A Electrical LLC', kind: 'sub', accountRole: null },
  { id: 'p-mig', name: 'Miguel Rodriguez', kind: 'sub', accountRole: null },
  { id: 'p-cale', name: 'Cale Yarbrough', kind: 'sub', accountRole: null },
  { id: 'p-abe', name: 'Abraham', kind: 'sub', accountRole: 'superintendent' },
]
const JOBS = [
  { id: 'j-892', hcp_number: '892', customer_name: 'Megan Connell', job_address: '582 Curvatura' },
  { id: 'j-880', hcp_number: '880', customer_name: 'Knight Contracting', job_address: '150 E Sonterra' },
]
const sheet = (over: Partial<WorkOrderBoardSheet> & { id: string }): WorkOrderBoardSheet => ({
  job_number: '892',
  address: '582 Curvatura',
  assigned_to_name: 'Miguel Rodriguez',
  labor_rate: 50,
  items: [{ count: 1, hrs_per_unit: 0, is_fixed: true, direct_labor_amount: 1750 }],
  payments: [],
  stage: 'working',
  job_date: '2026-08-20',
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
const board = (sheets: WorkOrderBoardSheet[], commitments: WorkOrderRowLike[] = [], assignees: Array<[string, string[]]> = []) =>
  buildWorkOrderBoard({ sheets, assigneesBySheetId: new Map(assignees), roster: ROSTER, commitments, jobs: JOBS, todayYmd: TODAY })

describe('buildWorkOrderBoard — which sheets are rows', () => {
  it('a sub sheet with money open and nothing signed is a no-agreement row with the gap rail', () => {
    const b = board([sheet({ id: 's1', job_number: '977', address: 'Hospital-415 Springtown Way', assigned_to_name: 'Texas R & A Electrical LLC', items: [{ count: 1, hrs_per_unit: 0, is_fixed: true, direct_labor_amount: 40000 }] })])
    expect(b.rows).toHaveLength(1)
    expect(b.rows[0]).toMatchObject({ key: 'sheet:s1', group: 'no_agreement', notInPipeline: true, primary: '#977', secondary: 'Hospital-415 Springtown Way', open: 40000, sheetDate: '2026-08-20' })
    expect(b.rows[0]!.rail.gap).toBe(true)
    expect(b.rows[0]!.next).toMatchObject({ label: 'Get it in writing', button: 'draft' })
    expect(b.tiles).toEqual({ handshakeUsd: 40000, handshakeCount: 1, offersOut: 0, signedThisMonth: 0 })
  })
  it('a paid-up sheet with no order is history — not a row', () => {
    expect(board([sheet({ id: 's1', payments: [{ amount: 1750 }] })]).rows).toEqual([])
  })
  it('a paid-up sheet WITH a signed order sits in Signed, on the Paid dot', () => {
    const b = board([sheet({ id: 's1', payments: [{ amount: 1750 }], stage: 'customer_pay' })], [order({ id: 'o1', status: 'accepted', labor_job_id: 's1', signed_at: '2026-09-05T10:00:00Z', record_id: 'WO-892-01' })])
    expect(b.rows[0]).toMatchObject({ group: 'signed', recordId: 'WO-892-01', commitmentId: 'o1' })
    expect(b.rows[0]!.rail).toMatchObject({ current: 'paid', tone: 'paid' })
    expect(b.rows[0]!.next.label).toBe('Nothing — done')
    expect(b.tiles.signedThisMonth).toBe(1)
  })
  it('crew pay sheets never appear', () => {
    expect(board([sheet({ id: 's1', assigned_to_name: 'Abraham' })], [], [['s1', ['p-abe']]]).rows).toEqual([])
  })
  it('a job-anchored order covers every sheet on the job; a sheet-anchored one covers only its sheet', () => {
    const b = board([sheet({ id: 's1' }), sheet({ id: 's2', assigned_to_name: 'Cale Yarbrough' })], [order({ id: 'o1', status: 'draft', job_id: 'j-892', amount: null })])
    expect(b.rows.map((r) => r.group)).toEqual(['drafted', 'drafted'])
    const b2 = board([sheet({ id: 's1' }), sheet({ id: 's2', assigned_to_name: 'Cale Yarbrough' })], [order({ id: 'o1', status: 'offered', labor_job_id: 's1', job_id: 'j-892', offered_at: '2026-09-04T00:00:00Z' })])
    expect(b2.rows.map((r) => [r.sheetId, r.group])).toEqual([['s2', 'no_agreement'], ['s1', 'sent']])
  })
})

describe('buildWorkOrderBoard — the sub behind a row', () => {
  it('a single junction assignee hands the assembler its sub; a single legacy name resolves through the roster; two names give nothing', () => {
    expect(board([sheet({ id: 's1' })], [], [['s1', ['p-mig']]]).rows[0]!.personId).toBe('p-mig')
    expect(board([sheet({ id: 's2', assigned_to_name: 'Cale Yarbrough' })]).rows[0]!.personId).toBe('p-cale')
    expect(board([sheet({ id: 's3', assigned_to_name: 'Miguel Rodriguez | Cale Yarbrough' })], [], [['s3', ['p-mig', 'p-cale']]]).rows[0]!.personId).toBeNull()
  })
})

describe('buildWorkOrderBoard — orders with no sheet', () => {
  it('a job-anchored draft on a job with no sheets is its own row', () => {
    const b = board([], [order({ id: 'o1', status: 'draft', job_id: 'j-880', amount: null, display_name: 'Cale Yarbrough' })])
    expect(b.rows[0]).toMatchObject({ key: 'order:o1', sheetId: null, jobId: 'j-880', primary: '#880 · Knight Contracting', group: 'drafted', unpriced: true })
    expect(b.rows[0]!.next).toMatchObject({ label: 'Price it and send', button: 'price' })
  })
  it('an unanchored order takes the label the component knows', () => {
    const b = buildWorkOrderBoard({ sheets: [], assigneesBySheetId: new Map(), roster: ROSTER, commitments: [order({ id: 'o1', status: 'offered', step_id: 'st', offered_at: '2026-09-01T00:00:00Z' })], jobs: JOBS, todayYmd: TODAY, orderLabels: new Map([['o1', { primary: 'Rough-in', secondary: 'Project step' }]]) })
    expect(b.rows[0]).toMatchObject({ primary: 'Rough-in', secondary: 'Project step', group: 'sent' })
    expect(b.rows[0]!.next).toMatchObject({ button: 'nudge' })
  })
  it('declined and expired orders fall back into the no-agreement group', () => {
    const b = board([sheet({ id: 's1' })], [order({ id: 'o1', status: 'declined', labor_job_id: 's1', decline_reason: 'too low' })])
    expect(b.rows[0]).toMatchObject({ group: 'no_agreement', commitmentId: 'o1' })
    expect(b.rows[0]!.next).toMatchObject({ button: 'reoffer' })
    expect(b.counts.no_agreement).toBe(1)
  })
})

describe('buildWorkOrderBoard — order and search', () => {
  it('groups in rail order, then further-left dot, then money', () => {
    const b = board(
      [
        sheet({ id: 'a' }),
        sheet({ id: 'b', assigned_to_name: 'Cale Yarbrough', items: [{ count: 1, hrs_per_unit: 0, is_fixed: true, direct_labor_amount: 9000 }] }),
        sheet({ id: 'c', job_number: '880', assigned_to_name: 'Texas R & A Electrical LLC' }),
      ],
      [order({ id: 'o1', status: 'accepted', labor_job_id: 'a' }), order({ id: 'o2', status: 'offered', labor_job_id: 'c', offered_at: '2026-09-05T00:00:00Z' })],
    )
    expect(b.rows.map((r) => r.key)).toEqual(['sheet:b', 'sheet:c', 'sheet:a'])
    expect(b.counts).toEqual({ all: 3, no_agreement: 1, drafted: 0, sent: 1, signed: 1 })
  })
  it('search matches sub, job number, customer, address and WO number', () => {
    const b = board([sheet({ id: 's1' })], [order({ id: 'o1', status: 'accepted', labor_job_id: 's1', record_id: 'WO-892-01' })])
    const row = b.rows[0]!
    for (const q of ['miguel', '892', 'connell', 'curvatura', 'wo-892']) expect(workOrderBoardRowMatches(row, q)).toBe(true)
    expect(workOrderBoardRowMatches(row, 'airfordable')).toBe(false)
  })
  it('legacy ?wof= words map onto rail groups', () => {
    expect(workOrderBoardFilterFromParam('drafts')).toBe('drafted')
    expect(workOrderBoardFilterFromParam('awaiting')).toBe('sent')
    expect(workOrderBoardFilterFromParam('expired')).toBe('no_agreement')
    expect(workOrderBoardFilterFromParam('nope')).toBeNull()
  })
})
