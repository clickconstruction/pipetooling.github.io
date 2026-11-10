/**
 * A month's credit (punch list #301, PR 3): the answers the window offers, the suggested one first, with no amount
 * offered twice. "No credit this month" is always an answer, since a month with the whole bill paid is settled, not
 * forgotten; it leads when the bank says the whole bill was paid.
 */
import { addMonths, money2, monthOf, suggestedCredit, type InKindMonth } from './inKindLedger'
import { suggestionWhyWords, usd } from './inKindWords'

export type MonthChoiceKey = 'suggested' | 'usual' | 'whole' | 'none' | 'other'
export interface MonthChoice {
  key: MonthChoiceKey
  amount: number
  title: string
  why: string
  /** The bank's own reading led to this one. */
  fromBank: boolean
}

export function monthChoices(args: {
  monthlyAmount: number
  monthlyDue: number | null
  bankPaid: number | null
  left: number
  /** The month is not over. An empty bank says nothing yet, so the usual credit leads. */
  early?: boolean
}): MonthChoice[] {
  const { monthlyAmount, monthlyDue, left, early = false } = args
  const bankPaid = early && (args.bankPaid ?? 0) <= 0.005 ? null : args.bankPaid
  const s = suggestedCredit({ monthly_amount: monthlyAmount, monthly_due: monthlyDue }, bankPaid, left)
  const cap = (n: number) => money2(Math.max(0, Math.min(n, left)))
  const out: MonthChoice[] = []
  const seen = new Set<number>()
  const fromBank = s.why !== 'usual'
  if (s.amount > 0.005) {
    out.push({ key: 'suggested', amount: s.amount, title: usd(s.amount), why: suggestionWhyWords(s.why, bankPaid, monthlyDue), fromBank })
    seen.add(s.amount)
  }
  const usual = cap(monthlyAmount)
  if (usual > 0.005 && !seen.has(usual)) {
    out.push({ key: 'usual', amount: usual, title: usd(usual), why: 'The usual credit.', fromBank: false })
    seen.add(usual)
  }
  const whole = monthlyDue != null ? cap(monthlyDue) : 0
  if (whole > 0.005 && !seen.has(whole)) {
    out.push({ key: 'whole', amount: whole, title: usd(whole), why: early ? 'We pay nothing this month.' : 'We paid nothing that month.', fromBank: false })
    seen.add(whole)
  }
  const none: MonthChoice = { key: 'none', amount: 0, title: 'No credit this month', why: 'We paid the whole bill. The month is marked settled.', fromBank: s.why === 'bank_all' }
  if (none.fromBank) out.unshift(none)
  else out.push(none)
  out.push({ key: 'other', amount: 0, title: 'Another amount', why: '', fromBank: false })
  return out
}

/** The month the next credit falls in: this month, or the one after when this month already has its line. */
export function nextCreditMonth(months: readonly InKindMonth[], todayYmd: string): string {
  const thisMonth = monthOf(todayYmd)
  return months.some((m) => m.month === thisMonth && m.line) ? addMonths(thisMonth, 1) : thisMonth
}

/** A month that has not ended. Its credit can be entered ahead of the bank. */
export const monthNotOver = (month: string, todayYmd: string): boolean => month >= monthOf(todayYmd)
