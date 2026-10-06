import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import type { GcState } from './gcTypes'
import { ownerPayApp } from './gcOwnerBilling'
import { cashAhead } from './gcOwnerBillingAhead'
import { planMove } from './gcScheduleMoves'
import {
  aboutMoney,
  billingByMonth,
  billingForecast,
  customerShiftWords,
  forecastPct,
  moveBillingShift,
  planBillingShift,
  shiftWords,
  weekBillingShift,
} from './gcBillingForecast'

/**
 * GC mode design spike: what we expect to bill each month as the schedule stands (the Gantt, G-97).
 * Played on the made-up job being built, Fair Oaks D, where today is Fri Oct 2: $1,488,762 to
 * Cibolo Creek Partners, $860,695 asked for so far, and pay application 4 the draft.
 */

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const round = (n: number) => Math.round(n)
const tpoMove = (s: GcState) => planMove(job(s), 'froof-1', '2026-09-21', '2026-10-14')!

describe('a bar by a bill day', () => {
  it('keeps what it reported, spreads the rest evenly to its finish, and is done on it', () => {
    // Not started: nothing until its start, then even over its days.
    expect(forecastPct('2026-10-19', '2026-10-30', 0, '2026-10-02', '2026-10-18')).toBe(0)
    expect(forecastPct('2026-10-19', '2026-10-30', 0, '2026-10-02', '2026-10-25')).toBeCloseTo((100 * 7) / 12)
    // Under way: what it reported counts through today; the rest starts tomorrow.
    expect(forecastPct('2026-09-14', '2026-10-23', 40, '2026-10-02', '2026-10-02')).toBe(40)
    expect(forecastPct('2026-09-14', '2026-10-23', 40, '2026-10-02', '2026-10-12')).toBeCloseTo(40 + (60 * 10) / 21)
    // On or after its finish, or past it already, or reported done: done.
    expect(forecastPct('2026-09-21', '2026-10-09', 50, '2026-10-02', '2026-10-09')).toBe(100)
    expect(forecastPct('2026-09-07', '2026-09-30', 80, '2026-10-02', '2026-10-25')).toBe(100)
    expect(forecastPct('2026-11-02', '2026-11-20', 100, '2026-10-02', '2026-10-25')).toBe(100)
  })
})

describe('Fair Oaks D, as the schedule stands', () => {
  const state = initialGcState()
  const f = billingForecast(state, job(state))

  it('bills Oct 25, Nov 25 and Dec 25, then what they hold with the final bill', () => {
    expect(f.none).toBeNull()
    expect(f.months.map((m) => [m.on, m.pct, round(m.bill)])).toEqual([
      ['2026-10-25', 92, 368744],
      ['2026-11-25', 97, 70405],
      ['2026-12-25', 100, 40043],
    ])
    expect(round(f.heldAtEnd)).toBe(148876)
    expect(f.unplaced).toBe(0)
  })

  it('starts on the draft’s bill day, and says what the draft asks today', () => {
    const draft = ownerPayApp(state, job(state))
    expect(f.months[0]?.on).toBe(draft.billOn)
    expect(round(f.draft.due)).toBe(98566)
  })

  it('comes to the price: asked so far, every month, and what they hold', () => {
    const draft = ownerPayApp(state, job(state))
    const total = draft.askedBefore + f.months.reduce((t, m) => t + m.bill, 0) + f.heldAtEnd
    expect(Math.abs(total - draft.contract)).toBeLessThan(1)
  })

  it('names the trades whose work each month bills, the most first, our costs and fee spread in', () => {
    expect(f.months[0]?.byTrade.slice(0, 3).map((t) => [t.label, round(t.amount)])).toEqual([
      ['Roofing', 122230],
      ['Electrical', 120519],
      ['HVAC', 114407],
    ])
    // Each month's trades add up to the work it bills: its work in place less the month before's.
    const billedBefore = ownerPayApp(state, job(state)).lines.reduce((t, l) => t + l.doneBefore, 0)
    const from = [billedBefore, ...f.months.map((m) => m.workToDate)]
    f.months.forEach((m, i) => expect(Math.abs(m.byTrade.reduce((t, x) => t + x.amount, 0) - (m.workToDate - (from[i] ?? 0)))).toBeLessThan(2))
  })

  it('leaves Owner Billing as it was: the draft and the cash weeks are the same after a forecast', () => {
    const fresh = initialGcState()
    const draftBefore = ownerPayApp(fresh, job(fresh))
    const cashBefore = cashAhead(fresh)
    billingForecast(fresh, job(fresh))
    billingByMonth(fresh)
    planBillingShift(fresh, job(fresh), tpoMove(fresh))
    expect(ownerPayApp(fresh, job(fresh))).toEqual(draftBefore)
    expect(cashAhead(fresh)).toEqual(cashBefore)
    expect(fresh).toEqual(initialGcState())
  })
})

describe('a move moves money', () => {
  it('says what a planned move does to the bills: Summit’s Oct 14 pushes the rooftop units past Oct 25', () => {
    const state = initialGcState()
    const shifts = planBillingShift(state, job(state), tpoMove(state))
    expect(shifts.map((s) => [s.on, round(s.delta)])).toEqual([
      ['2026-10-25', -6600],
      ['2026-11-25', 6600],
    ])
    expect(shiftWords(shifts, 'will')).toBe('$6,600 of the Oct 25 bill moves to Nov 25.')
    expect(shiftWords(shifts, 'did')).toBe('it moved $6,600 of the Oct 25 bill to Nov 25.')
    expect(customerShiftWords(shifts)).toBe('This week\'s schedule moves shifted about $6,600 from your Oct 25 bill to Nov 25.')
  })

  it('lists each bill when the money lands on more than one', () => {
    const state = initialGcState()
    const shifts = planBillingShift(state, job(state), planMove(job(state), 'fhvac-2', '2026-09-14', '2026-12-31')!)
    expect(shifts.length).toBeGreaterThan(2)
    expect(shiftWords(shifts, 'will')).toMatch(/^Oct 25 goes down \$[\d,]+\. /)
    expect(shiftWords(shifts, 'will')).toContain('Jan 25 goes up')
    expect(customerShiftWords(shifts)).toMatch(/^This week’s schedule moves changed your bills\. Oct 25 is about \$[\d,]+ less\./)
  })

  it('says nothing when a move moves no money', () => {
    const state = initialGcState()
    expect(planBillingShift(state, job(state), planMove(job(state), 'fairoaksd-insp-final', '2026-12-10', '2026-12-11')!)).toEqual([])
    expect(shiftWords([], 'will')).toBeNull()
    expect(customerShiftWords([])).toBeNull()
  })

  it('reads a saved move’s money by putting its dates back, until a later move overtakes it', () => {
    const state = initialGcState()
    const move = tpoMove(state)
    const saved = gcReducer(state, { type: 'setScheduleActivity', projectId: ID, lineId: 'froof-1', start: move.to.start, finish: move.to.finish, after: ['fsteel-2'], why: { reason: 'materials', note: 'The membrane ships Oct 12.', by: 'Robert' } })
    const m = job(saved).schedule!.moves![0]!
    expect(shiftWords(moveBillingShift(saved, job(saved), m) ?? [], 'did')).toBe('it moved $6,600 of the Oct 25 bill to Nov 25.')
    // The rooftop units moved again since: the old move's dates are not where it left them.
    const units = job(saved).schedule!.activities.find((a) => a.lineId === 'fhvac-1')!
    const later = gcReducer(saved, { type: 'setScheduleActivity', projectId: ID, lineId: 'fhvac-1', start: units.start, finish: '2026-10-30', after: units.after, why: { reason: 'crew', note: 'Cool Breeze is short a crew.', by: 'Robert' } })
    expect(moveBillingShift(later, job(later), job(later).schedule!.moves![1]!)).toBeNull()
    // Undone: nothing to read.
    const undone = gcReducer(saved, { type: 'undoScheduleMove', projectId: ID, moveId: m.id, by: 'Robert' })
    expect(moveBillingShift(undone, job(undone), job(undone).schedule!.moves![0]!)).toBeNull()
  })

  it('adds up this week’s moves for the customer, and forgets them a week on', () => {
    const state = initialGcState()
    const move = tpoMove(state)
    const saved = gcReducer(state, { type: 'setScheduleActivity', projectId: ID, lineId: 'froof-1', start: move.to.start, finish: move.to.finish, after: ['fsteel-2'], why: { reason: 'materials', note: 'The membrane ships Oct 12.', by: 'Robert' } })
    expect(customerShiftWords(weekBillingShift(saved, job(saved)))).toBe('This week\'s schedule moves shifted about $6,600 from your Oct 25 bill to Nov 25.')
    expect(weekBillingShift({ ...saved, today: '2026-10-10' }, job(saved))).toEqual([])
    expect(weekBillingShift(state, job(state))).toEqual([])
  })
})

describe('a signed change order, and the other jobs', () => {
  it('bills a signed change order’s work by the finish of the bar it lands on', () => {
    let state = gcReducer(initialGcState(), { type: 'draftChangeOrder', projectId: ID, description: 'A larger roof curb for RTU-2', reason: 'plans', schedule: '', packageId: 'froof', cost: 4_200, price: 0, days: 3 })
    state = gcReducer(state, { type: 'sendChangeOrder', projectId: ID, changeOrderId: 'co-1' })
    state = gcReducer(state, { type: 'ownerSignChangeOrder', projectId: ID, changeOrderId: 'co-1' })
    const f = billingForecast(state, job(state))
    const draft = ownerPayApp(state, job(state))
    expect(draft.changeOrdersTotal).toBeGreaterThan(0)
    expect(f.unplaced).toBe(0)
    expect(Math.abs(draft.askedBefore + f.months.reduce((t, m) => t + m.bill, 0) + f.heldAtEnd - draft.contract)).toBeLessThan(1)
    expect(f.months[0]?.byTrade.map((t) => t.label)).toContain('Change order 1')
  })

  it('says when the work is all billed, or there is no schedule to read', () => {
    const state = initialGcState()
    const stone = billingForecast(state, state.projects.find((p) => p.id === 'stoneoak')!)
    expect(stone.none).toBe('allBilled')
    expect(round(stone.heldAtEnd)).toBe(18241)
    expect(billingForecast(state, state.projects.find((p) => p.id === 'helotes')!).none).toBe('noSchedule')
  })

  it('adds the months up across every job that is ours', () => {
    const state = initialGcState()
    const all = billingByMonth(state)
    expect(all.months.map((m) => [m.on, round(m.total), m.jobs.map((j) => j.project.id)])).toEqual([
      ['2026-10-25', 368744, [ID]],
      ['2026-11-25', 70405, [ID]],
      ['2026-12-25', 40043, [ID]],
    ])
    // Fair Oaks D's $148,876 and Stone Oak's $18,241, held until the final bills.
    expect(round(all.heldAtEnd)).toBe(167118)
    expect(all.noSchedule.map((p) => p.id)).toEqual(['helotes'])
    expect(all.unplaced).toEqual([])
  })

  it('rounds a forecast to the hundred for the customer', () => {
    expect(aboutMoney(368744)).toBe('about $368,700')
    expect(aboutMoney(148876)).toBe('about $148,900')
  })
})
