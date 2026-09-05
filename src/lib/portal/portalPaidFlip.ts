/**
 * "Did a bill get paid between two looks at the statement?" — the portal's
 * after-payment beat (journey-map J22-F3 / Tier-2 #38). The customer pays on
 * Stripe's hosted page (a new tab) and comes back; the page refetches and,
 * when a bill it showed before is gone (or smaller) and the balance dropped,
 * says "Payment received — statement updated". Pure; no writes.
 *
 * Snapshots persist in localStorage (shared across the customer's tabs on
 * this origin) so a receipt-footer landing in a fresh tab can still compare
 * against what the statement showed before the payment.
 */

export type PortalSnapshotBill = { key: string; amount: number }
export type PortalBillsSnapshot = { bills: PortalSnapshotBill[]; totalDue: number }

type BillLike = { payUrl: string | null; jobLabel: string; billedOn: string | null; amount: number }

/** Stable identity for a bill row: the Stripe pay URL when it has one, else job + billed date. */
export function portalBillKey(b: BillLike): string {
  const pay = (b.payUrl ?? '').trim()
  return pay ? `pay:${pay}` : `job:${b.jobLabel}|${b.billedOn ?? ''}`
}

export function snapshotPortalBills(payload: { bills: ReadonlyArray<BillLike>; totalDue: number }): PortalBillsSnapshot {
  return {
    bills: payload.bills.map((b) => ({ key: portalBillKey(b), amount: b.amount })),
    totalDue: payload.totalDue,
  }
}

export function parsePortalBillsSnapshot(raw: unknown): PortalBillsSnapshot | null {
  if (raw == null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.bills) || typeof r.totalDue !== 'number' || !Number.isFinite(r.totalDue)) return null
  const bills: PortalSnapshotBill[] = []
  for (const b of r.bills) {
    if (b == null || typeof b !== 'object') return null
    const { key, amount } = b as Record<string, unknown>
    if (typeof key !== 'string' || typeof amount !== 'number' || !Number.isFinite(amount)) return null
    bills.push({ key, amount })
  }
  return { bills, totalDue: r.totalDue }
}

/**
 * True when money landed between `before` and `after`: the balance dropped
 * AND at least one bill from `before` is gone or carries a smaller amount.
 * No `before` (first look), no bills before, or a balance that did not drop
 * (a new bill appeared, a void, identical loads) → false. Never claims a
 * payment it cannot see.
 */
export function paidFlipDetected(before: PortalBillsSnapshot | null | undefined, after: PortalBillsSnapshot): boolean {
  if (!before || before.bills.length === 0) return false
  if (!(after.totalDue < before.totalDue - 0.005)) return false
  const afterByKey = new Map(after.bills.map((b) => [b.key, b.amount]))
  return before.bills.some((b) => {
    const now = afterByKey.get(b.key)
    return now === undefined || now < b.amount - 0.005
  })
}

export function portalSnapshotStorageKey(tokenOrSlug: string): string {
  return `pt-portal-snapshot:${tokenOrSlug}`
}
