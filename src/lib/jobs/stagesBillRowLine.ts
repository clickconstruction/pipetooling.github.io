/**
 * The "This bill" line on a Pipeline bill row (v2.4349, progress bar pass 4).
 *
 * A job with two or more sent bills draws one row per bill, and every one of
 * those rows prints the whole job's money legend. Before this, the only thing a
 * row said about its own bill was its original amount, labelled "draft" — so
 * Springtown's Sep 1 bill read "$11,770 draft · 25d past" while $11,182 of it
 * was paid and $588 was left. This line says what is paid and what is left on
 * the row's own bill: *This bill · $11,182 paid* … *$588 left*.
 *
 * A payment counts against a bill only when it is linked to it
 * (`payments.invoice_id`), the same rule the section totals and the legend's
 * Billed row use. Pure.
 */
import { openRemainder, isSettledRemainder } from '../billing/billTruth'
import { formatUsdNoCents } from './jobFormatting'
import { formatYmdMonthDay } from './billedExpectedPay'

export type StagesBillRowLine = {
  /** "$11,182 paid" · "nothing paid". */
  paid: string
  /** "$588 left" · "nothing left". */
  left: string
  /** The hover: the bill's amount, its send day when known, what is paid and what is left. */
  title: string
  /** Dollars still open on the bill. */
  openUsd: number
}

export function stagesBillRowLine(input: { amount: number | string | null | undefined; applied: number; billedYmd?: string | null }): StagesBillRowLine {
  const amount = Math.max(0, Number(input.amount ?? 0) || 0)
  const applied = Math.max(0, input.applied || 0)
  const open = openRemainder(amount, applied)
  const paid = isSettledRemainder(applied) ? 'nothing paid' : `${formatUsdNoCents(applied)} paid`
  const left = isSettledRemainder(open) ? 'nothing left' : `${formatUsdNoCents(open)} left`
  const sent = input.billedYmd ? ` sent ${formatYmdMonthDay(input.billedYmd)}` : ''
  const title = `This row's bill: ${formatUsdNoCents(amount)}${sent}. ${isSettledRemainder(applied) ? 'Nothing is paid on it yet' : `${formatUsdNoCents(applied)} is paid on it`}, ${isSettledRemainder(open) ? 'and nothing is left' : `and ${formatUsdNoCents(open)} is left`}.`
  return { paid, left, title, openUsd: open }
}
