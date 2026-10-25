/**
 * The Collect desk, PR F (v2.5857): the cash forecast's receipt for one bill,
 * read from the Collect desk's pile instead of the company-median model. The
 * expected day is the bill's, by its payer's own pace, the GC pace here, the
 * segment's or the company's, or the promise's day; the words name the source
 * so the receipts band says why it expects the money then. Pure.
 */
import type { ReceiptBasis } from '../cashForecast'
import type { CollectBillRead } from './collectPile'

export type CollectReceiptRead = {
  expectedYmd: string
  /** The words beside the receipt: "pays in ~35d", "the GC pace here ~30d", "promised". */
  source: string
  basis: ReceiptBasis
  /** The pace the expected day rests on; null on a promise. */
  paceDays: number | null
}

/** The receipt for a pile bill; null when the bill has no day to read, so the caller falls back. */
export function collectReceiptFor(bill: CollectBillRead): CollectReceiptRead | null {
  if (!bill.expectedYmd) return null
  if (bill.promise) return { expectedYmd: bill.expectedYmd, source: 'promised', basis: 'promised', paceDays: null }
  const n = bill.paceDays ?? 0
  switch (bill.paceSource) {
    case 'own':
      return { expectedYmd: bill.expectedYmd, source: `pays in ~${n}d`, basis: 'customer', paceDays: n }
    case 'gc':
      return { expectedYmd: bill.expectedYmd, source: `the GC pace here ~${n}d`, basis: 'company', paceDays: n }
    case 'segment':
      return { expectedYmd: bill.expectedYmd, source: `${bill.isGc ? 'commercial' : 'their segment’s'} pace ~${n}d`, basis: 'company', paceDays: n }
    case 'company':
      return { expectedYmd: bill.expectedYmd, source: `company pace ~${n}d`, basis: 'company', paceDays: n }
    default:
      return null
  }
}
