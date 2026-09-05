import type { SubPortalSheet } from './subPortalPayload'

/**
 * Which dot of the portal's four-dot rail is lit (v2.2767 / v2.2854):
 *
 *   0 Work · 1 Walk-through · 2 Customer pays · 3 You're paid
 *
 * The first three follow the stored stage. The fourth lights when a sheet at
 * Waiting on customer carries a payable-after date — the office has promised
 * a pay run, so the last thing between the sub and the money is the calendar,
 * not the customer. A payable-after date on an earlier stage (a progress
 * payment promised mid-job) never jumps the rail ahead of the work.
 */
export type SubPortalRailStep = 0 | 1 | 2 | 3

export function isSubPortalSheetQueued(sheet: Pick<SubPortalSheet, 'stage' | 'payableAfter'>): boolean {
  return sheet.stage === 'customer_pay' && (sheet.payableAfter ?? '').trim() !== ''
}

export function subPortalRailStep(sheet: Pick<SubPortalSheet, 'stage' | 'payableAfter'>): SubPortalRailStep {
  if (isSubPortalSheetQueued(sheet)) return 3
  switch (sheet.stage) {
    case 'walkthrough':
      return 1
    case 'customer_pay':
      return 2
    default:
      return 0
  }
}
