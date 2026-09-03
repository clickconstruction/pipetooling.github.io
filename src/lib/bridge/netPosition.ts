import { ymdAddDays } from '../../utils/dateUtils'

/**
 * Net position kernel (v2.2726) — the Bridge's black line.
 *
 * Net position = cash + owed to you (collections excluded) − owed by you.
 * Today's level is the real number; history is reconstructed backwards from
 * the dated flows the app already records:
 *   cash(t)  = cash(today) − Σ bank flows after t
 *   AR(t)    = AR(today)   − Σ invoices sent after t + Σ payments received after t
 *   AP(t)    = AP(today)   − Σ supply invoices dated after t + Σ supply invoices paid after t
 * Payroll and sub-labor payables are carried flat in history (they turn over
 * weekly); the page says so.
 *
 * Pure: no React, no Supabase.
 */

export type NetPositionDay = { ymd: string; offset: number; cashUsd: number; arUsd: number; apUsd: number; netUsd: number }

const num = (v: number | null | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** Roll a typed cash figure forward from its as-of day to today using the bank flows in between. */
export function cashTodayFromAsOf(input: {
  cashAsOfUsd: number
  asOfYmd: string
  todayYmd: string
  /** Signed net bank flow per day (deposits positive, payments negative). */
  bankFlowByDay: ReadonlyMap<string, number>
}): number {
  if (input.asOfYmd >= input.todayYmd) return input.cashAsOfUsd
  let cash = input.cashAsOfUsd
  for (let d = ymdAddDays(input.asOfYmd, 1); d <= input.todayYmd; d = ymdAddDays(d, 1)) cash += num(input.bankFlowByDay.get(d))
  return cash
}

export function buildNetPositionHistory(input: {
  todayYmd: string
  daysBack: number
  cashTodayUsd: number
  arTodayUsd: number
  apTodayUsd: number
  bankFlowByDay: ReadonlyMap<string, number>
  invoicesSentByDay: ReadonlyMap<string, number>
  paymentsReceivedByDay: ReadonlyMap<string, number>
  supplyDatedByDay: ReadonlyMap<string, number>
  supplyPaidByDay: ReadonlyMap<string, number>
}): NetPositionDay[] {
  const out: NetPositionDay[] = []
  let cash = input.cashTodayUsd
  let ar = input.arTodayUsd
  let ap = input.apTodayUsd
  // Walk backwards: the value on day t is the value on t+1 minus t+1's flows.
  const days: NetPositionDay[] = [{ ymd: input.todayYmd, offset: 0, cashUsd: cash, arUsd: ar, apUsd: ap, netUsd: cash + ar - ap }]
  for (let o = 1; o <= input.daysBack; o++) {
    const nextYmd = ymdAddDays(input.todayYmd, -(o - 1))
    cash -= num(input.bankFlowByDay.get(nextYmd))
    ar = ar - num(input.invoicesSentByDay.get(nextYmd)) + num(input.paymentsReceivedByDay.get(nextYmd))
    ap = ap - num(input.supplyDatedByDay.get(nextYmd)) + num(input.supplyPaidByDay.get(nextYmd))
    const ymd = ymdAddDays(input.todayYmd, -o)
    days.push({ ymd, offset: -o, cashUsd: cash, arUsd: ar, apUsd: ap, netUsd: cash + ar - ap })
  }
  out.push(...days.reverse())
  return out
}
