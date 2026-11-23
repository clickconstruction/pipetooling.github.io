import type { PortalScheduledBill } from './portalPayload'

/**
 * The words of the customer page's "Scheduled in kind" card (v2.8314, punch list #301; the owner's call
 * of 2026-11-22). *Scheduled in kind* is the office's own name for such a bill, so a call about it uses
 * one name on both ends. Drawn by `src/components/portal/PortalScheduledBillsCard.tsx`.
 */
export const SCHEDULED_BILLS_WORDS = {
  eyebrow: 'Scheduled in kind',
  why: 'Our arrangement with you pays these bills, not money. They are not in your balance, and there is nothing to pay here.',
  foot: 'Scheduled in kind · not in your balance',
} as const

/** What is still to come in kind across the bills, in dollars. */
export function scheduledBillsTotal(bills: readonly Pick<PortalScheduledBill, 'amount'>[]): number {
  return Math.round(bills.reduce((s, b) => s + b.amount, 0) * 100) / 100
}

/** The card's top line: "2 bills · $1,200.00 to come". */
export function scheduledBillsSummary(bills: readonly Pick<PortalScheduledBill, 'amount'>[], formatUsd: (n: number) => string): string {
  return `${bills.length} ${bills.length === 1 ? 'bill' : 'bills'} · ${formatUsd(scheduledBillsTotal(bills))} to come`
}
