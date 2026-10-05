import { describe, expect, it } from 'vitest'
import { blockersPress, procurementNextLine, procurementSteps, rowsForStep, sendUpdateLabel, sharedHouse, stepOfRow, stepOnlyWords, stepShares } from './procurementBoard'
import { orderBlockers, type ProcurementRow, type ProcurementStatus } from './procurementLog'

const row = (key: string, status: ProcurementStatus, p: Partial<ProcurementRow> = {}): ProcurementRow => ({
  key, tag: key, isHand: false, recordId: null, product: key, supplyHouse: 'National Wholesale', stage: 'trim_set', submittal: 'open', submittalAt: null, releasedOn: null, orderedOn: null, poRef: '', leadTimeDays: null,
  expectedOn: null, expectedSource: null, requiredOn: null, floatDays: null, orderBy: null, deliveredOn: null, note: '', status, late: false, countedWith: [], itemId: `it-${key}`, ...p,
})

/**
 * BP375 SPACEX BA-02N as the to-do's page holds it (`RAW`): 47 lines, one house. Read on
 * 2026-10-05, five parts were sent back, three carriers were on site and 39 waited.
 */
const IDS = 'm1 m2 m3 m4 m5 m6 m7 d1 d2 e1 e2 e3 e4 e5 e6 e7 fco fd hb a1 a2 a3 a4 a5 a6 a7 a8 b1 b2 b3 b4 b5 b6 b7 b8 u1 u2 u3 ut w1 w2 w3 w4 w5 h2 h3 h5'.split(' ')
const BACK = new Set(['m2', 'a2', 'b1', 'b2', 'w2'])
const CARRIERS = new Set(['e7', 'u3', 'w5'])
const today = IDS.map((id) =>
  CARRIERS.has(id) ? row(id, 'delivered', { isHand: true, itemId: null, supplyHouse: null, orderedOn: '2026-09-23', deliveredOn: '2026-09-29' }) : BACK.has(id) ? row(id, 'sent_back', { submittal: 'rejected' }) : row(id, id === 'ut' ? 'not_submitted' : 'awaiting'),
)

/** The page's made-up three weeks on (`LATER`), read on 10/26: approvals, three POs, lead times and stage dates. */
const ready = (orderBy: string, lead: number): Partial<ProcurementRow> => ({ submittal: 'approved', releasedOn: '2026-10-22', requiredOn: '2026-12-08', orderBy, leadTimeDays: lead })
const LATER: Record<string, [ProcurementStatus, Partial<ProcurementRow>]> = {
  fco: ['delivered', { orderedOn: '2026-10-06', deliveredOn: '2026-10-15', poRef: '4471' }],
  fd: ['delivered', { orderedOn: '2026-10-06', deliveredOn: '2026-10-15', poRef: '4471' }],
  w4: ['ordered', { orderedOn: '2026-10-08', expectedOn: '2026-10-29', requiredOn: '2026-10-20', floatDays: -9, late: true, poRef: '4480' }],
  ...Object.fromEntries(['h2', 'h3', 'h5'].map((id) => [id, ['ordered', { orderedOn: '2026-10-20', expectedOn: '2026-11-03', requiredOn: '2026-11-10', floatDays: 7, poRef: '4502' }]])),
  ...Object.fromEntries(['d1', 'd2'].map((id) => [id, ['released', ready('2026-11-10', 28)]])),
  ...Object.fromEntries(['m1', 'm3', 'm4', 'm5', 'm6', 'm7'].map((id) => [id, ['released', ready('2026-10-27', 42)]])),
  hb: ['released', ready('2026-11-24', 14)],
  ...Object.fromEntries(['e1', 'e2'].map((id) => [id, ['released', ready('2026-11-03', 35)]])),
  ...Object.fromEntries(['e3', 'e4', 'e5', 'e6'].map((id) => [id, ['released', { noGc: true, requiredOn: '2026-12-08', orderBy: '2026-12-01', leadTimeDays: 7 }]])),
  a2: ['awaiting', { leadTimeDays: 28 }],
  b2: ['awaiting', { leadTimeDays: 28 }],
}
const later = today.map((r) => (LATER[r.key] ? row(r.key, LATER[r.key]![0], LATER[r.key]![1]) : r))

describe('procurementSteps', () => {
  it('today: 44 wait on the GC with 5 sent back, nothing to order or on order, 3 on site; every line is counted once', () => {
    const steps = procurementSteps(today)
    expect(steps.map((s) => [s.label, s.count, s.note, s.tone])).toEqual([
      ['Waiting on the GC', 44, '5 sent back', 'back'],
      ['To order', 0, 'nothing approved yet', 'quiet'],
      ['On order', 0, '', 'quiet'],
      ['On site', 3, 'last 09/29', 'quiet'],
    ])
    expect(steps.reduce((n, s) => n + s.count, 0)).toBe(today.length)
  })

  it('three weeks on: 23 · 15 · 4 · 5, the first order by 10/27, one late on order, the last on site 10/15', () => {
    expect(procurementSteps(later).map((s) => [s.count, s.note, s.tone])).toEqual([
      [23, '3 sent back', 'back'],
      [15, 'first by 10/27', 'go'],
      [4, '1 late', 'late'],
      [5, 'last 10/15', 'quiet'],
    ])
  })

  it('a delivered part is on site only, though it holds an order date; on order with nothing late says the next arrival', () => {
    expect(stepOfRow(row('x', 'delivered', { orderedOn: '2026-10-06', deliveredOn: '2026-10-15' }))).toBe('on_site')
    expect(procurementSteps(later.filter((r) => r.key !== 'w4'))[2]).toMatchObject({ count: 3, note: 'next arrives 11/03', tone: 'quiet' })
    // Approved parts with no order-by date yet: counted, with nothing to say under the number.
    expect(procurementSteps([row('a', 'released')])[1]).toMatchObject({ count: 1, note: '', tone: 'quiet' })
  })

  it('a step shows only its lines, says so, and takes its share of the bar', () => {
    expect(rowsForStep(today, 'on_site').map((r) => r.key)).toEqual(['e7', 'u3', 'w5'])
    expect(rowsForStep(today, null)).toHaveLength(47)
    expect(stepOnlyWords('gc', 44)).toEqual({ lead: 'Waiting on the GC: 44 parts.', rest: 'The other lines are hidden.' })
    expect(stepOnlyWords('on_order', 1).lead).toBe('On order: 1 part.')
    expect(stepShares(procurementSteps(today)).map((s) => s.key)).toEqual(['gc', 'on_site'])
    expect(Math.round(stepShares(procurementSteps(today)).reduce((n, s) => n + s.percent, 0))).toBe(100)
    expect(stepShares(procurementSteps([]))).toEqual([])
  })
})

describe('procurementNextLine', () => {
  it('nothing to order: the GC holds it, with what they sent back and what still waits', () => {
    expect(procurementNextLine(today, '2026-10-05')).toEqual(['Nothing can be ordered until the GC answers.', 'They sent 5 parts back.', '39 more wait on their answer.'])
    expect(procurementNextLine([row('a', 'awaiting')], '2026-10-05')).toEqual(['Nothing can be ordered until the GC answers.', '1 part waits on their answer.'])
    expect(procurementNextLine([row('a', 'sent_back'), row('b', 'awaiting')], '2026-10-05')).toEqual(['Nothing can be ordered until the GC answers.', 'They sent 1 part back.', '1 more waits on their answer.'])
  })

  it('something to order: how many by the first date and how soon, then the late, then the sent back', () => {
    expect(procurementNextLine(later, '2026-10-26')).toEqual(['Order 6 parts by 10/27, tomorrow.', '1 part on order arrives late.', 'The GC sent 3 parts back.'])
    expect(procurementNextLine(later, '2026-10-27')[0]).toBe('Order 6 parts by 10/27, today.')
    expect(procurementNextLine(later, '2026-10-30')[0]).toBe('Order 6 parts by 10/27, 3 days ago.')
    expect(procurementNextLine(later, '2026-10-12')[0]).toBe('Order 6 parts by 10/27.')
    expect(procurementNextLine([row('a', 'released'), row('b', 'released')], '2026-10-26')).toEqual(['2 parts are approved and not ordered.'])
  })

  it('nothing held and nothing to order: what is on order, or that it is all on site; an empty log says nothing', () => {
    expect(procurementNextLine([row('a', 'ordered'), row('b', 'delivered')], '2026-10-26')).toEqual(['Nothing is left to order. 1 part is on order.'])
    expect(procurementNextLine([row('a', 'ordered', { late: true })], '2026-10-26')).toEqual(['Nothing is left to order. 1 part is on order.', '1 part on order arrives late.'])
    expect(procurementNextLine([row('b', 'delivered')], '2026-10-26')).toEqual(['Every part is on site.'])
    expect(procurementNextLine([], '2026-10-26')).toEqual([])
  })
})

describe('what the lines share', () => {
  it('the missing facts press only when a part that can be ordered lacks a lead time or a stage', () => {
    expect(blockersPress(today, orderBlockers(today))).toBe(false)
    expect(blockersPress(later, orderBlockers(later))).toBe(false)
    const one = [...later, row('z', 'released', { stage: null, leadTimeDays: 7 })]
    expect(blockersPress(one, orderBlockers(one))).toBe(true)
  })

  it('one house is said once; two houses, or a line with none, are not', () => {
    expect(sharedHouse(today)).toBe('National Wholesale')
    expect(sharedHouse([...today, row('z', 'awaiting', { supplyHouse: 'Moore Supply' })])).toBeNull()
    expect(sharedHouse([...today, row('z', 'awaiting', { supplyHouse: null })])).toBeNull()
    expect(sharedHouse([])).toBeNull()
  })

  it('the send button carries the count only after an update has gone', () => {
    expect(sendUpdateLabel(false, 47)).toBe('Send update…')
    expect(sendUpdateLabel(true, 0)).toBe('Send update…')
    expect(sendUpdateLabel(true, 14)).toBe('Send update · 14 changes')
    expect(sendUpdateLabel(true, 1)).toBe('Send update · 1 change')
  })
})
