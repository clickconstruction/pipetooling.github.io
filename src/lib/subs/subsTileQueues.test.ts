import { describe, expect, it } from 'vitest'
import type { WorkOrderBoardRow } from '../subWorkOrders/workOrderBoardRows'
import type { SheetRail } from '../subWorkOrders/sheetRail'
import type { SubsJobGroup, SubsStageRow } from './subsTabRows'
import type { SubDispatchOrder } from './subDispatch'
import {
  addCalendarDays,
  availabilityLabel,
  availabilityTone,
  buildHandshakeQueue,
  buildOffersQueue,
  buildSignedQueue,
  buildStagesQueue,
  monthName,
  quickOfferDefaults,
  quickOfferProblem,
  shiftMonth,
  signedCountForMonth,
  signedNextKind,
  subAvailabilityForSpan,
} from './subsTileQueues'

const rail = (current: SheetRail['current'], group: SheetRail['group']): SheetRail => ({ steps: [], current, gap: group === 'no_agreement', group, position: 0, label: '', sublabel: null, tone: 'now', crewPay: false })

function row(over: Partial<WorkOrderBoardRow> & { key: string }): WorkOrderBoardRow {
  return {
    sheetId: null,
    commitmentId: null,
    recordId: null,
    jobId: 'job-1',
    jobNumber: '880',
    primary: '#880 · Knight',
    secondary: null,
    notInPipeline: false,
    subNames: ['Sub'],
    subName: 'Sub',
    personId: 'p-1',
    agreed: 100,
    paid: 0,
    open: 100,
    unpriced: false,
    sheetDate: null,
    coverage: { kind: 'none' },
    rail: rail('work', 'no_agreement'),
    next: { label: '', hint: null, button: null, buttonLabel: null },
    group: 'no_agreement',
    ...over,
  }
}

describe('buildHandshakeQueue', () => {
  it('keeps no-agreement rows, most money first, unpriced last, with the days on a handshake', () => {
    const q = buildHandshakeQueue(
      [
        row({ key: 'a', open: 4200, sheetDate: '2026-09-02' }),
        row({ key: 'b', open: 40000, sheetDate: '2026-08-30', jobId: null }),
        row({ key: 'c', open: 0, unpriced: true }),
        row({ key: 'd', group: 'signed', coverage: { kind: 'signed', id: 'o', subName: 'S', amount: 1, signedOn: '2026-09-01', laborJobId: null, recordId: null } }),
      ],
      '2026-09-06',
    )
    expect(q.rows.map((r) => r.row.key)).toEqual(['b', 'a', 'c'])
    expect(q.openUsd).toBe(44200)
    expect(q.rows[0]).toMatchObject({ daysWorking: 7, needsJob: true, workingSince: '2026-08-30' })
    expect(q.rows[1]!.daysWorking).toBe(4)
  })
})

describe('quickOfferDefaults / quickOfferProblem', () => {
  it('opens on the day they started, ends ten weekdays past today, good for a week, priced from the sheet', () => {
    const d = quickOfferDefaults({ sheetDate: '2026-08-30', todayYmd: '2026-09-06', agreed: 40000, unpriced: false })
    // Aug 30 2026 is a Sunday → the Monday after; Sep 6 2026 is a Sunday → Mon Sep 7 + 10 weekdays = Fri Sep 18.
    expect(d).toEqual({ start: '2026-08-31', end: '2026-09-18', workDays: 10, expires: '2026-09-13', amount: '40000' })
    expect(quickOfferDefaults({ sheetDate: null, todayYmd: '2026-09-06', agreed: 0, unpriced: true }).amount).toBe('')
  })
  it('names the one thing stopping a send', () => {
    const base = { amount: '100', start: '2026-09-07', end: '2026-09-18', expires: '2026-09-13', todayYmd: '2026-09-06', hasJob: true }
    expect(quickOfferProblem(base)).toBeNull()
    expect(quickOfferProblem({ ...base, hasJob: false })).toMatch(/job/)
    expect(quickOfferProblem({ ...base, amount: '' })).toMatch(/price/)
    expect(quickOfferProblem({ ...base, end: '2026-09-01' })).toMatch(/ends before/)
    expect(quickOfferProblem({ ...base, start: '2026-08-01', end: '2026-08-20' })).toMatch(/behind/)
    expect(quickOfferProblem({ ...base, expires: '2026-09-01' })).toMatch(/expire/)
  })
  it('adds calendar days', () => {
    expect(addCalendarDays('2026-09-28', 7)).toBe('2026-10-05')
  })
})

describe('buildStagesQueue', () => {
  const stage = (id: string, start: string | null, end: string | null, asked = false): SubsStageRow => ({
    key: `stage:${id}`,
    kind: 'stage',
    jobId: 'job-1',
    stage: { id, name: id, amount: 1000, sequence: 1, kind: 'order', shared: false },
    window: { id: `w-${id}`, job_id: 'job-1', fixture_id: id, window_start: start, window_end: end, window_by: 'office', asked_start: asked ? '2026-09-29' : null, asked_end: asked ? '2026-10-10' : null, asked_at: asked ? '2026-09-05T00:00:00Z' : null, answered_at: null },
    span: start && end ? { start, end } : null,
    board: null,
  })
  const group: SubsJobGroup = { key: 'job-1', jobId: 'job-1', jobNumber: '880', primary: '#880', secondary: null, rows: [stage('ahead', '2026-09-22', '2026-10-02', true), stage('passed', '2026-09-01', '2026-09-05'), stage('open', '2026-09-01', '2026-09-19'), stage('unset', null, null)], attention: 0, freeFixtures: [] }
  it('orders passed → open → ahead → no dates, flags open asks, and suggests re-dated spans for passed windows', () => {
    const q = buildStagesQueue([group], '2026-09-06')
    expect(q.rows.map((r) => r.phase)).toEqual(['passed', 'open', 'ahead', 'unset'])
    expect(q.totalUsd).toBe(4000)
    // Sep 1–5 2026 is Tue–Sat (4 weekdays); the next weekday after Sun Sep 6 is Mon Sep 7 → Thu Sep 10.
    expect(q.rows[0]!.suggestedSpan).toEqual({ start: '2026-09-07', end: '2026-09-10' })
    expect(q.rows[2]!.askOpen).toBe(true)
    expect(q.rows[1]!.askOpen).toBe(false)
  })
})

describe('buildOffersQueue', () => {
  it('lists sent offers, expired first, then the ones out longest, with days out and days left', () => {
    const sent = (key: string, sentAt: string, expiresOn: string, expired: boolean) => row({ key, group: 'sent', coverage: { kind: 'sent', id: key, subName: 'S', amount: 100, sentAt, expiresOn, expired } })
    const q = buildOffersQueue([sent('fresh', '2026-09-04', '2026-09-11', false), sent('old', '2026-08-28', '2026-09-04', true), row({ key: 'none' })], '2026-09-06')
    expect(q.rows.map((r) => r.row.key)).toEqual(['old', 'fresh'])
    expect(q.rows[0]).toMatchObject({ expired: true, daysOut: 9, daysLeft: -2 })
    expect(q.rows[1]).toMatchObject({ expired: false, daysOut: 2, daysLeft: 5 })
    expect(q.totalUsd).toBe(200)
    expect(q.expiredCount).toBe(1)
  })
})

describe('buildSignedQueue', () => {
  const signed = (key: string, signedOn: string, current: SheetRail['current'], open = 100) =>
    row({ key, group: 'signed', open, rail: rail(current, 'signed'), coverage: { kind: 'signed', id: key, subName: 'S', amount: 500, signedOn, laborJobId: null, recordId: `WO-880-${key}` } })
  it('reads the office move off the rail', () => {
    expect(signedNextKind(signed('a', '2026-09-01', 'work'))).toBe('wait_sub')
    expect(signedNextKind(signed('a', '2026-09-01', 'inspection'))).toBe('inspection')
    expect(signedNextKind(signed('a', '2026-09-01', 'customer_pays'))).toBe('bill')
    expect(signedNextKind(signed('a', '2026-09-01', 'paid', 50))).toBe('pay')
    expect(signedNextKind(signed('a', '2026-09-01', 'paid', 0))).toBe('done')
  })
  it('keeps the month, puts the office rows first, sums payable', () => {
    const board = [signed('sub', '2026-09-03', 'work'), signed('insp', '2026-09-04', 'inspection'), signed('pay', '2026-09-01', 'paid', 1000), signed('aug', '2026-08-20', 'work')]
    const q = buildSignedQueue(board, '2026-09')
    expect(q.rows.map((r) => r.row.key)).toEqual(['insp', 'pay', 'sub'])
    expect(q).toMatchObject({ totalUsd: 1500, payableUsd: 1000, officeCount: 2 })
    expect(signedCountForMonth(board, '2026-08')).toBe(1)
  })
  it('names and shifts months', () => {
    expect(monthName('2026-09')).toBe('September')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  })
})

describe('subAvailabilityForSpan', () => {
  const order = (id: string, personId: string, start: string, end: string, stageName: string | null = null): SubDispatchOrder => ({ id, personId, personName: 'P', jobId: 'j', jobLabel: '#273', status: 'accepted', pickedStart: start, pickedEnd: end, proposedStart: null, proposedEnd: null, windowStart: null, windowEnd: null, stageName, recordId: null })
  const span = { start: '2026-09-08', end: '2026-09-12' }
  it('is free when nothing touches the span', () => {
    const a = subAvailabilityForSpan('p-1', span, [order('o', 'p-1', '2026-09-15', '2026-09-16')], new Map())
    expect(a).toEqual({ busy: [], off: [] })
    expect(availabilityTone(a)).toBe('free')
    expect(availabilityLabel(a, (d) => d)).toBe('free those days')
  })
  it('names the other job when a pick overlaps, skipping the order being replaced', () => {
    const a = subAvailabilityForSpan('p-1', span, [order('o', 'p-1', '2026-09-10', '2026-09-11', 'Trim & final'), order('mine', 'p-1', '2026-09-08', '2026-09-09')], new Map(), 'mine')
    expect(a.busy).toEqual(['#273 · Trim & final'])
    expect(availabilityTone(a)).toBe('busy')
    expect(availabilityLabel(a, (d) => d)).toBe('on #273 · Trim & final')
  })
  it('reports days off inside the span, which win over busy', () => {
    const a = subAvailabilityForSpan('p-1', span, [order('o', 'p-1', '2026-09-10', '2026-09-11')], new Map([['p-1', ['2026-09-10', '2026-09-20']]]))
    expect(a.off).toEqual(['2026-09-10'])
    expect(availabilityTone(a)).toBe('off')
    expect(availabilityLabel(a, (d) => d.slice(5))).toBe('off 09-10')
  })
})
