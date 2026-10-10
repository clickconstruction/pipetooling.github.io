/**
 * GC mode, the real build, the schedule's PR 16c: the money team's own state on the Schedule, apart from the chart's
 * (to-dos/gc-mode/mockups/schedule-pr16.md on branch spike/gc-mode, call 3). The chart reads change orders through the
 * office's view with their money hidden; the money team's lines read this instead: the chart's read with the full change
 * orders, the trades' money and the customer's bills laid over it. The late fee's dollars, what a way to get days back
 * saves and the billing line under a pull or a days-back move read it, never the chart's state.
 */
import { billingStateFor, type BillingRows } from './billCustomer'
import { withChangeOrders, type ChangeOrderRow } from './changeOrderRows'
import { withDraws, withTradeChanges, type DrawTables } from './drawRows'
import type { GcState } from './types'

/** What the money team's lines read beside the chart: the customer's bills, the full change orders and the trades' money. */
export interface ScheduleMoney {
  bills: BillingRows
  changeOrders: ChangeOrderRow[]
  draws: DrawTables
}

/** The chart's state with the money laid over it, the full change orders in place of the view's. */
export function scheduleMoneyState(state: GcState, projectId: string, money: ScheduleMoney): GcState {
  return billingStateFor(withTradeChanges(withChangeOrders(withDraws(state, money.draws), money.changeOrders), money.draws), projectId, money.bills)
}
