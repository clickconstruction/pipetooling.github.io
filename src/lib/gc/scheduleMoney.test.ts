/**
 * The money team's own state on the Schedule (the schedule's PR 16c, ./scheduleMoney.ts): the chart's read with the full
 * change orders, the trades' money and the customer's bills laid over it, so every dollar reads it and never the chart's.
 */
import { describe, expect, it } from 'vitest'
import { scheduleMoneyState, type ScheduleMoney } from './scheduleMoney'
import type { OwnerTermsRow } from './billCustomer'
import type { ChangeOrderRow } from './changeOrderRows'
import { NO_DRAWS } from './drawRows'
import { withOfficeChangeOrders } from './changeOrderOfficeRows'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

const terms = (over: Partial<OwnerTermsRow> = {}): OwnerTermsRow => ({
  project_id: 'fairoaksd', owner_retainage_pct: 10, owner_retainage_step_at_pct: null, owner_retainage_step_to_pct: null, owner_retainage_step_way: null,
  owner_pay_days: null, owner_late_interest_pct_per_month: null, owner_late_finish_per_day: null, billing_job_id: null, property_owner_customer_id: null, ...over,
})
const fullOrder: ChangeOrderRow = {
  id: 'co-1', project_id: 'fairoaksd', number: 1, description: 'Thicker slab at grid C', reason: 'plans', schedule_words: 'Two more days on the slab.',
  package_id: 'fconc', cost: 500, price: 550, status: 'signed', sent_on: '2026-09-24', answered_on: '2026-09-26', answered_how: 'office', pct_done: 40, days: 2,
  days_on_chart: null, plan_set_id: null, created_by: null, created_at: '2026-09-24T00:00:00Z',
} as ChangeOrderRow
const money = (over: Partial<ScheduleMoney> = {}): ScheduleMoney => ({
  bills: { terms: [terms({ owner_late_finish_per_day: 500 })], contract: [], billing: new Map(), names: {}, payDays: {} },
  changeOrders: [fullOrder],
  draws: NO_DRAWS,
  ...over,
})
/** The chart's read: the board with the change orders through the office's view, their money hidden. */
function chart(): GcState {
  return withOfficeChangeOrders(initialGcState(), [
    { id: 'co-1', project_id: 'fairoaksd', number: 1, description: 'Thicker slab at grid C', reason: 'plans', schedule_words: '', package_id: 'fconc', status: 'signed', sent_on: '2026-09-24', answered_on: '2026-09-26', days: 2, days_on_chart: null },
  ])
}
const fairOaks = (s: GcState) => s.projects.find((p) => p.id === 'fairoaksd')!

describe('scheduleMoneyState (the schedule’s PR 16c)', () => {
  it('puts the full change orders in place of the view’s, so their money is real on the money team’s state', () => {
    const before = chart()
    expect(fairOaks(before).changeOrders?.[0]?.price).toBe(0)
    const s = scheduleMoneyState(before, 'fairoaksd', money())
    expect(fairOaks(s).changeOrders?.map((c) => [c.number, c.price, c.cost, c.pctDone])).toEqual([[1, 550, 500, 40]])
  })

  it('lays the customer’s bills, so the late fee a day is there for the money team’s lines', () => {
    const s = scheduleMoneyState(chart(), 'fairoaksd', money())
    expect(fairOaks(s).ownerLateFinish?.perDay).toBe(500)
  })

  it('never touches the chart’s own state: the money lives only on the state it returns', () => {
    const before = chart()
    scheduleMoneyState(before, 'fairoaksd', money())
    expect(fairOaks(before).changeOrders?.[0]?.price).toBe(0)
    expect(fairOaks(before).ownerLateFinish?.perDay ?? null).toBeNull()
  })

  it('keeps what the chart read beside the money: its schedule and its daily logs', () => {
    const before = chart()
    const s = scheduleMoneyState(before, 'fairoaksd', money())
    expect(fairOaks(s).schedule).toBe(fairOaks(before).schedule)
    expect(fairOaks(s).dailyLogs).toBe(fairOaks(before).dailyLogs)
  })
})
