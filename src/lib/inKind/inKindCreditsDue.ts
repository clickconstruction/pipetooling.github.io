/**
 * One place for work paid in kind (punch list #301, PR 3): the months that have no credit entered, across every open
 * monthly deal. The Needs you line reads this. A month is due once it is over, or once its bill has left the bank.
 * Nothing here writes: the line opens the month's window, and a person presses.
 */
import { monthsWithBank, type BankPaidLine } from './inKindBank'
import { dueMonths, inKindTotals, money2, suggestedCredit, type InKindArrangement, type InKindJob, type InKindLine } from './inKindLedger'

export interface InKindCreditDue {
  arrangementId: string
  customerId: string | null
  partner: string
  /** YYYY-MM-01 */
  month: string
  /** The credit the window will suggest. */
  amount: number
}

export interface InKindCreditsDue {
  /** Oldest month first. */
  due: InKindCreditDue[]
  total: number
}

export interface InKindDealForDue {
  arrangement: InKindArrangement
  lines: InKindLine[]
  jobs: InKindJob[]
  /** The bank's lines to the deal's payee; null or absent when the bank was not read. */
  bank?: BankPaidLine[] | null
}

export function inKindCreditsDue(deals: readonly InKindDealForDue[], todayYmd: string): InKindCreditsDue {
  const due: InKindCreditDue[] = []
  for (const d of deals) {
    const a = d.arrangement
    if (a.ended_at) continue
    let left = inKindTotals(d.jobs, d.lines, []).left
    for (const m of dueMonths(monthsWithBank(a, d.lines, d.bank, todayYmd))) {
      const amount = suggestedCredit(a, m.bankPaid, left).amount
      left = money2(Math.max(0, left - amount))
      due.push({ arrangementId: a.id, customerId: a.customer_id, partner: a.partner_name || 'A customer', month: m.month, amount })
    }
  }
  due.sort((x, y) => x.month.localeCompare(y.month) || x.partner.localeCompare(y.partner))
  return { due, total: money2(due.reduce((s, x) => s + x.amount, 0)) }
}

/** Fired on the window when a deal or a line changes, so the Needs you line reads again. */
export const IN_KIND_CHANGED_EVENT = 'in-kind-changed'
