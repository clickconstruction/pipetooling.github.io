import { describe, expect, it } from 'vitest'
import type { SubRows, SubSheetPaymentRow, SubSheetRow, WorkOrderRow } from './residentialLoad'
import { orderLaneId, sheetDayStamps, sheetIsPaid, sheetPaidStamps, subStampsFor, workOrderStamps } from './residentialLoad'
import { SEED_FLOWS } from './seed'

// The sub flow's job lane alone: its Once lane (a sub coming on, spike) is read by subOnboardingLoad.test.ts.
const SUB_JOBS = { ...SEED_FLOWS.sub, lanes: SEED_FLOWS.sub.lanes.filter((l) => l.lane === 'per_job') }
import { readFlow, type FactStamp } from './state'

const NOW = new Date('2026-10-12T17:00:00Z')

// Manny Reyes, a sub, on the Oakridge tie-in (job 1312) and a second sheet on the same house; the mock-up's people.
const sheet = (p: Partial<SubSheetRow> & Pick<SubSheetRow, 'id'>): SubSheetRow => ({
  job_ledger_id: 'job-1312',
  job_number: '1312',
  address: '4120 Oakridge Trl',
  stage: 'working',
  on_site_at: null,
  done_at: null,
  created_at: '2026-10-05T14:00:00Z',
  labor_rate: null,
  ...p,
})
const order = (p: Partial<WorkOrderRow> & Pick<WorkOrderRow, 'id'>): WorkOrderRow => ({
  labor_job_id: 'sheet-tie-in',
  job_id: 'job-1312',
  status: 'offered',
  offered_at: '2026-10-05T15:00:00Z',
  accepted_at: null,
  declined_at: null,
  decline_reason: null,
  created_at: '2026-10-05T14:30:00Z',
  ...p,
})
const pay = (p: Partial<SubSheetPaymentRow> & Pick<SubSheetPaymentRow, 'amount'>): SubSheetPaymentRow => ({
  job_id: 'sheet-tie-in',
  payment_date: '2026-10-09',
  created_at: '2026-10-09T20:00:00Z',
  ...p,
})
const rows = (p: Partial<SubRows> = {}): SubRows => ({
  contact: { id: 'c-manny', kind: 'sub', off_since: null, off_why: null, off_by: null },
  sheets: [sheet({ id: 'sheet-tie-in' })],
  ...p,
})
const facts = (stamps: FactStamp[]) => stamps.map((s) => `${s.fact}@${s.at ?? '-'}`)

describe('flows/load: a sub’s work order', () => {
  it('asks on the offer and says yes on the accept', () => {
    const r = rows({ orders: [order({ id: 'wo-1', status: 'accepted', accepted_at: '2026-10-06T13:00:00Z' })] })
    expect(facts(workOrderStamps(r, 'sheet-tie-in'))).toEqual(['sub_asked@2026-10-05T15:00:00Z', 'sub_said_yes@2026-10-06T13:00:00Z'])
  })

  it('asks nothing once the offer is withdrawn', () => {
    const r = rows({ orders: [order({ id: 'wo-1', status: 'draft', offered_at: null })] })
    expect(workOrderStamps(r, 'sheet-tie-in')).toEqual([])
  })

  it('reads their no while the order still says declined, and not after a re-offer', () => {
    const declined = rows({ orders: [order({ id: 'wo-1', status: 'declined', declined_at: '2026-10-06T09:00:00Z', decline_reason: 'Booked that week' })] })
    expect(facts(workOrderStamps(declined, 'sheet-tie-in'))).toEqual(['sub_asked@2026-10-05T15:00:00Z', 'sub_declined@2026-10-06T09:00:00Z'])
    const reoffered = rows({ orders: [order({ id: 'wo-1', status: 'offered', offered_at: '2026-10-07T10:00:00Z', declined_at: null })] })
    expect(facts(workOrderStamps(reoffered, 'sheet-tie-in'))).toEqual(['sub_asked@2026-10-07T10:00:00Z'])
  })

  it('reads the newest live order on a sheet and leaves a cancelled one out', () => {
    const r = rows({
      orders: [
        order({ id: 'wo-old', status: 'cancelled', offered_at: '2026-10-01T15:00:00Z', created_at: '2026-10-01T14:00:00Z' }),
        order({ id: 'wo-new', status: 'accepted', offered_at: '2026-10-05T15:00:00Z', accepted_at: '2026-10-05T18:00:00Z' }),
      ],
    })
    expect(facts(workOrderStamps(r, 'sheet-tie-in'))).toEqual(['sub_asked@2026-10-05T15:00:00Z', 'sub_said_yes@2026-10-05T18:00:00Z'])
  })

  it('reads a sheet made by hand as agreed outside the app: asked the day it was made, said yes with no day', () => {
    expect(facts(workOrderStamps(rows(), 'sheet-tie-in'))).toEqual(['sub_asked@2026-10-05T14:00:00Z', 'sub_said_yes@-'])
  })
})

describe('flows/load: a sub’s sheet', () => {
  it('reads the two days the sheet keeps', () => {
    expect(facts(sheetDayStamps(sheet({ id: 's', on_site_at: '2026-10-07T13:15:00Z', done_at: '2026-10-08T22:45:00Z' })))).toEqual([
      'sub_on_site@2026-10-07T13:15:00Z',
      'sub_done@2026-10-08T22:45:00Z',
    ])
    expect(sheetDayStamps(sheet({ id: 's' }))).toEqual([])
  })

  it('is paid when its payments cover its lines, a back charge counted, on the newest payment’s day', () => {
    const r = rows({
      items: [{ job_id: 'sheet-tie-in', direct_labor_amount: 1200 }],
      payments: [pay({ amount: 700, payment_date: '2026-10-09' }), pay({ amount: 300, payment_date: '2026-10-10' }), pay({ amount: -200, payment_date: '2026-10-10' })],
    })
    expect(sheetIsPaid(r, r.sheets[0]!)).toBe(true)
    expect(facts(sheetPaidStamps(r, r.sheets[0]!))).toEqual(['sub_paid@2026-10-10'])
  })

  it('is not paid while money is still owed', () => {
    const r = rows({ items: [{ job_id: 'sheet-tie-in', direct_labor_amount: 1200 }], payments: [pay({ amount: 700 })] })
    expect(sheetIsPaid(r, r.sheets[0]!)).toBe(false)
    expect(sheetPaidStamps(r, r.sheets[0]!)).toEqual([])
  })

  it('is not paid with nothing on it, though it balances to 0', () => {
    const r = rows()
    expect(sheetIsPaid(r, r.sheets[0]!)).toBe(false)
  })

  it('reads its own payments only', () => {
    const r = rows({ items: [{ job_id: 'sheet-tie-in', direct_labor_amount: 500 }], payments: [pay({ job_id: 'sheet-other', amount: 500 })] })
    expect(sheetIsPaid(r, r.sheets[0]!)).toBe(false)
  })
})

describe('flows/load: subStampsFor', () => {
  it('gives an order with no sheet yet its own lane, and a draft with no sheet none', () => {
    const r = rows({
      sheets: [],
      orders: [
        order({ id: 'wo-friday', labor_job_id: null, status: 'offered', offered_at: '2026-10-12T20:12:00Z', created_at: '2026-10-12T20:00:00Z' }),
        order({ id: 'wo-draft', labor_job_id: null, status: 'draft', offered_at: null }),
      ],
    })
    const s = subStampsFor(r)
    expect(s.jobIds).toEqual([orderLaneId('wo-friday')])
    expect(facts(s.jobs[orderLaneId('wo-friday')]!.stamps)).toEqual(['sub_asked@2026-10-12T20:12:00Z'])
  })

  it('puts the newest unpaid sheet first, the rest oldest first', () => {
    const r = rows({
      sheets: [
        sheet({ id: 'sheet-rough', created_at: '2026-09-20T14:00:00Z' }),
        sheet({ id: 'sheet-tie-in', created_at: '2026-10-05T14:00:00Z' }),
        sheet({ id: 'sheet-paid', created_at: '2026-10-08T14:00:00Z' }),
      ],
      items: [{ job_id: 'sheet-paid', direct_labor_amount: 400 }],
      payments: [pay({ job_id: 'sheet-paid', amount: 400 })],
    })
    const s = subStampsFor(r)
    expect([s.defaultJobId, ...s.jobIds]).toEqual(['sheet-tie-in', 'sheet-tie-in', 'sheet-rough', 'sheet-paid'])
  })

  it('falls back to the newest lane when every sheet is paid', () => {
    const r = rows({
      sheets: [sheet({ id: 'sheet-a', created_at: '2026-10-01T14:00:00Z' }), sheet({ id: 'sheet-b', created_at: '2026-10-03T14:00:00Z' })],
      items: [{ job_id: 'sheet-a', direct_labor_amount: 100 }, { job_id: 'sheet-b', direct_labor_amount: 100 }],
      payments: [pay({ job_id: 'sheet-a', amount: 100 }), pay({ job_id: 'sheet-b', amount: 100 })],
      orders: [order({ id: 'wo-next', labor_job_id: null, created_at: '2026-10-12T20:00:00Z' })],
    })
    expect(subStampsFor(r).defaultJobId).toBe(orderLaneId('wo-next'))
  })

  it('walks Manny’s tie-in from the work order to the pay', () => {
    const where = (r: SubRows) => {
      const reading = readFlow(SUB_JOBS, subStampsFor(r), NOW)
      const lane = reading.lanes.find((l) => l.jobId === 'sheet-tie-in')!
      return `${reading.nowStepId ?? '-'} · ${lane.steps.map((x) => `${x.stepId}:${x.state}`).join(' ')}${lane.ended ? ` · ended by ${lane.ended}` : ''}`
    }
    const accepted = order({ id: 'wo-1', status: 'accepted', accepted_at: '2026-10-06T13:00:00Z' })
    expect(where(rows({ orders: [order({ id: 'wo-1' })] }))).toBe('yes · asked:done yes:now onsite:next done:later paid:later')
    expect(where(rows({ orders: [accepted] }))).toBe('onsite · asked:done yes:done onsite:now done:next paid:later')
    const worked = rows({
      orders: [accepted],
      sheets: [sheet({ id: 'sheet-tie-in', stage: 'walkthrough', on_site_at: '2026-10-07T13:15:00Z', done_at: '2026-10-08T22:45:00Z' })],
      items: [{ job_id: 'sheet-tie-in', direct_labor_amount: 1200 }],
    })
    expect(where(worked)).toBe('paid · asked:done yes:done onsite:done done:done paid:now')
    expect(where({ ...worked, payments: [pay({ amount: 1200 })] })).toBe('- · asked:done yes:done onsite:done done:done paid:done')
    expect(where(rows({ orders: [order({ id: 'wo-1', status: 'declined', declined_at: '2026-10-06T09:00:00Z' })] }))).toBe(
      '- · asked:done yes:done onsite:later done:later paid:later · ended by sub_declined',
    )
  })

  it('stands a sheet made by hand on On site, not on our work order', () => {
    expect(readFlow(SUB_JOBS, subStampsFor(rows()), NOW).nowStepId).toBe('onsite')
  })

  it('carries the office’s word that they are off the flow', () => {
    const r = rows({ contact: { id: 'c-manny', kind: 'sub', off_since: '2026-10-10', off_why: 'Moved away', off_by: 'u-rosa' }, userNames: { 'u-rosa': 'Rosa' } })
    expect(subStampsFor(r).off).toEqual({ since: '2026-10-10', why: 'Moved away', by: 'Rosa' })
  })
})
