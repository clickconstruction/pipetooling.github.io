/**
 * GC mode: the day a trade's approved draw is due (Taunya, 2026-11-21). A trade is paid after the customer pays us for
 * that work: `PAY_WITHIN_DAYS` after the customer pays the pay application the draw rode on. Until then the rule read
 * "within ten days of our approval", which promised a trade its money whether or not the customer had paid.
 *
 * A draw rides on the first pay application we sent the customer on or after the day we approved it: the work we
 * approved by then is the work that bill asks for. That reads what happened, so it needs no cut-off setting.
 *
 * A job whose bills to the customer are not kept one by one (`ownerBilling` null, or with no `payApps` list) has no
 * payment to count from, so its draws keep the day counted from approval.
 *
 * The retainage release keeps its own day (`tradeRetainageOpensOn`), which already waits on the customer.
 * Pure. `portal.ts`'s own `payByOf` is not drawn anywhere and still reads the day from approval.
 */
import { addDays } from './building'
import { ownerPayAppsSent } from './ownerBilling'
import { PAY_WITHIN_DAYS } from './portal'
import type { Draw, GcProject, OwnerPayAppSent } from './types'

/** What an approved draw with no pay-by day waits on: our bill to the customer, or the customer's payment of it. */
export type DrawWaitsOn = 'ourBill' | 'customer'

export interface DrawClock {
  /** The day to pay it by. Null: not approved, or the customer has not paid for it yet. */
  payBy: string | null
  /** Why an approved draw has no day yet. Null: it has one, or it is not approved. */
  waitsOn: DrawWaitsOn | null
  /** The customer's pay application it rides on, once that has gone. */
  ownerApp: OwnerPayAppSent | null
  /** The day is counted from our approval, because the job keeps no bills to count from. */
  fromApproval: boolean
}

const NO_CLOCK: DrawClock = { payBy: null, waitsOn: null, ownerApp: null, fromApproval: false }

/** The customer's pay application a draw approved that day rides on: the first one sent that day or later. Null: none has gone. */
export function ownerAppForDraw(project: GcProject, approvedOn: string): OwnerPayAppSent | null {
  return (
    ownerPayAppsSent(project)
      .filter((a) => a.final !== true && a.sentOn >= approvedOn)
      .sort((a, b) => a.sentOn.localeCompare(b.sentOn) || a.number - b.number)[0] ?? null
  )
}

/** A draw's pay-by day, or what it waits on. A retainage release is not read here: it keeps its own day. */
export function drawClock(project: GcProject, draw: Pick<Draw, 'status' | 'approvedOn'>): DrawClock {
  const approvedOn = draw.status === 'requested' ? null : (draw.approvedOn ?? null)
  if (!approvedOn) return NO_CLOCK
  if (!project.ownerBilling || project.ownerBilling.payApps === undefined) return { ...NO_CLOCK, payBy: addDays(approvedOn, PAY_WITHIN_DAYS), fromApproval: true }
  const ownerApp = ownerAppForDraw(project, approvedOn)
  if (!ownerApp) return { ...NO_CLOCK, waitsOn: 'ourBill' }
  if (!ownerApp.paidOn) return { ...NO_CLOCK, waitsOn: 'customer', ownerApp }
  return { payBy: addDays(ownerApp.paidOn, PAY_WITHIN_DAYS), waitsOn: null, ownerApp, fromApproval: false }
}

/** What an approved draw with no day yet reads as, after "approved" or the draw's name. */
export function drawDueWords(waitsOn: DrawWaitsOn): string {
  return waitsOn === 'customer' ? `due ${PAY_WITHIN_DAYS} days after the customer pays us` : `due ${PAY_WITHIN_DAYS} days after the customer pays our next bill`
}

/** The rule in one sentence, for the office. */
export const DRAW_PAY_RULE = `We pay an approved draw within ${PAY_WITHIN_DAYS} days after the customer pays us for it.`
