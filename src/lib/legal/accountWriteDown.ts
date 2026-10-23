/**
 * The account-level write-down (v2.5760): "How much will we accept?" for the whole account, split across
 * its open bills in proportion to what each still owes, to the cent (largest remainder). Each bill is then
 * written down by the same per-bill path the Apply discount window uses: its new total is what was paid on it
 * plus its share of what we accept.
 */

import { legalJobMoney, type LegalPacket } from './legalPacket'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

export type AccountJob = Parameters<typeof legalJobMoney>[0]

export type AccountBill = {
  jobId: string
  jobLabel: string
  invoiceId: string
  /** The bill's current billed amount. */
  billed: number
  /** The day the bill went out, `YYYY-MM-DD`, or null. Tells two bills on one job apart. */
  billedOn: string | null
  /** Payments linked to this bill. */
  paid: number
  /** billed − paid, never below 0. */
  open: number
  stripeHosted: boolean
}

export type AccountBillShare = AccountBill & {
  /** What we accept on this bill, of its open amount. */
  accept: number
  /** open − accept. */
  forgive: number
  /** paid + accept: the bill's new total, the write-down's input. */
  newTotal: number
}

export type AccountWriteDownPlan = {
  open: number
  accept: number
  forgive: number
  shares: AccountBillShare[]
  /** The bills that change (a share with something forgiven). */
  writes: AccountBillShare[]
}

const cents = (n: number) => Math.round(n * 100)

/** The account's open bills, as the packet counts them (`legalJobMoney`): the billed lines and what each still needs. */
export function accountBills(jobs: ReadonlyArray<AccountJob>, lines: ReadonlyArray<Pick<LegalPacket['account']['jobs'][number], 'jobId' | 'label'>>): AccountBill[] {
  const label = new Map(lines.map((l) => [l.jobId, l.label] as const))
  return jobs.flatMap((j) => {
    const money = legalJobMoney(j)
    return [...money.openByInvoice.entries()].map(([invoiceId, open]) => {
      const inv = (j.invoices ?? []).find((i) => i.id === invoiceId)
      const billed = Number(inv?.amount ?? 0)
      const openC = Math.max(0, cents(open))
      return {
        jobId: j.id,
        jobLabel: label.get(j.id) ?? '—',
        invoiceId,
        billed,
        billedOn: inv?.billed_at ? calendarYmdInAppTzFromIso(inv.billed_at) || null : null,
        paid: Math.max(0, cents(billed) - openC) / 100,
        open: openC / 100,
        stripeHosted: Boolean((inv?.stripe_invoice_id ?? '').trim() && (inv?.hosted_invoice_url ?? '').trim()),
      }
    })
  })
}

export function planAccountWriteDown(bills: ReadonlyArray<AccountBill>, acceptDollars: number): AccountWriteDownPlan {
  const live = bills.filter((b) => cents(b.open) > 0)
  const openC = live.reduce((s, b) => s + cents(b.open), 0)
  const acceptC = Math.min(openC, Math.max(0, cents(Number.isFinite(acceptDollars) ? acceptDollars : 0)))
  // Each bill's exact share in cents, floored; the leftover cents go to the largest remainders (ties: larger bill first).
  const parts = live.map((b, i) => { const exact = openC > 0 ? (acceptC * cents(b.open)) / openC : 0; return { i, b, exact, floor: Math.floor(exact) } })
  let left = acceptC - parts.reduce((s, p) => s + p.floor, 0)
  for (const p of [...parts].sort((x, y) => y.exact - y.floor - (x.exact - x.floor) || cents(y.b.open) - cents(x.b.open))) {
    if (left <= 0) break
    p.floor += 1
    left -= 1
  }
  const shares = parts.map(({ b, floor }): AccountBillShare => {
    const acceptB = Math.min(cents(b.open), floor)
    return { ...b, accept: acceptB / 100, forgive: (cents(b.open) - acceptB) / 100, newTotal: (cents(b.paid) + acceptB) / 100 }
  })
  return { open: openC / 100, accept: acceptC / 100, forgive: (openC - acceptC) / 100, shares, writes: shares.filter((s) => cents(s.forgive) > 0) }
}

/** The row's name for a bill: the job alone when it has one bill; with its billed amount and day when it has more. */
export function billRowWords(bill: Pick<AccountBill, 'jobLabel' | 'billed' | 'billedOn'>, siblings: number, money: (n: number) => string): { job: string; bill: string | null } {
  if (siblings < 2) return { job: bill.jobLabel, bill: null }
  const day = bill.billedOn ? `${bill.billedOn.slice(5, 7)}/${bill.billedOn.slice(8, 10)}/${bill.billedOn.slice(2, 4)}` : null
  return { job: bill.jobLabel, bill: `${money(bill.billed)} bill${day ? `, ${day}` : ''}` }
}

/** The Save button's words: exactly what it will do. */
export function writeDownButtonWords(plan: AccountWriteDownPlan, money: (n: number) => string): string {
  const n = plan.writes.length
  if (n === 0) return 'Nothing to write down'
  return `Write down ${money(plan.forgive)} across ${n} bill${n === 1 ? '' : 's'}`
}

/** The line after a run: what went and what was held, with the reason (do what is ready, list the rest). */
export function writeDownResultWords(done: number, held: ReadonlyArray<{ jobLabel: string; reason: string }>): string {
  const went = done === 0 ? 'No bill was written down.' : `Wrote down ${done} bill${done === 1 ? '' : 's'}.`
  if (held.length === 0) return went
  return `${went} Held ${held.length}: ${held.map((h) => `job ${h.jobLabel}, ${h.reason}`).join('; ')}.`
}
