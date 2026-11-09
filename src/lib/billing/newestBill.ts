/**
 * The job's newest billed bill with its amount (v2.6771, punch list #291): what the Tell the customer sheet reads on a
 * Pipeline move to Billed, so the Billed line's `{amount}` and `{bill}` both fill. The same rows and the same order as
 * `newestBillLink` (`billLink.ts`, v2.5628), with the amount beside the link; a bill billed outside Stripe has no pay
 * page and is passed over, as `newestBillLink` passes it over. Pure; the read is `newestBillIo.ts`.
 */
import { billedNewestFirst, newestBillLink, type BillForLink } from './billLink'

export interface NewestBill {
  id: string
  /** "$1,850.00" */
  amount: string
  /** The bill's pay page. */
  link: string
}

/** A bill's dollars as the sheet's line reads them: always two decimals, so "$1,850.00" and never "$1,850". */
export function billDollars(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** The newest billed bill that has a pay page, with its amount; null with none. */
export function newestBill<T extends BillForLink & { amount: number | null }>(bills: readonly T[]): NewestBill | null {
  const link = newestBillLink(bills)
  if (!link) return null
  const bill = billedNewestFirst(bills).find((b) => link.endsWith(`/${b.id}`))
  if (!bill) return null
  return { id: bill.id, amount: billDollars(bill.amount ?? 0), link }
}
